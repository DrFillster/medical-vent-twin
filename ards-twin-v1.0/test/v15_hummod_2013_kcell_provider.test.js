'use strict';

const assert=require('node:assert/strict');
const {
  INITIAL_KCELL_MEQ_PER_L,
  KCELL_CAPTIVE_MASS_MEQ,
  K_TO_CELL_BASIC_PER_MIN,
  K_TO_POOL_BASIC_PER_MIN,
  READINESS,
  initialKCellMass2013,
  kCellConcentration2013,
  kFluxToCell2013,
  kFluxToPool2013,
}=require('../src/hummod_2013_kcell_provider.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-12){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('2013 intracellular potassium constants are generation-specific',()=>{
  near(INITIAL_KCELL_MEQ_PER_L,140);
  near(KCELL_CAPTIVE_MASS_MEQ,2180);
  near(K_TO_CELL_BASIC_PER_MIN,0.0018);
  near(K_TO_POOL_BASIC_PER_MIN,8.0e-5);
  assert.equal(READINESS.olderPotassiumModuleInterchangeable,false);
});

test('initial KCell mass follows source 140 mEq/L sizing',()=>{
  const s=initialKCellMass2013({initialIcfvMl:20000});
  near(s.initialIcfvL,20);
  near(s.initialMassMeq,2800);
});

test('current KCell concentration is mass divided by current CellH2O volume',()=>{
  const s=kCellConcentration2013({
    kCellMassMeq:2800,
    cellWaterVolumeMl:20000,
  });
  near(s.concentrationMeqPerL,140);
});

test('source exchange constants drive fluxes',()=>{
  const into=kFluxToCell2013({
    kPoolMassMeq:70,
    delayedAldosteroneEffect:1,
  });
  near(into.rateMeqPerMin,0.0018*70);

  const out=kFluxToPool2013({kCellMassMeq:2800});
  near(out.rateMeqPerMin,8.0e-5*(2800-2180));
});

test('fixed initial potassium concentration is forbidden as live substitution',()=>{
  assert.equal(READINESS.fixed140MeqPerLSubstitutionAllowed,false);
  assert.equal(
    READINESS.currentKCellConcentration,
    'blocked-on-whole-body-potassium-and-cell-water-state'
  );
  assert(READINESS.requiredLiveProviders.includes('KCell.Mass'));
  assert(READINESS.requiredLiveProviders.includes('CellH2O.Vol'));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
