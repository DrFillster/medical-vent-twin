'use strict';

const assert=require('node:assert/strict');
const {
  HCT_ON_VISCOSITY,
  hermite,
  viscosityFromHematocrit,
  leftHeartAlphaReceptorActivity,
}=require('../src/hummod_2013_coronary_flow_provider_primitives.js');
const {
  STATUS,
  readiness,
}=require('../src/hummod_2013_coronary_flow_provider_contract.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-10){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('HumMod viscosity curve identity is preserved',()=>{
  near(hermite(HCT_ON_VISCOSITY,0.00),0.5);
  near(hermite(HCT_ON_VISCOSITY,0.44),1.0);
  near(hermite(HCT_ON_VISCOSITY,0.60),1.5);
  const v=viscosityFromHematocrit({hematocritFraction:0.44});
  near(v.value,1);
  near(v.conductanceEffect,1);
});

test('left-heart alpha receptor activity preserves source neural/humoral weights',()=>{
  const a=leftHeartAlphaReceptorActivity({
    cardiacGangliaHz:3,
    alpha1PoolEffect:2,
  });
  near(a.neuralAgonism,3);
  near(a.humoralAgonism,2);
  near(a.totalAgonism,(0.333*3)+(0.5*2));
  near(a.activity,a.totalAgonism);
});

test('coronary-flow provider readiness remains fail-closed',()=>{
  const r=readiness();
  assert.equal(r.authority,'diagnostic-only');
  assert.equal(r.summary.readyForLiveSourceCompleteCoronaryFlow,false);
  assert.equal(r.summary.neutralBackfillAllowed,false);
  assert(r.summary.blockedFields.includes('adhPoolLog10Conc'));
  assert(!r.summary.blockedFields.includes('initialLeftHeartMassG'));
  assert(!r.summary.blockedFields.includes('plasmaVolumeFraction'));
});

test('runtime-present synthetic boundaries are not mislabeled source-complete live',()=>{
  const r=readiness();
  const byName=Object.fromEntries(r.fields.map(x=>[x.field,x]));
  assert.equal(
    byName.o2MaxMlPerMl.status,
    STATUS.DERIVABLE_PARALLEL
  );
  assert.equal(
    byName.arterialO2ContentMlPerMl.status,
    STATUS.RUNTIME_BOUNDARY_DEPENDENT
  );
  assert.notEqual(
    byName.o2MaxMlPerMl.status,
    STATUS.SOURCE_COMPLETE_LIVE
  );
});

test('new LV-mass and blood providers are parallel-derivable, not live authority',()=>{
  const r=readiness();
  const byName=Object.fromEntries(r.fields.map(x=>[x.field,x]));
  assert.equal(byName.initialLeftHeartMassG.status,STATUS.DERIVABLE_PARALLEL);
  assert.equal(byName.viscosityConductanceEffect.status,STATUS.DERIVABLE_PARALLEL);
  assert.equal(byName.plasmaVolumeFraction.status,STATUS.DERIVABLE_PARALLEL);
  assert.equal(byName.o2MaxMlPerMl.status,STATUS.DERIVABLE_PARALLEL);
  assert(r.summary.sourceCompleteLiveFields.includes('pressureGradientMmHg'));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
