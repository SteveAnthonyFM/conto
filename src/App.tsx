import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { AmbientWave } from './components/AmbientWave'
import { CollapsibleSlot } from './components/CollapsibleSlot'
import { Gauge } from './components/Gauge'
import { StatusBar } from './components/StatusBar'
import { ToggleSwitch } from './components/ToggleSwitch'
import { refreshUsage, type UsageReport } from './lib/api'
import { formatResetsAt, formatResetsIn } from './lib/format'
import { useElementHeight } from './lib/useElementHeight'

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

  // The card's four regions (header, Session, Weekly, footer) are laid out with exact
  // pixel arithmetic rather than flexbox grow/shrink: header/Session/footer are measured
  // at their natural size, and Weekly gets whatever's left over, clamped at 0. This is
  // what lets the footer keep its exact padding at every window size — see the note in
  // CollapsibleSlot.tsx for why flex-shrink wasn't reliable enough for that across
  // Tauri's two render engines.
  const [mainRef, mainH] = useElementHeight<HTMLDivElement>()
  const [headerRef, headerH] = useElementHeight<HTMLDivElement>()
  const [sessionRef, sessionH] = useElementHeight<HTMLDivElement>()
  const [footerRef, footerH] = useElementHeight<HTMLDivElement>()

  const weeklyHeight = mainH - headerH - sessionH - footerH

  return (
    <div className="h-full p-1.5">
      <main
        ref={mainRef}
        className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <AmbientWave />

        <header
          ref={headerRef}
          data-tauri-drag-region
          className="relative z-10 flex items-center justify-between px-4 pt-2.5"
        >
          <h1 className="font-display text-[23px] font-bold tracking-[0.14em]">CONTO</h1>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] opacity-70">
              Always on Top
            </span>
            <ToggleSwitch checked={alwaysOnTop} onChange={toggleAlwaysOnTop} label="Always on top" />
          </div>
        </header>

        {showEmptyState ? (
          <div
            className="relative z-10 flex flex-col items-center justify-center gap-1.5 overflow-hidden px-6 text-center"
            style={{ height: `${Math.max(mainH - headerH - footerH, 0)}px` }}
          >
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
          <>
            <div ref={sessionRef} className="relative z-10 px-4 pt-1">
              <Gauge
                label="Session (5h)"
                percent={usage?.five_hour?.utilization ?? null}
                resetsLabel={formatResetsIn(usage?.five_hour?.resets_at ?? null)}
                size="primary"
              />
            </div>
            {/* This is the section that gives way first as the window is resized shorter, so
                the footer (status/refresh/settings/close) and the Session gauge never move
                or lose their padding. */}
            <CollapsibleSlot className="relative z-10 overflow-hidden px-4 pt-3" heightPx={weeklyHeight}>
              <Gauge
                label="Weekly"
                percent={usage?.seven_day?.utilization ?? null}
                resetsLabel={formatResetsAt(usage?.seven_day?.resets_at ?? null)}
                size="secondary"
              />
            </CollapsibleSlot>
          </>
        )}

        <div ref={footerRef}>
          <StatusBar
            status={status}
            fetchedAt={report?.fetched_at ?? null}
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            onClose={() => void getCurrentWindow().close()}
          />
        </div>
      </main>
    </div>
  )
}
