'use strict';

/**
 * Channelized Ursino/Magosso cardiovascular effector candidate.
 *
 * Source-family composition:
 * - Ursino 1998: exact effector equations/parameters for resistance,
 *   venous unstressed volume, ventricular Emax, and heart period.
 * - Ursino & Magosso 2000: vascular effectors use vascular sympathetic f_sp;
 *   cardiac Emax / sympathetic heart-period use cardiac sympathetic f_sh.
 * - Magosso & Ursino 2001: vascular sympathetic output is separated into
 *   arterial f_sp and venous f_sv. f_sv controls venous unstressed volume.
 *
 * This module changes no canonical patient state.
 */

const SOURCE=Object.freeze({
  baroreflex:Object.freeze({
    citation:'Ursino M. Interaction between carotid baroregulation and the pulsating heart: a mathematical model. Am J Physiol Heart Circ Physiol. 1998;275:H1733-H1747.',
    doi:'10.1152/ajpheart.1998.275.5.H1733',
    equations:'35-42',
    parameters:'Table 3',
  }),
  hypoxia:Object.freeze({
    citation:'Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
    doi:'10.1152/ajpheart.2000.279.1.H149',
    role:'f_sp -> resistance; f_sh -> cardiac elastance and sympathetic heart period',
  }),
  co2:Object.freeze({
    citation:'Magosso E, Ursino M. A mathematical model of CO2 effect on cardiovascular regulation. Am J Physiol Heart Circ Physiol. 2001;281:H2036-H2052.',
    doi:'10.1152/ajpheart.2001.281.5.H2036',
    role:'separates vascular sympathetic fibers into arterial f_sp and venous f_sv; f_sv controls unstressed venous volumes',
  }),
  authority:'candidate-not-canonical',
});

