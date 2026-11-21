import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRanking } from '../src/lib/ranking'
import type {
  AAModel,
  AAFile,
  MetaFile,
  ModelsFile,
  OpenCodeModel,
  Plan,
  RankingFile,
} from '../src/types'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = path.join(ROOT, 'public', 'data')
const MAPPINGS_PATH = path.join(ROOT, 'mappings.json')
const OPENCODE_URL = 'https://opencode.ai/inference/go/v1/models'
const AA_URL = 'https://artificialanalysis.ai/api/v2/language/models/free'
const PLANS: Plan[] = ['go', 'go_plus']

/* ---------- Tipos das APIs ---------- */

interface RawPrice {
  price?: number
  cache?: { read?: number; write?: number | Record<string, number> }
  overrides?: unknown[]
}

interface RawOpenCodeModel {
  id: string
  name: string
  canonical_id?: string
  description?: string
  family?: string
  open_weights?: boolean
  limit?: { context?: number; output?: number }
  cost?: {
    text?: { input?: RawPrice; output?: RawPrice }
    multipliers?: unknown[]
  }
  go?: {
    monthly_usage?: { go?: number | null; 'go-plus'?: number | null } | null
    training?: boolean
    limited_regions?: boolean
  }
}

interface RawAaModel {
  slug: string
  name: string
  model_creator?: { name?: string | null } | null
  evaluations?: Record<string, number | null>
  artificial_analysis_intelligence_index_cost?: {
    cost_per_task?: { total_cost?: number | null }
  }
  pricing?: {
    price_1m_input_tokens?: number | null
    price_1m_output_tokens?: number | null
    price_1m_cache_hit_tokens?: number | null
  }
}

interface RawAaResponse {
  intelligence_index_version?: number | string | null
  pagination?: { page?: number; has_more?: boolean }
  data?: RawAaModel[]
}

interface MappingsFile {
  models: Record<string, string[]>
}

interface Match {
  aa: RawAaModel
  via: string
}

/* ---------- Helpers ---------- */

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeName(value: string): string {
  return normalizeSlug(value.replace(/\([^)]*\)/g, ' '))
}

async function fetchJson(
  url: string,
  headers: Record<string, string> = {},
  retries = 2,
): Promise<unknown> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(url, { headers })
      if (!response.ok) {
        const body = (await response.text()).slice(0, 300)
        throw new Error(`HTTP ${response.status} em ${url}: ${body}`)
      }
      return (await response.json()) as unknown
    } catch (error) {
      if (attempt >= retries) throw error
      console.warn(`  falha na tentativa ${attempt + 1}, tentando novamente…`)
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
    }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath)
    return true
  } catch {
    return false
  }
}

