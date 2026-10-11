'use strict';

// PRE-REGISTERED DYNAMIC CANDIDATE.
// Parameters were fitted only to the validated single-step Shimayoshi CO2 grid
// before inspecting the multistep validation trajectory from workflow run
// 38166194835.
//
// State model:
//   dXfast/dt = (A(CO2)-Xfast)/tauFast(CO2)
//   dXslow/dt = (B(CO2)-Xslow)/tauSlow(CO2)
//   stressRatio = 1 - Xfast + Xslow
//
// At source baseline CO2=5%, both targets are zero. Baseline recovery time
// constants were fitted jointly to the recovery portions of the five
// single-step source trajectories.
//
// This is a source-model surrogate candidate only. No bedside variables were
// fitted and it has no pressure/circulation authority.

const SOURCE_CONTROL_PEAK_FB_MN_PER_MM2=6.041059088461671;
const BASELINE_CO2_PERCENT=5;
const CHALLENGE_LEVELS=Object.freeze([10,15,20,25,30]);

const CHALLENGE_PARAMETERS=Object.freeze({
  10:Object.freeze({
    A:0.036017011678127875,
    B:0.01857325725533654,
    tauFastS:54.45104094469249,
    tauSlowS:433.16216831839023,
  }),
  15:Object.freeze({
    A:0.07659055063478525,
    B:0.039493943394181844,
    tauFastS:54.39991346317788,
    tauSlowS:374.56251304999006,
  }),
  20:Object.freeze({
    A:0.11691313997134242,
    B:0.07216401201190832,
    tauFastS:52.067562830539686,
    tauSlowS:349.07728733299973,
  }),
  25:Object.freeze({
    A:0.15445609581772463,
    B:0.10491297591518375,
    tauFastS:48.7112752488951,
    tauSlowS:300.4590815205655,
  }),
  30:Object.freeze({
    A:0.18975962068630886,
    B:0.1374319843126217,
    tauFastS:46.12511323899951,
    tauSlowS:268.40657969830244,
  }),
});

const BASELINE_RECOVERY=Object.freeze({
  A:0,
  B:0,
  tauFastS:57.31992949,
  tauSlowS:211.6317123,
});

const TRAINING_VALIDATION=Object.freeze({
  sourceGridWorkflowRunId:38164241750,
  blindDynamicWorkflowRunId:38166194835,
  blindDynamicResultUsedForFit:false,
  maxRelativeErrorByStepLevel:Object.freeze({
    10:0.005298289992763019,
    15:0.007395452890505554,
    20:0.00826272588057367,
    25:0.011876316609167017,
    30:0.015322305445508772,
  }),
  globalRecoveryRmseStressRatio:0.003427759822468444,
  globalRecoveryMaxAbsoluteStressRatioError:0.007570367615742146,
  closedLoopAuthority:false,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}

function parametersForCo2(sourceCo2Percent){
  finite(sourceCo2Percent,'sourceCo2Percent');
  if(sourceCo2Percent===BASELINE_CO2_PERCENT){
    return BASELINE_RECOVERY;
  }
  if(sourceCo2Percent<CHALLENGE_LEVELS[0]||
     sourceCo2Percent>CHALLENGE_LEVELS[CHALLENGE_LEVELS.length-1]){
    throw new Error(
      'sourceCo2Percent must be baseline 5 or within validated challenge grid [10,30]'
    );
  }
  if(Object.prototype.hasOwnProperty.call(
    CHALLENGE_PARAMETERS,String(sourceCo2Percent)
  )){
    return CHALLENGE_PARAMETERS[sourceCo2Percent];
  }

  let low=CHALLENGE_LEVELS[0];
  let high=CHALLENGE_LEVELS[CHALLENGE_LEVELS.length-1];
  for(let i=1;i<CHALLENGE_LEVELS.length;i++){
    if(sourceCo2Percent<CHALLENGE_LEVELS[i]){
      low=CHALLENGE_LEVELS[i-1];
      high=CHALLENGE_LEVELS[i];
      break;
    }
  }
  const a=(sourceCo2Percent-low)/(high-low);
  const lo=CHALLENGE_PARAMETERS[low];
  const hi=CHALLENGE_PARAMETERS[high];
  return Object.freeze({
    A:lo.A+a*(hi.A-lo.A),
    B:lo.B+a*(hi.B-lo.B),
    tauFastS:Math.exp(
      Math.log(lo.tauFastS)+
      a*(Math.log(hi.tauFastS)-Math.log(lo.tauFastS))
    ),
    tauSlowS:Math.exp(
      Math.log(lo.tauSlowS)+
      a*(Math.log(hi.tauSlowS)-Math.log(lo.tauSlowS))
    ),
  });
}

function initialState(){
  return Object.freeze({
    fast:0,
    slow:0,
    stressRatio:1,
    peakFbMnPerMm2:SOURCE_CONTROL_PEAK_FB_MN_PER_MM2,
    sourceCo2Percent:BASELINE_CO2_PERCENT,
    controlAuthority:false,
    closedLoopPressureAuthority:false,
  });
}

function advanceDynamicCandidate({
  state,
  sourceCo2Percent,
  dtSec,
}={}){
  if(!state||typeof state!=='object'){
    throw new Error('state is required');
  }
  finite(state.fast,'state.fast');
  finite(state.slow,'state.slow');
  finite(dtSec,'dtSec');
  if(!(dtSec>0)) throw new Error('dtSec must be > 0');

  const p=parametersForCo2(sourceCo2Percent);
  const ef=Math.exp(-dtSec/p.tauFastS);
  const es=Math.exp(-dtSec/p.tauSlowS);
  const fast=p.A+(state.fast-p.A)*ef;
  const slow=p.B+(state.slow-p.B)*es;
  const stressRatio=1-fast+slow;

  return Object.freeze({
    fast,
    slow,
    stressRatio,
    peakFbMnPerMm2:SOURCE_CONTROL_PEAK_FB_MN_PER_MM2*stressRatio,
    sourceCo2Percent,
    controlAuthority:false,
    closedLoopPressureAuthority:false,
  });
}

module.exports=Object.freeze({
  SOURCE_CONTROL_PEAK_FB_MN_PER_MM2,
  BASELINE_CO2_PERCENT,
  CHALLENGE_LEVELS,
  CHALLENGE_PARAMETERS,
  BASELINE_RECOVERY,
  TRAINING_VALIDATION,
  parametersForCo2,
  initialState,
  advanceDynamicCandidate,
});
