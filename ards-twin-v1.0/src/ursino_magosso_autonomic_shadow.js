'use strict';

/**
 * Ursino-Magosso autonomic controller shadow implementation.
 *
 * IMPORTANT:
 * - Diagnostic/shadow only. It MUST NOT directly modify HumMod/Vent physiology.
 * - Every physiologic parameter below is transcribed from published sources.
 * - No HumMod Baroreflex.NA -> Ursino f_ab conversion is assumed.
 *
 * Primary source:
 * Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia.
 * I. A mathematical model. Am J Physiol Heart Circ Physiol.
 * 2000;279:H149-H165. doi:10.1152/ajpheart.2000.279.1.H149.
 *
 * Equation ledger:
 * docs/URSINO_MAGOSSO_EQUATION_LEDGER.md
 */

const {SOURCE:ADAPTATION_SOURCE,PARAMETERS:ALBANESE,PARAMETER_SET,validateParameterSet}=require('./albanese_2016_control_parameter_set.js');

const SOURCE = Object.freeze({
  citation:
    'Ursino M, Magosso E. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
  doi: '10.1152/ajpheart.2000.279.1.H149',
  pmid: '10899052',
  status: 'exact-primary-source-transcription-shadow-only',
});

const P = Object.freeze({
  peripheralChemoreceptor: Object.freeze({
    fMinSpikesPerSec: 1.16,
    fMaxSpikesPerSec: 17.07,
    pO2MidMmHg: 45,
    kMmHg: 29.27,
    tauSec: 2,
  }),
  pulmonaryStretch: Object.freeze({
    gainSpikesPerSecPerL: 23.29,
    tauSec: 2,
  }),
  sympathetic: Object.freeze({
    fInfinitySpikesPerSec: 2.1,
    f0SpikesPerSec: 16.11,
    fMaxSpikesPerSec: 60,
    kSec: 0.0675,
    weights: Object.freeze({
      sp: Object.freeze({ baro: 1, chemo: 5, pulmonary: 0.34 }),
      sh: Object.freeze({ baro: 1, chemo: 1, pulmonary: 0 }),
    }),
  }),
  vagal: Object.freeze({
    f0SpikesPerSec: 3.2,
    fInfinitySpikesPerSec: 6.3,
    baroMidSpikesPerSec: 25,
    kSpikesPerSec: 7.06,
    chemoWeight: 0.2,
    pulmonaryWeight: 0.103,
    thetaSpikesPerSec: -0.68,
  }),
  cnsHypoxia: Object.freeze({
    tauSec: 30,
    sp: Object.freeze({
      chiMinSpikesPerSec: 7.33,
      chiMaxSpikesPerSec: 13.32,
      pO2MidMmHg: 30,
      kMmHg: 2,
    }),
    sh: Object.freeze({
      chiMinSpikesPerSec: -49.38,
      chiMaxSpikesPerSec: 3.59,
      pO2MidMmHg: 45,
      kMmHg: 6,
    }),
  }),
});

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be a finite number');
  }
  return value;
}

function nonNegative(value, label) {
  finite(value, label);
  if (value < 0) throw new Error(label + ' must be non-negative');
  return value;
}

function firstOrderExact(current, target, dtSec, tauSec) {
  finite(target, 'target');
  nonNegative(dtSec, 'dtSec');
  finite(tauSec, 'tauSec');
  if (!(tauSec > 0)) throw new Error('tauSec must be > 0');
  if (current == null) return target;
  finite(current, 'current');
  if (dtSec === 0) return current;
  const decay = Math.exp(-dtSec / tauSec);
  return target + (current - target) * decay;
}

// Ursino & Magosso 2000 Eq. 17.
function peripheralChemoreceptorStatic(pao2MmHg) {
  finite(pao2MmHg, 'pao2MmHg');
  const p = P.peripheralChemoreceptor;
  const e = Math.exp((pao2MmHg - p.pO2MidMmHg) / p.kMmHg);
  return (p.fMaxSpikesPerSec + p.fMinSpikesPerSec * e) / (1 + e);
}

// Ursino & Magosso 2000 Eq. 19.
function pulmonaryStretchStatic(tidalVolumeL, gain=P.pulmonaryStretch.gainSpikesPerSecPerL) {
  nonNegative(tidalVolumeL, 'tidalVolumeL');
  return gain * tidalVolumeL;
}

