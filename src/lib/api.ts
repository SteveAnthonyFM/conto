import { invoke } from '@tauri-apps/api/core'

export interface UsageWindow {
  utilization: number
  resets_at: string | null
}

export interface Usage {
  five_hour: UsageWindow | null
  seven_day: UsageWindow | null
  seven_day_opus: UsageWindow | null
  seven_day_sonnet: UsageWindow | null
  extra_usage: unknown
}

// Mirrors the Rust `Status` enum (adjacently tagged: kind + optional message).
export type Status =
  | { kind: 'ok' }
  | { kind: 'no_credentials' }
  | { kind: 'token_expired' }
  | { kind: 'rate_limited' }
  | { kind: 'offline'; message: string }
  | { kind: 'error'; message: string }

export interface UsageReport {
  status: Status
  usage: Usage | null
  fetched_at: number | null
  subscription_type: string | null
  retry_in_secs: number | null
}

export interface Snapshot {
  ts: number
  five_hour: number | null
  seven_day: number | null
  seven_day_opus: number | null
  seven_day_sonnet: number | null
}

export interface LocalBucket {
  hour: number
  model: string
  input: number
  output: number
  cache_creation: number
  cache_read: number
  requests: number
}

export function refreshUsage(force: boolean): Promise<UsageReport> {
  return invoke('refresh_usage', { force, userAgent: navigator.userAgent })
}

export function getSnapshots(since: number): Promise<Snapshot[]> {
  return invoke('get_snapshots', { since })
}

export function getLocalUsage(since: number): Promise<LocalBucket[]> {
  return invoke('get_local_usage', { since })
}

export interface Settings {
  always_on_top: boolean
  notifications_enabled: boolean
  warn_pct: number
  limit_pct: number
  poll_minutes: number
}

export function getSettings(): Promise<Settings> {
  return invoke('get_settings')
}

export function setAlwaysOnTop(value: boolean): Promise<Settings> {
  return invoke('set_always_on_top', { value })
}

/** Opens the claude.ai sign-in window. Rejects with "cancelled" if the user closes it. */
export function signIn(): Promise<void> {
  return invoke('sign_in')
}

export function signOut(): Promise<void> {
  return invoke('sign_out')
}

export function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return invoke('update_settings', { patch })
}

export function getAutostart(): Promise<boolean> {
  return invoke('get_autostart')
}

export function setAutostart(value: boolean): Promise<boolean> {
  return invoke('set_autostart', { value })
}
