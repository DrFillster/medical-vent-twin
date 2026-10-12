'use strict';

const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
let x=null;

test('external validation matrix executes without claiming coordinate equivalence',()=>{
  const run=spawnSync(process.execPath,[
    path.resolve(__dirname,'../scripts/gas-cardiovascular-external-validation-matrix.js')
  ],{
    encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024,
  });
  assert.equal(run.status,0,run.stderr||run.stdout);
  x=JSON.parse(run.stdout);
  assert.equal(x.authority,'candidate-not-canonical');
  assert.match(x.coordinateWarning,/Do not directly equate/);
});

test('matrix reports the candidate magnitudes without equating unlike human gas coordinates',()=>{
  const summary={
    mildHypercapnia:x.results.normoxic_mild_hypercapnia.pct,
    moderateIsocapnicHypoxia:x.results.moderate_isocapnic_hypoxia.pct,
    severeIsocapnicHypoxia:x.results.severe_isocapnic_hypoxia.pct,
    combined5050:x.results.combined_50_50.pct,
    combined5060:x.results.combined_50_60.pct,
  };
  console.log('candidate-response-summary '+JSON.stringify(summary));
  for(const row of Object.values(summary)){
    for(const v of Object.values(row)) assert(Number.isFinite(v));
  }
});

test('combined hypoxic hypercapnia is distinct from isolated gas challenges',()=>{
  const c=x.results.combined_50_50.pct;
  const h=x.results.moderate_isocapnic_hypoxia.pct;
  const co2=x.results.normoxic_hypercapnia.pct;
  assert.notEqual(c.hr,h.hr);
  assert.notEqual(c.hr,co2.hr);
  assert.notEqual(c.rsp,h.rsp);
  assert.notEqual(c.rsp,co2.rsp);
});

test('response intensifies across the tested isocapnic hypoxia grid',()=>{
  const mild=x.results.mild_isocapnic_hypoxia.pct.hr;
  const moderate=x.results.moderate_isocapnic_hypoxia.pct.hr;
  const severe=x.results.severe_isocapnic_hypoxia.pct.hr;
  assert(moderate>mild);
  assert(severe>moderate);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
