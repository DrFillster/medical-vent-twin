'use strict';
const {
  CURVES,hermite,alphaReceptorActivity,sourceSympatheticVascularComponents
}=require('../src/hummod_ards_vascular_sympathetic_source_aligned.js');
let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}
function near(a,b,t=1e-12){assert(Math.abs(a-b)<=t,a+' != '+b);}

test('source curve knots are preserved',()=>{
  near(hermite(CURVES.visceralOther,1),1);
  near(hermite(CURVES.skeletalMuscle,1),1);
  near(hermite(CURVES.cardiac,1),1);
  near(hermite(CURVES.visceralOther,5),0.1);
  near(hermite(CURVES.skeletalMuscle,4),0.5);
  near(hermite(CURVES.cardiac,4),0.8);
});

test('alpha receptor activity uses source neural and humoral weights',()=>{
  near(alphaReceptorActivity({gangliaHz:1.5,alphaPoolEffect:1}),0.9995);
});

test('higher sympathetic agonism lowers source conductance components',()=>{
  const b=sourceSympatheticVascularComponents({gangliaHz:1.5,alphaPoolEffect:1});
  const h=sourceSympatheticVascularComponents({gangliaHz:4,alphaPoolEffect:1.4});
  assert(h.conductanceMultipliers.boneFatGiOtherRespiratoryMuscle<
    b.conductanceMultipliers.boneFatGiOtherRespiratoryMuscle);
  assert(h.conductanceMultipliers.skeletalMuscle<
    b.conductanceMultipliers.skeletalMuscle);
  assert(h.conductanceMultipliers.leftRightHeart<
    b.conductanceMultipliers.leftRightHeart);
});

test('component explicitly refuses full systemic vascular authority',()=>{
  const x=sourceSympatheticVascularComponents({gangliaHz:1.5,alphaPoolEffect:1});
  assert(x.authority==='diagnostic-component-only');
  assert(x.excludedFromSystemicAuthority.length>=8);
  assert(x.provenance.sourceRepository==='HumMod/hummod-standalone');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
