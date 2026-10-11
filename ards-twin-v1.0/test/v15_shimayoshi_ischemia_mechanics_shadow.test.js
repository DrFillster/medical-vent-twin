'use strict';
const assert=require('node:assert/strict');
const {
  shimayoshiIschemiaMechanicsShadow,
}=require('../src/shimayoshi_ischemia_mechanics_shadow.js');

const s=shimayoshiIschemiaMechanicsShadow({
  time_s:1079.6,
  protocol:'ischemia',
  stress_ratio:3.0392478486077046,
  shortening_ratio:0.003783496987723881,
  peak_Fb_mN_per_mm2:18.360275837919154,
  cycle_peak_shortening_um:0.0003984413640306661,
  start_cycle_hsmL_um:0.5384165099154501,
  min_cycle_hsmL_um:0.5380180685514194,
  max_cycle_hsmL_um:0.5384165099154501,
  end_cycle_hsmL_um:0.5380180685514194,
  end_cycle_ATPTotal_mM:0.33648765859134755,
  end_cycle_PCr_mM:0.0065443711387072195,
  end_cycle_Pi_mM:15.415984856876808,
  end_cycle_pHi:6.465884155038551,
  peak_Cyt_Cai_mM:0.0030528878417299277,
});

assert.equal(s.phase,'ischemia');
assert(s.activeForce.stressRatio>3);
assert(s.cyclicMechanics.shorteningRatio<0.01);
assert.equal(s.peakFbOnlyPumpMappingAllowed,false);
assert.equal(s.closedLoopPressureAuthority,false);
assert.equal(s.controlAuthority,false);
console.log('ok - severe ischemia carries force and mechanics together without Fb-only pump authority');
