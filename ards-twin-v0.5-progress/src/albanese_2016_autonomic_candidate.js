'use strict';

/**
 * Albanese/Cheng/Ursino/Chbat 2016 cardiovascular-control calibration.
 *
 * Primary source:
 * Albanese A, Cheng L, Ursino M, Chbat NW.
 * Am J Physiol Heart Circ Physiol. 2016;310:H899-H921.
 * doi:10.1152/ajpheart.00230.2014
 *
 * Table 7 reports the cardiovascular-control parameters that the authors
 * changed from Ursino/Magosso because the original parameterization did not
 * reproduce observed HR and arterial-pressure responses to hypercapnia and
 * hypoxia.
 *
 * This module transcribes only those published modifications and delegates
 * the remaining source-family equations to the existing Magosso/Ursino
 * implementation.
 */

const {
  P:BASE_P,
  peripheralChemoreceptorStatic,
  cnsHypoxiaStatic,
  firstOrderExact,
}=require('./magosso_ursino_2001_gas_autonomic_candidate.js');

const {
  vagalFiring,
}=require('./ursino_magosso_autonomic_shadow.js');

const SOURCE=Object.freeze({
  citation:
    'Albanese A, Cheng L, Ursino M, Chbat NW. Am J Physiol Heart Circ Physiol. 2016;310:H899-H921.',
  doi:'10.1152/ajpheart.00230.2014',
  table:'Table 7',
  validation:
    'Cheng L et al. Am J Physiol Heart Circ Physiol. 2016;310:H922-H937. doi:10.1152/ajpheart.00923.2014',
  authority:'primary-source-calibrated-cardiovascular-control-candidate',
  clinicalValidation:false,
});

const P=Object.freeze({
  lungStretch:Object.freeze({
    gainSpikesPerSecPerL:11.76,
    tauSec:2,
  }),
  sympathetic:Object.freeze({
    ...BASE_P.sympathetic,
    weights:Object.freeze({
      p:Object.freeze({baro:-1.1375,chemo:1.716,pulmonary:-0.3997}),
      v:Object.freeze({baro:-1.0806,chemo:1.716,pulmonary:-0.2907}),
      h:Object.freeze({baro:-1.75,chemo:1,pulmonary:0}),
    }),
  }),
  cns:BASE_P.cns,
  chemoreceptor:BASE_P.chemoreceptor,
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

function createAlbanese2016AutonomicCandidate(){
  let fAc=null;
  let fAp=null;
  const o2={p:null,v:null,h:null};
  const co2={p:null,v:null,h:null};
  let state=null;

  function step({
    dtSec,pao2MmHg,paco2MmHg,fAbSpikesPerSec,tidalVolumeL,
  }={}){
    nonNegative(dtSec,'dtSec');
    nonNegative(pao2MmHg,'pao2MmHg');
    finite(paco2MmHg,'paco2MmHg');
    nonNegative(fAbSpikesPerSec,'fAbSpikesPerSec');
    nonNegative(tidalVolumeL,'tidalVolumeL');

    const phi=peripheralChemoreceptorStatic({pao2MmHg,paco2MmHg});
    fAc=firstOrderExact(fAc,phi,dtSec,P.chemoreceptor.tauSec);

    const stretchTarget=P.lungStretch.gainSpikesPerSecPerL*tidalVolumeL;
    fAp=firstOrderExact(fAp,stretchTarget,dtSec,P.lungStretch.tauSec);

    const theta={};
    for(const channel of ['p','v','h']){
      const cp=P.cns[channel];
      o2[channel]=firstOrderExact(
        o2[channel],cnsHypoxiaStatic(pao2MmHg,channel),dtSec,P.cns.tauO2Sec
      );
      const co2Target=cp.gCo2PerMmHgSec*(paco2MmHg-P.cns.paco2NormalMmHg);
      co2[channel]=firstOrderExact(
        co2[channel],co2Target,dtSec,P.cns.tauCo2Sec
      );
      theta[channel]=cp.thetaNormalSpikesPerSec-o2[channel]-co2[channel];
    }

    const common={fAbSpikesPerSec,fAcSpikesPerSec:fAc,fApSpikesPerSec:fAp};
    const fSp=sympatheticFiring({...common,channel:'p',thetaSpikesPerSec:theta.p});
    const fSv=sympatheticFiring({...common,channel:'v',thetaSpikesPerSec:theta.v});
    const fSh=sympatheticFiring({...common,channel:'h',thetaSpikesPerSec:theta.h});

    // Albanese retains the Ursino/Magosso vagal source-family equation;
    // the changed Table-7 parameter is the lung-stretch afferent gain.
    const fV=vagalFiring({
      fAbSpikesPerSec,
      fAcSpikesPerSec:fAc,
      fApSpikesPerSec:fAp,
    });

    state=Object.freeze({
      pao2MmHg,paco2MmHg,tidalVolumeL,
      fAbSpikesPerSec,
      fAcSpikesPerSec:fAc,
      fApSpikesPerSec:fAp,
      fSpSpikesPerSec:fSp,
      fSvSpikesPerSec:fSv,
      fShSpikesPerSec:fSh,
      fVSpikesPerSec:fV,
      thetaSp:theta.p,thetaSv:theta.v,thetaSh:theta.h,
      provenance:SOURCE,
    });
    return state;
  }

  return Object.freeze({
    kind:'albanese-2016-autonomic-candidate',
    step,
    snapshot:()=>state,
    source:SOURCE,
    parameters:P,
  });
}

module.exports=Object.freeze({
  SOURCE,P,sympatheticFiring,createAlbanese2016AutonomicCandidate,
});
