import type { TokenPrices } from '../types'

/**
 * Custo em dólares de um request de acordo com os preços por 1M de tokens.
 * O percentual de cache se aplica apenas aos tokens de entrada.
 */
export function requestCost(
  tokensIn: number,
  tokensOut: number,
  cachePercent: number,
  prices: Pick<TokenPrices, 'input' | 'output' | 'cache_read'>,
): number {
  const cacheShare = Math.min(100, Math.max(0, cachePercent)) / 100
  const cachedTokens = tokensIn * cacheShare
  const freshTokens = tokensIn - cachedTokens
  return (
    (freshTokens * prices.input + cachedTokens * prices.cache_read + tokensOut * prices.output) /
    1_000_000
  )
}

/** Fração (0-1) da franquia mensal consumida por um custo. */
export function franchiseShare(cost: number, monthlyLimit: number): number {
  if (!(monthlyLimit > 0) || !(cost >= 0)) return Number.NaN
  return cost / monthlyLimit
}

/** Quantidade de tarefas iguais a essa que cabem na franquia mensal. */
export function tasksCovered(monthlyLimit: number, costPerTask: number): number {
  if (!(monthlyLimit > 0)) return Number.NaN
  if (!(costPerTask > 0)) return Number.POSITIVE_INFINITY
  return monthlyLimit / costPerTask
}

/**
 * Score bruto de eficiência de franquia:
 * índice de inteligência dividido pela fração de franquia consumida por tarefa.
 */
export function efficiencyScore(index: number, costPerTask: number, monthlyLimit: number): number {
  if (!(index > 0) || !(costPerTask > 0) || !(monthlyLimit > 0)) return 0
  return index * (monthlyLimit / costPerTask)
}

/** Normaliza o score para que o melhor modelo da visão seja 100. */
export function normalizeScore(rawScore: number, bestRawScore: number): number {
  if (!(bestRawScore > 0) || !(rawScore > 0)) return 0
  return Math.min(100, (rawScore / bestRawScore) * 100)
}

/** Preço composto usado para comparar preços OpenCode x preço de tabela da AA (3:1 in:out). */
export function blendedPrice(prices: Pick<TokenPrices, 'input' | 'output'>): number {
  return (3 * prices.input + prices.output) / 4
}

/**
 * Fator de ajuste entre o custo por tarefa publicado pela AA (preços de tabela)
 * e os preços praticados pelo OpenCode no momento. 1 = preços iguais.
 */
export function adjustmentFactor(
  opencode: Pick<TokenPrices, 'input' | 'output'>,
  reference: Pick<TokenPrices, 'input' | 'output'>,
): number {
  const referenceBlend = blendedPrice(reference)
  const opencodeBlend = blendedPrice(opencode)
  if (!(referenceBlend > 0) || !Number.isFinite(opencodeBlend) || opencodeBlend < 0) return 1
  return opencodeBlend / referenceBlend
}
