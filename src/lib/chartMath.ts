export interface Point {
  x: number
  y: number
}

/**
 * Monotone cubic (Fritsch–Carlson) interpolation. Unlike a naive Catmull-Rom spline,
 * it never overshoots between points — important for a percentage series, which must
 * not visually dip below 0 or arc above 100 between two real readings.
 */
export function smoothPath(points: Point[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M ${points[0].x} ${points[0].y}`

  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x
    const dy = points[i + 1].y - points[i].y
    slope[i] = dx[i] === 0 ? 0 : dy / dx[i]
  }

  const tangent: number[] = new Array(n)
  tangent[0] = slope[0] ?? 0
  tangent[n - 1] = slope[n - 2] ?? 0
  for (let i = 1; i < n - 1; i++) {
    tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  }
  // Constrain tangents so the curve can't overshoot past either endpoint's value.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i] / slope[i]
    const b = tangent[i + 1] / slope[i]
    const h = Math.hypot(a, b)
    if (h > 3) {
      const t = 3 / h
      tangent[i] = t * a * slope[i]
      tangent[i + 1] = t * b * slope[i]
    }
  }

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const { x: x0, y: y0 } = points[i]
    const { x: x1, y: y1 } = points[i + 1]
    const cp1x = x0 + dx[i] / 3
    const cp1y = y0 + (tangent[i] * dx[i]) / 3
    const cp2x = x1 - dx[i] / 3
    const cp2y = y1 - (tangent[i + 1] * dx[i]) / 3
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x1} ${y1}`
  }
  return d
}

export function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0 || 1
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0)
}

/** Finds the index of the point whose x is closest to `x`. Points must be sorted by x. */
export function nearestIndex(points: { x: number }[], x: number): number {
  if (points.length === 0) return -1
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].x < x) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && Math.abs(points[lo - 1].x - x) < Math.abs(points[lo].x - x)) return lo - 1
  return lo
}

/** 1284 -> "1,284"; 12900 -> "12.9K"; 4200000 -> "4.2M". */
export function formatCompactNumber(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toLocaleString()
}
