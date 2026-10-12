#!/usr/bin/env node
'use strict';

const {
  sourceSizingFromReference,
}=require('../src/hummod_2013_left_heart_pump_candidate.js');
const {
  createHumMod2013CompensationDecompensationCandidate,
}=require('../src/hummod_2013_compensation_decompensation_candidate.js');

const DT=0.1;
const sizing=sourceSizingFromReference({
  sourceCardiacOutputMlPerMin:5000,
  leftHeartMassG:300,
  systemicArteryTotalVolumeMl:1000,
});

const c=createHumMod2013CompensationDecompensationCandidate({
  ecfvMl:15000,
  sourceSizing:sizing,
  initialArterialPh:7.44,
});

const BASE={
  dtSec:DT,
  arterialPo2MmHg:94,
  arterialPh:7.44,
  myocardialIntracellularPh:7.0,
  meanArterialPressureMmHg:87,
  leftAtrialPressureMmHg:5.5,
  pericardialPressureMmHg:-4,
};

function snap(label){
  const s=c.snapshot();
  return {
    label,
    timeSec:s.timeSec,
    heartRatePerMin:s.heartRatePerMin,
    arterialPo2MmHg:s.inputs?.arterialPo2MmHg ?? null,
    arterialPh:s.inputs?.arterialPh ?? null,
    myocardialIntracellularPh:s.inputs?.myocardialIntracellularPh ?? null,
    chemoCnsEffect:s.autonomic?.chemoreceptorsCns?.effect ?? null,
    cardiacSympatheticHz:s.autonomic?.sympathetic?.cardiacHz ?? null,
    beta1PoolEffect:s.autonomic?.catecholamines?.beta1Effect ?? null,
    norepinephrinePgPerMl:s.autonomic?.catecholamines?.nePgPerMl ?? null,
    epinephrinePgPerMl:s.autonomic?.catecholamines?.epiPgPerMl ?? null,
    myocardialPhEffect:s.leftHeartContractility?.phEffect ?? null,
    betaSymps:s.leftHeartContractility?.betaSymps ?? null,
    lvContractility:s.leftHeartContractility?.contractility ?? null,
    lvKMultiplier:s.leftHeartPump?.kMultiplier ?? null,
    sbpMmHg:s.leftHeartPump?.sbpMmHg ?? null,
    strokeVolumeMl:s.strokeVolumeMl,
    cardiacOutputMlPerMin:s.cardiacOutputMlPerMin,
  };
}

function run(seconds,inputs){
  const n=Math.round(seconds/DT);
  const extrema={
    maxHr:-Infinity,minHr:Infinity,
    maxContractility:-Infinity,minContractility:Infinity,
    maxSv:-Infinity,minSv:Infinity,
    maxCo:-Infinity,minCo:Infinity,
    maxBetaSymps:-Infinity,minBetaSymps:Infinity,
    maxCardiacSymps:-Infinity,minCardiacSymps:Infinity,
  };
  for(let i=0;i<n;i++){
    const s=c.step(inputs);
    const vals=[
      ['maxHr','minHr',s.heartRatePerMin],
      ['maxContractility','minContractility',s.leftHeartContractility.contractility],
      ['maxSv','minSv',s.strokeVolumeMl],
      ['maxCo','minCo',s.cardiacOutputMlPerMin],
      ['maxBetaSymps','minBetaSymps',s.leftHeartContractility.betaSymps],
      ['maxCardiacSymps','minCardiacSymps',s.autonomic.sympathetic.cardiacHz],
    ];
    for(const [maxK,minK,v] of vals){
      extrema[maxK]=Math.max(extrema[maxK],v);
      extrema[minK]=Math.min(extrema[minK],v);
    }
  }
  return extrema;
}

const stages=[];

let extrema=run(600,BASE);
stages.push({endpoint:snap('baseline'),extrema});

extrema=run(600,{...BASE,arterialPo2MmHg:30});
stages.push({endpoint:snap('compensated-severe-hypoxia'),extrema});

extrema=run(300,{
  ...BASE,
  arterialPo2MmHg:30,
  arterialPh:7.10,
  myocardialIntracellularPh:6.68,
});
stages.push({endpoint:snap('myocardial-decompensation'),extrema});

extrema=run(300,{
  ...BASE,
  arterialPo2MmHg:94,
  arterialPh:7.44,
  myocardialIntracellularPh:6.68,
});
stages.push({endpoint:snap('reoxygenation-persistent-myocardial-acidosis'),extrema});

extrema=run(900,BASE);
stages.push({endpoint:snap('full-recovery'),extrema});

const low=stages.find(x=>x.endpoint.label==='myocardial-decompensation').endpoint;
const rec=stages.find(x=>x.endpoint.label==='full-recovery').endpoint;

console.log(JSON.stringify({
  schema:'hummod-2013-recovery-diagnostic/v1',
  authority:'diagnostic-only',
  physiologyChanged:false,
  regressionFixtureSizing:{
    sourceCardiacOutputMlPerMin:5000,
    leftHeartMassG:300,
    systemicArteryTotalVolumeMl:1000,
    note:'Synthetic regression fixture only; not a HumMod default patient.',
  },
  stages,
  comparison:{
    decompensation:low,
    fullRecovery:rec,
    recoveryMinusDecompensation:{
      heartRatePerMin:rec.heartRatePerMin-low.heartRatePerMin,
      cardiacSympatheticHz:rec.cardiacSympatheticHz-low.cardiacSympatheticHz,
      beta1PoolEffect:rec.beta1PoolEffect-low.beta1PoolEffect,
      myocardialPhEffect:rec.myocardialPhEffect-low.myocardialPhEffect,
      betaSymps:rec.betaSymps-low.betaSymps,
      lvContractility:rec.lvContractility-low.lvContractility,
      strokeVolumeMl:rec.strokeVolumeMl-low.strokeVolumeMl,
      cardiacOutputMlPerMin:rec.cardiacOutputMlPerMin-low.cardiacOutputMlPerMin,
    },
  },
  interpretation:
    'Diagnostic only. Determines whether the failed recovery assertion reflects withdrawal of adrenergic support, slow autonomic/catecholamine kinetics, or persistent pump depression. No source parameters are changed.',
},null,2));
