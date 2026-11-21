export type Plan = 'go' | 'go_plus'

export const PLAN_LABELS: Record<Plan, string> = {
  go: 'Go',
  go_plus: 'Go Plus',
}

export interface TokenPrices {
  input: number
  output: number
  cache_read: number
  cache_write: number | null
}

export interface PriceOverride {
  context_gt: number
  input: number | null
  output: number | null
  cache_read: number | null
}

export interface OpenCodeModel {
  id: string
  name: string
  description: string
  family: string | null
  open_weights: boolean
  context: number | null
  max_output: number | null
  prices: TokenPrices
  price_overrides: PriceOverride[]
  monthly_usage: { go: number | null; go_plus: number | null } | null
  training: boolean
  limited_regions: boolean
  free: boolean
  has_pricing_complexity: boolean
}

export interface ModelsFile {
  generated_at: string
  models: OpenCodeModel[]
}

export interface AAModel {
  opencode_id: string
  slug: string
  name: string
  creator: string | null
  intelligence_index: number | null
  engineering_index: number | null
  cost_per_task: number | null
  prices: { input: number | null; output: number | null; cache_read: number | null }
}

export interface AAFile {
  generated_at: string
  intelligence_index_version: string | null
  models: AAModel[]
}

export interface RankedModel {
  id: string
  name: string
  score: number
  raw_score: number
  index: number
  cost_per_task_aa: number
  cost_per_task_opencode: number
  adjustment_factor: number
  monthly_limit: number
  franchise_pct_per_task: number
  training: boolean
  limited_regions: boolean
}

export interface ExcludedModel {
  id: string
  name: string
  reason: string
}

export type RankingViewKey = 'coding' | 'general'

export interface RankingFile {
  generated_at: string
  intelligence_index_version: string | null
  plans: Record<Plan, Record<RankingViewKey, RankedModel[]>>
  excluded: Record<Plan, Record<RankingViewKey, ExcludedModel[]>>
}

export interface MetaFile {
  generated_at: string
  aa_intelligence_index_version: string | null
  counts: {
    opencode_models: number
    matched: number
    ranked_coding: number
    ranked_general: number
    aa_models?: number
    unmatched?: number
  }
}
