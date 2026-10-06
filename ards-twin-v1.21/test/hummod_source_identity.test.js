'use strict';

const {
  HUMMOD_CANONICAL_REPOSITORY,
  HUMMOD_CANONICAL_REVISION,
  HUMMOD_REPRODUCIBILITY_MIRROR_REPOSITORY,
  HUMMOD_REPRODUCIBILITY_MIRROR_REVISION,
  HUMMOD_SOURCE_IDENTITY,
} = require('../src/hummod_source_identity.js');
const { MODEL_PROVENANCE } = require('../src/model_provenance.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

test('official HumMod repository is canonical',()=>{
  assert(HUMMOD_CANONICAL_REPOSITORY==='HumMod/hummod-standalone');
  assert(HUMMOD_CANONICAL_REVISION===null,
    'do not invent an official SHA until independently resolved');
  assert(HUMMOD_SOURCE_IDENTITY.canonicalRepository===HUMMOD_CANONICAL_REPOSITORY);
});

test('riliescu repository is mirror-only',()=>{
  assert(HUMMOD_REPRODUCIBILITY_MIRROR_REPOSITORY==='riliescu/hummod-standalone');
  assert(HUMMOD_REPRODUCIBILITY_MIRROR_REVISION===
    '8dab57e05631f779bf5020fe0dd51874d8ae98c1');
  assert(HUMMOD_REPRODUCIBILITY_MIRROR_REPOSITORY!==HUMMOD_CANONICAL_REPOSITORY);
});

test('all HumMod provenance records name official repository as authority',()=>{
  let count=0;
  for(const record of Object.values(MODEL_PROVENANCE)){
    for(const source of record.source||[]){
      if(source.type!=='HumMod') continue;
      count++;
      assert(source.repository===HUMMOD_CANONICAL_REPOSITORY,
        record.id+' uses noncanonical HumMod repository '+source.repository);
      assert(source.revision===null,
        record.id+' must not claim unresolved mirror SHA as official revision');
      assert(source.mirrorRepository===HUMMOD_REPRODUCIBILITY_MIRROR_REPOSITORY,
        record.id+' missing reproducibility mirror');
      assert(source.mirrorRevision===HUMMOD_REPRODUCIBILITY_MIRROR_REVISION,
        record.id+' missing pinned mirror revision');
    }
  }
  assert(count>10,'expected broad HumMod provenance coverage');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
