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

/** "Resets in 4h 36m" style label, for the short session window. Null once it has reset. */
export function formatResetsIn(resetsAt: string | null | undefined, now = Date.now()): string | null {
  if (!resetsAt) return null
  const target = Date.parse(resetsAt)
  if (Number.isNaN(target)) return null
  const diffMs = target - now
  if (diffMs <= 0) return 'Resets shortly'
  const totalMinutes = Math.round(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `Resets in ${minutes}m`
  return `Resets in ${hours}h ${minutes}m`
}

function formatClockTime(d: Date): string {
  const hour24 = d.getHours()
  const ampm = hour24 >= 12 ? 'pm' : 'am'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${hour12}:${minutes}${ampm}`
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const weekdayDateFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

/**
 * "Resets Wednesday at 12:00pm" style label for the longer weekly window — an absolute
 * day and time reads better than a multi-day countdown. Built from `Date`'s local
 * getters (getHours/getFullYear/…), so it reflects the OS's current timezone and DST
 * state rather than a fixed offset.
 */
export function formatResetsAt(resetsAt: string | null | undefined, now = new Date()): string | null {
  if (!resetsAt) return null
  const target = new Date(resetsAt)
  if (Number.isNaN(target.getTime())) return null
  const diffDays = Math.round((startOfDay(target) - startOfDay(now)) / 86_400_000)
  const day = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : diffDays > 1 && diffDays < 7 ? weekdayFormatter.format(target) : weekdayDateFormatter.format(target)
  return `Resets ${day} at ${formatClockTime(target)}`
}

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** Last-updated label in the system's local time (e.g. "2:41 PM"). */
export function formatUpdatedAt(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return '—'
  return timeFormatter.format(new Date(unixSeconds * 1000))
}
