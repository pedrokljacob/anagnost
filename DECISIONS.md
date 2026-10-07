# Decisions

Only decisions already shaping the code. Anything not listed is open.
Preferences voiced in conversation are not decisions. Ask again when they become relevant.
Add a line when a decision starts affecting work. Delete it if reversed.

- Anagnost is a fork of [cjpais/Handy](https://github.com/cjpais/Handy) (MIT). Upstream history is merged into the repo root, baseline tag v0.9.8, via the `upstream` remote.
- Upstream is merged periodically and reviewed: check what each merge brings in, how it affects these decisions, and what needs adapting. Files deleted here stay deleted (resolve modify/delete conflicts by removing them again).
- Redesigned UI files are ours: on upstream merges keep our version, and port a Handy UI change by hand in the new design when it is worth having.
- Agent instructions live in `AGENTS.md` only. Handy's `CLAUDE.md` and `CRUSH.md` were dropped at import; do not reintroduce them.
- Anagnost ships for macOS only: Apple Silicon, macOS 13 or later. Windows/Linux packaging and installers are not kept.
- Linux is a test bench, not a target: the Rust crate must keep compiling and passing tests on Linux, and the headless `--transcribe-file` mode stays for testing. The Mac app is built on a macOS machine, never cross-compiled. CI runs the Linux checks and tests before it publishes a Mac build.
- The UI is English only. Keep `react-i18next` and the lint rule so all UI text stays in `src/i18n/locales/en/translation.json`.
- Not shipped: auto-updater, What's New, remote-control CLI flags and signals, keyboard-implementation choice in the UI, footer model selector, Chinese script conversion, translate-to-English, sound picker (Marimba only).
- Kept on purpose: LLM post-processing, transcription history (text only, last 5 entries plus starred ones, no setting), duplicate-launch guard (single instance), both VAD backends, the full model catalog.
- Also kept: the hidden Debug section (toggled with Cmd+Shift+D, no visible control) with all its diagnostics and tuning settings; Custom words. The Experimental switch goes: its settings (post-processing toggle, acceleration, keep mic open, VAD backend) become regular Advanced settings.
- UI redesign in progress, tracked in `REDESIGN.md`.
- UI look: native macOS first. Depart from it only where Pedro asks explicitly.
- Theme follows the system; no in-app light/dark choice.
- Accessibility bar: every UI element stays clearly visible in light and dark. No formal WCAG target.
- UI building blocks stay hand-built (`src/components/ui/`) and are restyled; icons stay lucide. Use native `<select>` wherever search isn't needed.
- App name is Anagnost, bundle identifier `com.pedrojacob.anagnost`, author Pedro. Code names use `anagnost` (crate, `anagnost_lib`, `ANAGNOST_*` env vars). Kept as Handy on purpose: the `handy-keys` crate and its wrappers, model hosting (`blob.handy.computer`, `handy-computer` on Hugging Face), upstream issue references and code comments. No migration from Handy app data.
- On-disk footprint: everything the app writes lives in one folder, `~/Library/Application Support/<identifier>/` (settings, history, models including the Hugging Face cache, logs). Webviews keep no data on disk. `scripts/uninstall.sh` removes that folder plus, best effort, what macOS keeps for the app (caches, preferences, crash reports, privacy permissions); it reports what it could not remove and what stays (Dock tile, backups, text pasted elsewhere) is documented in `BUILD.md`.
- Build size: the dev profile keeps line tables only and no debuginfo for dependencies or build scripts (`CARGO_PROFILE_DEV_DEBUG=full` for a session that needs variables), and the crate builds as `rlib` only. The release profile stays speed-first (`opt-level` 3, fat LTO, stripped); shipped size comes from trimming dependency features, with the system SQLite on macOS and the bundled one on Linux. The Linux bench keeps Vulkan. Docs-only pushes skip the Mac build, so `latest` stays on the last commit that changed the app.
