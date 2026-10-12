'use strict';

/**
 * Dynamic Ursino & Magosso 2000 split systemic effectors.
 *
 * Source equations and parameters are defined in
 * ursino_magosso_2000_split_effectors_candidate.js (Eqs. 30-40, Table 2).
 *
 * Candidate only. No canonical bedside authority.
 */

const {
  SOURCE:STATIC_SOURCE,P,sympatheticStatic,vagalStatic,
}=require('./ursino_magosso_2000_split_effectors_candidate.js');

const SOURCE=Object.freeze({
  ...STATIC_SOURCE,
  implementation:'delayed-first-order-effector-runtime',
  authority:'candidate-not-canonical',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label); if(v<0) throw new Error(label+' must be >= 0'); return v;
}

function delayed(history,target,fallback){
  if(!history.length) return fallback;
  if(target<history[0].t) return fallback;
  if(target===history[0].t) return history[0].v;
  for(let i=history.length-1;i>=1;i--){
    const a=history[i-1],b=history[i];
    if(a.t<=target&&target<=b.t){
      const span=b.t-a.t;
      if(!(span>0)) return a.v;
      const w=(target-a.t)/span;
      return a.v+w*(b.v-a.v);
    }
  }
  return history[history.length-1].v;
}

function staticDelta(name,firing){
  if(name==='Tv') return vagalStatic(firing);
  return sympatheticStatic(firing,P.effectors[name]);
}

function createUrsinoMagosso2000SplitEffectorsRuntime({
  initialVascularSympatheticSpikesPerSec,
  initialCardiacSympatheticSpikesPerSec,
  initialCardiacVagalSpikesPerSec,
}={}){
  nonNegative(initialVascularSympatheticSpikesPerSec,
    'initialVascularSympatheticSpikesPerSec');
  nonNegative(initialCardiacSympatheticSpikesPerSec,
    'initialCardiacSympatheticSpikesPerSec');
  nonNegative(initialCardiacVagalSpikesPerSec,
    'initialCardiacVagalSpikesPerSec');

  const delta={};
  for(const name of [
    'Rsp','Rep','RmpNormal','Vusv','Vuev','Vumv',
  ]){
    delta[name]=staticDelta(name,initialVascularSympatheticSpikesPerSec);
  }
  for(const name of ['EmaxLv','EmaxRv','Ts']){
    delta[name]=staticDelta(name,initialCardiacSympatheticSpikesPerSec);
  }
  delta.Tv=staticDelta('Tv',initialCardiacVagalSpikesPerSec);

  const history={vascular:[],cardiac:[],vagal:[]};
  let timeSec=0;
  let rates={};
  for(const name of Object.keys(delta)) rates[name]=0;

  function inputFor(name,current){
    if(['Rsp','Rep','RmpNormal','Vusv','Vuev','Vumv'].includes(name)){
      return ['vascular',current.vascular];
    }
    if(['EmaxLv','EmaxRv','Ts'].includes(name)){
      return ['cardiac',current.cardiac];
    }
    return ['vagal',current.vagal];
  }

  function step({
    dtSec,
    vascularSympatheticSpikesPerSec,
    cardiacSympatheticSpikesPerSec,
    cardiacVagalSpikesPerSec,
  }={}){
    nonNegative(dtSec,'dtSec');
    const current={
      vascular:nonNegative(vascularSympatheticSpikesPerSec,
        'vascularSympatheticSpikesPerSec'),
      cardiac:nonNegative(cardiacSympatheticSpikesPerSec,
        'cardiacSympatheticSpikesPerSec'),
      vagal:nonNegative(cardiacVagalSpikesPerSec,
        'cardiacVagalSpikesPerSec'),
    };

    const targets={};
    const nextRates={};
    for(const name of Object.keys(delta)){
      const cfg=P.effectors[name];
      const [channel,fallback]=inputFor(name,current);
      const fd=delayed(history[channel],timeSec-cfg.delaySec,fallback);
      targets[name]=staticDelta(name,fd);
      nextRates[name]=(-delta[name]+targets[name])/cfg.tauSec;
    }
    rates=nextRates;

    if(dtSec>0){
      for(const name of Object.keys(delta)){
        const cfg=P.effectors[name];
        const decay=Math.exp(-dtSec/cfg.tauSec);
        delta[name]=targets[name]+(delta[name]-targets[name])*decay;
      }
    }

    timeSec+=dtSec;
    history.vascular.push({t:timeSec,v:current.vascular});
    history.cardiac.push({t:timeSec,v:current.cardiac});
    history.vagal.push({t:timeSec,v:current.vagal});
    const keepAfter=timeSec-7;
    for(const h of Object.values(history)){
      while(h.length>2&&h[1].t<keepAfter) h.shift();
    }

    return snapshot();
  }

  function snapshot(){
    const absolute=Object.freeze({
      EmaxLv:P.effectors.EmaxLv.offset+delta.EmaxLv,
      EmaxRv:P.effectors.EmaxRv.offset+delta.EmaxRv,
      Rsp:P.effectors.Rsp.offset+delta.Rsp,
      Rep:P.effectors.Rep.offset+delta.Rep,
      RmpNormal:P.effectors.RmpNormal.offset+delta.RmpNormal,
      Vusv:P.effectors.Vusv.offset+delta.Vusv,
      Vuev:P.effectors.Vuev.offset+delta.Vuev,
      Vumv:P.effectors.Vumv.offset+delta.Vumv,
      heartPeriodSec:P.basalHeartPeriodSec+delta.Ts+delta.Tv,
    });
    return Object.freeze({
      timeSec,
      delta:Object.freeze({...delta}),
      rate:Object.freeze({...rates}),
      absolute,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      provenance:SOURCE,
    });
  }

  return Object.freeze({step,snapshot,source:SOURCE,parameters:P});
}

module.exports=Object.freeze({
  SOURCE,createUrsinoMagosso2000SplitEffectorsRuntime,
});