const P=Object.freeze({
  thresholdSpikesPerSec:2.66,
  effectors:Object.freeze({
    EmaxLv:Object.freeze({
      channel:'fSh',gain:0.475,tauSec:8,delaySec:2,offset:2.392,
      units:'mmHg/mL',
    }),
    EmaxRv:Object.freeze({
      channel:'fSh',gain:0.282,tauSec:8,delaySec:2,offset:1.412,
      units:'mmHg/mL',
    }),
    Rsp:Object.freeze({
      channel:'fSp',gain:0.695,tauSec:6,delaySec:2,offset:2.49,
      units:'mmHg*s/mL',
    }),
    Rep:Object.freeze({
      channel:'fSp',gain:0.53,tauSec:6,delaySec:2,offset:0.78,
      units:'mmHg*s/mL',
    }),
    Vusv:Object.freeze({
      channel:'fSv',gain:-265.4,tauSec:20,delaySec:5,offset:1435.4,
      units:'mL',
    }),
    Vuev:Object.freeze({
      channel:'fSv',gain:-132.5,tauSec:20,delaySec:5,offset:1537,
      units:'mL',
    }),
    Ts:Object.freeze({
      channel:'fSh',gain:-0.13,tauSec:2,delaySec:2,offset:0,
      units:'s',
    }),
    Tv:Object.freeze({
      channel:'fV',gain:0.09,tauSec:1.5,delaySec:0.2,offset:0,
      units:'s',
    }),
  }),
  basalHeartPeriodSec:0.58,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function sympatheticStatic(firingSpikesPerSec,cfg){
  nonNegative(firingSpikesPerSec,'firingSpikesPerSec');
  if(firingSpikesPerSec<P.thresholdSpikesPerSec) return 0;
  return cfg.gain*Math.log(
    firingSpikesPerSec-P.thresholdSpikesPerSec+1
  );
}

function vagalStatic(firingSpikesPerSec,cfg=P.effectors.Tv){
  nonNegative(firingSpikesPerSec,'firingSpikesPerSec');
  return cfg.gain*firingSpikesPerSec;
}

function sourceTargets({
  fSpSpikesPerSec,
  fSvSpikesPerSec,
  fShSpikesPerSec,
  fVSpikesPerSec,
}={}){
  for(const [k,v] of Object.entries({
    fSpSpikesPerSec,fSvSpikesPerSec,fShSpikesPerSec,fVSpikesPerSec,
  })) nonNegative(v,k);

  const delta=Object.freeze({
    EmaxLv:sympatheticStatic(fShSpikesPerSec,P.effectors.EmaxLv),
    EmaxRv:sympatheticStatic(fShSpikesPerSec,P.effectors.EmaxRv),
    Rsp:sympatheticStatic(fSpSpikesPerSec,P.effectors.Rsp),
    Rep:sympatheticStatic(fSpSpikesPerSec,P.effectors.Rep),
    Vusv:sympatheticStatic(fSvSpikesPerSec,P.effectors.Vusv),
    Vuev:sympatheticStatic(fSvSpikesPerSec,P.effectors.Vuev),
    Ts:sympatheticStatic(fShSpikesPerSec,P.effectors.Ts),
    Tv:vagalStatic(fVSpikesPerSec),
  });

  const absolute=Object.freeze({
    EmaxLv:P.effectors.EmaxLv.offset+delta.EmaxLv,
    EmaxRv:P.effectors.EmaxRv.offset+delta.EmaxRv,
    Rsp:P.effectors.Rsp.offset+delta.Rsp,
    Rep:P.effectors.Rep.offset+delta.Rep,
    Vusv:P.effectors.Vusv.offset+delta.Vusv,
    Vuev:P.effectors.Vuev.offset+delta.Vuev,
    heartPeriodSec:P.basalHeartPeriodSec+delta.Ts+delta.Tv,
  });

  return Object.freeze({delta,absolute});
}

function createChannelizedEffectorCandidate({
  initialFSpSpikesPerSec,
  initialFSvSpikesPerSec,
  initialFShSpikesPerSec,
  initialFVSpikesPerSec,
}={}){
  const init=sourceTargets({
    fSpSpikesPerSec:initialFSpSpikesPerSec,
    fSvSpikesPerSec:initialFSvSpikesPerSec,
    fShSpikesPerSec:initialFShSpikesPerSec,
    fVSpikesPerSec:initialFVSpikesPerSec,
  });

  let delta={...init.delta};
  const history={
    fSp:[],fSv:[],fSh:[],fV:[],
  };
  let timeSec=0;

  function delayed(name,delaySec,current){
    const h=history[name];
    const target=timeSec-delaySec;
    if(!h.length||target<=h[0].t) return h.length?h[0].v:current;
    for(let i=h.length-1;i>=1;i--){
      const a=h[i-1],b=h[i];
      if(a.t<=target&&target<=b.t){
        const dt=b.t-a.t;
        if(!(dt>0)) return a.v;
        const w=(target-a.t)/dt;
        return a.v+w*(b.v-a.v);
      }
    }
    return h[h.length-1].v;
  }

  function derivative(current,target,tauSec){
    return (-current+target)/tauSec;
  }

  function step({
    dtSec,
    fSpSpikesPerSec,
    fSvSpikesPerSec,
    fShSpikesPerSec,
    fVSpikesPerSec,
  }={}){
    nonNegative(dtSec,'dtSec');
    for(const [k,v] of Object.entries({
      fSpSpikesPerSec,fSvSpikesPerSec,fShSpikesPerSec,fVSpikesPerSec,
    })) nonNegative(v,k);

    const delayedSignals={
      EmaxLv:delayed('fSh',P.effectors.EmaxLv.delaySec,fShSpikesPerSec),
      EmaxRv:delayed('fSh',P.effectors.EmaxRv.delaySec,fShSpikesPerSec),
      Rsp:delayed('fSp',P.effectors.Rsp.delaySec,fSpSpikesPerSec),
      Rep:delayed('fSp',P.effectors.Rep.delaySec,fSpSpikesPerSec),
      Vusv:delayed('fSv',P.effectors.Vusv.delaySec,fSvSpikesPerSec),
      Vuev:delayed('fSv',P.effectors.Vuev.delaySec,fSvSpikesPerSec),
      Ts:delayed('fSh',P.effectors.Ts.delaySec,fShSpikesPerSec),
      Tv:delayed('fV',P.effectors.Tv.delaySec,fVSpikesPerSec),
    };

    const targets={
      EmaxLv:sympatheticStatic(delayedSignals.EmaxLv,P.effectors.EmaxLv),
      EmaxRv:sympatheticStatic(delayedSignals.EmaxRv,P.effectors.EmaxRv),
      Rsp:sympatheticStatic(delayedSignals.Rsp,P.effectors.Rsp),
      Rep:sympatheticStatic(delayedSignals.Rep,P.effectors.Rep),
      Vusv:sympatheticStatic(delayedSignals.Vusv,P.effectors.Vusv),
      Vuev:sympatheticStatic(delayedSignals.Vuev,P.effectors.Vuev),
      Ts:sympatheticStatic(delayedSignals.Ts,P.effectors.Ts),
      Tv:vagalStatic(delayedSignals.Tv),
    };

    // Exact first-order update for a held target over dt.
    for(const name of Object.keys(delta)){
      const cfg=P.effectors[name];
      if(dtSec>0){
        const decay=Math.exp(-dtSec/cfg.tauSec);
        delta[name]=targets[name]+(delta[name]-targets[name])*decay;
      }
    }

    timeSec+=dtSec;
    history.fSp.push({t:timeSec,v:fSpSpikesPerSec});
    history.fSv.push({t:timeSec,v:fSvSpikesPerSec});
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
      Vusv:P.effectors.Vusv.offset+delta.Vusv,
      Vuev:P.effectors.Vuev.offset+delta.Vuev,
      heartPeriodSec:P.basalHeartPeriodSec+delta.Ts+delta.Tv,
    };
    return Object.freeze({
      timeSec,
      delta:Object.freeze({...delta}),
      absolute:Object.freeze(absolute),
      authority:SOURCE.authority,
      controlAuthority:false,
      provenance:SOURCE,
    });
  }

  return Object.freeze({step,snapshot,source:SOURCE,parameters:P});
}

module.exports=Object.freeze({
  SOURCE,P,sympatheticStatic,vagalStatic,sourceTargets,
  createChannelizedEffectorCandidate,
});
