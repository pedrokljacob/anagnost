#!/bin/bash
# Remove the app's own files from this Mac, and the state macOS keeps for it
# as far as a script can: app data and logs, caches, preferences, crash
# reports and privacy permissions. It does not touch backups (Time Machine,
# local snapshots), downloaded disk images, other user accounts, other apps'
# data, or text the app pasted elsewhere. See BUILD.md, "Uninstall".
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
# deleting anything; run it again afterwards. It exits non-zero if some step
# failed, and says what to finish by hand.

set -euo pipefail

APP_NAME="Anagnost"
BUNDLE_ID="com.pedrojacob.anagnost"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

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
# Deleting a bundle this account cannot write to would fail halfway, after
# the app data is already gone. Same check as install-mac.sh.
if $remove_app && [[ -e "$app" && ! -w "$app" ]]; then
  blockers+=("Delete $app in Finder: you lack write access to it, so this script cannot.")
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

# Everything the app writes is under $data_dir. The rest is what macOS keeps
# for any app, listed whether or not this app triggers it today, so a
# regression (a logger writing to ~/Library/Logs, a webview keeping cookies)
# is still cleaned up.
paths=(
  "$data_dir"
  "$HOME/Library/Caches/$BUNDLE_ID"
  "$HOME/Library/Logs/$BUNDLE_ID"
  "$HOME/Library/WebKit/$BUNDLE_ID"
  "$HOME/Library/HTTPStorages/$BUNDLE_ID"
  "$HOME/Library/HTTPStorages/$BUNDLE_ID.binarycookies"
  "$HOME/Library/Cookies/$BUNDLE_ID.binarycookies"
  "$HOME/Library/Preferences/$BUNDLE_ID.plist"
  "$HOME/Library/Saved Application State/$BUNDLE_ID.savedState"
  "$(getconf DARWIN_USER_CACHE_DIR)$BUNDLE_ID"
  "$(getconf DARWIN_USER_TEMP_DIR)$BUNDLE_ID"
  "/tmp/${socket_id}_si.sock"
)
shopt -s nullglob
paths+=("$HOME/Library/Preferences/ByHost/$BUNDLE_ID".*.plist)
# Crash, hang and resource reports, and the crash dialog's preferences, are
# named after the executable, whose case differs from the app's
# (anagnost-2026-01-01-120000.ips, anagnost_2026-01-01-120000_Host.cpu_resource.diag,
# CrashReporter/anagnost_<hardware UUID>.plist).
shopt -s nocaseglob
for dir in "$HOME/Library/Logs/DiagnosticReports" \
  "$HOME/Library/Logs/DiagnosticReports/Retired"; do
  paths+=("$dir/$APP_NAME"[-_]*.ips "$dir/$APP_NAME"[-_]*.diag
    "$dir/$APP_NAME"[-_]*.spin "$dir/$APP_NAME"[-_]*.hang)
done
paths+=("$HOME/Library/Application Support/CrashReporter/$APP_NAME"_*.plist)
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

# Set when a step fails. Later steps still run, so one failure does not
# leave the rest behind, and the exit status reports it.
failed=false

# tccutil deletes the permission rows recorded under the bundle ID; it needs
# no running or installed app, so the order here is only for tidiness.
# Always pass the bundle ID: without it tccutil resets every app.
if ! tcc_output=$(tccutil reset All "$BUNDLE_ID" 2>&1); then
  failed=true
  echo "Error: could not reset privacy permissions: $tcc_output" >&2
  echo "  Remove $APP_NAME by hand under System Settings > Privacy & Security >" >&2
  echo "  Microphone, Accessibility and Input Monitoring." >&2
fi

# Clear the preferences through cfprefsd first, so its cached copy is not
# written back after the plist is deleted.
defaults delete "$BUNDLE_ID" 2>/dev/null || true

# Drop the bundle from the LaunchServices database before it goes, or a
# stale entry (Open With menus, bundle ID lookups) lingers until the
# database is rebuilt. Best effort: the database is rebuilt anyway.
if $remove_app && [[ -e "$app" && -x "$LSREGISTER" ]]; then
  "$LSREGISTER" -u "$app" >/dev/null 2>&1 || true
fi

for path in ${existing[@]+"${existing[@]}"}; do
  if ! rm -rf "$path"; then
    failed=true
    echo "Error: could not delete $path. Delete it in Finder." >&2
  fi
done

if $failed; then
  echo "Finished, but not everything was removed. See the errors above." >&2
  exit 1
fi
echo "Done."
echo "If $APP_NAME was ever set to launch on startup, check System Settings >"
echo "General > Login Items and remove it if it is still listed."
