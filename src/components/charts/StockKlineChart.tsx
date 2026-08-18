import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Segmented } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { ECharts, EChartsOption, SeriesOption } from 'echarts'
import type { DailyBar, IndicatorPoint, StockDivergenceEvent, Timeframe } from '@/api/types'
import { KlineInfoPanel } from './KlineInfoPanel'
import { calcMa, formatScientificAxis } from './klineFormat'
import styles from './StockKlineChart.module.css'

interface Props {
  bars: DailyBar[]
  indicators: IndicatorPoint[]
  divergences?: StockDivergenceEvent[]
  timeframe?: Timeframe
  height?: number
}

type SubChartKind = 'volume' | 'macd' | 'kdj'

const SUB_CHART_OPTIONS: { label: string; value: SubChartKind }[] = [
  { label: '成交量', value: 'volume' },
  { label: 'MACD', value: 'macd' },
  { label: 'KDJ', value: 'kdj' },
]

const TF_LABEL: Record<string, string> = {
  daily: '日K',
  weekly: '周K',
  monthly: '月K',
  yearly: '年K',
}

const DEFAULT_VISIBLE_BARS = 120

function defaultDataZoomRange(barCount: number): { start: number; end: number } {
  if (barCount <= DEFAULT_VISIBLE_BARS) {
    return { start: 0, end: 100 }
  }
  return {
    start: ((barCount - DEFAULT_VISIBLE_BARS) / barCount) * 100,
    end: 100,
  }
}

function alignIndicators(bars: DailyBar[], indicators: IndicatorPoint[]) {
  const map = new Map(indicators.map((i) => [i.trade_date, i]))
  return bars.map((b) => map.get(b.trade_date) ?? null)
}

function resolveBarIndex(chart: ECharts, barCount: number, point: [number, number]): number | null {
  for (const gridIndex of [0, 1] as const) {
    if (!chart.containPixel({ gridIndex }, point)) continue
    const raw = chart.convertFromPixel({ gridIndex, xAxisIndex: gridIndex }, point)
    if (raw == null || raw[0] == null || Number.isNaN(Number(raw[0]))) continue
    const idx = Math.round(Number(raw[0]))
    if (idx >= 0 && idx < barCount) return idx
  }
  return null
}

function indexFromAxisPointer(
  dates: string[],
  axesInfo: { value?: number | string; axisDim?: string }[] | undefined,
): number | null {
  const info = axesInfo?.find((a) => a.axisDim === 'x') ?? axesInfo?.[0]
  if (!info || info.value == null) return null
  if (typeof info.value === 'number') {
    const idx = Math.round(info.value)
    return idx >= 0 && idx < dates.length ? idx : null
  }
  const idx = dates.indexOf(String(info.value))
  return idx >= 0 ? idx : null
}

