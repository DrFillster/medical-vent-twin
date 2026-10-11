'use strict';

// Dynamic reduced-order surrogate for Shimayoshi respiratory-acidosis
// myocardial active-force response.
//
// State equations:
//   dx_fast/dt = (A_eq(u) - x_fast) / tau_fast(u)
//   dx_slow/dt = (B_eq(u) - x_slow) / tau_slow(u)
//   stress_ratio = 1 - x_fast + x_slow
//
// u is the Shimayoshi extracellular CO2 challenge level in percent.
// q = (u - 5) / 25
//
// A_eq(q) = a1*q + a2*q^2
// B_eq(q) = b1*q + b2*q^2
// tau_fast(q) = exp(logTauFast0 + logTauFast1*q)
// tau_slow(q) = exp(logTauSlow0 + logTauSlow1*q)
//
// Fit data: validated fixed-step Shimayoshi source trajectories at
// 10%, 20%, and 30% CO2 only.
// Held out from fitting: 15%, 25%, and dynamic multistep source trajectory.
// No HR, MAP, CO, SV, SVR, arterial pH, or bedside target was used.

const SOURCE_CONTROL_PEAK_FB_MN_PER_MM2=6.041059088461671;

const PARAMETERS=Object.freeze({
  a1:0.22337553,
  a2:-0.01909800,
  b1:0.11366576,
  b2:0.03267191,
  logTauFast0:4.29156786,
  logTauFast1:-0.37587466,
  logTauSlow0:5.90545769,
  logTauSlow1:-0.46063629,
});

const VALIDATION=Object.freeze({
  sourceGridRunId:38164241750,
  dynamicSourceRunId:38166194835,
  upstreamGitSha:'6478d2ab0acbfc88d3da461d2594658bcb2798ca',
  trainingCo2Percent:Object.freeze([10,20,30]),
  heldOutFixedStepCo2Percent:Object.freeze([15,25]),
  heldOutFixedStep:Object.freeze({
    15:Object.freeze({
      meanAbsoluteStressRatioError:0.0011314391049182656,
      maxAbsoluteStressRatioError:0.005213009222829856,
      maxRelativeStressRatioError:0.005190007082239505,
    }),
    25:Object.freeze({
      meanAbsoluteStressRatioError:0.0012526241834581377,
      maxAbsoluteStressRatioError:0.009898185720513486,
      maxRelativeStressRatioError:0.010081420028867591,
    }),
  }),
  dynamicMultistep:Object.freeze({
    meanAbsoluteStressRatioError:0.001718377869456078,
    maxAbsoluteStressRatioError:0.008049925266402469,
    maxRelativeStressRatioError:0.008604649535895627,
  }),
  fixedStepGridDynamicComparison:Object.freeze({
    maxRelativeStressRatioError:0.08294162932252738,
    comparisonRunId:38166440455,
  }),
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}

function boundedCo2Percent(v){
  finite(v,'sourceEquivalentCo2Percent');
  if(v<5||v>30){
    throw new Error('sourceEquivalentCo2Percent is outside validated dynamic source domain [5,30]');
  }
  return v;
}

function equilibriumForCo2Percent(sourceEquivalentCo2Percent){
  const u=boundedCo2Percent(sourceEquivalentCo2Percent);
  const q=(u-5)/25;
  const fastEquilibrium=PARAMETERS.a1*q+PARAMETERS.a2*q*q;
  const slowEquilibrium=PARAMETERS.b1*q+PARAMETERS.b2*q*q;
  const tauFastS=Math.exp(
    PARAMETERS.logTauFast0+PARAMETERS.logTauFast1*q
  );
  const tauSlowS=Math.exp(
    PARAMETERS.logTauSlow0+PARAMETERS.logTauSlow1*q
  );
  return Object.freeze({
    sourceEquivalentCo2Percent:u,
    q,
    fastEquilibrium,
    slowEquilibrium,
    tauFastS,
    tauSlowS,
  });
}

function createShimayoshiDynamicAcidosisSurrogate({
  initialFastState=0,
  initialSlowState=0,
}={}){
  finite(initialFastState,'initialFastState');
  finite(initialSlowState,'initialSlowState');

  let fastState=initialFastState;
  let slowState=initialSlowState;
  let timeSec=0;

  function snapshot(){
    const stressRatio=1-fastState+slowState;
    return Object.freeze({
      status:'Shimayoshi-dynamic-acidosis-surrogate-shadow',
      timeSec,
      fastDepressiveState:fastState,
      slowAdaptiveState:slowState,
      stressRatio,
      peakFbMnPerMm2:SOURCE_CONTROL_PEAK_FB_MN_PER_MM2*stressRatio,
      closedLoopPressureAuthority:false,
      controlAuthority:false,
      provenance:VALIDATION,
    });
  }

  function reset(){
    fastState=0;
    slowState=0;
    timeSec=0;
    return snapshot();
  }

  function step({
    dtSec,
    sourceEquivalentCo2Percent,
  }={}){
    finite(dtSec,'dtSec');
    if(!(dtSec>0)) throw new Error('dtSec must be > 0');

    const p=equilibriumForCo2Percent(sourceEquivalentCo2Percent);
    const ef=Math.exp(-dtSec/p.tauFastS);
    const es=Math.exp(-dtSec/p.tauSlowS);

    fastState=p.fastEquilibrium+(fastState-p.fastEquilibrium)*ef;
    slowState=p.slowEquilibrium+(slowState-p.slowEquilibrium)*es;
    timeSec+=dtSec;

    return Object.freeze({
      ...snapshot(),
      sourceEquivalentCo2Percent:p.sourceEquivalentCo2Percent,
      fastEquilibrium:p.fastEquilibrium,
      slowEquilibrium:p.slowEquilibrium,
      tauFastS:p.tauFastS,
      tauSlowS:p.tauSlowS,
    });
  }

  return Object.freeze({
    status:'Shimayoshi-dynamic-acidosis-surrogate-shadow',
    step,
    snapshot,
    reset,
    closedLoopPressureAuthority:false,
  });
}

module.exports=Object.freeze({
  SOURCE_CONTROL_PEAK_FB_MN_PER_MM2,
  PARAMETERS,
  VALIDATION,
  equilibriumForCo2Percent,
  createShimayoshiDynamicAcidosisSurrogate,
});
