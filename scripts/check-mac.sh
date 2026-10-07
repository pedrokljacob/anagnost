#!/bin/bash
# Check an installed CI build on this Mac: the part of the Mac checkpoint a
# script can verify. Pairs with scripts/install-mac.sh; see BUILD.md,
# "Checking a build on the Mac". Uses only tools that ship with macOS.
#
# Usage: scripts/check-mac.sh [--mark] [--wav <file>] [--expect <text>]
#   --mark         write the footprint marker and exit; run it before
#                  installing, then run the script again afterwards
#   --wav <file>   transcribe this WAV (16 kHz, mono, 16-bit) through the
#                  installed app and report the text and speed;
#                  tests/audio/jfk.wav is a committed fixture
#   --expect <t>   fail unless the transcript contains <t> (case-insensitive)
#
# Prints one line per check and exits non-zero if any failed.

set -uo pipefail

APP_NAME="Anagnost"
BUNDLE_ID="com.pedrojacob.anagnost"
SIGNING_IDENTITY="Anagnost Signing"
REPO="pedrokljacob/anagnost"

app="/Applications/$APP_NAME.app"
data_dir="$HOME/Library/Application Support/$BUNDLE_ID"
marker="${TMPDIR:-/tmp}/anagnost-check-mark"

mark=false
wav=""
expected=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mark) mark=true ;;
    --wav)
      wav="${2:-}"
      shift
      ;;
    --expect)
      expected="${2:-}"
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This script is for macOS." >&2
  exit 1
fi

if $mark; then
  touch "$marker"
  echo "Marker written: $marker. Install the build, use it, then run this script again."
  exit 0
fi

failed=0
pass() { echo "ok    $1"; }
fail() {
  echo "FAIL  $1"
  failed=1
}

# --- The app bundle ---------------------------------------------------------

if [[ ! -d "$app" ]]; then
  fail "$app is not installed"
  exit 1
fi
pass "$app exists"

if codesign --verify --deep --strict "$app" 2>/dev/null; then
  pass "signature verifies"
else
  fail "signature does not verify"
fi
sig=$(codesign -dvv "$app" 2>&1)
if grep -q '^Signature=adhoc$' <<<"$sig"; then
  fail "ad-hoc signature (not a CI build)"
elif grep -q "^Authority=$SIGNING_IDENTITY$" <<<"$sig"; then
  pass "signed by \"$SIGNING_IDENTITY\""
else
  fail "signed by an unexpected authority: $(grep '^Authority=' <<<"$sig" | head -1)"
fi

plist="$app/Contents/Info.plist"
bundle_id=$(defaults read "$plist" CFBundleIdentifier 2>/dev/null || true)
[[ "$bundle_id" == "$BUNDLE_ID" ]] && pass "bundle identifier is $BUNDLE_ID" || fail "bundle identifier is \"$bundle_id\""
min_os=$(defaults read "$plist" LSMinimumSystemVersion 2>/dev/null || true)
[[ "$min_os" == "13.0" ]] && pass "minimum macOS is 13.0" || fail "minimum macOS is \"$min_os\""

commit=$(defaults read "$plist" AnagnostCommit 2>/dev/null || true)
if [[ "$commit" =~ ^[0-9a-f]{40}$ ]]; then
  pass "built from commit ${commit:0:7}"
  latest=$(curl -fsSL --max-time 10 "https://github.com/$REPO/releases/download/latest/latest.txt" 2>/dev/null | sed -n 1p || true)
  if [[ -z "$latest" ]]; then
    echo "skip  could not fetch latest.txt to compare the commit"
  elif [[ "$latest" == "$commit" ]]; then
    pass "matches the published latest build"
  else
    fail "the published latest build is ${latest:0:7}; run scripts/install-mac.sh"
  fi
else
  fail "no commit stamped in Info.plist (local build?)"
fi

# --- What the app leaves on disk ---------------------------------------------

if [[ -d "$data_dir" ]]; then
  mode=$(stat -f %Lp "$data_dir")
  [[ "$mode" == "700" ]] && pass "app data folder is private (0700)" || fail "app data folder mode is $mode, expected 700"
  [[ -f "$data_dir/settings_store.json" ]] && pass "settings file present" || fail "settings_store.json missing"
  if [[ -d "$data_dir/logs" ]] && grep -rqs '"error":{' "$data_dir/logs"; then
    fail "a provider response body was logged (see logs/)"
  else
    pass "logs carry no provider response bodies"
  fi
else
  echo "skip  app data folder not created yet (launch the app once)"
fi

# Webviews keep no data on disk (DECISIONS.md): these must never appear.
for path in "$HOME/Library/WebKit/$BUNDLE_ID" \
  "$HOME/Library/HTTPStorages/$BUNDLE_ID" \
  "$HOME/Library/HTTPStorages/$BUNDLE_ID.binarycookies"; do
  [[ -e "$path" ]] && fail "webview data on disk: $path"
done
pass "no webview storage outside the app data folder"

if [[ -e "$marker" ]]; then
  # Everything newer than the marker that names the app, apart from the app
  # itself, its data folder and what macOS keeps for every app.
  allowed=(
    "$app"
    "$data_dir"
    "$HOME/Library/Caches/$BUNDLE_ID"
    "$HOME/Library/Preferences/$BUNDLE_ID.plist"
    "$HOME/Library/Saved Application State/$BUNDLE_ID.savedState"
    "$marker"
  )
  prune=()
  for a in "${allowed[@]}"; do prune+=(-path "$a" -prune -o); done
  stray=$(find "$HOME/Library" /Applications /tmp "${TMPDIR:-/tmp}" "${prune[@]}" \
    -newer "$marker" \( -iname '*anagnost*' -o -iname "*$BUNDLE_ID*" \) -print 2>/dev/null)
  if [[ -z "$stray" ]]; then
    pass "nothing written outside the app data folder since the marker"
  else
    fail "written outside the app data folder since the marker:"
    sed 's/^/        /' <<<"$stray"
  fi
else
  echo "skip  no footprint marker; run with --mark before installing to check the footprint"
fi

# --- The real transcription path ---------------------------------------------

if [[ -n "$wav" ]]; then
  if [[ ! -f "$wav" ]]; then
    fail "WAV not found: $wav"
  else
    out=$("$app/Contents/MacOS/anagnost" --transcribe-file "$wav" --json 2>/dev/null)
    status=$?
    if [[ $status -ne 0 ]]; then
      fail "headless transcription exited with $status (is a model selected in the app?)"
    else
      text=$(sed -n 's/.*"text":"\([^"]*\)".*/\1/p' <<<"$out")
      rtf=$(sed -n 's/.*"rtf":\([0-9.]*\).*/\1/p' <<<"$out")
      backend=$(sed -n 's/.*"bound_backend":"\([^"]*\)".*/\1/p' <<<"$out")
      if [[ -z "$text" ]]; then
        fail "transcription returned no text"
      else
        pass "transcribed on $backend, real-time factor $rtf: \"$text\""
        if [[ -n "$expected" ]] && ! grep -qi -- "$expected" <<<"$text"; then
          fail "transcript does not contain \"$expected\""
        fi
      fi
    fi
  fi
fi

if [[ $failed -ne 0 ]]; then
  echo "Some checks failed." >&2
  exit 1
fi
echo "All checks passed."
