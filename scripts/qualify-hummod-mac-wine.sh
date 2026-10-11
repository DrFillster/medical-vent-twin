#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
OUT_DIR="${1:-$ROOT/runtime/hummod-wine-qualification}"
HUMMOD_ROOT="${HUMMOD_ROOT:-}"
WINE_BIN="${WINE_BIN:-}"
WINEPATH_BIN="${WINEPATH_BIN:-}"

EXPECTED_SHA="4243E8721F77A5FABF3128FAC5AC139588B20A8285D35D2021C6852D596803CB"
EXPECTED_BYTES="2043904"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This qualification script is for macOS." >&2
  exit 2
fi
if [ -z "$HUMMOD_ROOT" ]; then
  echo "HUMMOD_ROOT is required." >&2
  exit 2
fi
if [ -z "$WINE_BIN" ]; then
  if command -v wine >/dev/null 2>&1; then
    WINE_BIN="$(command -v wine)"
  else
    echo "Plain Wine was not found on PATH. Set WINE_BIN explicitly." >&2
    exit 2
  fi
fi
if [ -z "$WINEPATH_BIN" ]; then
  if command -v winepath >/dev/null 2>&1; then
    WINEPATH_BIN="$(command -v winepath)"
  else
    WINEPATH_BIN="$(dirname "$WINE_BIN")/winepath"
  fi
fi
if [ ! -x "$WINEPATH_BIN" ]; then
  echo "winepath was not found. Set WINEPATH_BIN explicitly." >&2
  exit 2
fi
if ! command -v x86_64-w64-mingw32-gcc >/dev/null 2>&1; then
  echo "x86_64-w64-mingw32-gcc is required. Install mingw-w64." >&2
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required for native SOLN conversion." >&2
  exit 2
fi

EXE="$HUMMOD_ROOT/HumMod.EXE"
MODEL="$HUMMOD_ROOT/HumMod.DES"
if [ ! -f "$EXE" ] || [ ! -f "$MODEL" ]; then
  echo "HumMod.EXE and HumMod.DES must exist in HUMMOD_ROOT." >&2
  exit 2
fi

actual_sha="$(shasum -a 256 "$EXE" | awk '{print toupper($1)}')"
actual_bytes="$(stat -f '%z' "$EXE")"
if [ "$actual_sha" != "$EXPECTED_SHA" ] || [ "$actual_bytes" != "$EXPECTED_BYTES" ]; then
  echo "Pinned HumMod executable verification failed." >&2
  echo "expected sha=$EXPECTED_SHA bytes=$EXPECTED_BYTES" >&2
  echo "actual   sha=$actual_sha bytes=$actual_bytes" >&2
  exit 3
fi

mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
PROBE_EXE="$OUT_DIR/hummod-wine-control.exe"

x86_64-w64-mingw32-gcc -O2 -Wall -Wextra \
  -o "$PROBE_EXE" \
  "$ROOT/native-engine/hummod-wine/hummod-wine-control.c" \
  -luser32

launch_log="$OUT_DIR/hummod-launch.log"
(
  cd "$HUMMOD_ROOT"
  exec "$WINE_BIN" "$EXE" '<model> HumMod.DES </model>'
) >"$launch_log" 2>&1 &
launcher_pid=$!

cleanup() {
  set +e
  "$WINE_BIN" "$PROBE_EXE" command 5 >/dev/null 2>&1
  sleep 1
  kill "$launcher_pid" >/dev/null 2>&1
}
trap cleanup EXIT INT TERM

deadline=$(( $(date +%s) + 45 ))
until "$WINE_BIN" "$PROBE_EXE" main >"$OUT_DIR/main-window.txt" 2>"$OUT_DIR/main-window.err"; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "HumMod main window was not detected within 45 seconds." >&2
    exit 4
  fi
  sleep 1
done

wait_dialog() {
  deadline=$(( $(date +%s) + 10 ))
  until "$WINE_BIN" "$PROBE_EXE" dialog >"$OUT_DIR/dialog.txt" 2>"$OUT_DIR/dialog.err"; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "Expected HumMod file dialog was not detected." >&2
      exit 5
    fi
    sleep 1
  done
}

wait_stable_file() {
  path="$1"
  deadline=$(( $(date +%s) + 30 ))
  last_size=-1
  while :; do
    if [ -s "$path" ]; then
      size="$(stat -f '%z' "$path")"
      if [ "$size" = "$last_size" ]; then return 0; fi
      last_size="$size"
    fi
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "Timed out waiting for stable file: $path" >&2
      exit 7
    fi
    sleep 1
  done
}

save_solution() {
  path="$1"
  if [ -e "$path" ]; then
    echo "Refusing to overwrite solution: $path" >&2
    exit 6
  fi
  windows_path="$("$WINEPATH_BIN" -w "$path")"
  "$WINE_BIN" "$PROBE_EXE" command 4
  wait_dialog
  "$WINE_BIN" "$PROBE_EXE" dialog-submit "$windows_path"
  wait_stable_file "$path"
}

