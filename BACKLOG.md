# Backlog

Deferred work and open questions. One line each; remove a line when it is done
or decided (decisions go to `DECISIONS.md`).

## Separate threads

- Model cache leftovers: a cancelled or failed Hugging Face download leaves `blobs/<etag>.sync.part` and `.lock` files that the app never shows, cleans or deletes with the model, and a mirror fallback keeps them next to the finished file. A catalog regeneration with a newer revision makes an already downloaded model show as not downloaded and invisible to delete (`hf_cached_path` checks only the pinned ref and `main`). Sweep on delete and at startup; fall back to any `refs/*` entry.

## Decide later

- Artwork: replace Handy's app icons (`src-tauri/icons/`), tray icons (`resources/tray_*.png`) and logo components (`AppIcon.tsx`, `AppTextLogo.tsx`, shown in the sidebar and onboarding).
- Release size levers that need a Mac benchmark first: `opt-level = "s"` (estimated 2–5 MB smaller, Rust DSP a little slower) and `TRANSCRIBE_CMAKE_ARGS=-DGGML_NATIVE=OFF` on the CI Mac build (today ggml compiles its CPU backend for the runner's chip; a runner newer than the user's Mac could SIGILL).
- CPU-only Linux bench: dropping the `vulkan` and `dynamic-backends` features saves about 0.4 GB and 5 min per cold build and the Vulkan apt packages, at the cost of Vulkan coverage.
- DMG compression: Tauri writes zlib (UDZO); converting to `ULMO` in CI would cut the download by 15–25 % but drops the DMG signature.
- Replace `react-select` (the creatable model picker in `PostProcessingSettingsApi/ModelSelect.tsx`, 17 % of the frontend gzip) with a native `<datalist>` or a hand-built combobox, as part of the redesign's Select unit.
- `tao` patch (cjpais fork): keep or move to crates.io `tao` (needs a Mac build).
- Model hosting: keep using Handy's mirror and Hugging Face org, or self-host.
- Trim the model catalog to the families actually used.
- VAD: keep Silero, earshot, or both.
- Auto-updater: re-add once Anagnost publishes signed releases.
