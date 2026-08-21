import type { DailyBar } from '@/api/types'

/** A 股：涨红跌绿 */
export function priceColor(value: number, ref: number): string {
  if (value > ref) return '#f5222d'
  if (value < ref) return '#52c41a'
  return '#595959'
}

export function formatDateLabel(date: string, compact = false): string {
  const d = date.replace(/-/g, '')
  return compact ? d : `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}`
}

/** 成交量副图纵轴：大数用科学计数法，避免标签过长 */
export function formatScientificAxis(value: number | string): string {
  const v = Number(value)
  if (!Number.isFinite(v)) return ''
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs < 1000) return String(Math.round(v))
  if (abs < 10000) return `${(v / 1000).toFixed(1)}k`
  return v.toExponential(1).replace('e+', 'e')
}

export function formatVolume(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '--'
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
  if (v >= 1e4) return `${(v / 1e4).toFixed(2)}万`
  return String(Math.round(v))
}

export function formatAmount(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '--'
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
  if (v >= 1e4) return `${(v / 1e4).toFixed(2)}万`
  return v.toFixed(0)
}

/** 换手率，库内单位为百分比数值（如 1.23 表示 1.23%） */
export function formatTurnover(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '--'
  return `${v.toFixed(2)}%`
}

export function formatPrice(v: number): string {
  return v.toFixed(2)
}

export function formatPct(v: number | null | undefined, digits = 2): string {
  if (v == null || Number.isNaN(v)) return '--'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(digits)}%`
}

export function barMetrics(bar: DailyBar, prevClose: number | null) {
  const ref = prevClose ?? bar.open_price
  const changePct =
    prevClose != null && prevClose !== 0
      ? ((bar.close_price - prevClose) / prevClose) * 100
      : null
  const amplitudePct =
    prevClose != null && prevClose !== 0
      ? ((bar.high_price - bar.low_price) / prevClose) * 100
      : null
  return { ref, changePct, amplitudePct }
}

export function calcMa(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i + 1 < period) return null
    const slice = closes.slice(i + 1 - period, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}
