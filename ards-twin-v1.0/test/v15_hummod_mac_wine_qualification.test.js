'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');

const manifest=JSON.parse(
  fs.readFileSync('native-engine/hummod-wine/command-manifest.json','utf8')
);

assert.equal(
  manifest.upstream.revision,
  '8dab57e05631f779bf5020fe0dd51874d8ae98c1'
);
assert.equal(
  manifest.upstream.executableSha256,
  '4243E8721F77A5FABF3128FAC5AC139588B20A8285D35D2021C6852D596803CB'
);
assert.equal(manifest.upstream.executableBytes,2043904);
assert.equal(manifest.commands.loadSolution,3);
assert.equal(manifest.commands.saveSolution,4);
assert.equal(manifest.commands.exit,5);
assert.equal(manifest.commands.go1Sec,12);
assert.equal(manifest.commands.go5Sec,13);
assert.equal(manifest.commands.go10Sec,14);
assert.equal(manifest.commands.go1Min,15);
assert.equal(manifest.commands.go5Min,16);
assert.equal(manifest.dialog.actionButtonId,1);
assert.deepEqual(manifest.dialog.filenameEditIds,[1148,1001]);
assert.equal(manifest.authority.safeAcrossOtherHumModBuilds,false);
assert.equal(manifest.authority.physiologyAuthority,false);
assert.equal(manifest.authority.controlAuthority,false);

const source=fs.readFileSync(
  'native-engine/hummod-wine/hummod-wine-control.c','utf8'
);
assert.match(source,/WM_COMMAND/);
assert.match(source,/dialog-submit/);
assert.match(source,/pid != main_pid/);
assert.match(source,/id == 1148 \|\| id == 1001/);
assert.match(source,/id == IDOK/);

const script=fs.readFileSync(
  'scripts/qualify-hummod-mac-wine.sh','utf8'
);
assert.match(script,/Plain Wine was not found/);
assert.doesNotMatch(script,/CrossOver/);
assert.match(script,/EXPECTED_SHA="4243E872/);
assert.match(script,/command 4/);
assert.match(script,/command 3/);
assert.match(script,/command 12/);
assert.match(script,/convert-hummod-native-solution\.js/);
assert.match(script,/restored HumMod trajectory does not exactly match baseline/);
assert.match(script,/sameProcessSession:true/);
assert.match(script,/physiologyAuthority:false/);
assert.match(script,/controlAuthority:false/);

console.log(
  'ok - Mac Wine HumMod qualification is hash-pinned, plain-Wine-only, '+
  'same-process, and non-authoritative'
);
