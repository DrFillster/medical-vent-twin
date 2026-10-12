'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'web/clinical-worker.js'),'utf8');
const cacheKey='1.5.1-candidate-runtime';

test('candidate runtime assets use one cache-busting key',()=>{
  assert(index.includes('./engine.js?v='+cacheKey));
  assert(index.includes('./app.js?v='+cacheKey));
  assert(app.includes("./clinical-worker.js?v="+cacheKey));
  assert(worker.includes("./engine.js?v="+cacheKey));
});

test('live browser path hard-fails when physician candidate is absent',()=>{
  assert(app.includes('function requirePhysicianCandidateSnapshot(snapshot)'));
  assert(app.includes('Physician validation candidate missing from live runtime snapshot'));
  assert(app.includes('HumMod 2013 compensation comparison missing or invalid'));
  assert(app.includes('requirePhysicianCandidateSnapshot(data.snapshot)'));
});

test('clinical export records served build identity and candidate gate',()=>{
  assert(index.includes('id="clinical-build-sha"'));
  assert(app.includes("fetch('./DEPLOY_SOURCE_SHA.txt?cache=' + Date.now()"));
  assert(app.includes('record.browserBuildSha = clinicalBuildSha'));
  assert(app.includes('requirePhysicianCandidateSnapshot(clinicalSnapshot)'));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
