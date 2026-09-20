import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { AmbientWave } from './components/AmbientWave'
import { ExpandChevron } from './components/ExpandChevron'
import { Gauge } from './components/Gauge'
import { HistoryPanel } from './components/HistoryPanel'
import { ResizeEdges } from './components/ResizeEdges'
import { SettingsPanel } from './components/SettingsPanel'
import { StatusBar } from './components/StatusBar'
import { ToggleSwitch } from './components/ToggleSwitch'
import { getSettings, refreshUsage, signIn, setAlwaysOnTop as setAlwaysOnTopSetting, type Settings, type UsageReport } from './lib/api'
import { formatResetsAt, formatResetsIn } from './lib/format'
import { useElementHeight } from './lib/useElementHeight'
import { animateWindowResize, getLogicalWindowSize, relaxWindowHeightLimits, setWindowHeightLimits } from './lib/windowResize'
import { LogicalSize } from '@tauri-apps/api/dpi'

const DEFAULT_SETTINGS: Settings = { always_on_top: false, notifications_enabled: true, warn_pct: 60, limit_pct: 85, poll_minutes: 5 }

// Each screen has its own allowed window height, so the window never has dead space or
// clipped content and the user never has to re-adjust it after switching screens:
//   compact  — exactly the content (fixed height)
//   history  — compact + a chart area that may flex between HISTORY_MIN and HISTORY_MAX
//   settings — exactly the height that shows every option (may be made shorter, then it scrolls)
//   empty    — the sign-in prompt (fixed height)
const HISTORY_MIN = 180
const HISTORY_OPEN = 220
const HISTORY_MAX = 300
const EMPTY_BODY = 140
// Outer p-1.5 padding (12) + the card's 1px border on each side (2).
const CARD_CHROME = 14
const MAIN_BORDER = 2

type View = 'empty' | 'compact' | 'history' | 'settings'

