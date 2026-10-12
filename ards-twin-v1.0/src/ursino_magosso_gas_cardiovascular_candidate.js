'use strict';

/**
 * Integrated Ursino/Magosso gas-autonomic cardiovascular candidate.
 *
 * Candidate layer:
 * - may own effectors inside a non-canonical candidate cardiovascular plant;
 * - must not own the canonical bedside patient state.
 *
 * Source family:
 * - Ursino 1998: baroreceptor + cardiovascular effector equations;
 * - Ursino & Magosso 2000: hypoxia + pulmonary stretch;
 * - Magosso & Ursino 2001: O2-CO2 interaction and channelized sympathetic control.
 */

const {
  createUrsinoBaroreceptorShadow,
}=require('./ursino_baroreceptor_shadow.js');

const {
  P:O2_2000_P,
  firstOrderExact,
  pulmonaryStretchStatic,
}=require('./ursino_magosso_autonomic_shadow.js');

const {
  createMagossoUrsinoGasAutonomicCandidate,
}=require('./magosso_ursino_2001_gas_autonomic_candidate.js');

const {
  createChannelizedEffectorCandidate,
}=require('./ursino_magosso_channelized_effectors_candidate.js');

const SOURCE=Object.freeze({
  baroreceptor:'Ursino 1998, doi:10.1152/ajpheart.1998.275.5.H1733',
  hypoxia:'Ursino & Magosso 2000, doi:10.1152/ajpheart.2000.279.1.H149',
  co2:'Magosso & Ursino 2001, doi:10.1152/ajpheart.2001.281.5.H2036',
  authority:'candidate-not-canonical',
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

function createUrsinoMagossoGasCardiovascularCandidate(){
  const baro=createUrsinoBaroreceptorShadow();
  const gas=createMagossoUrsinoGasAutonomicCandidate();
  let effectors=null;
  let fAp=null;
  let timeSec=0;
  let state=Object.freeze({
    timeSec:0,
    authority:SOURCE.authority,
    canonicalControlAuthority:false,
    candidatePlantControlAuthority:true,
    status:'not-stepped',
    provenance:SOURCE,
  });

  function step({
    dtSec,
    systemicArterialPressureMmHg,
    pao2MmHg,
    paco2MmHg,
    tidalVolumeL,
  }={}){
    nonNegative(dtSec,'dtSec');
    finite(systemicArterialPressureMmHg,'systemicArterialPressureMmHg');
    nonNegative(pao2MmHg,'pao2MmHg');
    finite(paco2MmHg,'paco2MmHg');
    if(!(paco2MmHg>0)) throw new Error('paco2MmHg must be > 0');
    nonNegative(tidalVolumeL,'tidalVolumeL');

    const b=baro.step({
      dtSec,
      arterialPressureMmHg:systemicArterialPressureMmHg,
    });

    const phiAp=pulmonaryStretchStatic(tidalVolumeL);
    fAp=firstOrderExact(
      fAp,
      phiAp,
      dtSec,
      O2_2000_P.pulmonaryStretch.tauSec
    );

    const a=gas.step({
      dtSec,
      pao2MmHg,
      paco2MmHg,
      fAbSpikesPerSec:b.fAbSpikesPerSec,
      fApSpikesPerSec:fAp,
    });

    if(effectors==null){
      effectors=createChannelizedEffectorCandidate({
        initialFSpSpikesPerSec:a.fSpSpikesPerSec,
        initialFSvSpikesPerSec:a.fSvSpikesPerSec,
        initialFShSpikesPerSec:a.fShSpikesPerSec,
        initialFVSpikesPerSec:a.fVSpikesPerSec,
      });
    }

    const e=effectors.step({
      dtSec,
      fSpSpikesPerSec:a.fSpSpikesPerSec,
      fSvSpikesPerSec:a.fSvSpikesPerSec,
      fShSpikesPerSec:a.fShSpikesPerSec,
      fVSpikesPerSec:a.fVSpikesPerSec,
    });

    timeSec+=dtSec;
    const hp=e.absolute.heartPeriodSec;
    const hrPerMin=hp>0?60/hp:null;

    state=Object.freeze({
      timeSec,
      inputs:Object.freeze({
        systemicArterialPressureMmHg,
        pao2MmHg,
        paco2MmHg,
        tidalVolumeL,
      }),
      afferents:Object.freeze({
        fAbSpikesPerSec:b.fAbSpikesPerSec,
        fAcSpikesPerSec:a.fAcSpikesPerSec,
        fApSpikesPerSec:fAp,
      }),
      autonomic:Object.freeze({
        fSpSpikesPerSec:a.fSpSpikesPerSec,
        fSvSpikesPerSec:a.fSvSpikesPerSec,
        fShSpikesPerSec:a.fShSpikesPerSec,
        fVSpikesPerSec:a.fVSpikesPerSec,
        thetaSp:a.thetaSp,
        thetaSv:a.thetaSv,
        thetaSh:a.thetaSh,
      }),
      effectors:e.absolute,
      effectorRate:e.rate,
      candidateHeartRatePerMin:hrPerMin,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      candidatePlantControlAuthority:true,
      status:'candidate-controller-may-drive-candidate-plant-only',
      provenance:SOURCE,
    });
    return state;
  }

  return Object.freeze({
    step,
    snapshot:()=>state,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  createUrsinoMagossoGasCardiovascularCandidate,
});
