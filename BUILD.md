# Build Instructions

Anagnost ships for macOS on Apple Silicon. The Mac app is built on a Mac;
Linux is only a test bench for the Rust crate and the frontend (see
[Linux test bench](#linux-test-bench)).

## Install the latest CI build

Every push to `main` runs `.github/workflows/mac-build.yml` on a GitHub
Apple Silicon runner and publishes the app as the rolling `latest`
pre-release. No local build is needed.

Install or update it on the Mac with the tools macOS ships with:

```bash
curl -fsSL https://raw.githubusercontent.com/pedrokljacob/anagnost/main/scripts/install-mac.sh | bash
```

From a checkout, `scripts/install-mac.sh` does the same. It skips the
download when the installed build is already current; pass `--force` to
reinstall (`| bash -s -- --force` for the one-liner). It leaves nothing on
the Mac but the app; `curl` downloads are not quarantined, so Gatekeeper
does not block the unnotarized app.

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

After installing the final bundle at `/Applications/Handy.app`, quit the app, clear only
its stale Accessibility record, then reopen it:

```bash
osascript -e 'tell application id "com.pais.handy" to quit' || true
tccutil reset Accessibility com.pais.handy
open /Applications/Handy.app
```

Grant Accessibility again when prompted. This does not reset Microphone or other TCC
services.

For optional diagnosis, compare the designated requirements of the previous and rebuilt
bundles:

```bash
codesign -dr - /path/to/previous/Handy.app 2>&1
codesign -dr - /Applications/Handy.app 2>&1
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
the top of `src/dev/mock/index.ts`. Headless WebKit (`playwright-cli open
--browser=webkit`) is the closest match to the Mac's WKWebView.

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
  librsvg2-dev libgtk-layer-shell0 libgtk-layer-shell-dev patchelf cmake xvfb
```

### Full check

Run after every Rust or frontend change. The first `cargo build` takes about
ten minutes.

```bash
bun install
bun run build && bun run lint && bunx prettier --check . && bun run test:keyboard
bun run check:model-languages
(cd src-tauri && cargo build && cargo test)
```

### Headless transcription

Keeps app data, settings, logs and models inside `.scratch/` (gitignored).
Run it from `src-tauri/`: debug builds also regenerate `../src/bindings.ts`,
relative to the working directory.

```bash
S=$PWD/.scratch
cd src-tauri
LD_LIBRARY_PATH=$PWD/transcribe-libs \
XDG_DATA_HOME=$S/xdg/data XDG_CONFIG_HOME=$S/xdg/config \
XDG_CACHE_HOME=$S/xdg/cache HF_HOME=$S/hf \
xvfb-run -a target/debug/handy \
  --transcribe-file $S/audio/jfk.wav \
  --model handy-computer/canary-180m-flash-gguf/canary-180m-flash-Q8_0.gguf
```

Expected output (CPU, under a second): "And so, my fellow Americans, ask not
what your country can do for you…".

Test data:

- Model: download `canary-180m-flash-Q8_0.gguf` from the
  `handy-computer/canary-180m-flash-gguf` Hugging Face repo into the HF cache
  layout under `$S/hf/hub/models--handy-computer--canary-180m-flash-gguf/`
  (`snapshots/<revision>/` plus `refs/main` containing the revision). Take the
  revision from `src-tauri/src/catalog/catalog.json`.
- Audio: `jfk.wav` from whisper.cpp's `samples/` directory, saved as
  `$S/audio/jfk.wav`.

On Linux the regenerated bindings carry the non-macOS doc comment for
`isLaptop`; keep the macOS wording when committing `src/bindings.ts`.
