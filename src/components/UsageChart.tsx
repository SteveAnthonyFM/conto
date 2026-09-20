import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { nearestIndex, scaleLinear, smoothPath } from '../lib/chartMath'
import { useElementSize } from '../lib/useElementSize'

export interface ChartSeries {
  key: string
  label: string
  color: string
  values: (number | null)[]
}

interface UsageChartProps {
  /** Unix seconds, ascending, shared x for every series. */
  timestamps: number[]
  series: ChartSeries[]
  mode: 'line' | 'stacked-area'
  yDomain: [number, number]
  yTicks: number[]
  yTickFormat: (v: number) => string
  xTickFormat: (t: number) => string
  emptyMessage: string
}

// Palanquin's numerals are short (about lowercase height), which reads as clipped text at
// chart-label sizes. Numbers on the chart use the system UI font, which has full-height digits.
const NUMERIC_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

const PAD = { top: 10, right: 12, bottom: 18, left: 30 }

// The SVG's viewBox is set to the container's actual measured pixel size (via
// useElementSize), not a fixed internal coordinate system scaled by preserveAspectRatio.
// A time-series chart legitimately needs non-uniform X/Y scaling to fill its box, but
// stretching that way would visually warp the axis/tooltip <text> — matching the real
// pixel size sidesteps the tradeoff entirely rather than picking one side of it.
export function UsageChart({ timestamps, series, mode, yDomain, yTicks, yTickFormat, xTickFormat, emptyMessage }: UsageChartProps) {
  const [containerRef, { width, height }] = useElementSize<HTMLDivElement>()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const hasData = timestamps.length > 1 && series.some((s) => s.values.some((v) => v !== null && v !== 0))

  const plot = useMemo(() => {
    if (width < 10 || height < 10 || timestamps.length === 0) return null
    const innerW = Math.max(width - PAD.left - PAD.right, 1)
    const innerH = Math.max(height - PAD.top - PAD.bottom, 1)
    const x = scaleLinear([timestamps[0], timestamps[timestamps.length - 1]], [PAD.left, PAD.left + innerW])
    const y = scaleLinear(yDomain, [PAD.top + innerH, PAD.top])

    if (mode === 'stacked-area') {
      const baseline = timestamps.map(() => 0)
      const layers = series.map((s) => {
        const points = timestamps.map((t, i) => {
          const base = baseline[i]
          const top = base + (s.values[i] ?? 0)
          return { x: x(t), yTop: y(top), yBase: y(base) }
        })
        for (let i = 0; i < timestamps.length; i++) baseline[i] += s.values[i] ?? 0
        return { key: s.key, color: s.color, label: s.label, points }
      })
      return { x, y, innerW, innerH, lines: null, layers }
    }

    const lines = series.map((s) => ({
      key: s.key,
      color: s.color,
      label: s.label,
      points: timestamps.map((t, i) => ({ x: x(t), y: y(s.values[i] ?? 0), raw: s.values[i] })),
    }))
    return { x, y, innerW, innerH, lines, layers: null }
  }, [width, height, timestamps, series, mode, yDomain])

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!plot || timestamps.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const t0 = timestamps[0]
    const t1 = timestamps[timestamps.length - 1]
    const frac = plot.innerW === 0 ? 0 : (px - PAD.left) / plot.innerW
    const t = t0 + Math.max(0, Math.min(1, frac)) * (t1 - t0)
    setHoverIndex(nearestIndex(timestamps.map((v) => ({ x: v })), t))
  }

  if (!hasData) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-[var(--color-text-muted)]">
        {emptyMessage}
      </div>
    )
  }

  const hoverX = plot && hoverIndex !== null ? plot.x(timestamps[hoverIndex]) : null

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {plot && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
          className="block"
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={plot.y(tick)}
                y2={plot.y(tick)}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
            </g>
          ))}

          {plot.layers?.map((layer) => {
            const topPath = layer.points.map((p) => `${p.x},${p.yTop}`).join(' L ')
            const basePath = [...layer.points]
              .reverse()
              .map((p) => `${p.x},${p.yBase}`)
              .join(' L ')
            return (
              <path
                key={layer.key}
                d={`M ${topPath} L ${basePath} Z`}
                fill={layer.color}
                fillOpacity={0.7}
                // 2px surface-color gap between stacked bands (see marks-and-anatomy.md).
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            )
          })}

          {plot.lines?.map((line) => {
            const path = smoothPath(line.points)
            const areaPath = `${path} L ${line.points[line.points.length - 1].x} ${PAD.top + plot.innerH} L ${line.points[0].x} ${PAD.top + plot.innerH} Z`
            const last = line.points[line.points.length - 1]
            return (
              <g key={line.key}>
                <path d={areaPath} fill={line.color} fillOpacity={0.1} stroke="none" />
                <path d={path} fill="none" stroke={line.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={last.x} cy={last.y} r={4} fill={line.color} stroke="var(--color-surface)" strokeWidth={2} />
              </g>
            )
          })}

          {hoverX !== null && (
            <line x1={hoverX} x2={hoverX} y1={PAD.top} y2={PAD.top + plot.innerH} stroke="var(--color-border)" strokeWidth={1} />
          )}

        </svg>
      )}

      {/* Axis labels are HTML, not SVG <text>: in WebKit the SVG glyphs had their tops
          shaved off by the font's metrics, while HTML text (like the legend) renders whole. */}
      {plot &&
        yTicks.map((tick) => (
          <span
            key={`y${tick}`}
            className="pointer-events-none absolute text-[9px] leading-[1.3] text-[var(--color-text-muted)]"
            style={{ right: width - (PAD.left - 6), top: plot.y(tick), transform: 'translateY(-50%)', fontFamily: NUMERIC_FONT }}
          >
            {yTickFormat(tick)}
          </span>
        ))}
      {plot && (
        <>
          <span className="pointer-events-none absolute bottom-0 text-[9px] leading-[1.3] text-[var(--color-text-muted)]" style={{ left: PAD.left, fontFamily: NUMERIC_FONT }}>
            {xTickFormat(timestamps[0])}
          </span>
          <span className="pointer-events-none absolute bottom-0 text-[9px] leading-[1.3] text-[var(--color-text-muted)]" style={{ right: PAD.right, fontFamily: NUMERIC_FONT }}>
            {xTickFormat(timestamps[timestamps.length - 1])}
          </span>
        </>
      )}

      {plot && hoverIndex !== null && (
        <ChartTooltip
          containerWidth={width}
          x={hoverX ?? 0}
          time={xTickFormat(timestamps[hoverIndex])}
          rows={series.map((s) => ({ label: s.label, color: s.color, value: s.values[hoverIndex] }))}
          valueFormat={yTickFormat}
        />
      )}
    </div>
  )
}

interface ChartTooltipProps {
  containerWidth: number
  x: number
  time: string
  rows: { label: string; color: string; value: number | null }[]
  valueFormat: (v: number) => string
}

function ChartTooltip({ containerWidth, x, time, rows, valueFormat }: ChartTooltipProps) {
  const estWidth = 140
  const left = Math.min(Math.max(x - estWidth / 2, 4), Math.max(containerWidth - estWidth - 4, 4))
  return (
    <div
      className="pointer-events-none absolute top-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-chip-bg)] px-2 py-1.5 shadow-lg"
      style={{ left, width: estWidth, fontFamily: NUMERIC_FONT }}
    >
      <div className="mb-1 text-[9px] text-[var(--color-text-muted)]">{time}</div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-2 text-[10px]">
          <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
            <span className="inline-block h-[2px] w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
            {row.label}
          </span>
          <span className="font-semibold text-[var(--color-text)]">{row.value === null ? '—' : valueFormat(row.value)}</span>
        </div>
      ))}
    </div>
  )
}
