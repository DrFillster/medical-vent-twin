'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const migrate = fs.readFileSync(path.join(repoRoot, '.deploy', 'migrate-preview-to-v15.sh'), 'utf8');
const sync = fs.readFileSync(path.join(repoRoot, '.deploy', 'preview-sync-main.sh'), 'utf8');

assert.match(migrate, /TARGET_BRANCH="v1\.5"/);
assert.doesNotMatch(migrate, /TARGET_BRANCH="v1\.5-release"/);
assert.match(sync, /BRANCH="v1\.5"/);
assert.doesNotMatch(sync, /BRANCH="v1\.5-release"/);

console.log('ok - v1.5 migration and sync daemon use the same active deployment branch');
