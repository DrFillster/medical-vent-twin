'use strict';

/**
 * Ursino & Magosso 2000 reflex-effector candidate.
 *
 * Primary source: Appendix Eqs. 30-40, Table 2.
 * Vascular effectors use f_sp. Cardiac effectors use f_sh; heart period also
 * receives f_v. This module intentionally does NOT use the later 2001 f_sv
 * venous-sympathetic split.
 */

const SOURCE=Object.freeze({
  citation:'Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
  doi:'10.1152/ajpheart.2000.279.1.H149',
  equations:'30-40',
  parameterTable:2,
  authority:'candidate-not-canonical',
});

const P=Object.freeze({
  thresholdSpikesPerSec:2.66,
  effectors:Object.freeze({
    EmaxLv:Object.freeze({channel:'fSh',gain:0.475,tauSec:8,delaySec:2,offset:2.392}),
    EmaxRv:Object.freeze({channel:'fSh',gain:0.282,tauSec:8,delaySec:2,offset:1.412}),
    Rsp:Object.freeze({channel:'fSp',gain:0.695,tauSec:6,delaySec:2,offset:2.49}),
    Rep:Object.freeze({channel:'fSp',gain:1.94,tauSec:6,delaySec:2,offset:1.655}),
    RmpNeural:Object.freeze({channel:'fSp',gain:2.47,tauSec:6,delaySec:2,offset:2.106}),
    Vusv:Object.freeze({channel:'fSp',gain:-265.4,tauSec:20,delaySec:5,offset:1435.4}),
    Vuev:Object.freeze({channel:'fSp',gain:-74.21,tauSec:20,delaySec:5,offset:640.73}),
    Vumv:Object.freeze({channel:'fSp',gain:-58.29,tauSec:20,delaySec:5,offset:503.26}),
    Ts:Object.freeze({channel:'fSh',gain:-0.13,tauSec:2,delaySec:2,offset:0}),
    Tv:Object.freeze({channel:'fV',gain:0.09,tauSec:1.5,delaySec:0.2,offset:0}),
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

function sympatheticStatic(firingSpikesPerSec,cfg){
  nonNegative(firingSpikesPerSec,'firingSpikesPerSec');
  if(firingSpikesPerSec<P.thresholdSpikesPerSec) return 0;
  return cfg.gain*Math.log(firingSpikesPerSec-P.thresholdSpikesPerSec+1);
}
function vagalStatic(firingSpikesPerSec){
  nonNegative(firingSpikesPerSec,'firingSpikesPerSec');
  return P.effectors.Tv.gain*firingSpikesPerSec;
}

function sourceTargets({fSpSpikesPerSec,fShSpikesPerSec,fVSpikesPerSec}={}){
  for(const [k,v] of Object.entries({fSpSpikesPerSec,fShSpikesPerSec,fVSpikesPerSec})){
    nonNegative(v,k);
  }
  const delta=Object.freeze({
    EmaxLv:sympatheticStatic(fShSpikesPerSec,P.effectors.EmaxLv),
    EmaxRv:sympatheticStatic(fShSpikesPerSec,P.effectors.EmaxRv),
    Rsp:sympatheticStatic(fSpSpikesPerSec,P.effectors.Rsp),
    Rep:sympatheticStatic(fSpSpikesPerSec,P.effectors.Rep),
    RmpNeural:sympatheticStatic(fSpSpikesPerSec,P.effectors.RmpNeural),
    Vusv:sympatheticStatic(fSpSpikesPerSec,P.effectors.Vusv),
    Vuev:sympatheticStatic(fSpSpikesPerSec,P.effectors.Vuev),
    Vumv:sympatheticStatic(fSpSpikesPerSec,P.effectors.Vumv),
    Ts:sympatheticStatic(fShSpikesPerSec,P.effectors.Ts),
    Tv:vagalStatic(fVSpikesPerSec),
  });
  return Object.freeze({
    delta,
    absolute:Object.freeze({
      EmaxLv:P.effectors.EmaxLv.offset+delta.EmaxLv,
      EmaxRv:P.effectors.EmaxRv.offset+delta.EmaxRv,
      Rsp:P.effectors.Rsp.offset+delta.Rsp,
      Rep:P.effectors.Rep.offset+delta.Rep,
      RmpNeural:P.effectors.RmpNeural.offset+delta.RmpNeural,
      Vusv:P.effectors.Vusv.offset+delta.Vusv,
      Vuev:P.effectors.Vuev.offset+delta.Vuev,
      Vumv:P.effectors.Vumv.offset+delta.Vumv,
      heartPeriodSec:P.basalHeartPeriodSec+delta.Ts+delta.Tv,
    }),
  });
}

function createUrsinoMagosso2000EffectorCandidate({
  initialFSpSpikesPerSec,
  initialFShSpikesPerSec,
  initialFVSpikesPerSec,
}={}){
  const init=sourceTargets({
    fSpSpikesPerSec:initialFSpSpikesPerSec,
    fShSpikesPerSec:initialFShSpikesPerSec,
    fVSpikesPerSec:initialFVSpikesPerSec,
  });
  let delta={...init.delta};
  let rates=Object.fromEntries(Object.keys(delta).map(k=>[k,0]));
  let timeSec=0;
  const history={fSp:[],fSh:[],fV:[]};

  function delayed(channel,delaySec,current){
    const h=history[channel];
    const target=timeSec-delaySec;
    if(!h.length||target<h[0].t) return current;
    if(target===h[0].t) return h[0].v;
    for(let i=h.length-1;i>=1;i--){
      const a=h[i-1],b=h[i];
      if(a.t<=target&&target<=b.t){
        const span=b.t-a.t;
        if(!(span>0)) return a.v;
        const w=(target-a.t)/span;
        return a.v+w*(b.v-a.v);
      }
    }
    return h[h.length-1].v;
  }

  function step({dtSec,fSpSpikesPerSec,fShSpikesPerSec,fVSpikesPerSec}={}){
    nonNegative(dtSec,'dtSec');
    for(const [k,v] of Object.entries({fSpSpikesPerSec,fShSpikesPerSec,fVSpikesPerSec})){
      nonNegative(v,k);
    }

    const targets={};
    for(const [name,cfg] of Object.entries(P.effectors)){
      const current=cfg.channel==='fSp'
        ?fSpSpikesPerSec
        :cfg.channel==='fSh'?fShSpikesPerSec:fVSpikesPerSec;
      const fd=delayed(cfg.channel,cfg.delaySec,current);
      targets[name]=cfg.channel==='fV'
        ?vagalStatic(fd)
        :sympatheticStatic(fd,cfg);
    }

    const nextRates={};
    for(const name of Object.keys(delta)){
      const cfg=P.effectors[name];
      nextRates[name]=(-delta[name]+targets[name])/cfg.tauSec;
      if(dtSec>0){
        const decay=Math.exp(-dtSec/cfg.tauSec);
        delta[name]=targets[name]+(delta[name]-targets[name])*decay;
      }
    }
    rates=nextRates;
    timeSec+=dtSec;

    history.fSp.push({t:timeSec,v:fSpSpikesPerSec});
    history.fSh.push({t:timeSec,v:fShSpikesPerSec});
    history.fV.push({t:timeSec,v:fVSpikesPerSec});
    const keepAfter=timeSec-7;
    for(const h of Object.values(history)){
      while(h.length>2&&h[1].t<keepAfter) h.shift();
    }
    return snapshot();
  }

  function snapshot(){
    const absolute={
      EmaxLv:P.effectors.EmaxLv.offset+delta.EmaxLv,
      EmaxRv:P.effectors.EmaxRv.offset+delta.EmaxRv,
      Rsp:P.effectors.Rsp.offset+delta.Rsp,
      Rep:P.effectors.Rep.offset+delta.Rep,
      RmpNeural:P.effectors.RmpNeural.offset+delta.RmpNeural,
      Vusv:P.effectors.Vusv.offset+delta.Vusv,
      Vuev:P.effectors.Vuev.offset+delta.Vuev,
      Vumv:P.effectors.Vumv.offset+delta.Vumv,
      heartPeriodSec:P.basalHeartPeriodSec+delta.Ts+delta.Tv,
    };
    return Object.freeze({
      timeSec,
      delta:Object.freeze({...delta}),
      rate:Object.freeze({...rates}),
      absolute:Object.freeze(absolute),
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      provenance:SOURCE,
    });
  }

  return Object.freeze({step,snapshot,source:SOURCE,parameters:P});
}

module.exports=Object.freeze({
  SOURCE,P,sympatheticStatic,vagalStatic,sourceTargets,
  createUrsinoMagosso2000EffectorCandidate,
});
