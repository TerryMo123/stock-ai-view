import { useMemo } from 'react'
import { Card, Col, Row, Statistic, Typography } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

export type AiChartTone = 'up' | 'down' | 'flat'

export interface AiKpiItem {
  label: string
  value: number | string
  unit?: string
  sub?: string | null
  tone?: AiChartTone
}

export interface AiChartSpec {
  id: string
  type: 'kpi' | 'bar' | 'line'
  title: string
  unit?: string
  items?: AiKpiItem[]
  categories?: string[]
  series?: { name: string; data: Array<number | null> }[]
}

function toneColor(tone?: AiChartTone) {
  if (tone === 'up') return '#cf1322'
  if (tone === 'down') return '#389e0d'
  return undefined
}

/** 将图表规格转成可复制的纯文本（表格/图形无法原样复制时只拷数据） */
export function chartsToPlainText(charts: AiChartSpec[]): string {
  if (!charts.length) return ''
  const blocks: string[] = []
  for (const chart of charts) {
    const lines: string[] = [`【${chart.title}】`]
    if (chart.type === 'kpi') {
      for (const item of chart.items || []) {
        const unit = item.unit || ''
        const sub = item.sub ? `（${item.sub}）` : ''
        lines.push(`${item.label}：${item.value}${unit}${sub}`)
      }
    } else {
      const cats = chart.categories || []
      const series = chart.series || []
      if (series.length <= 1) {
        const data = series[0]?.data || []
        cats.forEach((c, i) => {
          const v = data[i]
          const unit = chart.unit ? chart.unit : ''
          lines.push(`${c}\t${v ?? '—'}${unit ? ` ${unit}` : ''}`)
        })
      } else {
        const header = ['项目', ...series.map((s) => s.name)].join('\t')
        lines.push(header)
        cats.forEach((c, i) => {
          const row = [c, ...series.map((s) => String(s.data[i] ?? '—'))].join('\t')
          lines.push(row)
        })
        if (chart.unit) lines.push(`单位：${chart.unit}`)
      }
    }
    blocks.push(lines.join('\n'))
  }
  return blocks.join('\n\n')
}


function BarOrLineChart({ chart }: { chart: AiChartSpec }) {
  const option: EChartsOption = useMemo(() => {
    const multi = (chart.series?.length || 0) > 1
    const singleColors =
      chart.type === 'bar' && !multi
        ? (chart.series?.[0]?.data || []).map((v) =>
            (v ?? 0) >= 0 ? '#cf1322' : '#389e0d',
          )
        : undefined
    return {
      color: ['#1677ff', '#fa8c16', '#13c2c2', '#eb2f96', '#722ed1'],
      legend: multi ? { top: 0, textStyle: { fontSize: 11 } } : undefined,
      grid: { left: 48, right: 16, top: multi ? 36 : 28, bottom: 28 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: chart.categories || [],
        axisLabel: { fontSize: 10, interval: 30, intervalLabel: { width: 72, overflow: 'truncate' } },
      },
      yAxis: {
        type: 'value',
        name: chart.unit,
        nameTextStyle: { fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.4 } },
      },
      series: (chart.series || []).map((s) =>
        chart.type === 'bar'
          ? {
              type: 'bar' as const,
              name: s.name,
              data: multi
                ? s.data
                : s.data.map((v, i) => ({
                    value: v,
                    itemStyle: { color: singleColors?.[i] },
                  })),
              barMaxWidth: multi ? 18 : 28,
            }
          : {
              type: 'line' as const,
              name: s.name,
              data: s.data,
              smooth: true,
              symbolSize: 6,
              lineStyle: { width: 2 },
              areaStyle: { opacity: 0.08 },
            },
      ),
    }
  }, [chart])

  return <ReactECharts option={option} style={{ height: 220, width: '100%' }} opts={{ renderer: 'canvas' }} />
}

export function AiChartsPanel({ charts }: { charts: AiChartSpec[] }) {
  if (!charts.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
      {charts.map((chart) => {
        if (chart.type === 'kpi') {
          return (
            <Card key={chart.id} size="small" title={chart.title} styles={{ body: { padding: '8px 12px' } }}>
              <Row gutter={[12, 12]}>
                {(chart.items || []).map((item) => (
                  <Col key={item.label} xs={12} sm={8} md={6}>
                    <Statistic
                      title={item.label}
                      value={item.value}
                      suffix={item.unit}
                      valueStyle={{ fontSize: 18, color: toneColor(item.tone) }}
                    />
                    {item.sub ? (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {item.sub}
                      </Typography.Text>
                    ) : null}
                  </Col>
                ))}
              </Row>
            </Card>
          )
        }
        return (
          <Card key={chart.id} size="small" title={chart.title} styles={{ body: { padding: '4px 8px 8px' } }}>
            <BarOrLineChart chart={chart} />
          </Card>
        )
      })}
    </div>
  )
}
