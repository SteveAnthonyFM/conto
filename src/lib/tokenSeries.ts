import type { ChartSeries } from '../components/UsageChart'
import type { LocalBucket } from './api'

const DAY_SECS = 86_400

// Stable, entity-based color assignment — never rank-based. If colors were assigned by
// "which model used the most tokens this range", switching the date range could repaint
// a model to a different color when the ranking shifts, which the dataviz skill calls
// out as a hard rule to avoid ("color follows the entity, never its rank"). Anything
// outside this known set (a future model name, or a locally-run model) folds into a
// single muted "Other" treatment rather than minting a new hue.
function modelIdentity(model: string): { label: string; color: string } {
  const m = model.toLowerCase()
  if (m.includes('sonnet')) return { label: 'Sonnet', color: 'var(--chart-series-1)' }
  if (m.includes('opus')) return { label: 'Opus', color: 'var(--chart-series-2)' }
  if (m.includes('haiku')) return { label: 'Haiku', color: 'var(--chart-series-3)' }
  return { label: model.replace(/^claude-/, '').replace(/-\d.*$/, '') || model, color: 'var(--color-text-muted)' }
}

function totalTokens(b: LocalBucket): number {
  return b.input + b.output + b.cache_creation + b.cache_read
}

/** Sums hourly buckets into day buckets, for a readable 7d/30d view (hourly noise over
 * a month reads as chaos). `hour` on the result is the day's start, same field name. */
export function aggregateDaily(buckets: LocalBucket[]): LocalBucket[] {
  const byDay = new Map<string, LocalBucket>()
  for (const b of buckets) {
    const day = b.hour - (b.hour % DAY_SECS)
    const key = `${day}:${b.model}`
    const existing = byDay.get(key)
    if (existing) {
      existing.input += b.input
      existing.output += b.output
      existing.cache_creation += b.cache_creation
      existing.cache_read += b.cache_read
      existing.requests += b.requests
    } else {
      byDay.set(key, { ...b, hour: day })
    }
  }
  return [...byDay.values()]
}

/** Pivots hourly/daily buckets into per-model series sharing one timestamp axis, for
 * the stacked-area token view. */
export function buildModelSeries(buckets: LocalBucket[]): { timestamps: number[]; series: ChartSeries[] } {
  const timestamps = [...new Set(buckets.map((b) => b.hour))].sort((a, b) => a - b)
  const indexOf = new Map(timestamps.map((t, i) => [t, i]))
  const models = [...new Set(buckets.map((b) => b.model))].sort()

  const series: ChartSeries[] = models.map((model) => {
    const values = new Array<number>(timestamps.length).fill(0)
    for (const b of buckets) {
      if (b.model !== model) continue
      const i = indexOf.get(b.hour)
      if (i !== undefined) values[i] += totalTokens(b)
    }
    const { label, color } = modelIdentity(model)
    return { key: model, label, color, values }
  })

  return { timestamps, series }
}
