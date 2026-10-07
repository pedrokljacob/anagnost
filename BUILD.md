# Build Instructions

Anagnost ships for macOS on Apple Silicon. The Mac app is built on a Mac;
Linux is only a test bench for the Rust crate and the frontend (see
[Linux test bench](#linux-test-bench)).

## Install the latest CI build

`.github/workflows/ci.yml` runs the [Linux test bench](#linux-test-bench)
checks on every push and on pull requests. On `main`, once they pass, it
builds the app on a GitHub Apple Silicon runner and publishes it as the
rolling `latest` pre-release. No local build is needed. A push that only
changes documentation skips the Mac build, so `latest` names the last
commit that changed the app.

Install or update it on the Mac (Apple Silicon, macOS 13 or later, from an
administrator account) with the tools macOS ships with:

```bash
curl -fsSL https://raw.githubusercontent.com/pedrokljacob/anagnost/main/scripts/install-mac.sh | bash
```

From a checkout, `scripts/install-mac.sh` does the same. It skips the
download when the installed build is already current; pass `--force` to
reinstall (`| bash -s -- --force` for the one-liner). It copies the new app
next to the old one before swapping them, so a failed install leaves the
installed app as it was, and quits and relaunches a running copy. It leaves
nothing on the Mac but the app, apart from what an interrupted run (power
loss, a killed terminal) can leave: a temporary folder under `$TMPDIR` and a
staging copy named `/Applications/.Anagnost-new.<pid>`, both harmless and
safe to delete. `curl` downloads are not quarantined, so Gatekeeper does not
block the unnotarized app.

### Trust model

The installer verifies that the downloaded app is intact and signed, and
refuses an ad-hoc signature, but the certificate is self-signed and the
build is not notarized, so nothing on the Mac vouches for who built it. What
you trust is GitHub over HTTPS: the script, the release and the CI
definition all come from this repository, so whoever controls it controls
what gets installed. Developer ID signing and notarization would let macOS
check the publisher; they need a paid Apple Developer account and are not
set up.

### Signing certificate

CI signs with a self-signed certificate so every build keeps the same code
identity and macOS keeps the Accessibility and Microphone grants across
updates. One-time setup:

1. In Keychain Access, choose **Certificate Assistant > Create a
   Certificate…**: name `Anagnost Signing`, identity type **Self-Signed
   Root**, certificate type **Code Signing**, tick **Let me override
   defaults** and set the validity to 3650 days.
2. Export it from **login > My Certificates** as a `.p12` with a password.
3. Add three repository secrets under **Settings > Secrets and variables >
   Actions**: `APPLE_CERTIFICATE` (output of `base64 -i <file>.p12`),
   `APPLE_CERTIFICATE_PASSWORD`, and `APPLE_SIGNING_IDENTITY`
   (`Anagnost Signing`).

Keep the `.p12` and its password somewhere safe and delete the file. A new
certificate means granting the permissions once more.

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/pedrokljacob/anagnost/main/scripts/uninstall.sh | bash -s -- --app
```

From a checkout: `scripts/uninstall.sh --app`. Without `--app` the app
itself stays in `/Applications`.

Dragging the app to the Trash does not run this cleanup: it leaves the app
data, the privacy permissions and any login item behind.

The script first checks what it cannot undo by itself. If "Launch on
Startup" is on (read from the app's settings) or the app is running, it
deletes nothing and says what to do: turn the setting off in Anagnost under
Settings > Advanced, which removes the app's login item, then quit the app.
Run it again afterwards.

It then lists what it found and asks before deleting (`--yes` skips the
question): the app data folder (`~/Library/Application Support/<identifier>`,
which holds settings, history, models and logs), the caches, preferences,
saved state, crash, hang and spin reports macOS keeps for the app, and,
with `--app`, the app itself, which it also unregisters from LaunchServices.
It resets all of the app's privacy permissions (Microphone, Accessibility,
Input Monitoring) as well. If a step fails it carries on, then exits with
a non-zero status and says what to finish by hand (permissions under System
Settings > Privacy & Security, a file in Finder). At the end it reminds you
to check System Settings > General > Login Items: the app only saves "Launch
on Startup" once macOS confirms the login item change, but the script cannot
read the real login-item state without root, so look there once if the
setting was ever on.

### What stays

The script removes the files the app owns and, as far as a script can, the
state macOS keeps for it. It is not guaranteed erasure. It does not touch:

- A Dock tile or Apple menu > Recent Items entry, which keep a dangling
  reference until you remove them; a copy of the app in the Trash if you
  dragged it there before running the script.
- Unified-log entries, which macOS keeps until it rotates them.
- Time Machine backups and local snapshots, which may hold earlier copies
  of the app data folder, including the settings file.
- Downloaded disk images or app copies outside `/Applications`, other user
  accounts, and your shell history.
- Anything that left the Mac: text the app pasted into other apps,
  clipboard-manager history, and, if you enabled post-processing with a
  cloud provider, whatever that provider keeps of the text it was sent.

### What the app stores

Everything is in the app data folder, which the uninstall removes and
which the app keeps private to your account (mode 0700). `settings_store.json`
holds the settings, including any post-processing API keys as plain text
(not in the Keychain, so nothing survives the folder). `history.db` holds
the last transcriptions. `logs/` holds the app logs; provider errors are
logged by status and short message only, never the response body. Models
and the Hugging Face cache live alongside. Post-processing is off by
default and only sends text off the Mac when you configure a remote
provider.

### Checking a build on the Mac

Tauri cannot drive a macOS window, so a build is checked by hand on a Mac.
`scripts/check-mac.sh` does the part a script can verify and prints one
line per check: the installed app verifies and carries the CI certificate,
its bundle identifier, minimum macOS and stamped commit are right, the
commit matches the published `latest` build, the app data folder is private
and the logs hold no provider response bodies, no webview storage exists
outside that folder, and nothing else was written since a marker. Pass a
WAV (16 kHz, mono, 16-bit) and it transcribes it through the installed app
on the real Metal path and prints the text and real-time factor:

```bash
scripts/check-mac.sh --mark          # before installing
scripts/install-mac.sh
# grant permissions, download a model, dictate once
scripts/check-mac.sh --wav dictation.wav --expect "ask not"
```

A fixture WAV is made once on the Mac with
`say -o dictation.aiff "..." && afconvert -f WAVE -d LEI16@16000 -c 1 dictation.aiff dictation.wav`.

What remains manual, each a yes or no: the Microphone and Accessibility
prompts appear once and the grants survive an update; the shortcut records
and the text lands in another app; the menu bar icon changes state and its
menu works; the start and stop sounds play; Launch on Startup shows up in
System Settings > General > Login Items and disappears when turned off; the
overlay shows at the chosen position in light and dark.

### Checking an uninstall

To check the install and uninstall cycle, before installing, record a
reference:

```bash
touch /tmp/anagnost-mark
```

Then install and confirm the installed copy carries the CI certificate
(an ad-hoc build prints `Signature=adhoc` and no `Authority` line):

```bash
codesign -dvv /Applications/Anagnost.app 2>&1 | grep -E '^(Authority|Signature)'
```

Expected: `Signature size=<n>` and `Authority=Anagnost Signing`. Next grant
the permissions, download a model, dictate once, turn "Launch on Startup"
on and off, quit, and uninstall with `--app`. Finally compare:

```bash
find ~/Library /Applications /tmp "$TMPDIR" -newer /tmp/anagnost-mark \
  \( -iname '*anagnost*' -o -iname '*pedrojacob*' \) 2>/dev/null
```

The `find` should print nothing, and System Settings > Privacy & Security
and Login Items should not list Anagnost. Running the uninstall a second
time should find nothing to delete.

## macOS

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Bun](https://bun.sh/) package manager
- Xcode Command Line Tools: `xcode-select --install`
- [Tauri prerequisites for macOS](https://tauri.app/start/prerequisites/)

### Setup

```bash
bun install
```

### Develop

```bash
bun run tauri dev
```

### Build

```bash
bun run tauri build
```

This produces the `.app` and `.dmg` bundles under
`src-tauri/target/release/bundle/`.

### Troubleshooting

#### Accessibility remains enabled after a local rebuild

Local builds use the ad-hoc `signingIdentity: "-"`. A rebuild can have a new macOS code
identity while the old **System Settings > Privacy & Security > Accessibility** entry
remains visibly enabled, leaving the app on `Waiting...`.

After installing the final bundle at `/Applications/Anagnost.app`, quit the app, clear only
its stale Accessibility record, then reopen it:

```bash
osascript -e 'tell application id "com.pedrojacob.anagnost" to quit' || true
tccutil reset Accessibility com.pedrojacob.anagnost
open /Applications/Anagnost.app
```

Grant Accessibility again when prompted. This does not reset Microphone or other TCC
services.

For optional diagnosis, compare the designated requirements of the previous and rebuilt
bundles:

```bash
codesign -dr - /path/to/previous/Anagnost.app 2>&1
codesign -dr - /Applications/Anagnost.app 2>&1
```

An ad-hoc requirement contains a `cdhash`; a changed requirement confirms the rebuild is
not covered by the old grant. The reset procedure does not require this check.

See [Handy issue #1618](https://github.com/cjpais/Handy/issues/1618) for the related
onboarding and stale-permission report.

## UI preview

Runs the interface in a plain browser with a fake backend (`src/dev/mock/`),
on any OS and without Rust. Native surfaces (menu bar, window chrome,
permission dialogs, sounds, overlay placement on screen) still need the Mac.

```bash
bun install
bun run preview:ui
```

It serves on the first free port from 1430. Open `/` for the settings window
and `/src/overlay/index.html` for the recording overlay; the main window is
680×570 and the overlay 256×50 (400×120 when streaming). URL parameters pick
the scenario, for example `/?onboarding=1` or
`/src/overlay/index.html?state=streaming&position=top`. The full list is at
the top of `src/dev/mock/index.ts`. Light and dark follow the browser's color
scheme, as the app follows the system: switch it in the browser, or emulate
it (Playwright's `colorScheme`, the T3 preview's appearance setting) for
screenshots. Headless WebKit (`playwright-cli open
--browser=webkit`) is the closest match to the Mac's WKWebView.

## UI contract tests

`bun run test:ui` drives the mock preview in headless WebKit (Playwright) and
compares the accessibility tree of each settings section, scenario and
overlay state with the ARIA snapshots in `tests/ui/__snapshots__/`, in light
and dark. A few tests also exercise the mock (toggling a setting, starring
and deleting history, starting and cancelling a download, the delete
confirmation). The clock is frozen so history times are stable. When a change
to the UI is intended, run `bun run test:ui:update` and review the snapshot
diff before committing it. Pixel screenshots are not compared; approved units
may get pixel baselines later (see `REDESIGN.md`). The first run needs
`bunx playwright install webkit` once (CI installs it with system
dependencies).

## Linux test bench

The Rust crate must keep compiling and passing its tests on Linux, and the
headless `--transcribe-file` mode exercises the real transcription path without
a window or microphone. Nothing is packaged for Linux.

### Prerequisites

Rust, Bun and the system packages Tauri needs. On Ubuntu/Debian:

```bash
sudo apt install build-essential clang libclang-dev libevdev-dev libasound2-dev \
  pkg-config libssl-dev libvulkan-dev vulkan-tools glslc spirv-headers \
  glslang-tools libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf cmake xvfb
```

CI installs the same list without `vulkan-tools` and `patchelf`, which only
a human or an AppImage needs.

### Full check

Run after every Rust or frontend change. The first `cargo build` takes about
ten minutes.

```bash
bun install
bun run build && bun run check
(cd src-tauri && cargo build && cargo test)
```

`bun run check` runs the lint, formatting, unit tests (`bun test`), the
decision guards (`scripts/check-decisions.ts`, which asserts what
`DECISIONS.md` says about the tree and pins fixes that must stay) and the
model-language check. The UI contract tests (`bun run test:ui`) are separate
because they start a browser.

CI runs the same in two parallel jobs, the frontend checks and the Rust
tests, so the wall-clock time stays that of the Rust build. The Rust job
also runs the debug binary once (`--list-models` under `xvfb`) and fails if
the regenerated `src/bindings.ts` differs from the committed one, apart from
the `isLaptop` doc comment below. The Mac job fails if the disk image grows
past `SIZE_BUDGET_MB` in `ci.yml`; raise it on purpose when a change is worth
the size.

### Build size

The dev profile (`src-tauri/Cargo.toml`) keeps line tables for the crate
and no debuginfo for dependencies or build scripts, and the crate builds
as `rlib` only. A `cargo build && cargo test` cycle then takes about
3.7 GB under `src-tauri/target/`, down from 14.8 GB with the defaults,
and `cargo build` and `cargo test` no longer recompile each other.
Panics and backtraces still show file and line. For a session that needs
local variables in the debugger, build with
`CARGO_PROFILE_DEV_DEBUG=full cargo build`.

Stale artifacts pile up only after `Cargo.lock`, feature or profile
changes; file times are no guide, since cargo does not touch up-to-date
units. Run `cargo clean` after such a change (the next build is cold,
about ten minutes) or `cargo clean -p anagnost` to drop only the crate's
own outputs.

### Headless transcription

Keeps app data, settings, logs and models inside `.scratch/` (gitignored).
Run it from `src-tauri/`: debug builds also regenerate `../src/bindings.ts`,
relative to the working directory.

```bash
S=$PWD/.scratch
cd src-tauri
LD_LIBRARY_PATH=$PWD/transcribe-libs \
XDG_DATA_HOME=$S/xdg/data XDG_CONFIG_HOME=$S/xdg/config \
XDG_CACHE_HOME=$S/xdg/cache \
xvfb-run -a target/debug/anagnost \
  --transcribe-file $S/audio/jfk.wav \
  --model handy-computer/canary-180m-flash-gguf/canary-180m-flash-Q8_0.gguf
```

Expected output (CPU, under a second): "And so, my fellow Americans, ask not
what your country can do for you…".

Test data:

- Model: download `canary-180m-flash-Q8_0.gguf` from the
  `handy-computer/canary-180m-flash-gguf` Hugging Face repo into the HF cache
  layout under
  `$S/xdg/data/com.pedrojacob.anagnost/huggingface/models--handy-computer--canary-180m-flash-gguf/`
  (`snapshots/<revision>/` plus `refs/main` containing the revision). Take the
  revision from `src-tauri/src/catalog/catalog.json`.
- Audio: `jfk.wav` from whisper.cpp's `samples/` directory, saved as
  `$S/audio/jfk.wav`.

On Linux the regenerated bindings carry the non-macOS doc comment for
`isLaptop`; keep the macOS wording when committing `src/bindings.ts`.
