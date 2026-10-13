'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const entry=fs.readFileSync(path.join(root,'src','browser-entry.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'web','clinical-worker.js'),'utf8');
const html=fs.readFileSync(path.join(root,'web','index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'web','app.js'),'utf8');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}

test('browser entry exports v1.6 ARDS session',()=>{
  assert(entry.includes("clinical_twin_v16_ards_session.js"));
});

test('worker routes v1.6 provider without removing legacy providers',()=>{
  assert(worker.includes("provider === 'v16-integrated-ards'"));
  assert(worker.includes('createBerlinV16ArdsSession'));
  assert(worker.includes("provider === 'live-reduced-hummod'"));
  assert(worker.includes('createBerlinClinicalTwinSession'));
});

test('physician UI exposes v1.6 provider and explicit ARDS boundaries',()=>{
  assert(html.includes('value="v16-integrated-ards"'));
  assert(html.includes('id="clinical-anatomic-shunt"'));
  assert(html.includes('id="clinical-excess-lung-water"'));
  assert(html.includes('35% shunt is prefilled only as the Karamolegkos/Dhainaut'));
  assert(html.includes('0 mL means no additional HumMod membrane-edema effect'));
});

test('quick start selects v1.6 and sends explicit case inputs',()=>{
  assert(app.includes("$('clinical-systemic-provider').value = 'v16-integrated-ards'"));
  assert(app.includes("payload.anatomicalShuntFraction"));
  assert(app.includes("clinicalNumber('clinical-anatomic-shunt') / 100"));
  assert(app.includes("payload.excessLungWaterMl"));
  assert(app.includes("clinicalNumber('clinical-excess-lung-water')"));
});

test('v1.6 is visibly labeled candidate, not reduced HumMod or replay',()=>{
  assert(app.includes("'v1.6 INTEGRATED ARDS CANDIDATE"));
  assert(app.includes("' · v1.6 integrated ARDS candidate'"));
  assert(app.includes("'Ursino/Magosso candidate'"));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
