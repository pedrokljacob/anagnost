#!/usr/bin/env bash
# Installs the latest CI build of the Mac app from the rolling `latest`
# GitHub release into /Applications, replacing and relaunching any running
# copy. Needs the GitHub CLI, logged in: `brew install gh && gh auth login`.
set -euo pipefail

REPO="${ANAGNOST_REPO:-pedrokljacob/anagnost}"
ASSET="anagnost-macos-arm64.dmg"
APP="/Applications/Handy.app"
BUNDLE_ID="com.pais.handy"
PROCESS="handy"

if ! command -v gh >/dev/null; then
  echo "GitHub CLI not found. Run: brew install gh && gh auth login" >&2
  exit 1
fi

latest=$(gh release view latest -R "$REPO" --json targetCommitish -q .targetCommitish)
installed=$(defaults read "$APP/Contents/Info.plist" AnagnostCommit 2>/dev/null || true)
if [ "$latest" = "$installed" ] && [ "${1:-}" != "--force" ]; then
  echo "Already up to date (${latest:0:7}). Use --force to reinstall."
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

echo "Downloading build ${latest:0:7}..."
gh release download latest -R "$REPO" -p "$ASSET" -D "$tmp"
hdiutil attach -quiet -nobrowse -readonly -mountpoint "$mnt" "$tmp/$ASSET"

if pgrep -xq "$PROCESS"; then
  echo "Quitting the running app..."
  osascript -e "tell application id \"$BUNDLE_ID\" to quit" 2>/dev/null || true
  for _ in $(seq 20); do
    pgrep -xq "$PROCESS" || break
    sleep 0.5
  done
  pkill -x "$PROCESS" 2>/dev/null || true
fi

rm -rf "$APP"
ditto "$mnt/$(basename "$APP")" "$APP"
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true

echo "Installed ${latest:0:7}. Launching..."
open "$APP"
