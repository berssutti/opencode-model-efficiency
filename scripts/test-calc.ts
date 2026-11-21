import assert from 'node:assert/strict'
import {
  activePriceOverride,
  adjustmentFactor,
  efficiencyScore,
  franchiseShare,
  normalizeScore,
  pricesForContext,
  requestCost,
  tasksCovered,
} from '../src/lib/calc'

function approx(actual: number, expected: number, epsilon = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `esperado ${expected}, recebido ${actual}`,
  )
}

// Custo de request
approx(requestCost(1_000_000, 0, 0, { input: 1, output: 9, cache_read: 0.1 }), 1)
approx(requestCost(0, 1_000_000, 0, { input: 1, output: 3, cache_read: 0.1 }), 3)
approx(requestCost(1_000_000, 0, 100, { input: 2, output: 4, cache_read: 0.2 }), 0.2)
approx(requestCost(1_000_000, 1_000_000, 50, { input: 2, output: 4, cache_read: 0.5 }), 5.25)
approx(requestCost(1_000_000, 0, -50, { input: 1, output: 1, cache_read: 0 }), 1)
approx(requestCost(1_000_000, 0, 250, { input: 1, output: 1, cache_read: 0.1 }), 0.1)

// Franquia
approx(franchiseShare(1.5, 15), 0.1)
approx(franchiseShare(6, 60), 0.1)
assert.ok(Number.isNaN(franchiseShare(1, 0)))
approx(tasksCovered(15, 1.5), 10)

// Score
approx(efficiencyScore(40, 0.5, 60), 4800)
approx(normalizeScore(2400, 4800), 50)
approx(normalizeScore(0, 4800), 0)

// Ajuste de preços
approx(adjustmentFactor({ input: 1, output: 2 }, { input: 1, output: 2 }), 1)
approx(adjustmentFactor({ input: 0.5, output: 1 }, { input: 1, output: 2 }), 0.5)
approx(adjustmentFactor({ input: 1, output: 2 }, { input: 0, output: 0 }), 1)

// Overrides por tamanho de contexto
const basePrices = { input: 1, output: 2, cache_read: 0.1 }
const overrides = [
  { context_gt: 100_000, input: 2, output: 4, cache_read: 0.2 },
  { context_gt: 200_000, input: 4, output: 8, cache_read: 0.4 },
]
approx(pricesForContext(basePrices, overrides, 50_000).input, 1)
approx(pricesForContext(basePrices, overrides, 150_000).input, 2)
approx(pricesForContext(basePrices, overrides, 150_000).output, 4)
approx(pricesForContext(basePrices, overrides, 250_000).input, 4)
approx(pricesForContext(basePrices, overrides, 250_000).cache_read, 0.4)
assert.equal(activePriceOverride(overrides, 50_000), null)
assert.equal(activePriceOverride(overrides, 150_000)?.context_gt, 100_000)
assert.equal(activePriceOverride(overrides, 250_000)?.context_gt, 200_000)

console.log('✓ test:calc — todos os casos passaram')
