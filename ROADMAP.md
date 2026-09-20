# Roadmap

Plans, not promises — CONTO is a small personal project and priorities can shift. Ideas
and votes are welcome via [issues](../../issues).

## Next (0.2.x) — make it solid
- **Windows testing and fixes:** sign-in, tray, window behavior, icon, DPI scaling.
- Handle session expiry more gracefully (sign-in reminder before the session runs out).
- Use the webview's real User-Agent for plain requests (fewer Cloudflare fallbacks).
- Polish based on early-tester feedback.

## Later (0.3.x+)
- Per-model weekly bars (Opus / Sonnet) on the main card when your plan reports them.
- Light theme and window opacity.
- Extra-usage / spend and credit balance display.
- Notification options: per-window thresholds, quiet hours.
- Multiple accounts / profiles.
- Compact "mini" mode.

## Distribution
- Code signing and notarization (Apple Developer ID, Windows certificate).
- In-app update notifications, then auto-update.
- Linux build (best-effort).
- macOS Icon Composer icon (needs Xcode).

## Not planned
- Anything that writes to your Claude account or Claude Code's login. CONTO is read-only.
