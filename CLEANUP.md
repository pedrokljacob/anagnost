# Cleanup pass (temporary)

Task list for the first trim of the Handy import. Decided with the owner on
2026-10-06. Delete this file in the last commit of the pass and move anything
left undone to `BACKLOG.md`.

Read `DECISIONS.md` first. Items marked "separate thread" in `BACKLOG.md` are
out of scope here, even when they touch the same files.

## Rules for this pass

- One logical change per commit, tests passing at every commit (see AGENTS.md).
- Do the items in the order below. English-only (step 4) comes early so later
  removals only have to delete keys from `src/i18n/locales/en/translation.json`.
- Run the full check (below) after every Rust or frontend change.
- Do not remove Linux or Windows _code_ (cfg blocks, `portable.rs`, Windows mic
  permission commands, Linux paste/typing tools). That is a separate thread.
  The Rust crate must keep compiling and passing tests on Linux.
- When removing a settings field or enum variant, check that loading an old
  settings store still works: an unknown field must be ignored and an unknown
  enum value must fall back to the default, not reset or crash the store. If it
  would not, keep the variant and only remove the UI.
- Remove the matching i18n keys, settingsStore entries, `lib.rs` command
  registrations, capabilities and dependencies together with each feature.
- Regenerate `src/bindings.ts` by running the debug binary (step "Headless
  transcription" below does this) and commit it with the Rust change.
- After dependency changes, run `bun install` / `cargo build` and commit the
  updated `bun.lock` / `Cargo.lock`.

## Full check (Linux test bench)

Toolchains live in `~/.cargo` and `~/.bun`; system packages are installed.
Test data lives in `.scratch/` (gitignored). Baseline on the untouched import:
everything passes (275 Rust tests, 2 existing compiler warnings); prettier
flags only `AGENTS.md`; regenerating `src/bindings.ts` on Linux produces no
diff. The first `cargo build` takes ~10 minutes.

```bash
export PATH=$HOME/.bun/bin:$HOME/.cargo/bin:$PATH
bun run build && bun run lint && bunx prettier --check . && bun run test:keyboard
bun run check:model-languages
(cd src-tauri && cargo build && cargo test)
```

Headless transcription. Keeps app data, settings, logs and models inside
`.scratch/`; also regenerates `src/bindings.ts` (debug builds export it):

```bash
S=$PWD/.scratch
LD_LIBRARY_PATH=$PWD/src-tauri/transcribe-libs \
XDG_DATA_HOME=$S/xdg/data XDG_CONFIG_HOME=$S/xdg/config \
XDG_CACHE_HOME=$S/xdg/cache HF_HOME=$S/hf \
xvfb-run -a src-tauri/target/debug/handy \
  --transcribe-file $S/audio/jfk.wav \
  --model handy-computer/canary-180m-flash-gguf/canary-180m-flash-Q8_0.gguf
```

Expected (CPU, ~0.6 s): the JFK quote ("And so my fellow Americans, ask not what your country
can do for you…"). If `.scratch/` is gone, re-create the model (HF cache layout
under `$S/hf/hub/models--handy-computer--canary-180m-flash-gguf/`, revision
from `catalog.json`) and fetch `jfk.wav` from whisper.cpp's `samples/`.

## Steps

1. **Unused leftovers.**
   - `sponsor-images/`
   - `.github/FUNDING.yml`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`
   - `CONTRIBUTING.md`, `CONTRIBUTING_TRANSLATIONS.md`
   - `scripts/mirror_models.py`, `scripts/ci/`
   - `.cargo/config.toml` (empty `[build]` only)
   - `rdev` in `src-tauri/Cargo.toml` (no uses)
   - `src-tauri/src/audio_toolkit/bin/cli.rs` (its `[[bin]]` is commented out;
     remove the commented block too)
   - `src-tauri/resources/handy_warning.png`
   - npm: `zod`, `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-autostart`,
     `@tauri-apps/plugin-clipboard-manager`, `@tauri-apps/plugin-global-shortcut`,
     `@tauri-apps/plugin-store`, `@types/react-select` (frontend never imports
     them; keep the Rust plugins)
   - `src/components/settings/debug/DebugPaths.tsx`, `src/components/ui/TextDisplay.tsx`,
     `src/components/icons/{CancelIcon,MicrophoneIcon,TranscriptionIcon}.tsx`
     and their barrel exports
   - `src-tauri/icons/android/`, `src-tauri/icons/ios/`, `Square*Logo.png`,
     `StoreLogo.png`, `logo.png`
   - `src-tauri/gen/apple/PrivacyInfo.xcprivacy`
   - `.gitignore`: `.crush/`, `__pycache__/` only if no Python script remains
     (`scripts/gen_catalog.py` stays)
2. **Playwright.** `playwright.config.ts`, `tests/`, `@playwright/test`, the
   `test:playwright*` scripts, the Playwright `.gitignore` lines.
3. **CI.** Delete `.github/workflows/` (own CI comes later). `.github/` should
   then be gone entirely.
4. **English-only UI.**
   - Delete every `src/i18n/locales/*` folder except `en`; trim
     `src/i18n/languages.ts` to English.
   - Remove `AppLanguageSelector.tsx` and `src/lib/utils/rtl.ts` and their uses.
     Leave the Rust `app_language` setting in place.
   - Confirm `build.rs` tray-string generation works with only `en`.
   - Remove `scripts/check-translations.ts` and the `check:translations` script.
   - Keep `react-i18next` and the `eslint-plugin-i18next` rule.
5. **Packaging for other platforms.**
   - Nix: `flake.nix`, `flake.lock`, `nix/`, `.nix/`, `scripts/check-nix-deps.ts`,
     the `postinstall` script in `package.json`, the `.direnv`/`.envrc`/`result`
     lines in `.gitignore`.
   - Windows: `src-tauri/nsis/`, `src-tauri/tauri.windows.conf.json`,
     `src-tauri/icons/icon.ico`.
   - `src-tauri/tauri.conf.json`: drop `bundle.linux`, `bundle.windows` and the
     `.ico` icon; set `bundle.targets` to `["app", "dmg"]`.
   - Keep `src-tauri/.gitignore` `/transcribe-libs/` (build.rs still stages
     there on Linux until the platform-code thread).
6. **Auto-updater.**
   - Frontend: `src/components/update-checker/` (including `portableInstaller.*`),
     `UpdateChecksToggle.tsx`, `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`.
   - Rust: `tauri-plugin-updater`, `tauri-plugin-process`, `trigger_update_check`,
     the tray "check for updates" item, the update-checks setting and its
     commands (`change_update_checks_setting`, `is_update_checks_locked`), the
     `HANDY_DISABLE_UPDATER` env flag.
   - Config: `plugins.updater` and `createUpdaterArtifacts` in `tauri.conf.json`;
     `updater:*` / `process:*` in `capabilities/`.
   - Leave `portable.rs` and the `is_portable` command (platform-code thread).
7. **What's New.** `src/components/whats-new/`, `src/content/release-notes/`,
   `public/release-notes/`, `ShowWhatsNewOnUpdate.tsx`, `debug/WhatsNewPreview.tsx`,
   `react-markdown`, `src/lib/compat.ts` and the `installCompatShims` call,
   `ui/Dialog.tsx` if nothing else uses it, the `show_whats_new_on_update` /
   `whats_new_last_seen_version` settings and commands.
8. **Uncalled Rust commands.** `get_keyboard_implementation`,
   `get_microphone_mode`, `get_selected_microphone`, `get_selected_output_device`,
   `get_clamshell_microphone`, `is_model_loading`, `get_model_load_status`,
   `unload_model_manually` (the tray keeps using the internal `unload_model`).
   Re-check each with grep before removing.
9. **Keyboard implementation choice.** Remove `debug/KeyboardImplementationSelector.tsx`
   and `GlobalShortcutInput.tsx`; `ShortcutInput.tsx` renders the handy-keys
   input only. Keep the Rust setting, its per-OS default and `shortcut/tauri_impl.rs`
   (Secure Input fallback on macOS, default backend on the Linux test bench).
10. **Remote-control CLI flags.** Remove `--toggle-transcription`,
    `--toggle-post-process`, `--cancel`, `signal_handle.rs` and `signal-hook`.
    Keep the single-instance plugin: a second launch only shows the existing
    window. Keep the headless flags (`--transcribe-file`, `--model`,
    `--list-*`, `--repeat`, `--json`, `--device-index`).
11. **Footer model selector.** `src/components/model-selector/` and its use in
    `Footer.tsx`; remove `shared/ProgressBar.tsx` if now unused. The Models page
    stays.
12. **Chinese script conversion.** `ChineseScript.tsx`, `chinese_script.rs`,
    `ferrous-opencc`, the setting, its command and its uses in
    `managers/transcription.rs`, `managers/model.rs`, `tray_i18n.rs`.
13. **Translate to English.** `TranslateToEnglish.tsx`, the setting, its command,
    its use in `managers/transcription.rs`, the `translate*` capability badges.
14. **Sound picker.** Remove `debug/SoundPicker.tsx`, the `Pop` and `Custom`
    themes, `pop_*.wav`, custom-sound loading and `check_custom_sounds`. Marimba
    (the default) stays, as do audio feedback, volume and output device.
15. **Docs.**
    - Trim `BUILD.md` to macOS, plus a "Linux test bench" section with the
      commands above.
    - Run prettier on `AGENTS.md` (the only file `prettier --check` flags in the
      baseline).
16. **Finish.** Delete this file, update `BACKLOG.md`, remove `.scratch/` and
    any build output you created.
