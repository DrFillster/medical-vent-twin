'use strict';

const {
  createUrsinoBaroreceptorShadow,
} = require('./ursino_baroreceptor_shadow.js');
const {
  firstOrderExact,
  pulmonaryStretchStatic,
  vagalFiring,
} = require('./ursino_magosso_autonomic_shadow.js');
const {
  createMagossoUrsinoGasAutonomicCandidate,
} = require('./magosso_ursino_2001_gas_autonomic_candidate.js');
const {
  createIwamotoHeartPeriodCandidate,
} = require('./ursino_iwamoto_heart_period_candidate.js');

const SOURCE=Object.freeze({
  baroreceptor:'10.1152/ajpheart.1998.275.5.H1733',
  hypoxiaStretchVagal:'10.1152/ajpheart.2000.279.1.H149',
  co2Autonomic:'10.1152/ajpheart.2001.281.5.H2036',
  heartPeriod:'10.1371/journal.pcbi.1012645',
  authority:'candidate-not-canonical',
});

const PULMONARY_STRETCH_TAU_SEC=2;

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function createCanonicalHrCandidate(){
  const baro=createUrsinoBaroreceptorShadow();
  const gasAutonomic=createMagossoUrsinoGasAutonomicCandidate();
  const period=createIwamotoHeartPeriodCandidate();
  let fAp=null;
  let previousTimeSec=null;
  let state=Object.freeze({
    heartRatePerMin:null,
    heartPeriodSec:null,
    authority:SOURCE.authority,
    provenance:SOURCE,
  });

  function step({
    timeSec,
    meanArterialPressureMmHg,
    pao2MmHg,
    paco2MmHg,
    tidalVolumeL,
  }={}){
    nonNegative(timeSec,'timeSec');
    finite(meanArterialPressureMmHg,'meanArterialPressureMmHg');
    nonNegative(pao2MmHg,'pao2MmHg');
    finite(paco2MmHg,'paco2MmHg');
    nonNegative(tidalVolumeL,'tidalVolumeL');
    if(previousTimeSec!=null&&timeSec<previousTimeSec){
      throw new Error('timeSec must be monotonic');
    }
    const dtSec=previousTimeSec==null?0:timeSec-previousTimeSec;
    previousTimeSec=timeSec;

    const b=baro.step({
      dtSec,
      arterialPressureMmHg:meanArterialPressureMmHg,
    });

    const stretchTarget=pulmonaryStretchStatic(tidalVolumeL);
    fAp=firstOrderExact(
      fAp,
      stretchTarget,
      dtSec,
      PULMONARY_STRETCH_TAU_SEC
    );

    const a=gasAutonomic.step({
      dtSec,
      pao2MmHg,
      paco2MmHg,
      fAbSpikesPerSec:b.fAbSpikesPerSec,
      fApSpikesPerSec:fAp,
    });

    // Ursino & Magosso 2000 Eq. 23.
    const fV=vagalFiring({
      fAbSpikesPerSec:b.fAbSpikesPerSec,
      fAcSpikesPerSec:a.fAcSpikesPerSec,
      fApSpikesPerSec:fAp,
    });

    const hp=period.step({
      timeSec,
      cardiacSympatheticSpikesPerSec:a.fShSpikesPerSec,
      cardiacVagalSpikesPerSec:fV,
    });

    state=Object.freeze({
      timeSec,
      meanArterialPressureMmHg,
      pao2MmHg,
      paco2MmHg,
      tidalVolumeL,
      fAbSpikesPerSec:b.fAbSpikesPerSec,
      fAcSpikesPerSec:a.fAcSpikesPerSec,
      fApSpikesPerSec:fAp,
      fSpSpikesPerSec:a.fSpSpikesPerSec,
      fSvSpikesPerSec:a.fSvSpikesPerSec,
      fShSpikesPerSec:a.fShSpikesPerSec,
      fVSpikesPerSec:fV,
      thetaSp:a.thetaSp,
      thetaSv:a.thetaSv,
      thetaSh:a.thetaSh,
      heartPeriodSec:hp.heartPeriodSec,
      heartRatePerMin:hp.heartRatePerMin,
      authority:SOURCE.authority,
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
  PULMONARY_STRETCH_TAU_SEC,
  createCanonicalHrCandidate,
});
