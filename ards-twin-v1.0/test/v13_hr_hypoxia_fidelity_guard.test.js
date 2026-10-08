'use strict';

const fs=require('node:fs');
const path=require('node:path');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}

const runtime=fs.readFileSync(
  path.join(__dirname,'../src/hummod_ards_cardiopulmonary_runtime.js'),
  'utf8');

test('source-aligned HR does not add empirical hypercapnic chronotropy',()=>{
  assert(runtime.includes('const appliedEmpiricalChronotropicBoostPerMin = 0;'),
    'source-aligned fidelity path must keep empirical HR overlay disabled');
  assert(runtime.includes("autonomicMode==='source-aligned'\n        ? sourceSaNodeHeartRatePerMin"),
    'source-aligned effective HR must come from HumMod SA-node rate');
  assert(!runtime.includes('sourceSaNodeHeartRatePerMin + appliedEmpiricalChronotropicBoostPerMin'),
    'empirical boost must not be summed into HumMod SA-node rate');
});

test('source-aligned runtime carries brain hypoxia state into autonomic control',()=>{
  assert(runtime.includes('createHumModSourceAlignedBrainHypoxia'),
    'brain hypoxia controller must be instantiated');
  assert(runtime.includes('brainHypoxiaState.brainFunctionEffect'),
    'Brain-Function effect must reach source autonomic control');
  assert(runtime.includes('brainHypoxia:brainHypoxiaState'),
    'brain hypoxia state must be preserved for diagnostics');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
