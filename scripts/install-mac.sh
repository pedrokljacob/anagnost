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

tmp=$(mktemp -d)
mnt="$tmp/mnt"
mkdir "$mnt"
cleanup() {
  hdiutil detach -quiet "$mnt" 2>/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT

echo "Downloading build ${commit:0:7}..."
curl -fL --progress-bar -o "$tmp/$ASSET" "$BASE_URL/$ASSET"
hdiutil attach -quiet -nobrowse -readonly -mountpoint "$mnt" "$tmp/$ASSET"

bundle_id=$(defaults read "$mnt/$app_name/Contents/Info.plist" CFBundleIdentifier)
executable=$(defaults read "$mnt/$app_name/Contents/Info.plist" CFBundleExecutable)

if pgrep -xq "$executable"; then
  echo "Quitting $app_name..."
  osascript -e "tell application id \"$bundle_id\" to quit" 2>/dev/null || true
  for _ in $(seq 20); do
    pgrep -xq "$executable" || break
    sleep 0.5
  done
  pkill -x "$executable" 2>/dev/null || true
fi

rm -rf "$app"
ditto "$mnt/$app_name" "$app"
xattr -dr com.apple.quarantine "$app" 2>/dev/null || true

echo "Installed $app_name ${commit:0:7}. Launching..."
open "$app"
