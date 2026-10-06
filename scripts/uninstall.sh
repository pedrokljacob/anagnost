#!/bin/bash
# Remove every trace the app leaves on macOS: app data, logs, macOS-managed
# caches and preferences, and its privacy permissions.
#
# Usage: scripts/uninstall.sh [--app] [--yes]
#   --app  also delete /Applications/$APP_NAME.app
#   --yes  do not ask for confirmation
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

# The executable's name can differ in case from the app's.
if pgrep -ix "$APP_NAME" >/dev/null; then
  echo "$APP_NAME is running. Quit it first." >&2
  exit 1
fi

# The single-instance socket name replaces '.' and '-' with '_'.
socket_id="${BUNDLE_ID//[.-]/_}"

paths=(
  "$HOME/Library/Application Support/$BUNDLE_ID"
  "$HOME/Library/Logs/$BUNDLE_ID"
  "$HOME/Library/Caches/$BUNDLE_ID"
  "$HOME/Library/WebKit/$BUNDLE_ID"
  "$HOME/Library/HTTPStorages/$BUNDLE_ID"
  "$HOME/Library/HTTPStorages/$BUNDLE_ID.binarycookies"
  "$HOME/Library/Preferences/$BUNDLE_ID.plist"
  "$HOME/Library/Saved Application State/$BUNDLE_ID.savedState"
  "$HOME/Library/LaunchAgents/$APP_NAME.plist"
  "$(getconf DARWIN_USER_CACHE_DIR)$BUNDLE_ID"
  "/tmp/${socket_id}_si.sock"
)
shopt -s nullglob
paths+=("$HOME/Library/Logs/DiagnosticReports/$APP_NAME"-*.ips)
shopt -u nullglob
if $remove_app; then
  paths+=("/Applications/$APP_NAME.app")
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
echo "Privacy permissions to reset for $BUNDLE_ID: Microphone, Accessibility, Input Monitoring"

if ! $assume_yes; then
  read -r -p "Continue? [y/N] " answer
  [[ "$answer" == [yY] ]] || exit 0
fi

# Clear the preferences through cfprefsd first, so its cached copy is not
# written back after the plist is deleted.
defaults delete "$BUNDLE_ID" 2>/dev/null || true

# macOS ships bash 3.2, where "${a[@]}" on an empty array trips `set -u`.
for path in ${existing[@]+"${existing[@]}"}; do
  rm -rf "$path"
done

# Always pass the bundle ID: without it tccutil resets every app.
for service in Microphone Accessibility ListenEvent; do
  tccutil reset "$service" "$BUNDLE_ID" >/dev/null 2>&1 || true
done

echo "Done."
