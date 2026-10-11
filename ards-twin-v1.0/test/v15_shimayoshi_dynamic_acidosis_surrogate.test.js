'use strict';

const assert=require('node:assert/strict');
const {
  VALIDATION,
  equilibriumForCo2Percent,
  createShimayoshiDynamicAcidosisSurrogate,
}=require('../src/shimayoshi_dynamic_acidosis_surrogate.js');

const baseline=equilibriumForCo2Percent(5);
assert.equal(baseline.fastEquilibrium,0);
assert.equal(baseline.slowEquilibrium,0);
assert(baseline.tauFastS>0);
assert(baseline.tauSlowS>baseline.tauFastS);
console.log('ok - dynamic surrogate has source-baseline zero equilibria');

const s=createShimayoshiDynamicAcidosisSurrogate();
const first=s.step({dtSec:0.4,sourceEquivalentCo2Percent:30});
assert(first.stressRatio<1);
assert.equal(first.closedLoopPressureAuthority,false);

let x=first;
for(let i=0;i<299;i++){
  x=s.step({dtSec:0.4,sourceEquivalentCo2Percent:30});
}
assert(x.stressRatio<0.95);
console.log('ok - sustained high source CO2 depresses active-force ratio');

const beforeRecovery=x.stressRatio;
const recovery=s.step({dtSec:0.4,sourceEquivalentCo2Percent:5});
assert.notEqual(recovery.stressRatio,1);
assert(recovery.stressRatio>=beforeRecovery);
console.log('ok - recovery retains source-derived history rather than resetting force');

assert.throws(
  ()=>s.step({dtSec:0.4,sourceEquivalentCo2Percent:31}),
  /outside validated dynamic source domain/
);
console.log('ok - dynamic surrogate refuses CO2 extrapolation');

assert(VALIDATION.heldOutFixedStep[15].maxRelativeStressRatioError<0.006);
assert(VALIDATION.heldOutFixedStep[25].maxRelativeStressRatioError<0.011);
assert(VALIDATION.dynamicMultistep.maxRelativeStressRatioError<0.009);
assert(VALIDATION.fixedStepGridDynamicComparison.maxRelativeStressRatioError>0.08);
console.log('ok - recorded held-out validation favors stateful model over memoryless grid');
