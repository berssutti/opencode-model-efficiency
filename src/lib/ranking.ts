import type { AAModel, ExcludedModel, OpenCodeModel, Plan, RankedModel } from '../types'
import { adjustmentFactor, efficiencyScore, normalizeScore } from './calc'

export type RankingIndexKey = 'intelligence_index' | 'engineering_index'

export interface RankingResult {
  entries: RankedModel[]
  excluded: ExcludedModel[]
}

const round = (value: number, digits: number) => Number(value.toFixed(digits))

/**
 * Monta o ranking de um plano para um índice. Puro: recebe o catálogo do OpenCode
 * e os dados já normalizados da Artificial Analysis, devolve entradas e exclusões.
 */
export function buildRanking(
  models: OpenCodeModel[],
  aaById: Map<string, AAModel>,
  plan: Plan,
  indexKey: RankingIndexKey,
): RankingResult {
  const entries: RankedModel[] = []
  const excluded: ExcludedModel[] = []

  for (const model of models) {
    if (model.monthly_usage === null) {
      excluded.push({
        id: model.id,
        name: model.name,
        reason: 'modelo gratuito — não consome franquia',
      })
      continue
    }

    const limit = model.monthly_usage[plan]
    if (limit === null || limit <= 0) {
      excluded.push({
        id: model.id,
        name: model.name,
        reason: 'sem limite de franquia neste plano',
      })
      continue
    }

    const aa = aaById.get(model.id)
    if (!aa) {
      excluded.push({
        id: model.id,
        name: model.name,
        reason: 'sem correspondência na Artificial Analysis',
      })
      continue
    }

    const index = aa[indexKey]
    if (index === null) {
      excluded.push({
        id: model.id,
        name: model.name,
        reason:
          indexKey === 'engineering_index'
            ? 'sem Engineering Index na Artificial Analysis'
            : 'sem Intelligence Index na Artificial Analysis',
      })
      continue
    }

    const costAa = aa.cost_per_task
    if (costAa === null || costAa <= 0) {
      excluded.push({
        id: model.id,
        name: model.name,
        reason: 'sem custo por tarefa na Artificial Analysis',
      })
      continue
    }

    let factor = 1
    if (
      aa.prices.input !== null &&
      aa.prices.output !== null &&
      (aa.prices.input > 0 || aa.prices.output > 0)
    ) {
      factor = adjustmentFactor(model.prices, {
        input: aa.prices.input,
        output: aa.prices.output,
      })
    }

    const costOpenCode = round(costAa * factor, 6)
    const rawScore = efficiencyScore(index, costOpenCode, limit)

    if (!(rawScore > 0)) {
      excluded.push({
        id: model.id,
        name: model.name,
        reason: 'dados insuficientes para calcular o score',
      })
      continue
    }

    entries.push({
      id: model.id,
      name: model.name,
      score: 0,
      raw_score: rawScore,
      index,
      cost_per_task_aa: costAa,
      cost_per_task_opencode: costOpenCode,
      adjustment_factor: round(factor, 4),
      monthly_limit: limit,
      franchise_pct_per_task: round(costOpenCode / limit, 8),
    })
  }

  entries.sort((a, b) => b.raw_score - a.raw_score)
  const best = entries[0]?.raw_score ?? 0
  for (const entry of entries) {
    entry.score = round(normalizeScore(entry.raw_score, best), 1)
    entry.raw_score = round(entry.raw_score, 4)
  }

  return { entries, excluded }
}
