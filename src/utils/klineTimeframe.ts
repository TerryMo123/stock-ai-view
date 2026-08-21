import type { ChartTimeframe, DailyBar } from '@/api/types'

export { indicatorsFromBars } from '@/utils/indicators'

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function weekKey(date: Date): string {
  const d = new Date(date.getTime())
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + (5 - day))
  return formatDate(d)
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function yearKey(date: Date): string {
  return String(date.getUTCFullYear())
}

function aggregateBy(
  bars: DailyBar[],
  keyFn: (d: Date) => string,
  labelFn: (group: DailyBar[]) => string,
): DailyBar[] {
  if (!bars.length) return []
  const sorted = [...bars].sort((a, b) => a.trade_date.localeCompare(b.trade_date))
  const groups = new Map<string, DailyBar[]>()
  for (const b of sorted) {
    const key = keyFn(parseDate(b.trade_date))
    const arr = groups.get(key) ?? []
    arr.push(b)
    groups.set(key, arr)
  }
  const result: DailyBar[] = []
  for (const arr of groups.values()) {
    const first = arr[0]
    const last = arr[arr.length - 1]
    let high = first.high_price
    let low = first.low_price
    let volume = 0
    let amount = 0
    let hasVolume = false
    let hasAmount = false
    for (const r of arr) {
      if (r.high_price > high) high = r.high_price
      if (r.low_price < low) low = r.low_price
      if (r.volume != null) {
        volume += r.volume
        hasVolume = true
      }
      if (r.amount != null) {
        amount += r.amount
        hasAmount = true
      }
    }
    result.push({
      trade_date: labelFn(arr),
      open_price: first.open_price,
      high_price: high,
      low_price: low,
      close_price: last.close_price,
      volume: hasVolume ? volume : null,
      amount: hasAmount ? amount : null,
      turnover_rate: last.turnover_rate ?? null,
    })
  }
  return result
}

function toWeekly(bars: DailyBar[]): DailyBar[] {
  return aggregateBy(
    bars,
    (d) => weekKey(d),
    (group) => group[group.length - 1].trade_date,
  )
}

function toMonthly(bars: DailyBar[]): DailyBar[] {
  return aggregateBy(
    bars,
    (d) => monthKey(d),
    (group) => group[group.length - 1].trade_date,
  )
}

function toYearly(bars: DailyBar[]): DailyBar[] {
  return aggregateBy(
    bars,
    (d) => yearKey(d),
    (group) => group[group.length - 1].trade_date,
  )
}

export function barsByTimeframe(allDaily: DailyBar[], tf: ChartTimeframe): DailyBar[] {
  if (tf === 'weekly') return toWeekly(allDaily)
  if (tf === 'monthly') return toMonthly(allDaily)
  if (tf === 'yearly') return toYearly(allDaily)
  return [...allDaily].sort((a, b) => a.trade_date.localeCompare(b.trade_date))
}