export function StockKlineChart({
  bars,
  indicators,
  divergences = [],
  timeframe = 'daily',
  height = 560,
}: Props) {
  const chartRef = useRef<ReactECharts>(null)
  const unbindHoverRef = useRef<(() => void) | null>(null)
  const datesRef = useRef<string[]>([])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [subChart, setSubChart] = useState<SubChartKind>('volume')

  datesRef.current = bars.map((b) => b.trade_date)

  const dates = bars.map((b) => b.trade_date)
  const ohlc = bars.map((b) => [b.open_price, b.close_price, b.low_price, b.high_price])
  const closes = bars.map((b) => b.close_price)
  const volumes = bars.map((b) => b.volume ?? 0)
  const volColors = bars.map((b) =>
    b.close_price >= b.open_price ? '#ef5350' : '#26a69a',
  )

  const aligned = useMemo(() => alignIndicators(bars, indicators), [bars, indicators])
  const dif = aligned.map((i) => i?.macd_dif ?? null)
  const dea = aligned.map((i) => i?.macd_dea ?? null)
  const hist = aligned.map((i) => i?.macd_hist ?? null)
  const kdjK = aligned.map((i) => i?.kdj_k ?? null)
  const kdjD = aligned.map((i) => i?.kdj_d ?? null)
  const kdjJ = aligned.map((i) => i?.kdj_j ?? null)

  const ma5 = useMemo(() => calcMa(closes, 5), [closes])
  const ma10 = useMemo(() => calcMa(closes, 10), [closes])
  const ma20 = useMemo(() => calcMa(closes, 20), [closes])

  const dataZoom = useMemo(() => defaultDataZoomRange(bars.length), [bars.length])

  const hoverBar = hoverIdx != null ? bars[hoverIdx] : null
  const hoverInd = hoverIdx != null ? aligned[hoverIdx] : null
  const hoverPrevClose =
    hoverIdx != null && hoverIdx > 0 ? bars[hoverIdx - 1].close_price : null

  useEffect(() => {
    setHoverIdx(null)
  }, [timeframe, subChart])

  const bindChartHover = useCallback((chart: ECharts) => {
    const onMove = (e: { offsetX: number; offsetY: number }) => {
      const count = datesRef.current.length
      if (count === 0) return
      const idx = resolveBarIndex(chart, count, [e.offsetX, e.offsetY])
      if (idx != null) setHoverIdx(idx)
    }
    const onOut = () => setHoverIdx(null)
    const onAxisPointer = (e: unknown) => {
      const payload = e as { axesInfo?: { value?: number | string; axisDim?: string }[] }
      const idx = indexFromAxisPointer(datesRef.current, payload.axesInfo)
      if (idx != null) setHoverIdx(idx)
    }

    const zr = chart.getZr()
    zr.on('mousemove', onMove)
    zr.on('mouseout', onOut)
    chart.on('updateAxisPointer', onAxisPointer)

    return () => {
      zr.off('mousemove', onMove)
      zr.off('mouseout', onOut)
      chart.off('updateAxisPointer', onAxisPointer)
    }
  }, [])

  const onChartReady = useCallback(
    (chart: ECharts) => {
      unbindHoverRef.current?.()
      unbindHoverRef.current = bindChartHover(chart)
    },
    [bindChartHover],
  )

  useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance()
    if (chart && bars.length > 0) {
      unbindHoverRef.current?.()
      unbindHoverRef.current = bindChartHover(chart)
    }
  }, [bars, bindChartHover, subChart])

  useEffect(() => () => unbindHoverRef.current?.(), [])

  const markPoints = divergences
    .filter((d) => d.timeframe === timeframe)
    .map((d) => ({
      name: d.kind === 'top' ? '顶背离' : '底背离',
      coord: [d.signal_date, d.price_later ?? 0],
      value: d.kind === 'top' ? '顶' : '底',
      itemStyle: { color: d.kind === 'top' ? '#cf1322' : '#389e0d' },
    }))

  const lastMa = (arr: (number | null)[], idx: number) => {
    const v = arr[idx]
    return v != null ? v.toFixed(2) : '--'
  }

  const subSeries = useMemo((): SeriesOption[] => {
    if (subChart === 'volume') {
      return [
        {
          name: '成交量',
          type: 'bar',
          data: volumes.map((v, i) => ({ value: v, itemStyle: { color: volColors[i] } })),
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 8,
        },
      ]
    }
    if (subChart === 'macd') {
      return [
        {
          name: 'MACD',
          type: 'bar',
          data: hist.map((v) => ({
            value: v,
            itemStyle: { color: v != null && v >= 0 ? '#ef5350' : '#26a69a' },
          })),
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 6,
        },
        {
          name: 'DIF',
          type: 'line',
          data: dif,
          smooth: true,
          showSymbol: false,
          xAxisIndex: 1,
          yAxisIndex: 1,
          lineStyle: { width: 1, color: '#333' },
        },
        {
          name: 'DEA',
          type: 'line',
          data: dea,
          smooth: true,
          showSymbol: false,
          xAxisIndex: 1,
          yAxisIndex: 1,
          lineStyle: { width: 1, color: '#fa8c16' },
        },
      ]
    }
    return [
      {
        name: 'K',
        type: 'line',
        data: kdjK,
        smooth: true,
        showSymbol: false,
        xAxisIndex: 1,
        yAxisIndex: 1,
        lineStyle: { width: 1, color: '#f5a623' },
      },
      {
        name: 'D',
        type: 'line',
        data: kdjD,
        smooth: true,
        showSymbol: false,
        xAxisIndex: 1,
        yAxisIndex: 1,
        lineStyle: { width: 1, color: '#1890ff' },
      },
      {
        name: 'J',
        type: 'line',
        data: kdjJ,
        smooth: true,
        showSymbol: false,
        xAxisIndex: 1,
        yAxisIndex: 1,
        lineStyle: { width: 1, color: '#9254de' },
      },
    ]
  }, [subChart, volumes, volColors, hist, dif, dea, kdjK, kdjD, kdjJ])

  const subYAxis = useMemo(() => {
    if (subChart === 'volume') {
      return {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: {
          fontSize: 9,
          formatter: (v: number) => formatScientificAxis(v),
        },
      }
    }
    return {
      scale: true,
      gridIndex: 1,
      splitNumber: 2,
      axisLabel: {
        fontSize: 9,
        formatter: (v: number) => {
          const n = Number(v)
          return Number.isInteger(n) ? String(n) : n.toFixed(2)
        },
      },
    }
  }, [subChart])

  const option: EChartsOption = useMemo(
    () => ({
      animation: false,
      tooltip: {
        trigger: 'axis',
        showContent: false,
        axisPointer: { type: 'cross', animation: false, label: { show: false } },
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      legend: { show: false },
      grid: [
        { left: 56, right: 148, top: 28, height: '62%', containLabel: false },
        {
          left: 56,
          right: 148,
          top: '74%',
          height: '10%',
          borderColor: '#e8e8e8',
          borderWidth: 1,
          backgroundColor: '#fafafa',
        },
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          boundaryGap: true,
          axisLine: { onZero: false },
          gridIndex: 0,
          axisLabel: { show: false },
        },
        {
          type: 'category',
          data: dates,
          gridIndex: 1,
          axisLabel: { fontSize: 10 },
          axisTick: { show: false },
        },
      ],
      yAxis: [
        { scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#f0f0f0' } } },
        subYAxis,
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1], ...dataZoom },
        {
          show: true,
          xAxisIndex: [0, 1],
          type: 'slider',
          bottom: 4,
          height: 16,
          ...dataZoom,
        },
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: ohlc,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: '#ef5350',
            color0: '#26a69a',
            borderColor: '#ef5350',
            borderColor0: '#26a69a',
          },
          markPoint: markPoints.length ? { data: markPoints, symbolSize: 36 } : undefined,
        },
        {
          name: 'MA5',
          type: 'line',
          data: ma5,
          smooth: true,
          showSymbol: false,
          xAxisIndex: 0,
          yAxisIndex: 0,
          lineStyle: { width: 1, color: '#f5a623' },
        },
        {
          name: 'MA10',
          type: 'line',
          data: ma10,
          smooth: true,
          showSymbol: false,
          xAxisIndex: 0,
          yAxisIndex: 0,
          lineStyle: { width: 1, color: '#1890ff' },
        },
        {
          name: 'MA20',
          type: 'line',
          data: ma20,
          smooth: true,
          showSymbol: false,
          xAxisIndex: 0,
          yAxisIndex: 0,
          lineStyle: { width: 1, color: '#9254de' },
        },
        ...subSeries,
      ],
    }),
    [dates, ohlc, ma5, ma10, ma20, markPoints, subSeries, dataZoom, subYAxis],
  )

  return (
    <div className={styles.wrap} onMouseLeave={() => setHoverIdx(null)}>
      <div className={styles.maLegend}>
        <span className={styles.ma5}>MA5:{hoverIdx != null ? lastMa(ma5, hoverIdx) : '--'}</span>
        <span className={styles.ma10}>MA10:{hoverIdx != null ? lastMa(ma10, hoverIdx) : '--'}</span>
        <span className={styles.ma20}>MA20:{hoverIdx != null ? lastMa(ma20, hoverIdx) : '--'}</span>
        <span className={styles.tfTag}>{TF_LABEL[timeframe] ?? timeframe}</span>
      </div>
      {hoverBar && (
        <KlineInfoPanel
          bar={hoverBar}
          prevClose={hoverPrevClose}
          kdj={
            hoverInd
              ? { k: hoverInd.kdj_k, d: hoverInd.kdj_d, j: hoverInd.kdj_j }
              : undefined
          }
        />
      )}
      <div className={styles.toolRow}>
        <Segmented
          size="small"
          options={SUB_CHART_OPTIONS}
          value={subChart}
          onChange={(v) => setSubChart(v as SubChartKind)}
        />
      </div>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height }}
        notMerge
        lazyUpdate={false}
        onChartReady={onChartReady}
      />
    </div>
  )
}
