# Decisions

Only decisions already shaping the code. Anything not listed is open.
Preferences voiced in conversation are not decisions. Ask again when they become relevant.
Add a line when a decision starts affecting work. Delete it if reversed.

- Anagnost is a fork of [cjpais/Handy](https://github.com/cjpais/Handy) (MIT). Upstream history is merged into the repo root, baseline tag v0.9.8, via the `upstream` remote.
- Upstream is merged periodically and reviewed: check what each merge brings in, how it affects these decisions, and what needs adapting. Files deleted here stay deleted (resolve modify/delete conflicts by removing them again).
- Agent instructions live in `AGENTS.md` only. Handy's `CLAUDE.md` and `CRUSH.md` were dropped at import; do not reintroduce them.
- Anagnost ships for macOS only (target: Apple Silicon). Windows/Linux packaging, installers and CI are not kept.
- Linux is a test bench, not a target: the Rust crate must keep compiling and passing tests on Linux, and the headless `--transcribe-file` mode stays for testing. The Mac app is built on a macOS machine, never cross-compiled.
- The UI is English only. Keep `react-i18next` and the lint rule so all UI text stays in `src/i18n/locales/en/translation.json`.
- Not shipped: auto-updater, What's New, remote-control CLI flags and signals, keyboard-implementation choice in the UI, footer model selector, Chinese script conversion, translate-to-English, sound picker (Marimba only).
- Kept on purpose: LLM post-processing, transcription history (text only, audio to be dropped), duplicate-launch guard (single instance), both VAD backends, the full model catalog.
