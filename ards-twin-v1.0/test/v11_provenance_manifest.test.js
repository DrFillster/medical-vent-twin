'use strict';

const {
  V11_RC_SUBSYSTEMS,
  V11_RC_OUTPUT_PROVENANCE,
  validateV11RcProvenanceManifest,
} = require('../src/v11_provenance_manifest.js');
const { MODEL_PROVENANCE } = require('../src/model_provenance.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

test('v1.1 release-candidate provenance manifest validates',()=>{
  const s=validateV11RcProvenanceManifest();
  assert(s.releaseCandidate==='1.1.0-rc.1');
  assert(s.unknownCount===0);
  assert(s.requiredCount>40,'expected broad live-path coverage');
});

test('every release-gated subsystem has provenance records',()=>{
  for(const [subsystem,ids] of Object.entries(V11_RC_SUBSYSTEMS)){
    assert(ids.length>0,'empty subsystem '+subsystem);
    for(const id of ids){
      assert(MODEL_PROVENANCE[id],subsystem+' missing '+id);
      assert(MODEL_PROVENANCE[id].class!=='UNKNOWN',subsystem+' has UNKNOWN '+id);
    }
  }
});

test('every declared monitor output path resolves to provenance records',()=>{
  for(const [path,ids] of Object.entries(V11_RC_OUTPUT_PROVENANCE)){
    assert(ids.length>0,'output path has no provenance '+path);
    for(const id of ids) assert(MODEL_PROVENANCE[id],path+' missing '+id);
  }
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
