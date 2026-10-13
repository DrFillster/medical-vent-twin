'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const entry=fs.readFileSync(path.join(root,'src/browser-entry.js'),'utf8');
const index=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'web/clinical-worker.js'),'utf8');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

const provider='v16-integrated-ards';
const cacheKey='1.6-integrated-ards-candidate';

test('browser entry exports v1.6 physician ARDS session',()=>{
  assert(entry.includes("require('./v16_physician_ards_browser_session.js')"));
});

test('worker and app agree on v1.6 provider',()=>{
  assert(index.includes('value="'+provider+'"'));
  assert(app.includes("provider === '"+provider+"'"));
  assert(worker.includes("provider === '"+provider+"'"));
  assert(worker.includes('createV16PhysicianArdsBrowserSession'));
});

test('browser uses one v1.6 cache key',()=>{
  assert(index.includes('./engine.js?v='+cacheKey));
  assert(index.includes('./app.js?v='+cacheKey));
  assert(app.includes("./clinical-worker.js?v="+cacheKey));
  assert(worker.includes("./engine.js?v="+cacheKey));
});

test('v1.6 case boundaries are explicit once',()=>{
  assert.equal((index.match(/id="clinical-v16-ards-boundaries"/g)||[]).length,1);
  assert.equal((index.match(/id="clinical-anatomic-shunt"/g)||[]).length,1);
  assert.equal((index.match(/id="clinical-excess-lung-water"/g)||[]).length,1);
  assert(app.includes("clinicalNumber('clinical-anatomic-shunt') / 100"));
  assert(app.includes("clinicalNumber('clinical-excess-lung-water')"));
});

test('legacy reduced HumMod remains comparison path rather than default v1.6 owner',()=>{
  const v16Pos=index.indexOf('value="'+provider+'"');
  const legacyPos=index.indexOf('value="live-reduced-hummod"');
  assert(v16Pos>=0&&legacyPos>=0&&v16Pos<legacyPos);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
