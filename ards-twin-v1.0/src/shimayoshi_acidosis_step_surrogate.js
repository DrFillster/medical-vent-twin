'use strict';

// Reduced-order surrogate fitted only to validated Shimayoshi source-model
// respiratory-acidosis trajectories from workflow run 38164241750.
// It is a step-response shadow model, not a general arbitrary-input model.
//
// Challenge model:
//   r(t)=1-A*(1-exp(-t/tauFast))+B*(1-exp(-t/tauSlow))
//
// Recovery model:
//   r(t)=1-A*exp(-t/tauFast)+B*(1-exp(-t/tauSlow))
//
// r is peak active cross-bridge force relative to independently generated
// source control peak Fb. No HR, MAP, CO, SV, SVR, or arterial pH was used.

const SOURCE_CONTROL_PEAK_FB_MN_PER_MM2=6.041059088461671;

const LEVELS=Object.freeze([10,15,20,25,30]);

const CHALLENGE=Object.freeze({
  10:Object.freeze({A:0.03601698894915803,B:0.018573268480647245,tauFastS:54.45101309807657,tauSlowS:433.16410491667676}),
  15:Object.freeze({A:0.07659050864036211,B:0.039493952741113836,tauFastS:54.399895646152615,tauSlowS:374.5638074552295}),
  20:Object.freeze({A:0.11691317761266948,B:0.07216403199882505,tauFastS:52.06758339089816,tauSlowS:349.0769597328707}),
  25:Object.freeze({A:0.154456064135155,B:0.10491295156468772,tauFastS:48.711261687865104,tauSlowS:300.45919782529444}),
  30:Object.freeze({A:0.18975974103444337,B:0.13743207068201593,tauFastS:46.12514713414123,tauSlowS:268.40625150015256}),
});

const RECOVERY=Object.freeze({
  10:Object.freeze({A:0.02184092688152406,B:0.0538641435590367,tauFastS:141.42513106096948,tauSlowS:141.42259044357777}),
  15:Object.freeze({A:0.04438392171193695,B:0.10432468014865788,tauFastS:143.60336174945775,tauSlowS:143.65213221034585}),
  20:Object.freeze({A:0.056545703472169806,B:0.12225576922991613,tauFastS:125.22180510658276,tauSlowS:125.16610674212232}),
  25:Object.freeze({A:0.062058311445984504,B:0.11255360218262032,tauFastS:96.7376206472724,tauSlowS:96.7519834951685}),
  30:Object.freeze({A:0.06468490762936219,B:0.11137739017493538,tauFastS:81.39479626501995,tauSlowS:81.40537535906844}),
});

const STATUS=Object.freeze({
  preferred:false,
  deprecatedBy:'shimayoshi_acidosis_grid_surrogate.js',
  reason:'compressed source-grid interpolation retains validated source trajectories directly with bounded compression error',
  closedLoopAuthority:false,
});

const VALIDATION=Object.freeze({
  sourceWorkflowRunId:38164241750,
  sourceUpstreamGitSha:'6478d2ab0acbfc88d3da461d2594658bcb2798ca',
  trainingTarget:'Shimayoshi peak Fb stress ratio only',
  heldOutLevelMethod:'linear interpolation of neighboring fitted source-level parameter sets',
  challenge:Object.freeze({
    level15MaxRelativeError:0.004691999423174622,
    level20MaxRelativeError:0.0074764749012988145,
    level25MaxRelativeError:0.010649744878836371,
  }),
  recovery:Object.freeze({
    level15MaxRelativeError:0.007620238944808681,
    level20MaxRelativeError:0.006796712180390324,
    level25MaxRelativeError:0.0057048767776939876,
  }),
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}

function interpolateParams(table,co2Percent){
  finite(co2Percent,'co2Percent');
  if(co2Percent<LEVELS[0]||co2Percent>LEVELS[LEVELS.length-1]){
    throw new Error('co2Percent is outside validated Shimayoshi source grid [10,30]');
  }
  if(Object.prototype.hasOwnProperty.call(table,co2Percent)){
    return Object.freeze({...table[co2Percent]});
  }
  let low=LEVELS[0],high=LEVELS[LEVELS.length-1];
  for(let i=1;i<LEVELS.length;i++){
    if(co2Percent<LEVELS[i]){
      low=LEVELS[i-1];
      high=LEVELS[i];
      break;
    }
  }
  const a=(co2Percent-low)/(high-low);
  const lo=table[low],hi=table[high];
  return Object.freeze({
    A:lo.A+a*(hi.A-lo.A),
    B:lo.B+a*(hi.B-lo.B),
    tauFastS:Math.exp(Math.log(lo.tauFastS)+a*(Math.log(hi.tauFastS)-Math.log(lo.tauFastS))),
    tauSlowS:Math.exp(Math.log(lo.tauSlowS)+a*(Math.log(hi.tauSlowS)-Math.log(lo.tauSlowS))),
  });
}

function ratioFromChallenge(p,t){
  return 1
    -p.A*(1-Math.exp(-t/p.tauFastS))
    +p.B*(1-Math.exp(-t/p.tauSlowS));
}

function ratioFromRecovery(p,t){
  return 1
    -p.A*Math.exp(-t/p.tauFastS)
    +p.B*(1-Math.exp(-t/p.tauSlowS));
}

function shimayoshiAcidosisStepSurrogate({
  challengeCo2Percent,
  phase,
  elapsedSec,
}={}){
  finite(elapsedSec,'elapsedSec');
  if(elapsedSec<0) throw new Error('elapsedSec must be >= 0');
  if(phase!=='challenge'&&phase!=='recovery'){
    throw new Error('phase must be challenge or recovery');
  }

  const maxDuration=phase==='challenge'?600:60;
  if(elapsedSec>maxDuration){
    throw new Error('elapsedSec exceeds validated source phase duration');
  }

  const table=phase==='challenge'?CHALLENGE:RECOVERY;
  const p=interpolateParams(table,challengeCo2Percent);
  const stressRatio=phase==='challenge'
    ? ratioFromChallenge(p,elapsedSec)
    : ratioFromRecovery(p,elapsedSec);

  return Object.freeze({
    status:'shimayoshi-acidosis-step-surrogate-shadow',
    phase,
    elapsedSec,
    challengeCo2Percent,
    stressRatio,
    peakFbMnPerMm2:SOURCE_CONTROL_PEAK_FB_MN_PER_MM2*stressRatio,
    pressureShadowEligible:true,
    closedLoopPressureAuthority:false,
    source:Object.freeze({
      upstreamGitSha:VALIDATION.sourceUpstreamGitSha,
      workflowRunId:VALIDATION.sourceWorkflowRunId,
      fittedTarget:VALIDATION.trainingTarget,
      validatedCo2PercentRange:Object.freeze([10,30]),
      sourceBaselineCo2Percent:5,
      sourceChallengeDurationS:600,
      sourceRecoveryDurationS:60,
    }),
  });
}

module.exports=Object.freeze({
  STATUS,
  SOURCE_CONTROL_PEAK_FB_MN_PER_MM2,
  LEVELS,
  CHALLENGE,
  RECOVERY,
  VALIDATION,
  interpolateParams,
  ratioFromChallenge,
  ratioFromRecovery,
  shimayoshiAcidosisStepSurrogate,
});
