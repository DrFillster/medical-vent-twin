#!/bin/sh
set -eu

BASE_URL="${1:-https://engine.hummod.defying-logic.com}"
BASE_URL="${BASE_URL%/}"

printf '%s\n' "Checking native engine through Cloudflare:"
printf '  %s\n' "$BASE_URL"

health_file="${TMPDIR:-/tmp}/medical-vent-twin-native-health.$$"
state_file="${TMPDIR:-/tmp}/medical-vent-twin-native-state.$$"
trap 'rm -f "$health_file" "$state_file"' EXIT HUP INT TERM

curl --fail --silent --show-error   --header 'Accept: application/json'   "$BASE_URL/health" > "$health_file"

curl --fail --silent --show-error   --header 'Accept: application/json'   "$BASE_URL/state" > "$state_file"

node - "$health_file" "$state_file" <<'NODE'
const fs=require('fs');
const health=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const state=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));

if(health.schema!=='native-engine-health/v1'||health.status!=='ok'){
  throw new Error('unexpected native health payload');
}
if(health.physiologyAuthority!==false||health.controlAuthority!==false){
  throw new Error('native health unexpectedly claims authority');
}
if(state.schema!=='native-engine-state/v1'){
  throw new Error('unexpected native state schema');
}
if(state.physiologyAuthority!==false||state.controlAuthority!==false){
  throw new Error('native state unexpectedly claims authority');
}

console.log('Cloudflare -> native engine: OK');
console.log('service:',health.service);
console.log('state:',state.status);
console.log('physiology authority:',state.physiologyAuthority);
console.log('control authority:',state.controlAuthority);
NODE
