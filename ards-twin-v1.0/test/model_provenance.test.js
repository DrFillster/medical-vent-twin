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

test('HumMod exact records name official upstream and preserve reproducible mirror pin',()=>{
  for(const x of Object.values(MODEL_PROVENANCE).filter(x=>x.class==='HUMMOD_EXACT')){
    const h=x.source.find(s=>s.type==='HumMod');
    assert(h,'missing HumMod source '+x.id);
    assert(h.repository==='HumMod/hummod-standalone','noncanonical repository '+x.id);
    assert(h.revision===null,'unverified official revision must remain null '+x.id);
    assert(h.mirrorRepository==='riliescu/hummod-standalone','missing reproducibility mirror '+x.id);
    assert(h.mirrorRevision==='8dab57e05631f779bf5020fe0dd51874d8ae98c1','unpinned mirror revision '+x.id);
    assert(typeof h.path==='string'&&h.path.length>0,'missing source path '+x.id);
  }
});

test('autonomic coverage registry includes control equations and constants',()=>{
  const expected=[
    'autonomic.target_map',
    'autonomic.baroreflex_gain',
    'autonomic.autonomic_tau',
    'autonomic.vascular_tau',
    'autonomic.cardiac_tau',
    'autonomic.hypoxic_drive_curve',
    'autonomic.hypercapnic_drive_curve',
    'autonomic.reflex_target_equation',
    'autonomic.parasympathetic_target_equation',
    'autonomic.reflex_hr_equation',
    'autonomic.contractility_equation',
    'autonomic.systemic_conductance_equation',
    'autonomic.venous_v0_equation',
    'autonomic.pulmonary_load_equation',
    'autonomic.respiratory_acidosis_inotropy',
    'autonomic.hypercapnic_acidosis_anchor',
  ];
  for(const id of expected){
    assert(MODEL_PROVENANCE[id], 'missing autonomic provenance '+id);
    assert(LIVE_CLINICAL_PROVENANCE_IDS.includes(id), 'autonomic provenance not active '+id);
  }
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
