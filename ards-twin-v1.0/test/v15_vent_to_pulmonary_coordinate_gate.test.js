'use strict';

const { PARAMETERS, pulmonaryArteriolarResistance } =
  require('../src/karamolegkos_pulmonary_circulation_candidate.js');

let passed=0, failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(cond,msg){if(!cond)throw new Error(msg||'assertion failed');}

test('candidate keeps absolute alveolar volume explicit',()=>{
  let threw=false;
  try{
    pulmonaryArteriolarResistance({
      shuntFraction:0.02,
    });
  }catch(_){threw=true;}
  assert(threw,'missing source-native alveolar volume must fail closed');
});

test('candidate does not export a Vent-to-VA convenience mapper',()=>{
  const candidate=require('../src/karamolegkos_pulmonary_circulation_candidate.js');
  assert(candidate.ventVolumeToAlveolarVolume===undefined,
    'no unsourced Vent -> Karamolegkos volume adapter may be present');
});

test('nominal FRC remains source-pinned',()=>{
  assert(PARAMETERS.frcNominalL===2.25);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
