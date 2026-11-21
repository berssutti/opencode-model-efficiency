const usd = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const usdSmall = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  maximumSignificantDigits: 3,
})

const integers = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
})

const compact = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value !== 0 && Math.abs(value) < 0.01) return usdSmall.format(value)
  return usd.format(value)
}

export function formatPct(fraction: number, digits = 2): string {
  if (!Number.isFinite(fraction)) return '—'
  const percent = fraction * 100
  if (percent > 0 && percent < 0.01) return '<0,01%'
  return `${percent.toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`
}

export function formatTasks(value: number): string {
  if (!Number.isFinite(value)) return '∞'
  if (value >= 100_000) return compact.format(value)
  return integers.format(value)
}

export function formatTokens(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return integers.format(value)
}

export function formatLimit(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return formatUsd(value)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })
}