function cnsHypoxiaStatic(pao2MmHg, channel) {
  finite(pao2MmHg, 'pao2MmHg');
  const p = P.cnsHypoxia[channel];
  if (!p) throw new Error('unknown CNS hypoxia channel: ' + channel);
  const e = Math.exp((pao2MmHg - p.pO2MidMmHg) / p.kMmHg);
  return (p.chiMinSpikesPerSec + p.chiMaxSpikesPerSec * e) / (1 + e);
}

// Ursino & Magosso 2000 Eq. 21.
function peripheralSympatheticFiring({
  fAbSpikesPerSec,
  fAcSpikesPerSec,
  fApSpikesPerSec,
  thetaSpSpikesPerSec,
}, weights=P.sympathetic.weights.sp) {
  finite(fAbSpikesPerSec, 'fAbSpikesPerSec');
  finite(fAcSpikesPerSec, 'fAcSpikesPerSec');
  finite(fApSpikesPerSec, 'fApSpikesPerSec');
  finite(thetaSpSpikesPerSec, 'thetaSpSpikesPerSec');
  const p = P.sympathetic;
  const w = weights;
  const exponent = p.kSec * (
    -w.baro * fAbSpikesPerSec +
    w.chemo * fAcSpikesPerSec -
    w.pulmonary * fApSpikesPerSec -
    thetaSpSpikesPerSec
  );
  const raw = p.fInfinitySpikesPerSec +
    (p.f0SpikesPerSec - p.fInfinitySpikesPerSec) * Math.exp(exponent);
  return Math.min(p.fMaxSpikesPerSec, raw);
}

// Ursino & Magosso 2000 Eq. 22.
function cardiacSympatheticFiring({
  fAbSpikesPerSec,
  fAcSpikesPerSec,
  thetaShSpikesPerSec,
}, weights=P.sympathetic.weights.sh) {
  finite(fAbSpikesPerSec, 'fAbSpikesPerSec');
  finite(fAcSpikesPerSec, 'fAcSpikesPerSec');
  finite(thetaShSpikesPerSec, 'thetaShSpikesPerSec');
  const p = P.sympathetic;
  const w = weights;
  const exponent = p.kSec * (
    -w.baro * fAbSpikesPerSec +
    w.chemo * fAcSpikesPerSec -
    thetaShSpikesPerSec
  );
  const raw = p.fInfinitySpikesPerSec +
    (p.f0SpikesPerSec - p.fInfinitySpikesPerSec) * Math.exp(exponent);
  return Math.min(p.fMaxSpikesPerSec, raw);
}

// Ursino & Magosso 2000 Eq. 23.
function vagalFiring({
  fAbSpikesPerSec,
  fAcSpikesPerSec,
  fApSpikesPerSec,
}) {
  finite(fAbSpikesPerSec, 'fAbSpikesPerSec');
  finite(fAcSpikesPerSec, 'fAcSpikesPerSec');
  finite(fApSpikesPerSec, 'fApSpikesPerSec');
  const p = P.vagal;
  const e = Math.exp((fAbSpikesPerSec - p.baroMidSpikesPerSec) / p.kSpikesPerSec);
  // Eq. 23 has both f_ev,0 and f_ev,infinity*exp(...) in the numerator.
  // Keeping f_ev,0 outside changes the high-pressure asymptote from 6.3 to
  // 9.5 spikes/s and spuriously increases vagal inhibition of the heart.
  return (p.f0SpikesPerSec + p.fInfinitySpikesPerSec * e) / (1 + e) +
    p.chemoWeight * fAcSpikesPerSec -
    p.pulmonaryWeight * fApSpikesPerSec -
    p.thetaSpikesPerSec;
}

