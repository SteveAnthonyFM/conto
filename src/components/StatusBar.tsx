import { RefreshCw, Settings, X } from 'lucide-react'
import type { Status } from '../lib/api'
import { formatUpdatedAt } from '../lib/format'

interface StatusBarProps {
  status: Status
  fetchedAt: number | null
  refreshing: boolean
  onRefresh: () => void
  onSignIn: () => void
  onSettings: () => void
  settingsOpen: boolean
  onClose: () => void
}

const DOT_COLOR: Record<Status['kind'], string> = {
  ok: '#3ddc84',
  no_credentials: 'var(--color-caution)',
  token_expired: 'var(--color-caution)',
  rate_limited: 'var(--color-caution)',
  offline: 'var(--color-danger)',
  error: 'var(--color-danger)',
}

const STATUS_LABEL: Record<Status['kind'], string> = {
  ok: 'Connected',
  no_credentials: 'Not signed in',
  token_expired: 'Session expired — sign in again',
  rate_limited: 'Rate limited, retrying shortly',
  offline: 'Offline — showing last reading',
  error: 'Something went wrong',
}

export function StatusBar({ status, fetchedAt, refreshing, onRefresh, onSignIn, onSettings, settingsOpen, onClose }: StatusBarProps) {
  const message = status.kind === 'offline' || status.kind === 'error' ? status.message : STATUS_LABEL[status.kind]

  return (
    <div className="relative z-10 flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-1.5">
      <span
        className="h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ backgroundColor: DOT_COLOR[status.kind] }}
        title={message}
      />
      <span className="truncate text-[11px] text-[var(--color-text-muted)]">
        {status.kind === 'ok' ? `Updated ${formatUpdatedAt(fetchedAt)}` : STATUS_LABEL[status.kind]}
      </span>
      {(status.kind === 'no_credentials' || status.kind === 'token_expired') && (
        <button
          type="button"
          onClick={onSignIn}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-chip-bg)]"
        >
          Sign in
        </button>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh now"
          aria-label="Refresh now"
          className="rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-chip-bg)] hover:text-[var(--color-text)]"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
        <button
          type="button"
          onClick={onSettings}
          title="Settings"
          aria-label="Settings"
          className={`rounded-md p-1.5 transition-colors hover:bg-[var(--color-chip-bg)] hover:text-[var(--color-text)] ${settingsOpen ? 'bg-[var(--color-chip-bg)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}
        >
          <Settings size={14} />
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="rounded-md p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
