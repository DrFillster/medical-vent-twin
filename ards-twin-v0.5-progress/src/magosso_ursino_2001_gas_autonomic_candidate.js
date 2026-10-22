'use strict';

/**
 * Exact candidate transcription of Magosso & Ursino 2001 Eqs. 1-7.
 * DOI: 10.1152/ajpheart.2001.281.5.H2036
 *
 * Candidate only. No control authority.
 */

const {
  vagalFiring,
}=require('./ursino_magosso_autonomic_shadow.js');

const SOURCE=Object.freeze({
  citation:
    'Magosso E, Ursino M. A mathematical model of CO2 effect on cardiovascular regulation. Am J Physiol Heart Circ Physiol. 2001;281:H2036-H2052.',
  doi:'10.1152/ajpheart.2001.281.5.H2036',
  pmid:'11668065',
  equations:Object.freeze([1,2,3,4,5,6,7]),
  authority:'candidate-not-canonical',
});

const P=Object.freeze({
  chemoreceptor:Object.freeze({
    fMaxSpikesPerSec:12.3,
    fMinSpikesPerSec:0.835,
    po2MidMmHg:45,
    kO2MmHg:29.27,
    kHigh:3,
    co2Offset:1.4,
    paco2NormalMmHg:40,
    tauSec:2,
  }),
  sympathetic:Object.freeze({
    fInfinitySpikesPerSec:2.10,
    f0SpikesPerSec:16.11,
    fMaxSpikesPerSec:60,
    kSec:0.0675,
    weights:Object.freeze({
      p:Object.freeze({baro:-1,chemo:5,pulmonary:-0.34}),
      v:Object.freeze({baro:-1,chemo:5,pulmonary:-0.34}),
      h:Object.freeze({baro:-1,chemo:1,pulmonary:0}),
    }),
  }),
  cns:Object.freeze({
    tauO2Sec:30,
    tauCo2Sec:20,
    paco2NormalMmHg:40,
    p:Object.freeze({
      chiSpikesPerSec:6,
      po2MidMmHg:30,
      kMmHg:2,
      gCo2PerMmHgSec:1.5,
      thetaNormalSpikesPerSec:13.32,
    }),
    v:Object.freeze({
      chiSpikesPerSec:6,
      po2MidMmHg:30,
      kMmHg:2,
      gCo2PerMmHgSec:0,
      thetaNormalSpikesPerSec:13.32,
    }),
    h:Object.freeze({
      chiSpikesPerSec:53,
      po2MidMmHg:45,
      kMmHg:6,
      gCo2PerMmHgSec:1,
      thetaNormalSpikesPerSec:3.6,
    }),
  }),
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}
function firstOrderExact(current,target,dtSec,tauSec){
  finite(target,'target');
  nonNegative(dtSec,'dtSec');
  finite(tauSec,'tauSec');
  if(!(tauSec>0)) throw new Error('tauSec must be > 0');
  if(current==null) return target;
  finite(current,'current');
  if(dtSec===0) return current;
  const d=Math.exp(-dtSec/tauSec);
  return target+(current-target)*d;
}

// Primary Eq. 1 piecewise coefficient.
// Boundary convention follows later published transcription: 40 <= PaO2 <= 80
// uses the middle branch. Values themselves are unchanged from the 2001 paper.
function co2InteractionK(pao2MmHg){
  nonNegative(pao2MmHg,'pao2MmHg');
  const kh=P.chemoreceptor.kHigh;
  if(pao2MmHg>80) return kh;
  if(pao2MmHg>=40) return kh-1.2*((pao2MmHg-80)/30);
  return kh-1.6;
}

// Magosso & Ursino 2001 Eq. 1.
function peripheralChemoreceptorStatic({pao2MmHg,paco2MmHg}={}){
  nonNegative(pao2MmHg,'pao2MmHg');
  finite(paco2MmHg,'paco2MmHg');
  if(!(paco2MmHg>0)) throw new Error('paco2MmHg must be > 0');
  const p=P.chemoreceptor;
  const e=Math.exp((pao2MmHg-p.po2MidMmHg)/p.kO2MmHg);
  const oxygenSigmoid=(p.fMaxSpikesPerSec+p.fMinSpikesPerSec*e)/(1+e);
  const k=co2InteractionK(pao2MmHg);
  return oxygenSigmoid*(k*Math.log(paco2MmHg/p.paco2NormalMmHg)+p.co2Offset);
}

// Eq. 4.
function cnsHypoxiaStatic(pao2MmHg,channel){
  nonNegative(pao2MmHg,'pao2MmHg');
  const p=P.cns[channel];
  if(!p) throw new Error('unknown CNS channel: '+channel);
  return p.chiSpikesPerSec/
    (1+Math.exp((pao2MmHg-p.po2MidMmHg)/p.kMmHg));
}

// Eq. 3.
function sympatheticFiring({
  channel,
  fAbSpikesPerSec,
  fAcSpikesPerSec,
  fApSpikesPerSec,
  thetaSpikesPerSec,
}={}){
  nonNegative(fAbSpikesPerSec,'fAbSpikesPerSec');
  nonNegative(fAcSpikesPerSec,'fAcSpikesPerSec');
  nonNegative(fApSpikesPerSec,'fApSpikesPerSec');
  finite(thetaSpikesPerSec,'thetaSpikesPerSec');
  const w=P.sympathetic.weights[channel];
  if(!w) throw new Error('unknown sympathetic channel: '+channel);
  const exponent=P.sympathetic.kSec*(
    w.baro*fAbSpikesPerSec+
    w.chemo*fAcSpikesPerSec+
    w.pulmonary*fApSpikesPerSec-
    thetaSpikesPerSec
  );
  const raw=P.sympathetic.fInfinitySpikesPerSec+
    (P.sympathetic.f0SpikesPerSec-P.sympathetic.fInfinitySpikesPerSec)*
    Math.exp(exponent);
  return Math.min(P.sympathetic.fMaxSpikesPerSec,raw);
}

function createMagossoUrsinoGasAutonomicCandidate(){
  let fAc=null;
  const o2={p:null,v:null,h:null};
  const co2={p:null,v:null,h:null};
  let state=Object.freeze({
    authority:SOURCE.authority,
    fAcSpikesPerSec:null,
    thetaSp:null,thetaSv:null,thetaSh:null,
    fSpSpikesPerSec:null,fSvSpikesPerSec:null,fShSpikesPerSec:null,
    fVSpikesPerSec:null,
    provenance:SOURCE,
  });

  function step({
    dtSec,
    pao2MmHg,
    paco2MmHg,
    fAbSpikesPerSec,
    fApSpikesPerSec,
  }={}){
    nonNegative(dtSec,'dtSec');
    nonNegative(pao2MmHg,'pao2MmHg');
    finite(paco2MmHg,'paco2MmHg');
    nonNegative(fAbSpikesPerSec,'fAbSpikesPerSec');
    nonNegative(fApSpikesPerSec,'fApSpikesPerSec');

    const phi=peripheralChemoreceptorStatic({pao2MmHg,paco2MmHg});
    fAc=firstOrderExact(fAc,phi,dtSec,P.chemoreceptor.tauSec);

    const theta={};
    for(const channel of ['p','v','h']){
      const cp=P.cns[channel];
      o2[channel]=firstOrderExact(
        o2[channel],
        cnsHypoxiaStatic(pao2MmHg,channel),
        dtSec,
        P.cns.tauO2Sec
      );
      const co2Target=cp.gCo2PerMmHgSec*
        (paco2MmHg-P.cns.paco2NormalMmHg);
      co2[channel]=firstOrderExact(
        co2[channel],
        co2Target,
        dtSec,
        P.cns.tauCo2Sec
      );
      // Eq. 7.
      theta[channel]=cp.thetaNormalSpikesPerSec-o2[channel]-co2[channel];
    }

    const common={fAbSpikesPerSec,fAcSpikesPerSec:fAc,fApSpikesPerSec};
    const fSp=sympatheticFiring({...common,channel:'p',thetaSpikesPerSec:theta.p});
    const fSv=sympatheticFiring({...common,channel:'v',thetaSpikesPerSec:theta.v});
    const fSh=sympatheticFiring({...common,channel:'h',thetaSpikesPerSec:theta.h});
    // The 2001 extension adds CO2-aware f_ac and separated sympathetic
    // channels. Cardiac vagal output retains the source 2000 Eq. 23 pathway:
    // baroreceptor + chemoreceptor + pulmonary-stretch inputs, with no direct
    // PaCO2-to-heart-rate term.
    const fV=vagalFiring({
      fAbSpikesPerSec,
      fAcSpikesPerSec:fAc,
      fApSpikesPerSec,
    });

    state=Object.freeze({
      pao2MmHg,paco2MmHg,
      fAbSpikesPerSec,fApSpikesPerSec,
      staticChemoreceptorTargetSpikesPerSec:phi,
      co2InteractionK:co2InteractionK(pao2MmHg),
      fAcSpikesPerSec:fAc,
      deltaThetaO2Sp:o2.p,
      deltaThetaO2Sv:o2.v,
      deltaThetaO2Sh:o2.h,
      deltaThetaCo2Sp:co2.p,
      deltaThetaCo2Sv:co2.v,
      deltaThetaCo2Sh:co2.h,
      thetaSp:theta.p,
      thetaSv:theta.v,
      thetaSh:theta.h,
      fSpSpikesPerSec:fSp,
      fSvSpikesPerSec:fSv,
      fShSpikesPerSec:fSh,
      fVSpikesPerSec:fV,
      authority:SOURCE.authority,
      provenance:SOURCE,
    });
    return state;
  }

  return Object.freeze({step,snapshot:()=>state,parameters:P,source:SOURCE});
}

module.exports=Object.freeze({
  SOURCE,P,firstOrderExact,co2InteractionK,
  peripheralChemoreceptorStatic,cnsHypoxiaStatic,sympatheticFiring,
  createMagossoUrsinoGasAutonomicCandidate,
});