export function App() {
  const [report, setReport] = useState<UsageReport | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

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

  // Opens the claude.ai sign-in window; once the user finishes (or closes it) we re-poll.
  const [signingIn, setSigningIn] = useState(false)
  const handleSignIn = useCallback(async () => {
    setSigningIn(true)
    try {
      await signIn()
    } catch {
      // "cancelled" / "already open" — nothing to do but re-check below.
    } finally {
      setSigningIn(false)
      void load(true)
    }
  }, [load])

  useEffect(() => {
    void load(true)
  }, [load])

  useEffect(() => {
    const id = window.setInterval(() => void load(false), settings.poll_minutes * 60 * 1000)
    return () => window.clearInterval(id)
  }, [load, settings.poll_minutes])

  // Always on Top is applied and persisted on the Rust side (set_always_on_top), so it
  // survives a relaunch — this just seeds the toggle's initial state from disk.
  useEffect(() => {
    void getSettings().then((s) => {
      setAlwaysOnTop(s.always_on_top)
      setSettings(s)
    })
  }, [])

  const toggleAlwaysOnTop = useCallback((next: boolean) => {
    setAlwaysOnTop(next)
    void setAlwaysOnTopSetting(next)
  }, [])

  const usage = report?.usage ?? null
  const status = report?.status ?? { kind: 'ok' as const }
  const showEmptyState = !usage && (status.kind === 'no_credentials' || status.kind === 'token_expired')

  // ---- Layout: every region is measured at its natural size; the History panel gets
  // whatever the window has left. (Exact pixel arithmetic rather than flex shrink/grow —
  // see useElementHeight.ts for why.)
  const [mainRef, mainH] = useElementHeight<HTMLDivElement>()
  const [headerRef, headerH] = useElementHeight<HTMLDivElement>()
  const [sessionRef, sessionH] = useElementHeight<HTMLDivElement>()
  const [weeklyRef, weeklyH] = useElementHeight<HTMLDivElement>()
  const [chevronRef, chevronH] = useElementHeight<HTMLDivElement>()
  const [footerRef, footerH] = useElementHeight<HTMLDivElement>()
  const [settingsNatural, setSettingsNatural] = useState(0)

  const compactH = headerH + sessionH + weeklyH + chevronH + footerH + CARD_CHROME
  const emptyH = headerH + footerH + EMPTY_BODY + CARD_CHROME
  const settingsH = headerH + footerH + settingsNatural + CARD_CHROME

  // ---- Which screen the user wants (intent) vs. which content is drawn. They differ only
  // while a *closing* transition runs, so the outgoing content shrinks away with the window
  // instead of vanishing and leaving a gap.
  const [settingsOn, setSettingsOn] = useState(false)
  const [historyOn, setHistoryOn] = useState(false)
  const [renderSettings, setRenderSettings] = useState(false)
  const [renderHistory, setRenderHistory] = useState(false)
  const desiredView: View = settingsOn ? 'settings' : showEmptyState ? 'empty' : historyOn ? 'history' : 'compact'

  const openSettings = useCallback(() => {
    setRenderSettings(true)
    setSettingsOn(true)
  }, [])
  const toggleSettings = useCallback(() => (settingsOn ? setSettingsOn(false) : openSettings()), [settingsOn, openSettings])
  const toggleHistory = useCallback(() => {
    if (!historyOn) setRenderHistory(true)
    setHistoryOn((v) => !v)
  }, [historyOn])

  // ---- Window sizing controller.
  const metrics = useRef({ compactH: 0, emptyH: 0, settingsH: 0 })
  metrics.current = { compactH, emptyH, settingsH }
  const intent = useRef({ settingsOn, historyOn })
  intent.current = { settingsOn, historyOn }
  const limits = useRef({ minH: 0, maxH: 9999 })
  const lastHistoryWindowH = useRef<number | null>(null)
  const curView = useRef<View | null>(null)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const [canResizeVertically, setCanResizeVertically] = useState(false)

  const limitsFor = (view: View): [number, number] => {
    const m = metrics.current
    switch (view) {
      case 'empty':
        return [m.emptyH, m.emptyH]
      case 'compact':
        return [m.compactH, m.compactH]
      case 'history':
        return [m.compactH + HISTORY_MIN, m.compactH + HISTORY_MAX]
      case 'settings':
        return [Math.min(m.compactH, m.settingsH), m.settingsH]
    }
  }
  const targetFor = (view: View): number => {
    const m = metrics.current
    if (view === 'empty') return m.emptyH
    if (view === 'settings') return m.settingsH
    if (view === 'compact') return m.compactH
    return lastHistoryWindowH.current ?? m.compactH + HISTORY_OPEN
  }
  const metricsReady = (view: View) => headerH > 0 && footerH > 0 && (view === 'empty' ? emptyH > 0 : view === 'settings' ? settingsNatural > 0 && compactH > 0 : compactH > 0)

  const settleWindow = useCallback(async (view: View, first: boolean) => {
    const win = getCurrentWindow()
    const { width, height } = await getLogicalWindowSize()
    const [minH, maxH] = limitsFor(view)
    const target = Math.min(Math.max(targetFor(view), minH), maxH)
    if (first) {
      await relaxWindowHeightLimits()
      await win.setSize(new LogicalSize(width, target))
    } else if (Math.abs(target - height) > 0.5 && (view !== 'history' || curView.current !== 'history')) {
      await relaxWindowHeightLimits()
      await animateWindowResize(width, height, target)
    }
    await setWindowHeightLimits(minH, maxH)
    limits.current = { minH, maxH }
    setCanResizeVertically(maxH - minH > 1)
    curView.current = view
    if (first) await win.show()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (report === null || !metricsReady(desiredView)) return
    const first = curView.current === null
    chain.current = chain.current
      .then(() => settleWindow(desiredView, first))
      .then(() => {
        // Closing transitions are done — now the outgoing content can go.
        setRenderSettings(intent.current.settingsOn)
        setRenderHistory(intent.current.historyOn)
      })
      .catch(() => {
        // Not in a real Tauri window (browser preview): no sizing to do.
        setRenderSettings(intent.current.settingsOn)
        setRenderHistory(intent.current.historyOn)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report === null, desiredView, compactH, emptyH, settingsH, settingsNatural, headerH, footerH, settleWindow])

  // Remember the chart height the user chose so returning from Settings restores it.
  useEffect(() => {
    if (curView.current === 'history' && desiredView === 'history' && mainH > 0) lastHistoryWindowH.current = mainH + CARD_CHROME - MAIN_BORDER
  }, [mainH, desiredView])

  const historyHeight = Math.max(mainH - MAIN_BORDER - headerH - sessionH - weeklyH - chevronH - footerH, 0)

  return (
    <div className="relative h-full p-1.5">
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

        {renderSettings ? (
          <div className="relative z-10 overflow-hidden" style={{ height: `${Math.max(mainH - MAIN_BORDER - headerH - footerH, 0)}px` }}>
            <SettingsPanel
              settings={settings}
              onSettings={setSettings}
              signedIn={status.kind === 'ok' || (usage !== null && status.kind !== 'no_credentials' && status.kind !== 'token_expired')}
              onSignIn={() => void handleSignIn()}
              onSignedOut={() => {
                setSettingsOn(false)
                void load(true)
              }}
              onBack={() => setSettingsOn(false)}
              onNaturalHeight={setSettingsNatural}
            />
          </div>
        ) : showEmptyState ? (
          <div
            className="relative z-10 flex flex-col items-center justify-center gap-1.5 overflow-hidden px-6 text-center"
            style={{ height: `${Math.max(mainH - MAIN_BORDER - headerH - footerH, 0)}px` }}
          >
            <p className="text-[13px] text-[var(--color-text)]">
              {status.kind === 'no_credentials' ? 'Sign in to see your usage' : 'Session expired'}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {status.kind === 'no_credentials'
                ? 'Use your Claude account. CONTO only reads your usage numbers.'
                : 'Sign in again to keep your usage up to date.'}
            </p>
            <button
              type="button"
              onClick={() => void handleSignIn()}
              disabled={signingIn}
              className="mt-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {signingIn ? 'Waiting for sign-in…' : 'Sign in to Claude'}
            </button>
          </div>
        ) : (
          <>
            <div ref={sessionRef} className="relative z-10 px-4 pt-1">
              <Gauge
                label="Session (5h)"
                warnPct={settings.warn_pct}
                limitPct={settings.limit_pct}
                percent={usage?.five_hour?.utilization ?? null}
                resetsLabel={formatResetsIn(usage?.five_hour?.resets_at ?? null)}
                size="primary"
              />
            </div>
            <div ref={weeklyRef} className="relative z-10 px-4 pt-3">
              <Gauge
                label="Weekly"
                warnPct={settings.warn_pct}
                limitPct={settings.limit_pct}
                percent={usage?.seven_day?.utilization ?? null}
                resetsLabel={formatResetsAt(usage?.seven_day?.resets_at ?? null)}
                size="secondary"
              />
            </div>

            <div ref={chevronRef}>
              <ExpandChevron expanded={historyOn} onToggle={toggleHistory} />
            </div>

            {renderHistory && (
              <div className="relative z-10 overflow-hidden" style={{ height: historyHeight }}>
                <HistoryPanel />
              </div>
            )}
          </>
        )}

        <div ref={footerRef}>
          <StatusBar
            status={status}
            fetchedAt={report?.fetched_at ?? null}
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            onSignIn={() => void handleSignIn()}
            onSettings={toggleSettings}
            settingsOpen={settingsOn}
            onClose={() => void getCurrentWindow().close()}
          />
        </div>
      </main>
      <ResizeEdges limits={limits} canResizeVertically={canResizeVertically} />
    </div>
  )
}
