# CONTO

A small desktop widget that shows your Claude usage — the 5-hour session and the weekly
limit — with a history chart, threshold notifications and a tray/menu-bar icon.
Built with Tauri 2 (Rust + React). macOS and Windows.

> CONTO is an independent hobby project, not affiliated with or endorsed by Anthropic.

## Install

Download the installer for your system from the **Releases** page.

Builds are **unsigned** for now, so your OS will warn you the first time:

- **macOS:** open the `.dmg`, drag CONTO to Applications, then **right-click → Open** the
  first time and confirm.
- **Windows:** run the installer; if SmartScreen appears, choose **More info → Run anyway**.

## Signing in

On first launch CONTO shows **Sign in to Claude**. A normal claude.ai login window opens;
sign in the way you usually do. CONTO then reads your usage from claude.ai.

- CONTO stores **nothing** itself: the session lives in the app's own web-view cookie store
  (like a browser profile) and lasts several weeks. When it expires CONTO says so and keeps
  showing your last reading until you sign in again.
- Your session is only ever sent to `claude.ai`. It is never logged.
- Settings → **Sign out** removes it.
- If you use Claude Code, CONTO can fall back to its login when you're not signed in on the web.

**Heads-up:** claude.ai's usage endpoint is unofficial and can change without notice. If
CONTO stops updating after a Claude update, that's the likely cause — please open an issue.

## Features

- Session (5 h) and Weekly gauges with reset times; colors follow your thresholds
- History chart: usage % over time, and tokens by model (from local Claude Code logs)
- Notifications when a gauge crosses your caution/limit level
- Tray / menu-bar icon showing session %, minimize-to-tray, launch at login
- Always-on-top, remembers position and width

## Build from source

Requires Node 22+, Rust (stable) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```bash
npm install
npm run desktop          # run in development
npx tauri build          # produce an installer for your OS
```

Releases are built by GitHub Actions when a tag like `v0.1.0` is pushed
(`.github/workflows/release.yml`); the result is a draft release to review before publishing.

## Contributing

Bug reports and Windows testing are especially welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Plans are in [ROADMAP.md](ROADMAP.md); changes are in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)

## Status

Developed and tested on macOS. Windows builds are produced by CI but have had little
real-world testing. See `PLAN.md` for the roadmap and design notes.