load_solution() {
  path="$1"
  if [ ! -s "$path" ]; then
    echo "Solution does not exist: $path" >&2
    exit 8
  fi
  windows_path="$("$WINEPATH_BIN" -w "$path")"
  "$WINE_BIN" "$PROBE_EXE" command 3
  wait_dialog
  "$WINE_BIN" "$PROBE_EXE" dialog-submit "$windows_path"
  sleep 2
}

advance_one_second() {
  "$WINE_BIN" "$PROBE_EXE" command 12
  sleep 1
}

convert_solution() {
  solution="$1"
  target="$2"
  mkdir -p "$target"
  node "$ROOT/ards-twin-v1.0/scripts/convert-hummod-native-solution.js" \
    "$solution" "$target"
}

initial="$OUT_DIR/initial.SOLN"
after3="$OUT_DIR/after-3sec.SOLN"
restored="$OUT_DIR/restored.SOLN"
restored1="$OUT_DIR/restored-plus-1sec.SOLN"

save_solution "$initial"
advance_one_second
advance_one_second
advance_one_second
save_solution "$after3"

load_solution "$initial"
save_solution "$restored"
advance_one_second
save_solution "$restored1"

convert_solution "$initial" "$OUT_DIR/initial-converted"
convert_solution "$after3" "$OUT_DIR/after3-converted"
convert_solution "$restored" "$OUT_DIR/restored-converted"
convert_solution "$restored1" "$OUT_DIR/restored1-converted"

wine_version="$("$WINE_BIN" --version 2>/dev/null || true)"

node - "$OUT_DIR" "$actual_sha" "$wine_version" <<'NODE'
const fs=require('fs');
const path=require('path');

const out=process.argv[2];
const executableSha256=process.argv[3];
const wineVersion=process.argv[4];

function readTrajectory(name){
  return JSON.parse(fs.readFileSync(
    path.join(out,name,'Vent.trajectory.json'),'utf8'
  ));
}
function finalRow(t){
  if(!Array.isArray(t.rows)||!t.rows.length) throw new Error('trajectory rows missing');
  return t.rows[t.rows.length-1];
}
function sameJson(a,b){
  return JSON.stringify(a)===JSON.stringify(b);
}

const initial=readTrajectory('initial-converted');
const after3=readTrajectory('after3-converted');
const restored=readTrajectory('restored-converted');
const restored1=readTrajectory('restored1-converted');

if(!sameJson(initial.rows,restored.rows)){
  throw new Error('restored HumMod trajectory does not exactly match baseline');
}

const i=finalRow(initial);
const a=finalRow(after3);
const r=finalRow(restored);
const r1=finalRow(restored1);

if(!(a.sourceClockValue>i.sourceClockValue)){
  throw new Error('three-second advance did not increase native source clock');
}
if(r.sourceClockValue!==i.sourceClockValue){
  throw new Error('restore did not return native source clock to baseline');
}
if(!(r1.sourceClockValue>r.sourceClockValue)){
  throw new Error('post-restore one-second advance did not increase source clock');
}

const required=[
  'Heart-Rate.Rate',
  'SystemicArtys.Pressure',
  'CardiacOutput.Flow(L/Min)',
  'PO2Artys.Pressure',
  'CO2Artys.Pressure',
  'BloodPh.ArtysPh',
];
for(const symbol of required){
  for(const row of [i,a,r,r1]){
    if(!Number.isFinite(row.values[symbol])){
      throw new Error('missing/nonfinite '+symbol);
    }
  }
  if(r.values[symbol]!==i.values[symbol]){
    throw new Error('restore mismatch for '+symbol);
  }
}

const report={
  schema:'medical-vent-twin/mac-wine-hummod-qualification/v1',
  ok:true,
  upstream:{
    repository:'riliescu/hummod-standalone',
    revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
    executableSha256,
  },
  runtime:{
    transport:'plain-wine-win32-command-and-solution-dialog',
    wineVersion,
    sameProcessSession:true,
  },
  commandIds:{loadSolution:3,saveSolution:4,exit:5,go1Sec:12},
  baseline:i,
  after3sec:a,
  restored:r,
  restoredPlus1sec:r1,
  acceptance:{
    baselineCaptured:true,
    sequentialAdvanceCaptured:true,
    exactCheckpointRestore:true,
    postRestoreAdvanceCaptured:true,
    sixCoreOutputsFinite:true,
    clinicalValidation:false,
  },
  authority:{physiologyAuthority:false,controlAuthority:false},
};
fs.writeFileSync(
  path.join(out,'qualification-report.json'),
  JSON.stringify(report,null,2)+'\n'
);
console.log(JSON.stringify(report,null,2));
NODE

echo "PASS: Mac Wine HumMod qualification completed."
echo "Report: $OUT_DIR/qualification-report.json"
