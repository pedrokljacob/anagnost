# Backlog

Deferred work and open questions. One line each; remove a line when it is done
or decided (decisions go to `DECISIONS.md`).

## Separate threads

- Platform code: strip Linux/Windows code (cfg blocks in `clipboard.rs`, `overlay.rs`, `build.rs`, audio, tray; `paste_tx/windows.rs`; `portable.rs`; Windows mic permission onboarding; Linux typing tools, extra paste methods, CUDA/DirectML/ROCm, Colored tray theme). Keep the crate compiling on Linux. Also fix `build.rs` comments that still cite the deleted `tauri.windows.conf.json`, and check shortcut recording on Linux (the UI always records through handy-keys; the Linux default backend is Tauri).
- Legacy ONNX engines: remove `transcribe-rs` engines and the hardcoded legacy model table. Check the 5 old Whisper entries in that table.
- Onboarding loop: on a first run with permissions already granted (e.g. after a reinstall), the permission check effect in `AccessibilityOnboarding.tsx` re-runs on every parent render and never settles. Seen in the UI preview; confirm on the Mac.

## Decide later

- Artwork: replace Handy's app icons (`src-tauri/icons/`), tray icons (`resources/handy.png`, `tray_*.png`) and logo components (`AppIcon.tsx`, `AppTextLogo.tsx`, shown in the sidebar and onboarding).
- `tao` patch (cjpais fork): keep or move to crates.io `tao` (needs a Mac build).
- Model hosting: keep using Handy's mirror and Hugging Face org, or self-host.
- Trim the model catalog to the families actually used.
- VAD: keep Silero, earshot, or both.
- Auto-updater: re-add once Anagnost publishes signed releases.
- Own CI (checks and tests).
