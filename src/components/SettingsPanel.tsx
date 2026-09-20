import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { getAutostart, setAutostart, signOut, updateSettings, type Settings } from '../lib/api'
import { ToggleSwitch } from './ToggleSwitch'

interface SettingsPanelProps {
  settings: Settings
  onSettings: (next: Settings) => void
  signedIn: boolean
  onSignIn: () => void
  onSignedOut: () => void
  onBack: () => void
}

const POLL_OPTIONS = [2, 5, 10, 15, 30]

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-[12px] text-[var(--color-text)]">{label}</div>
        {hint && <div className="text-[10px] text-[var(--color-text-muted)]">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function Select({ value, options, format, onChange, label }: { value: number; options: number[]; format: (n: number) => string; onChange: (n: number) => void; label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-chip-bg)] px-2 py-1 text-[11px] text-[var(--color-text)]"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {format(o)}
        </option>
      ))}
    </select>
  )
}

const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step)

export function SettingsPanel({ settings, onSettings, signedIn, onSignIn, onSignedOut, onBack }: SettingsPanelProps) {
  const [autostart, setAutostartState] = useState(false)
  useEffect(() => {
    void getAutostart().then(setAutostartState).catch(() => {})
  }, [])

  const change = (patch: Partial<Settings>) => {
    onSettings({ ...settings, ...patch })
    void updateSettings(patch).then(onSettings)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 pb-1 pt-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          title="Back"
          className="rounded-md p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-chip-bg)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft size={14} />
        </button>
        <span className="text-[13px] font-semibold text-[var(--color-text)]">Settings</span>
      </div>
      <div className="min-h-0 flex-1 divide-y divide-[var(--color-border)] overflow-y-auto px-4 pb-2">
        <Row label="Claude account" hint={signedIn ? 'Signed in' : 'Not signed in'}>
          {signedIn ? (
            <button
              type="button"
              onClick={() => void signOut().then(onSignedOut)}
              className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-text)] hover:bg-[var(--color-chip-bg)]"
            >
              Sign out
            </button>
          ) : (
            <button type="button" onClick={onSignIn} className="rounded-md bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-medium text-white">
              Sign in
            </button>
          )}
        </Row>
        <Row label="Notifications" hint="Alert when usage crosses a threshold">
          <ToggleSwitch checked={settings.notifications_enabled} onChange={(v) => change({ notifications_enabled: v })} label="Notifications" />
        </Row>
        <Row label="Caution at" hint="Gauge turns amber">
          <Select label="Caution threshold" value={settings.warn_pct} options={range(10, 90, 5).filter((n) => n < settings.limit_pct)} format={(n) => `${n}%`} onChange={(n) => change({ warn_pct: n })} />
        </Row>
        <Row label="Limit at" hint="Gauge turns red">
          <Select label="Limit threshold" value={settings.limit_pct} options={range(20, 100, 5).filter((n) => n > settings.warn_pct)} format={(n) => `${n}%`} onChange={(n) => change({ limit_pct: n })} />
        </Row>
        <Row label="Refresh every">
          <Select label="Refresh interval" value={settings.poll_minutes} options={POLL_OPTIONS} format={(n) => `${n} min`} onChange={(n) => change({ poll_minutes: n })} />
        </Row>
        <Row label="Launch at login">
          <ToggleSwitch checked={autostart} onChange={(v) => void setAutostart(v).then(setAutostartState)} label="Launch at login" />
        </Row>
      </div>
    </div>
  )
}
