#!/bin/sh
set -eu

PLIST="$HOME/Library/LaunchAgents/com.defyinglogic.medical-vent-twin-native.plist"
UID_VALUE="$(id -u)"

if [ -f "$PLIST" ]; then
  launchctl bootout "gui/$UID_VALUE" "$PLIST" >/dev/null 2>&1 || true
  rm -f "$PLIST"
fi

printf '%s\n' "Native engine launch agent removed."
