#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BIN="$ROOT/native-engine/build/medical-vent-twin-native"

if [ ! -x "$BIN" ]; then
  "$ROOT/scripts/build-native-mac.sh"
fi

: "${NATIVE_ENGINE_BIND:=127.0.0.1}"
: "${NATIVE_ENGINE_PORT:=8771}"
export NATIVE_ENGINE_BIND NATIVE_ENGINE_PORT

exec "$BIN"
