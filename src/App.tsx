import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { AmbientWave } from './components/AmbientWave'
import { Gauge } from './components/Gauge'
import { StatusBar } from './components/StatusBar'
import { ToggleSwitch } from './components/ToggleSwitch'
import { refreshUsage, type UsageReport } from './lib/api'

const POLL_MS = 5 * 60 * 1000

export function App() {
  const [report, setReport] = useState<UsageReport | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  const pollRef = useRef<number | null>(null)

  const load = useCallback(async (force: boolean) => {
    setRefreshing(true)
    try {
      const next = await refreshUsage(force)
      setReport(next)
    } catch (err) {
      // Only the Tauri IPC bridge itself throws here (fetch failures inside Rust are
      // already normalized into `Status`), so this is unexpected — surface it plainly.
      setReport((prev) => ({
        status: { kind: 'error', message: String(err) },
        usage: prev?.usage ?? null,
        fetched_at: prev?.fetched_at ?? null,
        subscription_type: prev?.subscription_type ?? null,
        retry_in_secs: null,
      }))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load(true)
    pollRef.current = window.setInterval(() => void load(false), POLL_MS)
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current)
    }
  }, [load])

  const toggleAlwaysOnTop = useCallback((next: boolean) => {
    setAlwaysOnTop(next)
    void getCurrentWindow().setAlwaysOnTop(next)
  }, [])

  const usage = report?.usage ?? null
  const status = report?.status ?? { kind: 'ok' as const }
  const showEmptyState = !usage && (status.kind === 'no_credentials' || status.kind === 'token_expired')

  return (
    <div className="h-full p-1.5">
      <main className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <AmbientWave />

        <header data-tauri-drag-region className="relative z-10 flex items-center justify-between px-4 pt-3.5">
          <h1 className="font-display text-[15px] font-bold tracking-[0.18em]">CONTO</h1>
          <ToggleSwitch checked={alwaysOnTop} onChange={toggleAlwaysOnTop} label="Always on top" />
        </header>

        {showEmptyState ? (
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1.5 px-6 text-center">
            <p className="text-[13px] text-[var(--color-text)]">
              {status.kind === 'no_credentials' ? 'Not signed in to Claude Code' : 'Sign-in expired'}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {status.kind === 'no_credentials'
                ? 'Run "claude auth login" in a terminal, then refresh.'
                : 'Open Claude Code to renew it, then refresh.'}
            </p>
          </div>
        ) : (
          <div className="relative z-10 flex flex-1 flex-col justify-center gap-4 px-4 pt-2">
            <Gauge
              label="Session (5h)"
              percent={usage?.five_hour?.utilization ?? null}
              resetsAt={usage?.five_hour?.resets_at ?? null}
              size="primary"
            />
            <Gauge
              label="Weekly"
              percent={usage?.seven_day?.utilization ?? null}
              resetsAt={usage?.seven_day?.resets_at ?? null}
              size="secondary"
            />
          </div>
        )}

        <StatusBar
          status={status}
          fetchedAt={report?.fetched_at ?? null}
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          onClose={() => void getCurrentWindow().close()}
        />
      </main>
    </div>
  )
}
