# CONTO — Project Plan

A lightweight, cross-platform (Windows + macOS) desktop widget that shows Claude usage in real time: the 5-hour session limit and the 7-day weekly limit, with a history chart.

Status: planning approved, no application code yet.

## Decisions

| Area | Decision |
|---|---|
| Framework | **Tauri 2** (Rust core + system webview). Small installers (~10 MB), low idle RAM (~30–60 MB). |
| UI stack | React + TypeScript + Vite + Tailwind + lucide-react (same as Studiolo, so styling carries over). |
| Data: gauges | Anthropic usage endpoint `GET https://api.anthropic.com/api/oauth/usage`, using the OAuth token Claude Code already stores (macOS Keychain / `~/.claude/.credentials.json`). Read-only; only `api.anthropic.com` is contacted. |
| Data: history and models | Local logs at `~/.claude/projects/**/*.jsonl` for token counts by model and history backfill. |
| Snapshots | CONTO saves a reading every 5 minutes to a local store to build the utilization-over-time chart. |
| Plan tier | Chosen on first run (Pro / Max 5x / Max 20x), changeable in Settings. Per-model weekly bars appear only if the plan reports them. |
| Polling | Every 5 minutes, plus a manual Refresh button. |
| Licensing | No license file while private. Add MIT if the repo goes public. |
| CI | GitHub Actions builds macOS and Windows installers on version tags. Installers are unsigned for now. |

## Data notes (from research)

- The endpoint returns `five_hour`, `seven_day`, `seven_day_opus`, `seven_day_sonnet` (each with `utilization` 0–100 and `resets_at` ISO timestamp) and `extra_usage`.
- Required headers: `Authorization: Bearer <token>`, `anthropic-beta: oauth-2025-04-20`, `User-Agent: claude-code/<version>` (without it, requests hit an aggressive rate-limit bucket), `Content-Type: application/json`.
- Access tokens expire about every 60 minutes and are refreshed by Claude Code, not by CONTO. When expired, CONTO shows a "Sign in via Claude Code" stale state.
- The endpoint is **unofficial and may change**. It sits behind a provider interface so a change means a small fix, with local-log estimates as a fallback.
- JSONL `input_tokens` values are unreliable streaming placeholders (see ccusage #866). Logs are used for counts and history, never for percentages.
- Back off on HTTP 429.

## Prior art reviewed

- [TokenEater](https://github.com/AThevon/TokenEater) (MIT, Swift, macOS): dashboard layout, flip tiles, pacing.
- [Usage Monitor for Claude](https://github.com/jens-duttke/usage-monitor-for-claude) (MIT, Python, Windows): credential handling, adaptive polling and backoff.
- [ccusage](https://github.com/ryoppippi/ccusage): JSONL parsing and 5-hour block logic.
- [Claude-Code-Usage-Monitor #202](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/issues/202): endpoint documentation.

No code is copied; only ideas and documented behavior are reused.

## Design system (derived from Studiolo)

- Dark-first, minimal, flat surfaces with crisp 1px blue-tinted borders. No blur or heavy glassmorphism, so it looks at home on both Windows and macOS.
- Colors: base `#070a10`, card `#0f131b`, chip `#151b26`, border `rgba(70,130,255,.16)`, text `#eef1f6`, muted `#7c8494`, accent `#3d7fff`, danger `#e5604f`.
- Font: Palanquin, bundled locally.
- Signature: a faint blue line-art wave behind the title.
- Gauge gradient: blue (0–60%, safe), amber (60–85%, caution), coral red (85%+, limit).
- Style is expected to be refined once the first build is visible.

## UI spec

**Compact card**
- Header: "CONTO" (left) with an Always on Top toggle.
- Session gauge: the largest bar, with a large % right-aligned and a low-opacity "resets in 4h 36m".
- Weekly gauge: slightly smaller, with % and reset schedule.
- Optional per-model bars (Opus/Sonnet) when the plan reports them.
- Footer: status dot, last-updated time, Refresh, Settings, Close.
- Chevron expands to the history panel.

**History panel**
- Mirrors the live gauges.
- Smooth-curve chart of utilization % over time (session and weekly lines).
- Toggle to tokens by model (stacked area) over 24h / 7d / 30d.

**Window behavior**
- Frameless, draggable, rounded corners; remembers position and always-on-top state.
- Dock to macOS menu bar / Windows system tray; tray shows current session % (badge or tooltip on Mac, tooltip on Windows).

**Settings**
- Poll interval, plan tier, thresholds, notifications (on/off), launch at login, theme, opacity, token source.
- Notifications fire when a threshold is crossed (defaults: 60% caution, 85% limit).

## Milestones

1. **Scaffold**: Tauri 2 + React/Tailwind project, design tokens, Palanquin, base window.
2. **Data layer**: token reader (Mac + Windows), usage client with backoff and stale state, JSONL parser, local snapshot store.
3. **Compact card**: gauges, gradients, footer, refresh, 5-minute polling.
4. **Window behavior**: always-on-top, position memory, tray/menu bar, launch at login.
5. **History panel**: expand animation, utilization chart, token-by-model toggle.
6. **Settings and notifications**: plan picker, thresholds, options.
7. **CI and release**: GitHub Actions installers, README, license decision.

## Open items

- Decide on code signing (Apple/Windows) if distribution widens.
- Add MIT license if the repo becomes public.
