import type { DailyBar } from '@/api/types'
import {
  barMetrics,
  formatAmount,
  formatDateLabel,
  formatPct,
  formatPrice,
  formatTurnover,
  formatVolume,
  priceColor,
} from './klineFormat'
import styles from './KlineInfoPanel.module.css'

interface Props {
  bar: DailyBar
  prevClose: number | null
  kdj?: { k: number | null; d: number | null; j: number | null }
}

function fmtKdj(v: number | null | undefined) {
  return v != null && !Number.isNaN(v) ? v.toFixed(2) : '--'
}

export function KlineInfoPanel({ bar, prevClose, kdj }: Props) {
  const { ref, changePct, amplitudePct } = barMetrics(bar, prevClose)
  const up = bar.close_price >= ref

  const row = (label: string, value: string, color?: string) => (
    <div className={styles.row} key={label}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value} style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  )

  const priceStyle = (v: number) => ({ color: priceColor(v, ref) })

  return (
    <div className={styles.panel}>
      {row('时间', formatDateLabel(bar.trade_date, true))}
      <div className={styles.row}>
        <span className={styles.label}>开盘</span>
        <span className={styles.value} style={priceStyle(bar.open_price)}>
          {formatPrice(bar.open_price)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>收盘</span>
        <span className={styles.value} style={priceStyle(bar.close_price)}>
          {formatPrice(bar.close_price)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>最高</span>
        <span className={styles.value} style={priceStyle(bar.high_price)}>
          {formatPrice(bar.high_price)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>最低</span>
        <span className={styles.value} style={priceStyle(bar.low_price)}>
          {formatPrice(bar.low_price)}
        </span>
      </div>
      {row(
        '涨幅',
        formatPct(changePct),
        changePct != null ? priceColor(bar.close_price, ref) : undefined,
      )}
      {row('振幅', amplitudePct != null ? amplitudePct.toFixed(2) : '--')}
      {row('成交量', formatVolume(bar.volume))}
      {row('成交额', formatAmount(bar.amount))}
      {kdj && row('K', fmtKdj(kdj.k))}
      {kdj && row('D', fmtKdj(kdj.d))}
      {kdj && row('J', fmtKdj(kdj.j))}
      {row('换手率', formatTurnover(bar.turnover_rate))}
      {row('盘后量', '--')}
      {row('盘后额', '--')}
      <span className={styles.hint} aria-hidden>
        {up ? '▲' : '▼'}
      </span>
    </div>
  )
}
