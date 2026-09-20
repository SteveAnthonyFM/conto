# Changelog

All notable changes to CONTO are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). While CONTO is below 1.0, minor versions may
include breaking changes.

## [Unreleased]

## [0.1.0] - 2026-09-20

First testing release. Developed and tested on macOS; Windows builds are produced by CI but
have not yet been tested on real hardware. Installers are unsigned.

### Added
- Compact card with **Session (5 h)** and **Weekly** usage gauges, reset times, and a status
  footer (last updated, refresh, settings, close).
- **Sign in with your Claude account:** a normal claude.ai login window; the session is kept
  in the app's own web-view cookie store (several weeks) and never stored or logged by CONTO.
  Claude Code's login is used as a fallback.
- **History panel:** smooth-curve usage % over time (Session and Weekly) and tokens by model
  (from local Claude Code logs), over 24 h / 7 d / 30 d.
- **Settings:** sign in/out, notifications on/off, caution and limit thresholds (also drive
  the gauge colors), refresh interval, launch at login.
- **Notifications** when Session or Weekly usage crosses your caution or limit level.
- **Tray / menu-bar icon** showing session % (tooltip on Windows), minimize-to-tray,
  launch at login, always-on-top, remembered window position and width.
- Per-screen window sizing: compact, history and settings each have their own height range,
  with smooth expand/collapse; generous edge-resize zones.
- GitHub Actions: CI checks, and installer builds for macOS (universal) and Windows on
  version tags.

### Known issues
- Windows is untested (sign-in, tray, window behavior, icon).
- The claude.ai usage endpoint is unofficial and may change without notice.
- Installers are unsigned; macOS and Windows will show a security warning on first launch.
- The macOS icon looks slightly different in Finder list view than in the Dock.

[Unreleased]: https://github.com/SteveAnthonyFM/conto/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/SteveAnthonyFM/conto/releases/tag/v0.1.0
