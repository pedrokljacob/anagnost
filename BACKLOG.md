# Backlog

Deferred work and open questions. One line each; remove a line when it is done
or decided (decisions go to `DECISIONS.md`).

## Separate threads

- Build size: a debug build directory is 8–13 GB on a 38 GB disk. Try line-tables-only debug info in the dev profile, dropping the `staticlib`/`cdylib` crate types (mobile only; check the next Mac build), and sweeping stale test binaries between tasks. Measure before and after, then look at the shipped app's size too.

## Decide later

- Artwork: replace Handy's app icons (`src-tauri/icons/`), tray icons (`resources/tray_*.png`) and logo components (`AppIcon.tsx`, `AppTextLogo.tsx`, shown in the sidebar and onboarding).
- `tao` patch (cjpais fork): keep or move to crates.io `tao` (needs a Mac build).
- Model hosting: keep using Handy's mirror and Hugging Face org, or self-host.
- Trim the model catalog to the families actually used.
- VAD: keep Silero, earshot, or both.
- Auto-updater: re-add once Anagnost publishes signed releases.
