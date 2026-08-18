import type { DailyBar, IndicatorPoint } from '@/api/types'

function ema(values: number[], span: number): number[] {
  if (!values.length) return []
  const alpha = 2 / (span + 1)
  const out = new Array<number>(values.length)
  out[0] = values[0]
  for (let i = 1; i < values.length; i++) {
    out[i] = alpha * values[i] + (1 - alpha) * out[i - 1]
  }
  return out
}

/** KDJ 9,3,3，与后端 add_kdj 一致 */
export function calcKdj(
  bars: DailyBar[],
  n = 9,
  kSmooth = 3,
  dSmooth = 3,
): { k: number[]; d: number[]; j: number[] } {
  const len = bars.length
  const k: number[] = new Array(len)
  const d: number[] = new Array(len)
  const j: number[] = new Array(len)
  if (!len) return { k, d, j }

  const alphaK = 1 / kSmooth
  const alphaD = 1 / dSmooth
  k[0] = 50
  d[0] = 50

  for (let i = 0; i < len; i++) {
    const start = Math.max(0, i - n + 1)
    let low = bars[start].low_price
    let high = bars[start].high_price
    for (let t = start; t <= i; t++) {
      if (bars[t].low_price < low) low = bars[t].low_price
      if (bars[t].high_price > high) high = bars[t].high_price
    }
    const close = bars[i].close_price
    const rsv = high === low ? 50 : ((close - low) / (high - low)) * 100
    if (i > 0) {
      k[i] = (1 - alphaK) * k[i - 1] + alphaK * rsv
      d[i] = (1 - alphaD) * d[i - 1] + alphaD * k[i]
    }
    j[i] = 3 * k[i] - 2 * d[i]
  }
  return { k, d, j }
}

export function indicatorsFromBars(bars: DailyBar[]): IndicatorPoint[] {
  if (!bars.length) return []
  const closes = bars.map((b) => b.close_price)
  const emaFast = ema(closes, 12)
  const emaSlow = ema(closes, 26)
  const dif = closes.map((_, i) => emaFast[i] - emaSlow[i])
  const dea = ema(dif, 9)
  const hist = dif.map((v, i) => (v - dea[i]) * 2)
  const { k, d, j } = calcKdj(bars)

  return bars.map((b, i) => ({
    trade_date: b.trade_date,
    macd_dif: dif[i],
    macd_dea: dea[i],
    macd_hist: hist[i],
    rsi: null,
    volume_ratio: null,
    kdj_k: k[i],
    kdj_d: d[i],
    kdj_j: j[i],
  }))
}
