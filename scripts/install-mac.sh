#!/bin/bash
# Install or update the app from the latest CI build (the rolling `latest`
# GitHub release), replacing and relaunching any running copy. Uses only
# tools that ship with macOS and leaves nothing behind but the app itself.
#
# Usage: scripts/install-mac.sh [--force]
#   --force  reinstall even if the installed build is current
#
# Without a checkout:
#   curl -fsSL https://raw.githubusercontent.com/pedrokljacob/anagnost/main/scripts/install-mac.sh | bash

set -euo pipefail

REPO="pedrokljacob/anagnost"
BASE_URL="https://github.com/$REPO/releases/download/latest"
ASSET="anagnost-macos-arm64.dmg"
MIN_MACOS=13

force=false
for arg in "$@"; do
  case "$arg" in
    --force) force=true ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This script is for macOS." >&2
  exit 1
fi
# hw.optional.arm64 is 1 on Apple Silicon even when this shell runs under
# Rosetta, where `uname -m` says x86_64.
if [[ "$(sysctl -n hw.optional.arm64 2>/dev/null)" != 1 ]]; then
  echo "The app is built for Apple Silicon only; this Mac has an Intel processor." >&2
  exit 1
fi
macos_version=$(sw_vers -productVersion)
if ((${macos_version%%.*} < MIN_MACOS)); then
  echo "The app needs macOS $MIN_MACOS or later; this Mac runs macOS $macos_version." >&2
  exit 1
fi

# latest.txt holds the build's commit and the app bundle name, one per line.
info=$(curl -fsSL "$BASE_URL/latest.txt")
commit=$(sed -n 1p <<<"$info")
app_name=$(sed -n 2p <<<"$info")
# Guards the `rm -rf` below against a malformed latest.txt.
if [[ ! "$commit" =~ ^[0-9a-f]{40}$ || ! "$app_name" =~ ^[A-Za-z0-9._\ -]+\.app$ ]]; then
  echo "Unexpected build info from $BASE_URL/latest.txt" >&2
  exit 1
fi
app="/Applications/$app_name"

installed=$(defaults read "$app/Contents/Info.plist" AnagnostCommit 2>/dev/null || true)
if [[ "$installed" == "$commit" ]] && ! $force; then
  echo "$app_name is up to date (${commit:0:7}). Use --force to reinstall."
  exit 0
fi

# Check up front that the app can be replaced, before downloading anything.
if [[ ! -w /Applications ]]; then
  echo "Cannot write to /Applications. Run this from an administrator account." >&2
  exit 1
fi
if [[ -e "$app" && ! -w "$app" ]]; then
  echo "Cannot replace $app: you lack write access to it. Delete it in Finder first." >&2
  exit 1
fi

# The new copy is staged next to the old one, on the same volume, so the
# swap below is two renames. The names lack `.app`, so macOS does not treat
# them as apps.
staging="/Applications/.${app_name%.app}-new.$$"
backup="/Applications/.${app_name%.app}-old.$$"
tmp=$(mktemp -d)
mnt="$tmp/mnt"
mkdir "$mnt"
cleanup() {
  hdiutil detach -quiet "$mnt" 2>/dev/null || true
  rm -rf "$tmp" "$staging"
  # Only reached if the swap was interrupted: put the old app back.
  if [[ -e "$backup" ]]; then
    if [[ -e "$app" ]]; then
      rm -rf "$backup"
    else
      mv "$backup" "$app" && echo "Restored the previous $app_name." >&2
    fi
  fi
}
trap cleanup EXIT
# Run the cleanup on Ctrl-C too.
trap 'exit 130' INT TERM HUP

echo "Downloading the latest build..."
curl -fL --progress-bar -o "$tmp/$ASSET" "$BASE_URL/$ASSET"
hdiutil attach -quiet -nobrowse -readonly -mountpoint "$mnt" "$tmp/$ASSET"
if [[ ! -d "$mnt/$app_name" ]]; then
  echo "The downloaded image does not contain $app_name." >&2
  exit 1
fi

info_plist="$mnt/$app_name/Contents/Info.plist"
bundle_id=$(defaults read "$info_plist" CFBundleIdentifier)
executable=$(defaults read "$info_plist" CFBundleExecutable)
# Report the commit the image was built from: latest.txt may already point
# at a newer build than the image downloaded a moment later.
built=$(defaults read "$info_plist" AnagnostCommit 2>/dev/null || true)
built=${built:0:7}

if ! ditto "$mnt/$app_name" "$staging"; then
  echo "Could not copy $app_name to /Applications. The installed app is unchanged." >&2
  exit 1
fi
xattr -dr com.apple.quarantine "$staging" 2>/dev/null || true

# The executable's name can differ in case from the app's.
if pgrep -ixq "$executable"; then
  echo "Quitting $app_name..."
  osascript -e "tell application id \"$bundle_id\" to quit" 2>/dev/null || true
  for _ in $(seq 20); do
    pgrep -ixq "$executable" || break
    sleep 0.5
  done
  pkill -ix "$executable" 2>/dev/null || true
fi

if [[ -e "$app" ]] && ! mv "$app" "$backup"; then
  echo "Could not move the installed $app_name aside. It is unchanged." >&2
  exit 1
fi
if ! mv "$staging" "$app"; then
  echo "Could not move the new $app_name into place." >&2
  exit 1
fi
rm -rf "$backup"

echo "Installed $app_name ${built:-(unknown build)}. Launching..."
open "$app"
