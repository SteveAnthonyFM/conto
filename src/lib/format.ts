// All time math here goes through the JS `Date`/`Intl` APIs, which read the OS's current
// timezone and DST rules — never a hardcoded offset — so displayed times stay correct
// across a DST transition without any app changes.

const STOPS: [number, [number, number, number]][] = [
  [0, [61, 127, 255]], // accent blue — safe
  [60, [240, 180, 41]], // caution amber
  [85, [229, 96, 79]], // danger coral
  [100, [214, 60, 44]], // deeper red at the ceiling
]

/** Smoothly interpolated gauge color for a 0–100 utilization value. */
export function percentColor(pct: number): string {
  const p = Math.max(0, Math.min(100, pct))
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [p0, c0] = STOPS[i]
    const [p1, c1] = STOPS[i + 1]
    if (p <= p1 || i === STOPS.length - 2) {
      const t = p1 === p0 ? 0 : (p - p0) / (p1 - p0)
      const mix = c0.map((v, idx) => Math.round(v + (c1[idx] - v) * t))
      return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`
    }
  }
  return `rgb(${STOPS[0][1].join(', ')})`
}

/** "resets in 4h 36m" style label, or null once the window has already reset. */
export function formatResetsIn(resetsAt: string | null | undefined, now = Date.now()): string | null {
  if (!resetsAt) return null
  const target = Date.parse(resetsAt)
  if (Number.isNaN(target)) return null
  const diffMs = target - now
  if (diffMs <= 0) return 'resets shortly'
  const totalMinutes = Math.round(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `resets in ${minutes}m`
  return `resets in ${hours}h ${minutes}m`
}

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** Last-updated label in the system's local time (e.g. "2:41 PM"). */
export function formatUpdatedAt(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return '—'
  return timeFormatter.format(new Date(unixSeconds * 1000))
}
