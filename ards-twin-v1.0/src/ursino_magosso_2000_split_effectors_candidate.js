'use strict';

/**
 * Ursino & Magosso 2000 split systemic effector candidate.
 *
 * Primary source:
 * Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia.
 * I. A mathematical model. Am J Physiol Heart Circ Physiol.
 * 2000;279:H149-H165. doi:10.1152/ajpheart.2000.279.1.H149.
 *
 * This module contains the source redistribution of the former aggregate
 * extrasplanchnic reflex effectors across remaining extrasplanchnic and
 * skeletal-muscle beds. Brain and coronary beds remain local-control only.
 */

const SOURCE=Object.freeze({
  citation:
    'Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
  doi:'10.1152/ajpheart.2000.279.1.H149',
  equations:'30-40',
  parameterTable:2,
  authority:'candidate-not-canonical',
});

const P=Object.freeze({
  thresholdSpikesPerSec:2.66,
  effectors:Object.freeze({
    EmaxLv:Object.freeze({gain:0.475,tauSec:8,delaySec:2,offset:2.392}),
    EmaxRv:Object.freeze({gain:0.282,tauSec:8,delaySec:2,offset:1.412}),
    Rsp:Object.freeze({gain:0.695,tauSec:6,delaySec:2,offset:2.49}),
    Rep:Object.freeze({gain:1.94,tauSec:6,delaySec:2,offset:1.655}),
    RmpNormal:Object.freeze({gain:2.47,tauSec:6,delaySec:2,offset:2.106}),
    Vusv:Object.freeze({gain:-265.4,tauSec:20,delaySec:5,offset:1435.4}),
    Vuev:Object.freeze({gain:-74.21,tauSec:20,delaySec:5,offset:640.73}),
    Vumv:Object.freeze({gain:-58.29,tauSec:20,delaySec:5,offset:503.26}),
    Ts:Object.freeze({gain:-0.13,tauSec:2,delaySec:2,offset:0}),
    Tv:Object.freeze({gain:0.09,tauSec:1.5,delaySec:0.2,offset:0}),
  }),
  basalHeartPeriodSec:0.58,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label); if(v<0) throw new Error(label+' must be >= 0'); return v;
}
function sympatheticStatic(f,cfg){
  nonNegative(f,'firingSpikesPerSec');
  if(f<P.thresholdSpikesPerSec) return 0;
  return cfg.gain*Math.log(f-P.thresholdSpikesPerSec+1);
}
function vagalStatic(f){
  nonNegative(f,'firingSpikesPerSec');
  return P.effectors.Tv.gain*f;
}
function parallel(rs){
  return 1/rs.reduce((sum,r)=>sum+1/r,0);
}

function sourceTargets({
  vascularSympatheticSpikesPerSec,
  cardiacSympatheticSpikesPerSec,
  cardiacVagalSpikesPerSec,
}={}){
  nonNegative(vascularSympatheticSpikesPerSec,'vascularSympatheticSpikesPerSec');
  nonNegative(cardiacSympatheticSpikesPerSec,'cardiacSympatheticSpikesPerSec');
  nonNegative(cardiacVagalSpikesPerSec,'cardiacVagalSpikesPerSec');

  const d={};
  for(const name of ['Rsp','Rep','RmpNormal','Vusv','Vuev','Vumv']){
    d[name]=sympatheticStatic(
      vascularSympatheticSpikesPerSec,P.effectors[name]
    );
  }
  for(const name of ['EmaxLv','EmaxRv','Ts']){
    d[name]=sympatheticStatic(
      cardiacSympatheticSpikesPerSec,P.effectors[name]
    );
  }
  d.Tv=vagalStatic(cardiacVagalSpikesPerSec);

  const absolute=Object.freeze({
    EmaxLv:P.effectors.EmaxLv.offset+d.EmaxLv,
    EmaxRv:P.effectors.EmaxRv.offset+d.EmaxRv,
    Rsp:P.effectors.Rsp.offset+d.Rsp,
    Rep:P.effectors.Rep.offset+d.Rep,
    RmpNormal:P.effectors.RmpNormal.offset+d.RmpNormal,
    Vusv:P.effectors.Vusv.offset+d.Vusv,
    Vuev:P.effectors.Vuev.offset+d.Vuev,
    Vumv:P.effectors.Vumv.offset+d.Vumv,
    heartPeriodSec:P.basalHeartPeriodSec+d.Ts+d.Tv,
  });

  return Object.freeze({delta:Object.freeze(d),absolute});
}

function aggregateExtrasplanchnicReflexState({
  vascularSympatheticSpikesPerSec,
  fixedBrainResistance=6.57,
  fixedCoronaryResistance=19.71,
  fixedBrainUnstressedVolumeMl=294.64,
  fixedCoronaryUnstressedVolumeMl=98.21,
}={}){
  nonNegative(vascularSympatheticSpikesPerSec,'vascularSympatheticSpikesPerSec');
  const x=sourceTargets({
    vascularSympatheticSpikesPerSec,
    cardiacSympatheticSpikesPerSec:vascularSympatheticSpikesPerSec,
    cardiacVagalSpikesPerSec:0,
  }).absolute;
  return Object.freeze({
    peripheralResistanceMmHgSecPerMl:parallel([
      x.Rep,x.RmpNormal,fixedBrainResistance,fixedCoronaryResistance,
    ]),
    venousUnstressedVolumeMl:
      x.Vuev+x.Vumv+
      fixedBrainUnstressedVolumeMl+fixedCoronaryUnstressedVolumeMl,
  });
}

module.exports=Object.freeze({
  SOURCE,P,sympatheticStatic,vagalStatic,sourceTargets,
  aggregateExtrasplanchnicReflexState,
});