async function writeJson(fileName: string, value: unknown): Promise<void> {
  await writeFile(path.join(DATA_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

/* ---------- Transformação do catálogo OpenCode ---------- */

function toModel(raw: RawOpenCodeModel): OpenCodeModel {
  const input = raw.cost?.text?.input
  const output = raw.cost?.text?.output
  const cacheWriteRaw = input?.cache?.write
  const monthlyRaw = raw.go?.monthly_usage ?? null

  const monthly = monthlyRaw
    ? {
        go: typeof monthlyRaw.go === 'number' ? monthlyRaw.go : null,
        go_plus: typeof monthlyRaw['go-plus'] === 'number' ? monthlyRaw['go-plus'] : null,
      }
    : null

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    family: raw.family ?? null,
    open_weights: Boolean(raw.open_weights),
    context: raw.limit?.context ?? null,
    max_output: raw.limit?.output ?? null,
    prices: {
      input: input?.price ?? 0,
      output: output?.price ?? 0,
      cache_read: input?.cache?.read ?? 0,
      cache_write: typeof cacheWriteRaw === 'number' ? cacheWriteRaw : null,
    },
    monthly_usage: monthly,
    training: Boolean(raw.go?.training),
    limited_regions: Boolean(raw.go?.limited_regions),
    free: monthly === null,
    has_pricing_complexity: Boolean(
      raw.cost?.multipliers?.length ||
        input?.overrides?.length ||
        output?.overrides?.length ||
        (cacheWriteRaw !== null && typeof cacheWriteRaw === 'object'),
    ),
  }
}

/* ---------- Correspondência com a Artificial Analysis ---------- */

function hasIntelligenceIndex(aa: RawAaModel): boolean {
  return aa.evaluations?.artificial_analysis_intelligence_index != null
}

function matchAaModels(
  models: OpenCodeModel[],
  aaModels: RawAaModel[],
  mappings: MappingsFile,
): Map<string, Match> {
  const bySlug = new Map<string, RawAaModel>()
  const byName = new Map<string, RawAaModel[]>()

  for (const aa of aaModels) {
    const slugKey = normalizeSlug(aa.slug)
    if (!bySlug.has(slugKey)) bySlug.set(slugKey, aa)

    const nameKey = normalizeName(aa.name)
    const list = byName.get(nameKey)
    if (list) list.push(aa)
    else byName.set(nameKey, [aa])
  }

  const result = new Map<string, Match>()

  for (const model of models) {
    let found: Match | null = null

    // 1) Mapeamentos explícitos são autoritativos: o primeiro slug existente vence.
    //    Isso evita casar com variantes antigas/sem índice da mesma família.
    for (const candidate of mappings.models[model.id] ?? []) {
      const aa = bySlug.get(normalizeSlug(candidate))
      if (aa) {
        found = { aa, via: candidate }
        break
      }
    }

    // 2) Sem mapeamento: tenta id e nome, preferindo variantes com índice avaliado.
    if (!found) {
      const direct = bySlug.get(normalizeSlug(model.id))
      const named = byName.get(normalizeName(model.name)) ?? []
      const pool = new Map<string, RawAaModel>()
      if (direct) pool.set(direct.slug, direct)
      for (const aa of named) pool.set(aa.slug, aa)

      const candidates = [...pool.values()]
      const chosen = candidates.find(hasIntelligenceIndex) ?? candidates[0]
      if (chosen) found = { aa: chosen, via: model.id }
    }

    if (found) result.set(model.id, found)
  }

  return result
}

/* ---------- Estruturas vazias (bootstrap sem chave da AA) ---------- */

function emptyRanking(generatedAt: string): RankingFile {
  const emptyView = { coding: [], general: [] }
  return {
    generated_at: generatedAt,
    intelligence_index_version: null,
    plans: { go: emptyView, go_plus: emptyView },
    excluded: { coding: [], general: [] },
  }
}

/* ---------- Main ---------- */

async function main(): Promise<void> {
  const skipAa = process.argv.includes('--skip-aa')
  const generatedAt = new Date().toISOString()

  console.log('→ Buscando catálogo do OpenCode Go…')
  const opencodeRaw = (await fetchJson(OPENCODE_URL)) as { data?: RawOpenCodeModel[] }
  const models = (opencodeRaw.data ?? []).map(toModel)

  if (models.length === 0) {
    throw new Error('O endpoint do OpenCode não retornou modelos.')
  }

  await mkdir(DATA_DIR, { recursive: true })
  console.log(`  ${models.length} modelos no catálogo.`)

  if (skipAa) {
    await writeJson('models.json', { generated_at: generatedAt, models } satisfies ModelsFile)
    if (!(await fileExists(path.join(DATA_DIR, 'aa.json')))) {
      await writeJson('aa.json', {
        generated_at: generatedAt,
        intelligence_index_version: null,
        models: [],
      } satisfies AAFile)
    }
    if (!(await fileExists(path.join(DATA_DIR, 'ranking.json')))) {
      await writeJson('ranking.json', emptyRanking(generatedAt))
    }
    console.log('  --skip-aa: ranking e dados da AA não foram atualizados.')
    return
  }

  const apiKey = process.env.AA_API_KEY
  if (!apiKey) {
    throw new Error(
      'AA_API_KEY não definida. Crie uma chave gratuita em artificialanalysis.ai e rode com a variável configurada (ou use --skip-aa para atualizar só o catálogo).',
    )
  }

  console.log('→ Buscando modelos na Artificial Analysis…')
  const aaModels: RawAaModel[] = []
  let intelligenceIndexVersion: string | null = null
  let page = 1

  for (;;) {
    const response = (await fetchJson(`${AA_URL}?page=${page}`, {
      'x-api-key': apiKey,
    })) as RawAaResponse

    aaModels.push(...(response.data ?? []))
    if (response.intelligence_index_version !== undefined && intelligenceIndexVersion === null) {
      intelligenceIndexVersion = String(response.intelligence_index_version)
    }

    if (!response.pagination?.has_more) break
    page += 1
    if (page > 20) throw new Error('Paginação da AA excedeu 20 páginas; abortando.')
  }

  if (aaModels.length === 0) {
    throw new Error('A API da Artificial Analysis não retornou modelos.')
  }
  console.log(`  ${aaModels.length} modelos na AA.`)

  const mappings = JSON.parse(await readFile(MAPPINGS_PATH, 'utf8')) as MappingsFile
  const matches = matchAaModels(models, aaModels, mappings)

  const aaById = new Map<string, AAModel>()
  for (const model of models) {
    const match = matches.get(model.id)
    if (!match) continue

    const { aa } = match
    aaById.set(model.id, {
      opencode_id: model.id,
      slug: aa.slug,
      name: aa.name,
      creator: aa.model_creator?.name ?? null,
      intelligence_index:
        aa.evaluations?.artificial_analysis_intelligence_index ?? null,
      engineering_index:
        aa.evaluations?.artificial_analysis_engineering_index ?? null,
      cost_per_task: aa.artificial_analysis_intelligence_index_cost?.cost_per_task?.total_cost ?? null,
      prices: {
        input: aa.pricing?.price_1m_input_tokens ?? null,
        output: aa.pricing?.price_1m_output_tokens ?? null,
        cache_read: aa.pricing?.price_1m_cache_hit_tokens ?? null,
      },
    })
  }

  const unmatched = models.filter((model) => !matches.has(model.id))
  if (unmatched.length > 0) {
    console.warn(`  ${unmatched.length} modelos sem correspondência na AA:`)
    for (const model of unmatched) console.warn(`    - ${model.id} (${model.name})`)
  }

  const ranking: RankingFile = {
    generated_at: generatedAt,
    intelligence_index_version: intelligenceIndexVersion,
    plans: {
      go: { coding: [], general: [] },
      go_plus: { coding: [], general: [] },
    },
    excluded: { coding: [], general: [] },
  }

  for (const plan of PLANS) {
    ranking.plans[plan].coding = buildRanking(models, aaById, plan, 'engineering_index').entries
    ranking.plans[plan].general = buildRanking(models, aaById, plan, 'intelligence_index').entries
  }

  ranking.excluded.coding = buildRanking(models, aaById, 'go', 'engineering_index').excluded
  ranking.excluded.general = buildRanking(models, aaById, 'go', 'intelligence_index').excluded

  const meta: MetaFile = {
    generated_at: generatedAt,
    aa_intelligence_index_version: intelligenceIndexVersion,
    counts: {
      opencode_models: models.length,
      matched: aaById.size,
      ranked_coding: ranking.plans.go.coding.length,
      ranked_general: ranking.plans.go.general.length,
    },
  }

  // Só grava depois de todas as coletas e cálculos terem dado certo.
  await writeJson('models.json', { generated_at: generatedAt, models } satisfies ModelsFile)
  await writeJson('aa.json', {
    generated_at: generatedAt,
    intelligence_index_version: intelligenceIndexVersion,
    models: [...aaById.values()],
  } satisfies AAFile)
  await writeJson('ranking.json', ranking)
  await writeJson('meta.json', meta)

  console.log('→ Ranking gerado:')
  console.log(
    `  plano Go: ${meta.counts.ranked_coding} em programação · ${meta.counts.ranked_general} no geral`,
  )
  console.log(
    `  plano Go Plus: ${ranking.plans.go_plus.coding.length} em programação · ${ranking.plans.go_plus.general.length} no geral`,
  )
  console.log('  Arquivos gravados em public/data/.')
}

main().catch((error: unknown) => {
  console.error('✖ Atualização abortada — nenhum dado foi sobrescrito.')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
