'use strict';

const assert=require('node:assert/strict');
const {
  hasFiniteMechanics,
  assessShimayoshiCycleAuthority,
}=require('../src/shimayoshi_source_authority.js');

function run(protocolName,cycle){
  return {
    status:'shimayoshi-source-stress-trajectory-validated',
    provenance:{protocolName},
    trajectory:[cycle],
  };
}

const acid=assessShimayoshiCycleAuthority({
  validatedSourceRun:run('acidosis',{
    protocol:'acidosis',
    peak_Fb_mN_per_mm2:5.3,
  }),
  cycleIndex:0,
});
assert.equal(acid.pressureShadowEligible,true);
assert.equal(acid.closedLoopPressureAuthority,false);
assert.match(acid.status,/acidosis-source-force-shadow-candidate/);
console.log('ok - acidosis source force is shadow candidate only');

const ischemiaNoMechanics=assessShimayoshiCycleAuthority({
  validatedSourceRun:run('ischemia',{
    protocol:'ischemia',
    peak_Fb_mN_per_mm2:18,
  }),
  cycleIndex:0,
});
assert.equal(ischemiaNoMechanics.mechanicsPresent,false);
assert.equal(ischemiaNoMechanics.closedLoopPressureAuthority,false);
assert.match(ischemiaNoMechanics.status,/pending-sarcomere-mechanics/);
console.log('ok - ischemia force alone cannot gain pumping authority');

const ischemiaMechanics={
  protocol:'reperfusion',
  peak_Fb_mN_per_mm2:18,
  start_cycle_hsmL_um:1.1,
  min_cycle_hsmL_um:1.0,
  max_cycle_hsmL_um:1.2,
  end_cycle_hsmL_um:1.1,
  end_cycle_hsmX_um:0.9,
  cycle_hsmL_excursion_um:0.2,
  cycle_peak_shortening_um:0.1,
  cycle_net_hsmL_change_um:0,
};
assert.equal(hasFiniteMechanics(ischemiaMechanics),true);
const ischemiaWithMechanics=assessShimayoshiCycleAuthority({
  validatedSourceRun:run('ischemia',ischemiaMechanics),
  cycleIndex:0,
});
assert.equal(ischemiaWithMechanics.mechanicsPresent,true);
assert.equal(ischemiaWithMechanics.closedLoopPressureAuthority,false);
assert.match(ischemiaWithMechanics.status,/contracture-dominant-source-phenotype/);
console.log('ok - validated contracture-dominant mechanics remain shadow-only without invented threshold');
