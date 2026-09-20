# Changelog

All notable changes to CONTO are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). While CONTO is below 1.0, minor versions may
include breaking changes.

## [Unreleased]

## [0.1.2] - 2026-09-20

### Changed
- Copyright is now held by Palace Multimedia LLC (LICENSE); the creator credit (Steve Palazzo Jr) appears in the README, package metadata and the installer's publisher/copyright fields.
- The Session gauge shows "Starts when you next use Claude" when no 5-hour window is open (0% usage), instead of leaving the reset line blank.

## [0.1.1] - 2026-09-20

### Added
- **Sign-in expiry reminder:** CONTO reads when your claude.ai sign-in expires (only the date, never the cookie itself). Within 3 days the footer turns amber ("Sign-in expires in 2 days") with a Sign in button, and a desktop notification appears at 3 days and again at 1 day (respects the Notifications setting). Settings shows "Signed in until <date>".

### Changed
- Plain web requests now send the webview's real User-Agent instead of a fixed Mac Safari one, so Cloudflare's clearance is more likely to be accepted on Windows (fewer slow fallbacks).
- Rust tests now run on Windows in CI: `src-tauri/build.rs` embeds a Common Controls v6 manifest (`windows.manifest`) in all Windows builds.

### Fixed
- **Windows app icon** now has rounded corners and a transparent margin (was a sharp-cornered square). Regenerated `icon.ico` (16–256 px), PNGs and Store/tile logos with `scripts/make-windows-icons.mjs`.
- **Windows tray icon** is now a bright blue mark readable on dark and light taskbars; the black template icon and template mode are macOS-only.

### Tested
- First real-hardware Windows test passed: install, sign-in, persistence, window sizing and position, tray, launch at login (survives a restart).

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
