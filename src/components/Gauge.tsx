import { percentColor } from '../lib/format'

interface GaugeProps {
  label: string
  percent: number | null
  /** Pre-formatted reset label — the caller picks the right formatter per window. */
  resetsLabel: string | null
  size: 'primary' | 'secondary'
  warnPct?: number
  limitPct?: number
}

export function Gauge({ label, percent, resetsLabel, size, warnPct, limitPct }: GaugeProps) {
  const pct = percent ?? 0
  const color = percent === null ? 'var(--color-text-muted)' : percentColor(pct, warnPct, limitPct)
  const isPrimary = size === 'primary'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span
          className={
            isPrimary
              ? 'text-[13px] font-semibold text-[var(--color-text)]'
              : 'text-[12px] font-medium text-[var(--color-text-muted)]'
          }
        >
          {label}
        </span>
        <span
          className={isPrimary ? 'text-[20px] font-bold leading-none' : 'text-[15px] font-semibold leading-none'}
          style={{ color }}
        >
          {percent === null ? '—' : `${Math.round(percent)}%`}
        </span>
      </div>
      <div
        className={`w-full overflow-hidden rounded-full bg-[var(--color-chip-bg)] ${isPrimary ? 'h-2.5' : 'h-2'}`}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(pct, percent === null ? 0 : 2)}%`, backgroundColor: color }}
        />
      </div>
      {resetsLabel && <span className="text-[11px] text-[var(--color-text-muted)] opacity-70">{resetsLabel}</span>}
    </div>
  )
}
