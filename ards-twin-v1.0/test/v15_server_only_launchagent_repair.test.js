'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const repoRoot=path.resolve(__dirname,'..','..');
const script=fs.readFileSync(path.join(repoRoot,'.deploy','repair-v15-server-launchagent.sh'),'utf8');

assert.match(script,/LABEL="com\.defyinglogic\.hummod-v15-server"/);
assert.doesNotMatch(script,/com\.local\.hummod-native/);
assert.doesNotMatch(script,/hummod-preview-sync/);
assert.doesNotMatch(script,/53863|8771|gateway|tunnel/i);
assert.match(script,/REPO_DIR/);
assert.match(script,/server-no-cache\.py/);
assert.match(script,/127\.0\.0\.1:8770/);
assert.match(script,/launchctl bootout/);
assert.match(script,/launchctl bootstrap/);
assert.match(script,/launchctl kickstart/);

console.log('ok - v1.5 server-only LaunchAgent repair is isolated to the public web server');
