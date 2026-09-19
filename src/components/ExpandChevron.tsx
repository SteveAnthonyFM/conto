import { ChevronDown } from 'lucide-react'

interface ExpandChevronProps {
  expanded: boolean
  onToggle: () => void
}

/** The thin strip between the Weekly gauge and the footer that expands/collapses the
 * History panel. Kept as its own persistent affordance rather than another footer
 * icon, per the spec's "More Info chevron" — the footer's icon row is already at a
 * comfortable maximum (status, refresh, settings, close). */
export function ExpandChevron({ expanded, onToggle }: ExpandChevronProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? 'Hide usage history' : 'Show usage history'}
      title={expanded ? 'Hide usage history' : 'Show usage history'}
      className="relative z-10 flex w-full items-center justify-center py-0.5 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
    >
      <ChevronDown size={14} className="transition-transform duration-200" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
    </button>
  )
}
