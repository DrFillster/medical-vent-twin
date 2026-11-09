'use strict';

const {
  firstOrderDriveStep,
  peripheralHypoxiaTarget,
} = require('./hennigs_respiratory_center_primitives.js');

const MMHG_PER_KPA = 7.500616827041697;

const PARAMETER_PROFILES = Object.freeze({
  'development-paper': Object.freeze({peripheralTauSec:1, oxygenWeight:0.25}),
  'validation-paper': Object.freeze({peripheralTauSec:10, oxygenWeight:1}),
});

const SOURCE = Object.freeze({
  citation:
    'Hennigs C et al. Validation of a Computational Respiratory System Model for Mechanical Ventilation. arXiv:2607.06210v2 (2026), Appendix Tables 8-9.',
  companionPrimarySource: '10.1016/j.cmpb.2026.109329',
  parameterSet: 'hennigs-2026-validation-reference',
  equations: '2-8',
  authority: 'candidate-not-canonical',
  controlAuthority: false,
  knownParameters: Object.freeze({
    centralGainPerPh: 27.72,
    centralTauSec: 100,
    medullaryPhThreshold: 7.32,
    peripheralCo2GainPerKpa: 0.08,
    arterialPhThreshold: 7.40,
    peripheralO2GainPerKpa: 0.2,
    peripheralO2ThresholdMmHg: 75,
    peripheralTauSec: 10,
    relativeDriveScale: 1,
    relativeDriveOffset: -4,
  }),
  unresolved: Object.freeze([
    'GPCO2_pH exact source value',
    'stochastic chemical-drive term for non-deterministic reproduction',
    'source-valid medullary pH provider from brain/CSF CO2 and cerebral flow',
  ]),
});

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be finite');
  }
  return value;
}
function positive(value, label) {
  finite(value, label);
  if (!(value > 0)) throw new Error(label + ' must be > 0');
  return value;
}
function nonNegative(value, label) {
  finite(value, label);
  if (value < 0) throw new Error(label + ' must be >= 0');
  return value;
}
function unitInterval(value, label) {
  finite(value, label);
  if (value < 0 || value > 1) throw new Error(label + ' must be in [0,1]');
  return value;
}
function mmHgToKpa(value) {
  finite(value, 'pressureMmHg');
  return value / MMHG_PER_KPA;
}
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function createHennigsChemicalDriveCandidate({
  gPco2Ph,
  parameterProfile = 'validation-paper',
  oxygenWeight,
  deterministicNoiseTerm = 0,
  initialCentralDrive = 0,
  initialPeripheralCo2Drive = 0,
  initialPeripheralO2Drive = 0,
} = {}) {
  // Preserve the two published 2026 parameterizations explicitly. The
  // development paper gives tauP=1 s and a 0.25 O2 weighting for RR response;
  // the later validation appendix gives tauP=10 s and RC2 as a direct sum.
  const profile = PARAMETER_PROFILES[parameterProfile];
  if (!profile) throw new Error('unknown parameterProfile: ' + parameterProfile);
  if (oxygenWeight == null) oxygenWeight = profile.oxygenWeight;
  nonNegative(gPco2Ph, 'gPco2Ph');
  nonNegative(oxygenWeight, 'oxygenWeight');
  finite(deterministicNoiseTerm, 'deterministicNoiseTerm');
  finite(initialCentralDrive, 'initialCentralDrive');
  finite(initialPeripheralCo2Drive, 'initialPeripheralCo2Drive');
  finite(initialPeripheralO2Drive, 'initialPeripheralO2Drive');

  let centralDrive = initialCentralDrive;
  let peripheralCo2Drive = initialPeripheralCo2Drive;
  let peripheralO2Drive = initialPeripheralO2Drive;
  let timeSec = 0;
  let last = null;

  function step({
    dtSec,
    medullaryPh,
    arterialPh,
    arterialPco2MmHg,
    arterialPo2MmHg,
  } = {}) {
    positive(dtSec, 'dtSec');
    finite(medullaryPh, 'medullaryPh');
    finite(arterialPh, 'arterialPh');
    nonNegative(arterialPco2MmHg, 'arterialPco2MmHg');
    nonNegative(arterialPo2MmHg, 'arterialPo2MmHg');

    const p = Object.freeze({...SOURCE.knownParameters, peripheralTauSec: profile.peripheralTauSec});

    const centralTarget =
      p.centralGainPerPh * (p.medullaryPhThreshold - medullaryPh);

    const peripheralCo2Target =
      p.peripheralCo2GainPerKpa * mmHgToKpa(arterialPco2MmHg) +
      gPco2Ph * (p.arterialPhThreshold - arterialPh);

    const peripheralO2Target = peripheralHypoxiaTarget({
      pao2: arterialPo2MmHg,
      threshold: p.peripheralO2ThresholdMmHg,
      gain: p.peripheralO2GainPerKpa / MMHG_PER_KPA,
    });

    centralDrive = firstOrderDriveStep({
      drive: centralDrive,
      target: centralTarget,
      tauSec: p.centralTauSec,
      dtSec,
    }).drive;
    peripheralCo2Drive = firstOrderDriveStep({
      drive: peripheralCo2Drive,
      target: peripheralCo2Target,
      tauSec: p.peripheralTauSec,
      dtSec,
    }).drive;
    peripheralO2Drive = firstOrderDriveStep({
      drive: peripheralO2Drive,
      target: peripheralO2Target,
      tauSec: p.peripheralTauSec,
      dtSec,
    }).drive;

    const totalChemicalDrive =
      centralDrive +
      peripheralCo2Drive +
      oxygenWeight * peripheralO2Drive;

    const unclampedRelativeDrive =
      p.relativeDriveScale * totalChemicalDrive +
      p.relativeDriveOffset +
      deterministicNoiseTerm;

    const frequencyRelativeDrive = Math.max(0, unclampedRelativeDrive);
    const amplitudeRelativeDrive = clamp01(unclampedRelativeDrive);
    const relativeDrive = frequencyRelativeDrive;
    timeSec += dtSec;

    last = Object.freeze({
      timeSec,
      centralDrive,
      peripheralCo2Drive,
      peripheralO2Drive,
      totalChemicalDrive,
      unclampedRelativeDrive,
      frequencyRelativeDrive,
      amplitudeRelativeDrive,
      relativeDrive,
      inputs: Object.freeze({
        medullaryPh,
        arterialPh,
        arterialPco2MmHg,
        arterialPo2MmHg,
      }),
      parameters: Object.freeze({
        gPco2Ph,
        parameterProfile,
        peripheralTauSec: profile.peripheralTauSec,
        oxygenWeight,
        deterministicNoiseTerm,
      }),
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
    return last;
  }

  function snapshot() {
    return last || Object.freeze({
      timeSec,
      centralDrive,
      peripheralCo2Drive,
      peripheralO2Drive,
      totalChemicalDrive: null,
      unclampedRelativeDrive: null,
      frequencyRelativeDrive: null,
      amplitudeRelativeDrive: null,
      relativeDrive: null,
      inputs: null,
      parameters: Object.freeze({
        gPco2Ph,
        parameterProfile,
        peripheralTauSec: profile.peripheralTauSec,
        oxygenWeight,
        deterministicNoiseTerm,
      }),
      authority: SOURCE.authority,
      controlAuthority: false,
      provenance: SOURCE,
    });
  }

  return Object.freeze({
    step,
    snapshot,
    source: SOURCE,
  });
}

module.exports = Object.freeze({
  MMHG_PER_KPA,
  PARAMETER_PROFILES,
  SOURCE,
  mmHgToKpa,
  createHennigsChemicalDriveCandidate,
});
