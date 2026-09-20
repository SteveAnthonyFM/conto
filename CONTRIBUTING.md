# Contributing to CONTO

Thanks for helping! CONTO is a small desktop app (Tauri 2: Rust backend + React/TypeScript
UI). Bug reports, testing on Windows, and feedback are the most valuable contributions right now.

## Reporting bugs and requesting features
Use the [issue templates](../../issues/new/choose). For a bug, please include your OS and
version, the CONTO version (from the release name), what you expected and what happened, and
a screenshot if it's visual. **Never paste your session cookie, tokens or credentials** — CONTO
never needs them in an issue.

Security-sensitive problems (anything involving credentials or the sign-in flow): please don't
open a public issue — contact the maintainer privately via GitHub.

## Development setup
Requires Node 22+, Rust (stable) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/)
for your OS.

```bash
npm install
npm run desktop        # run in development
```

Checks that CI runs (please run them before opening a PR):

```bash
npx tsc --noEmit
cd src-tauri && cargo test
```

Note: on some Macs the default SDK can't be read by the linker; if `cargo` fails with a
"tapi"/"unknown architecture" error, pin `SDKROOT` to an older SDK in the *gitignored*
`src-tauri/.cargo/config.toml`.

## Project layout
- `src/` — React UI (`App.tsx` holds the window/screen sizing logic; `components/`; `lib/`)
- `src-tauri/src/` — Rust: `webauth.rs` (claude.ai sign-in and usage), `credentials.rs` /
  `usage.rs` (Claude Code fallback), `store.rs` (history snapshots), `local.rs` (token logs),
  `notify.rs`, `settings.rs`, `tray.rs`
- `PLAN.md` — decisions and design notes; `ROADMAP.md` — what's next

## Pull requests
- Keep changes focused; describe what and why, and how you tested it (which OS).
- Match the surrounding code style and comment density.
- Add or update tests for Rust logic where practical.
- UI changes: include before/after screenshots.
- By contributing you agree your work is released under the [MIT License](LICENSE).

## Ground rules for the code
- CONTO is **read-only**: it must never write to a user's Claude account or credentials.
- The session cookie must stay in the web-view store, only be sent to `claude.ai`, and never be logged.
- The usage endpoint is unofficial — keep everything that touches it isolated so a change is a small fix.
