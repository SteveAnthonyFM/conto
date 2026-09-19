import { useEffect, useState } from 'react'
import { getLocalUsage, getSnapshots, type Snapshot } from '../lib/api'
import { formatCompactNumber } from '../lib/chartMath'
import { aggregateDaily, buildModelSeries } from '../lib/tokenSeries'
import { UsageChart, type ChartSeries } from './UsageChart'

type Metric = 'percent' | 'tokens'
type Range = '24h' | '7d' | '30d'

const RANGE_SECONDS: Record<Range, number> = { '24h': 86_400, '7d': 7 * 86_400, '30d': 30 * 86_400 }

function formatTimeTick(ts: number, range: Range): string {
  const d = new Date(ts * 1000)
  return range === '24h'
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-[var(--color-chip-bg)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
          style={{
            backgroundColor: value === opt.value ? 'var(--color-accent)' : 'transparent',
            color: value === opt.value ? 'var(--color-accent-text, #fff)' : 'var(--color-text-muted)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function HistoryPanel() {
  const [metric, setMetric] = useState<Metric>('percent')
  const [range, setRange] = useState<Range>('7d')
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [modelData, setModelData] = useState<{ timestamps: number[]; series: ChartSeries[] }>({
    timestamps: [],
    series: [],
  })

  useEffect(() => {
    const since = Math.floor(Date.now() / 1000) - RANGE_SECONDS[range]
    if (metric === 'percent') {
      void getSnapshots(since).then(setSnapshots)
    } else {
      void getLocalUsage(since).then((buckets) => {
        const prepared = range === '24h' ? buckets : aggregateDaily(buckets)
        setModelData(buildModelSeries(prepared))
      })
    }
  }, [metric, range])

  const percentSeries: ChartSeries[] = [
    { key: 'five_hour', label: 'Session', color: 'var(--chart-series-1)', values: snapshots.map((s) => s.five_hour) },
    { key: 'seven_day', label: 'Weekly', color: 'var(--chart-series-2)', values: snapshots.map((s) => s.seven_day) },
  ]

  const maxTokens = Math.max(1, ...modelData.timestamps.map((_, i) => modelData.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)))
  const tokenTicks = [0, Math.round(maxTokens / 2), Math.round(maxTokens)]

  return (
    <div className="flex h-full flex-col gap-2 px-4 pb-2 pt-1">
      <div className="flex items-center justify-between">
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'percent', label: 'Usage %' },
            { value: 'tokens', label: 'Tokens' },
          ]}
        />
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: '24h', label: '24h' },
            { value: '7d', label: '7d' },
            { value: '30d', label: '30d' },
          ]}
        />
      </div>

      {/* A single series needs no legend box (the chart's own labels say what's
          plotted); both modes here always have >= 1 series worth naming explicitly
          since which models appear varies. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {(metric === 'percent' ? percentSeries : modelData.series).map((s) => (
          <span key={s.key} className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
            <span className="inline-block h-[2px] w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {metric === 'percent' ? (
          <UsageChart
            timestamps={snapshots.map((s) => s.ts)}
            series={percentSeries}
            mode="line"
            yDomain={[0, 100]}
            yTicks={[0, 50, 100]}
            yTickFormat={(v) => `${v}%`}
            xTickFormat={(t) => formatTimeTick(t, range)}
            emptyMessage="No usage history yet — check back after CONTO's been running a while."
          />
        ) : (
          <UsageChart
            timestamps={modelData.timestamps}
            series={modelData.series}
            mode="stacked-area"
            yDomain={[0, tokenTicks[2]]}
            yTicks={tokenTicks}
            yTickFormat={formatCompactNumber}
            xTickFormat={(t) => formatTimeTick(t, range)}
            emptyMessage="No local Claude Code activity in this range yet."
          />
        )}
      </div>
    </div>
  )
}
