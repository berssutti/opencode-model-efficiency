import assert from 'node:assert/strict'
import { buildRanking } from '../src/lib/ranking'
import type { AAModel, OpenCodeModel } from '../src/types'

function model(overrides: Partial<OpenCodeModel> & Pick<OpenCodeModel, 'id' | 'name'>): OpenCodeModel {
  return {
    description: '',
    family: null,
    open_weights: true,
    context: 1_000_000,
    max_output: 128_000,
    prices: { input: 1, output: 2, cache_read: 0.1, cache_write: null },
    price_overrides: [],
    monthly_usage: { go: 100, go_plus: 200 },
    training: false,
    limited_regions: false,
    free: false,
    has_pricing_complexity: false,
    ...overrides,
  }
}

function aa(overrides: Partial<AAModel> & Pick<AAModel, 'opencode_id'>): AAModel {
  return {
    slug: overrides.opencode_id,
    name: overrides.opencode_id,
    creator: 'Test',
    intelligence_index: 50,
    engineering_index: 50,
    cost_per_task: 1,
    prices: { input: 1, output: 2, cache_read: 0.1 },
    ...overrides,
  }
}

const models: OpenCodeModel[] = [
  model({ id: 'a', name: 'A' }),
  model({ id: 'b', name: 'B' }),
  model({ id: 'sem-eng', name: 'Sem Engineering' }),
  model({ id: 'free', name: 'Grátis', monthly_usage: null, free: true }),
  model({ id: 'sem-aa', name: 'Sem AA' }),
]

const aaById = new Map<string, AAModel>([
  ['a', aa({ opencode_id: 'a', cost_per_task: 2, intelligence_index: 50, engineering_index: 40 })],
  ['b', aa({ opencode_id: 'b', cost_per_task: 1, intelligence_index: 40, engineering_index: 30 })],
  ['sem-eng', aa({ opencode_id: 'sem-eng', engineering_index: null })],
  ['promo', aa({ opencode_id: 'promo', cost_per_task: 2, intelligence_index: 50 })],
])

// Programação (Engineering)
const coding = buildRanking(models, aaById, 'go', 'engineering_index')
const codingA = coding.entries.find((entry) => entry.id === 'a')
const codingB = coding.entries.find((entry) => entry.id === 'b')

assert.ok(codingA && codingB, 'A e B deveriam estar no ranking')
assert.equal(codingA.raw_score, 2000) // 40 × 100 / 2
assert.equal(codingB.raw_score, 3000) // 30 × 100 / 1
assert.equal(codingB.score, 100, 'melhor score normalizado = 100')
assert.ok(
  Math.abs(codingA.score - Number(((2000 / 3000) * 100).toFixed(1))) < 1e-9,
  'score de A normalizado',
)
assert.ok(!coding.entries.some((entry) => entry.id === 'sem-eng'), 'sem Engineering fica fora')
assert.ok(coding.excluded.some((entry) => entry.id === 'sem-eng'))
assert.ok(coding.excluded.some((entry) => entry.id === 'free'))
assert.ok(coding.excluded.some((entry) => entry.id === 'sem-aa'))

// Promoção: preços do OpenCode pela metade → fator 0.5 → custo cai pela metade
const promoModel = model({
  id: 'promo',
  name: 'Promo',
  prices: { input: 0.5, output: 1, cache_read: 0.05, cache_write: null },
})
const promoRanking = buildRanking([promoModel], aaById, 'go', 'engineering_index')
const promo = promoRanking.entries[0]
assert.ok(promo)
assert.equal(promo.adjustment_factor, 0.5)
assert.equal(promo.cost_per_task_opencode, 1)
assert.equal(promo.raw_score, 5000)
assert.equal(promo.score, 100)

// Geral (Intelligence)
const general = buildRanking(models, aaById, 'go', 'intelligence_index')
assert.ok(general.entries.some((entry) => entry.id === 'sem-eng'), 'sem Engineering entra no geral')
assert.equal(general.entries.length, 3)

// Go Plus com limite diferente
const plusModels = [model({ id: 'a', name: 'A', monthly_usage: { go: 100, go_plus: 400 } })]
const plus = buildRanking(plusModels, aaById, 'go_plus', 'engineering_index')
assert.equal(plus.entries[0].raw_score, 8000) // 40 × 400 / 2

console.log('✓ test:ranking — todos os casos passaram')
