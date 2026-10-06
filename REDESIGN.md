# UI redesign

Tracker for the full UI redesign. Every surface a user sees, hears or touches
gets an explicit **keep** or **change**. Delete this file when the last item is
done. The durable decisions live in `DECISIONS.md`; this file holds the process
and the progress.

## Agreed approach

- **Scope:** appearance, wording and structure (which settings exist and how
  they are grouped). Behaviour (shortcuts, paste, overlay logic) comes later.
- **Order:** foundations, then building blocks, then screens. Screens mostly
  arrange building blocks and reword; they don't invent new styles.
- **Choosing:** foundations and building blocks get 2–3 variants as
  screenshots and Pedro picks one. Screens get one proposal.
- **Wording:** reworded screen by screen, following the tone guide set in
  Phase 1.
- **Name:** the app is Anagnost (see `DECISIONS.md`). Brand assets (app and
  tray icons, logos) are still Handy's and wait for a decision in `BACKLOG.md`.

## Workflow for one unit

1. Mark the unit `[~]` here with the branch name, in the unit's first commit.
2. Capture **before** screenshots of every state, light and dark.
3. Post them with a keep/change list for each element; Pedro answers.
4. Build it (variants first for Phase 1). Post **after** screenshots of the
   same states, next to the before ones.
5. On approval: commit, mark `[x]` with a one-line summary of what changed,
   merge into `main` fast-forward.

## Threads

- One thread per unit, each in its own worktree and branch
  (`feat/ui-<unit>`). Branch from the latest `main`; rebase before merging.
- Phase 1 runs **one thread at a time**: everything else depends on it.
  Phase 2 and Phase 3 units run in parallel once Phase 1 is merged.
- When two units touch the same file (`translation.json`, `App.tsx`), the
  second to merge rebases and resolves.

## Previewing

Setup in each new worktree (`bun` is at `~/.bun/bin/bun`; the cache stays
inside the repo):

```bash
BUN_INSTALL_CACHE_DIR=$PWD/.scratch/bun-cache ~/.bun/bin/bun install
~/.bun/bin/bun run preview:ui
```

URLs, sizes and scenario parameters: see "UI preview" in `BUILD.md` and the
header of `src/dev/mock/index.ts`. Screenshots go in `.scratch/shots/` and
are shown in the thread as Markdown images with absolute paths. Use headless
WebKit, the closest match to the Mac's WKWebView: the T3 preview tools if
"Agent browser access" is on, otherwise `playwright-cli open --browser=webkit`
(run it from `.scratch/`, it writes a `.playwright-cli/` folder).

The preview can't show the San Francisco font, translucency, the real window
frame, native pop-up menus, the menu bar, permission dialogs or sounds. Those
are checked at the Mac checkpoints below.

## Mac checkpoints

Pedro builds on the Mac at these points and reports back:

1. After Phase 1 (foundations, building blocks, window frame).
2. After the settings window screens.
3. After the overlay, menu bar, sounds and app icon.

## Phase 0: decide what stays

Settle these before redesigning their screens (from `BACKLOG.md`):

- [ ] Hidden debug and experimental settings: keep or remove.
- [ ] LLM post-processing: keep or remove. `DECISIONS.md` lists it as kept,
      `BACKLOG.md` as revisit after use; confirm which holds.
- [ ] Custom words: keep or remove.

Already decided: history keeps text and drops audio (player, re-transcribe,
retention settings), so History is designed without them.

## Phase 1: foundations and building blocks (one at a time)

- [ ] **Visual direction**: native macOS look; palette, type scale, spacing,
      corner radii, motion; tone guide for wording. `src/styles/theme.css`,
      `src/App.css`.
- [ ] **Window frame**: translucent sidebar, window buttons inset into the
      content. Rust window config in `src-tauri/src/lib.rs`; Mac-only check.
- [ ] **Building blocks** (`src/components/ui/`): Button, Input, Textarea,
      Select and Dropdown (native `<select>` wherever search isn't needed),
      ToggleSwitch, Slider, Tooltip, Alert, Badge, SettingContainer,
      SettingsGroup, ResetButton, PathDisplay. Icons stay lucide.
- [ ] **Messages**: pop-up toasts (`sonner` setup in `src/App.tsx`).

## Phase 2: screens (parallel)

- [ ] **Navigation**: sidebar (`src/components/Sidebar.tsx`), footer
      (`src/components/footer/`), section structure.
- [ ] **General**: shortcuts, shortcut behaviour, microphone, channel, output
      device, mute while recording, audio feedback, volume, model card.
- [ ] **Models**: search, filters, downloaded and available lists, model
      card, download progress, delete confirmation.
- [ ] **History**: entry list, copy, star, delete, empty state (audio player
      and re-transcribe removed).
- [ ] **Advanced**: app, output, transcription, history and experimental
      groups; structure depends on Phase 0.
- [ ] **Post-processing**: provider, API key, base URL, model, prompts,
      shortcut (if kept in Phase 0).
- [ ] **Debug**: diagnostics, log viewer, onboarding preview (if kept).
- [ ] **About**: version, folders, acknowledgements; theme selector removed
      (theme follows the system).
- [ ] **Onboarding**: permissions step, model picker.
- [ ] **Warnings**: accessibility permissions, secure input.

## Phase 3: outside the settings window (parallel)

- [ ] **Recording overlay**: recording, arming, streaming (live text),
      transcribing, processing; top and bottom placement. `src/overlay/`,
      sizes and offsets in `src-tauri/src/overlay.rs`.
- [ ] **Menu bar**: icons for idle, recording, transcribing and warning, light
      and dark (`src-tauri/resources/tray_*.png`); menu items and tooltip
      (`src-tauri/src/tray.rs`, strings under `tray` in `translation.json`).
- [ ] **Sounds**: start and stop sounds (`src-tauri/resources/marimba_*.wav`).
- [ ] **App icon and brand assets**: `src-tauri/icons/`, `assets/icon.svg`,
      `src/components/icons/`, `src-tauri/resources/*.png`.
- [ ] **System text**: microphone permission prompt (`src-tauri/Info.plist`).
