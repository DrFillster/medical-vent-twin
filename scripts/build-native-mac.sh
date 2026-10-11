#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BUILD_DIR="$ROOT/native-engine/build"

cmake -S "$ROOT/native-engine" -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD_DIR" --config Release --parallel

printf '%s\n' "Built: $BUILD_DIR/medical-vent-twin-native"
