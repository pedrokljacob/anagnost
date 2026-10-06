#!/bin/bash
# Remove every trace the app leaves on macOS: app data and logs, the caches,
# preferences and crash reports macOS keeps for it, and its privacy
# permissions.
#
# Usage: scripts/uninstall.sh [--app] [--yes]
#   --app  also delete /Applications/$APP_NAME.app
#   --yes  do not ask for confirmation
#
# Without a checkout:
#   curl -fsSL https://raw.githubusercontent.com/pedrokljacob/anagnost/main/scripts/uninstall.sh | bash -s -- --app
#
# Before running it, turn off "Launch at login" in the app (or remove it under
# System Settings > General > Login Items) and quit the app.

set -euo pipefail

APP_NAME="Anagnost"
BUNDLE_ID="com.pedrojacob.anagnost"

remove_app=false
assume_yes=false
for arg in "$@"; do
  case "$arg" in
    --app) remove_app=true ;;
    --yes) assume_yes=true ;;
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

app="/Applications/$APP_NAME.app"
data_dir="$HOME/Library/Application Support/$BUNDLE_ID"

# The executable's name can differ in case from the app's.
if pgrep -ix "$APP_NAME" >/dev/null; then
  echo "$APP_NAME is running. Quit it first." >&2
  exit 1
fi

# The single-instance socket name replaces '.' and '-' with '_'.
socket_id="${BUNDLE_ID//[.-]/_}"

paths=(
  "$data_dir"
  "$HOME/Library/Caches/$BUNDLE_ID"
  "$HOME/Library/WebKit/$BUNDLE_ID"
  "$HOME/Library/HTTPStorages/$BUNDLE_ID"
  "$HOME/Library/HTTPStorages/$BUNDLE_ID.binarycookies"
  "$HOME/Library/Preferences/$BUNDLE_ID.plist"
  "$HOME/Library/Saved Application State/$BUNDLE_ID.savedState"
  "$(getconf DARWIN_USER_CACHE_DIR)$BUNDLE_ID"
  "$(getconf DARWIN_USER_TEMP_DIR)$BUNDLE_ID"
  "/tmp/${socket_id}_si.sock"
)
shopt -s nullglob
paths+=("$HOME/Library/Preferences/ByHost/$BUNDLE_ID".*.plist)
# Crash and resource reports are named after the executable, whose case
# differs from the app's (anagnost-2026-01-01-120000.ips,
# anagnost_2026-01-01-120000_Host.cpu_resource.diag).
shopt -s nocaseglob
for dir in "$HOME/Library/Logs/DiagnosticReports" \
  "$HOME/Library/Logs/DiagnosticReports/Retired"; do
  paths+=("$dir/$APP_NAME"[-_]*.ips "$dir/$APP_NAME"[-_]*.diag)
done
shopt -u nocaseglob nullglob
if $remove_app; then
  paths+=("$app")
fi

existing=()
for path in "${paths[@]}"; do
  if [[ -e "$path" || -L "$path" ]]; then
    existing+=("$path")
  fi
done

echo "Files to delete:"
if ((${#existing[@]} == 0)); then
  echo "  (none found)"
else
  printf '  %s\n' "${existing[@]}"
fi
echo "Privacy permissions to reset for $BUNDLE_ID: all (Microphone, Accessibility, Input Monitoring, ...)"

if ! $assume_yes; then
  # Read the answer from the terminal, not stdin, so `curl ... | bash` works.
  if ! (: </dev/tty) 2>/dev/null; then
    echo "No terminal to ask for confirmation. Pass --yes to delete without asking." >&2
    exit 1
  fi
  read -r -p "Continue? [y/N] " answer </dev/tty
  [[ "$answer" == [yY] ]] || exit 0
fi

# Reset permissions while the app is still installed: tccutil resolves the
# bundle ID through the installed app. Always pass the bundle ID: without it
# tccutil resets every app.
if ! tcc_output=$(tccutil reset All "$BUNDLE_ID" 2>&1); then
  echo "Warning: could not reset privacy permissions: $tcc_output" >&2
  echo "  Remove $APP_NAME by hand under System Settings > Privacy & Security >" >&2
  echo "  Microphone, Accessibility and Input Monitoring." >&2
fi

# Clear the preferences through cfprefsd first, so its cached copy is not
# written back after the plist is deleted.
defaults delete "$BUNDLE_ID" 2>/dev/null || true

# macOS ships bash 3.2, where "${a[@]}" on an empty array trips `set -u`.
for path in ${existing[@]+"${existing[@]}"}; do
  rm -rf "$path"
done

echo "Done."
