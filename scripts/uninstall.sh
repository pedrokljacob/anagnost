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
# It first checks what it cannot undo by itself (the login item, the running
# app). If any of it is still on, it says what to turn off and stops without
# deleting anything; run it again afterwards.

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
settings_file="$data_dir/settings_store.json"

# Prints true, false or unknown: whether "Launch on Startup" is on. The app
# registers its login item with SMAppService, which only the app can undo
# (it unregisters when the setting is switched off), so the setting is the
# source of truth. The settings file is tauri-plugin-store JSON,
# {"settings": {..., "autostart_enabled": <bool>, ...}}. It is parsed with
# JavaScript for Automation (ships with macOS; python3 does not, and plutil
# rejects the file's JSON nulls). A missing file or key means the default,
# off.
autostart_enabled() {
  if [[ ! -e "$settings_file" ]]; then
    echo false
    return
  fi
  local value
  value=$(/usr/bin/osascript -l JavaScript -e '
    function run(argv) {
      const text = $.NSString.stringWithContentsOfFileEncodingError(
        argv[0], $.NSUTF8StringEncoding, null);
      if (text.isNil()) return "unknown";
      try {
        const settings = JSON.parse(text.js).settings || {};
        const value = settings.autostart_enabled;
        if (value === undefined || value === false) return "false";
        return value === true ? "true" : "unknown";
      } catch (e) {
        return "unknown";
      }
    }' "$settings_file" 2>/dev/null) || value=unknown
  case "$value" in
    true | false) echo "$value" ;;
    *) echo unknown ;;
  esac
}

# Things to turn off before anything is deleted, in the order to do them.
blockers=()
warnings=()
case "$(autostart_enabled)" in
  true)
    if [[ -d "$app" ]]; then
      blockers+=("Open $APP_NAME, go to Settings > Advanced and turn off \"Launch on Startup\". This removes its login item.")
    else
      # Without the app nobody can unregister the login item; the user has to.
      warnings+=("\"Launch on Startup\" is on but $app is gone. Remove $APP_NAME under System Settings > General > Login Items if it is listed.")
    fi
    ;;
  unknown)
    warnings+=("Could not tell from $settings_file whether \"Launch on Startup\" is on. If it is, turn it off in $APP_NAME (Settings > Advanced) before uninstalling.")
    ;;
esac
# The executable's name can differ in case from the app's.
if pgrep -ix "$APP_NAME" >/dev/null; then
  blockers+=("Quit $APP_NAME (menu bar icon > Quit).")
fi

if ((${#blockers[@]} > 0)); then
  echo "Nothing was deleted. First:" >&2
  i=1
  for blocker in "${blockers[@]}"; do
    echo "  $i. $blocker" >&2
    i=$((i + 1))
  done
  echo "Then run this script again." >&2
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
# macOS ships bash 3.2, where "${a[@]}" on an empty array trips `set -u`.
for warning in ${warnings[@]+"${warnings[@]}"}; do
  echo "Warning: $warning" >&2
done

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

for path in ${existing[@]+"${existing[@]}"}; do
  rm -rf "$path"
done

echo "Done."
