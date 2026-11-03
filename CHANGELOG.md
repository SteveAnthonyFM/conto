# Changelog

All notable changes to CONTO are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). While CONTO is below 1.0, minor versions may
include breaking changes.

## [Unreleased]

## [0.2.2] - 2026-11-03

Security hardening from a full audit (Cloudflare security-audit skill, no vulnerabilities found).

### Security
- **App commands are permission-gated:** CONTO's own commands are now declared to Tauri and granted only to the main window, so the sign-in and background windows that load claude.ai can never call them, even in edge cases the framework default didn't cover explicitly.
- **Content Security Policy:** the main window now runs under a strict CSP (local files only; no remote scripts, frames or forms).
- **Sign-in window stays on the web:** it now refuses plain-http pages, CONTO's own pages and other addresses on this machine. Any secure site is still allowed, so single sign-on through Google, Apple or a company login keeps working.
- **GitHub Actions pinned:** every workflow action is pinned to an exact commit, CI runs with a read-only token, and the release build no longer saves a build cache.

### Fixed
- **Sign-out now removes every claude.ai cookie.** On macOS the `.claude.ai` ones were left behind. Sign-in and sign-out also forget the cached usage, plan and organization, so the previous account's numbers no longer linger.
- **The menu-bar readout clears when there's no reading** (for example right after signing out with no Claude Code login to fall back on), instead of keeping the last percentage.

### Tested
- macOS: unit tests (22) pass, including new ones for the sign-in navigation rules and cookie matching. A test build loaded normally under the new CSP, and Settings, Refresh, Sign Out and Sign In all worked.

## [0.2.1] - 2026-11-02

### Fixed
- **Menu-bar / tray readout and alerts froze while the window was hidden:** the refresh timer lived in the webview, which the OS suspends once the window is hidden, so the session % in the menu bar only caught up after you clicked the icon. Threshold notifications, the sign-in expiry reminder and the daily update check stalled the same way.

### Changed
- Polling now runs on a native background thread in the Rust app and honours the refresh interval from Settings (changes apply without a restart). It skips a poll when the card refreshed recently, so the two never double up. The card shows new readings it is sent (`usage-updated` / `update-info` events) instead of running its own timers; the launch refresh and the Refresh button work as before.
- The daily update check moved to the same background thread.

### Tested
- macOS: with the card hidden, the dev build kept saving new readings at the configured interval.
- Not yet checked: alerts firing while hidden, and Windows (the change uses only standard threads and Tauri's cross-platform events).

## [0.2.0] - 2026-10-18

### Added
- **Update notifications:** CONTO checks GitHub for a newer release at launch and about once a day. When one exists, the footer shows "Update x.y.z available" with a Download button, and a desktop notification appears once per version (respects the Notifications setting). Download opens the release page; nothing is installed automatically.
- Settings → **Updates**: shows your version, a "Check now" button, and a "Check automatically" toggle to turn the background check off.

## [0.1.3] - 2026-10-18

### Fixed
- **Signing in again did nothing while the old session was still valid:** the login window closed after about a second and the "Signed in until" date never changed, because the still-unexpired session cookie made CONTO think sign-in had already finished. CONTO now clears the old session first (Windows reported cookie deletes as successful without removing anything, so it verifies and wipes the webview data if needed), waits for a genuinely new one, and restores the old one if you close the window without finishing. Sign out uses the same reliable clearing.

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

[Unreleased]: https://github.com/SteveAnthonyFM/conto/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/SteveAnthonyFM/conto/releases/tag/v0.2.1
[0.1.2]: https://github.com/SteveAnthonyFM/conto/releases/tag/v0.1.2
