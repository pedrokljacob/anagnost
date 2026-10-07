# Backlog

Deferred work and open questions. One line each; remove a line when it is done
or decided (decisions go to `DECISIONS.md`).

## Separate threads

- Linux code: strip what the test bench doesn't need (cfg blocks in `clipboard.rs`, `overlay.rs`, audio, tray; Linux typing tools and extra paste methods, whose `typing_tool` and `external_script_path` settings no longer have UI; CUDA/DirectML/ROCm; Colored tray theme). Keep the crate compiling on Linux. Also check shortcut recording on Linux (the UI always records through handy-keys; the Linux default backend is Tauri).
- Legacy ONNX engines: remove `transcribe-rs` engines and the hardcoded legacy model table. Check the 5 old Whisper entries in that table.

## Decide later

- Artwork: replace Handy's app icons (`src-tauri/icons/`), tray icons (`resources/idle.png`, `recording.png`, `transcribing.png`, `tray_*.png`) and logo components (`AppIcon.tsx`, `AppTextLogo.tsx`, shown in the sidebar and onboarding).
- `tao` patch (cjpais fork): keep or move to crates.io `tao` (needs a Mac build).
- Model hosting: keep using Handy's mirror and Hugging Face org, or self-host.
- Trim the model catalog to the families actually used.
- VAD: keep Silero, earshot, or both.
- Auto-updater: re-add once Anagnost publishes signed releases.