function createUrsinoMagossoAutonomicShadow({controlParameterSet='ursino-magosso-2000'}={}) {
  validateParameterSet(controlParameterSet);
  const adapted=controlParameterSet===PARAMETER_SET;
  const instanceSource=adapted?Object.freeze({
    ...SOURCE,status:'published-parameter-adaptation-candidate-only',
    parameterSource:ADAPTATION_SOURCE,
  }):SOURCE;
  const weights={};
  for(const [key,w] of Object.entries(ALBANESE.sympatheticWeights)){
    weights[key]={baro:-w.baro,chemo:w.chemo,pulmonary:-w.pulmonary};
  }
  const pulmonaryGain=adapted?ALBANESE.pulmonaryGainSpikesPerSecPerL:P.pulmonaryStretch.gainSpikesPerSecPerL;
  let state = Object.freeze({
    fAcSpikesPerSec: null,
    fApSpikesPerSec: null,
    thetaSpSpikesPerSec: null,
    thetaShSpikesPerSec: null,
    fSpSpikesPerSec: null,
    fShSpikesPerSec: null,
    fVSpikesPerSec: null,
    fAbSpikesPerSec: null,
    baroreceptorMappingStatus: 'unmapped-no-source-valid-f_ab',
    active: false,
  });

  function step({ dtSec, pao2MmHg, tidalVolumeL, fAbSpikesPerSec = null }) {
    nonNegative(dtSec, 'dtSec');
    finite(pao2MmHg, 'pao2MmHg');
    nonNegative(tidalVolumeL, 'tidalVolumeL');

    const phiAc = peripheralChemoreceptorStatic(pao2MmHg);
    const phiAp = pulmonaryStretchStatic(tidalVolumeL,pulmonaryGain);
    const chiSp = cnsHypoxiaStatic(pao2MmHg, 'sp');
    const chiSh = cnsHypoxiaStatic(pao2MmHg, 'sh');

    const fAc = firstOrderExact(
      state.fAcSpikesPerSec,
      phiAc,
      dtSec,
      P.peripheralChemoreceptor.tauSec
    );
    const fAp = firstOrderExact(
      state.fApSpikesPerSec,
      phiAp,
      dtSec,
      P.pulmonaryStretch.tauSec
    );
    const thetaSp = firstOrderExact(
      state.thetaSpSpikesPerSec,
      chiSp,
      dtSec,
      P.cnsHypoxia.tauSec
    );
    const thetaSh = firstOrderExact(
      state.thetaShSpikesPerSec,
      chiSh,
      dtSec,
      P.cnsHypoxia.tauSec
    );

    let fSp = null;
    let fSv = null;
    let fSh = null;
    let fV = null;
    let mappingStatus = 'unmapped-no-source-valid-f_ab';
    if (fAbSpikesPerSec != null) {
      finite(fAbSpikesPerSec, 'fAbSpikesPerSec');
      fSp = peripheralSympatheticFiring({
        fAbSpikesPerSec,
        fAcSpikesPerSec: fAc,
        fApSpikesPerSec: fAp,
        thetaSpSpikesPerSec: thetaSp,
      },adapted?weights.sp:P.sympathetic.weights.sp);
      fSv=adapted?peripheralSympatheticFiring({
        fAbSpikesPerSec,fAcSpikesPerSec:fAc,fApSpikesPerSec:fAp,
        thetaSpSpikesPerSec:thetaSp,
      },weights.sv):fSp;
      fSh = cardiacSympatheticFiring({
        fAbSpikesPerSec,
        fAcSpikesPerSec: fAc,
        thetaShSpikesPerSec: thetaSh,
      },adapted?weights.sh:P.sympathetic.weights.sh);
      fV = vagalFiring({
        fAbSpikesPerSec,
        fAcSpikesPerSec: fAc,
        fApSpikesPerSec: fAp,
      });
      mappingStatus = 'explicit-f_ab-input-supplied';
    }

    state = Object.freeze({
      fAcSpikesPerSec: fAc,
      fApSpikesPerSec: fAp,
      thetaSpSpikesPerSec: thetaSp,
      thetaShSpikesPerSec: thetaSh,
      controlParameterSet,
      fSpSpikesPerSec: fSp,
      fSvSpikesPerSec:fSv,
      fShSpikesPerSec: fSh,
      fVSpikesPerSec: fV,
      fAbSpikesPerSec,
      pao2MmHg,
      tidalVolumeL,
      baroreceptorMappingStatus: mappingStatus,
      active: false,
      authority: 'shadow-diagnostic-only',
      provenance: instanceSource,
    });
    return state;
  }

  return Object.freeze({
    step,
    snapshot: () => state,
    source: instanceSource,
    parameters: P,
  });
}

module.exports = {
  SOURCE,
  P,
  firstOrderExact,
  peripheralChemoreceptorStatic,
  pulmonaryStretchStatic,
  cnsHypoxiaStatic,
  peripheralSympatheticFiring,
  cardiacSympatheticFiring,
  vagalFiring,
  createUrsinoMagossoAutonomicShadow,
};
