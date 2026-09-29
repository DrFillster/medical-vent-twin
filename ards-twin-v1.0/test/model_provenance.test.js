'use strict';

const {
  MODEL_PROVENANCE,
  LIVE_CLINICAL_PROVENANCE_IDS,
  validateProvenanceRegistry,
  provenanceSummary,
} = require('../src/model_provenance.js');

let passed=0, failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

test('provenance registry validates',()=>assert(validateProvenanceRegistry()===true));

test('live initial registry has no UNKNOWN records',()=>{
  const s=provenanceSummary();
  assert(s.hasUnknown===false,'initial live provenance registry contains UNKNOWN');
});

test('all declared live provenance ids exist',()=>{
  for(const id of LIVE_CLINICAL_PROVENANCE_IDS) assert(MODEL_PROVENANCE[id], 'missing '+id);
});

test('HumMod exact records pin revision and source path',()=>{
  for(const x of Object.values(MODEL_PROVENANCE).filter(x=>x.class==='HUMMOD_EXACT')){
    const h=x.source.find(s=>s.type==='HumMod');
    assert(h,'missing HumMod source '+x.id);
    assert(h.revision==='8dab57e05631f779bf5020fe0dd51874d8ae98c1','unpinned revision '+x.id);
    assert(typeof h.path==='string'&&h.path.length>0,'missing source path '+x.id);
  }
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
