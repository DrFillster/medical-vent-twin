#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BIN="$ROOT/native-engine/build/medical-vent-twin-native"
TEMPLATE="$ROOT/native-engine/macos/com.defyinglogic.medical-vent-twin-native.plist.in"
PLIST="$HOME/Library/LaunchAgents/com.defyinglogic.medical-vent-twin-native.plist"
LOG_DIR="$HOME/Library/Logs"
UID_VALUE="$(id -u)"

if [ "$(uname -s)" != "Darwin" ]; then
  printf '%s\n' "This installer is for macOS." >&2
  exit 1
fi

if [ ! -x "$BIN" ]; then
  "$ROOT/scripts/build-native-mac.sh"
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[&|]/\\&/g'
}

BIN_ESCAPED="$(escape_sed_replacement "$BIN")"
OUT_ESCAPED="$(escape_sed_replacement "$LOG_DIR/medical-vent-twin-native.out.log")"
ERR_ESCAPED="$(escape_sed_replacement "$LOG_DIR/medical-vent-twin-native.err.log")"

sed \
  -e "s|__NATIVE_ENGINE_BINARY__|$BIN_ESCAPED|g" \
  -e "s|__NATIVE_ENGINE_STDOUT__|$OUT_ESCAPED|g" \
  -e "s|__NATIVE_ENGINE_STDERR__|$ERR_ESCAPED|g" \
  "$TEMPLATE" > "$PLIST"

plutil -lint "$PLIST"

launchctl bootout "gui/$UID_VALUE" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID_VALUE" "$PLIST"
launchctl enable "gui/$UID_VALUE/com.defyinglogic.medical-vent-twin-native"
launchctl kickstart -k "gui/$UID_VALUE/com.defyinglogic.medical-vent-twin-native"

printf '%s\n' "Installed: $PLIST"
printf '%s\n' "Health: http://127.0.0.1:8771/health"
printf '%s\n' "Logs:"
printf '  %s\n' "$LOG_DIR/medical-vent-twin-native.out.log"
printf '  %s\n' "$LOG_DIR/medical-vent-twin-native.err.log"
