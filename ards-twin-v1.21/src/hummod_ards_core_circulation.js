'use strict';

// hummod_ards_core_circulation.js
//
// Reduced closed-loop circulation built from compact HumMod vascular and
// ventricular source equations, while lumping the detailed organ circulation
// into explicit effective systemic arterial/venous conductances.
//
// Native units:
//   pressure: mmHg
//   volume: mL
//   flow: mL/min
//   time input: seconds
//
// This is a reduced-order engineering model, not a verbatim runnable HumMod
// subset and not clinical validation.

const {
  VASCULAR_DEFAULTS,
  stressedVolumePressure,
  conductanceFlow,
  ventricularPump,
} = require('./hummod_ards_core_hemodynamics.js');

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(label + ' must be a finite number');
  }
  return v;
}
function positive(v, label) {
  finite(v, label);
  if (!(v > 0)) throw new Error(label + ' must be > 0');
  return v;
}
function nonNegative(v, label) {
  finite(v, label);
  if (v < 0) throw new Error(label + ' must be >= 0');
  return v;
}

function createHumModArdsCirculation({
  initialVolumesMl,
  boundaries,
  maxSubstepSec = 0.01,
} = {}) {
  if (!initialVolumesMl || !boundaries) {
    throw new Error('initialVolumesMl and boundaries are required');
  }

  const requiredVolumes = [
    'systemicArteries','systemicVeins','rightAtrium',
    'pulmonaryArtery','pulmonaryCapillaries','pulmonaryVeins','leftAtrium',
  ];
  const volumes = {};
  for (const name of requiredVolumes) {
    volumes[name] = positive(initialVolumesMl[name], 'initialVolumesMl.' + name);
  }

  let activeBoundaries = { ...boundaries };
  positive(activeBoundaries.heartRatePerMin, 'heartRatePerMin');
  positive(activeBoundaries.systemicArterialConductanceMlPerMinPerMmHg,
    'systemicArterialConductanceMlPerMinPerMmHg');
  positive(activeBoundaries.systemicVenousConductanceMlPerMinPerMmHg,
    'systemicVenousConductanceMlPerMinPerMmHg');
  positive(maxSubstepSec, 'maxSubstepSec');

  let timeSec = 0;
  let last = null;

  function pressures({ thoracicPressureMmHg, pericardialPressureMmHg }) {
    finite(thoracicPressureMmHg, 'thoracicPressureMmHg');
    finite(pericardialPressureMmHg, 'pericardialPressureMmHg');

    const sa = stressedVolumePressure({
      volumeMl: volumes.systemicArteries,
      v0Ml: VASCULAR_DEFAULTS.systemicArteries.v0Ml,
      complianceMlPerMmHg: VASCULAR_DEFAULTS.systemicArteries.complianceMlPerMmHg,
      externalPressureMmHg: 0,
    });
    const sv = stressedVolumePressure({
      volumeMl: volumes.systemicVeins,
      v0Ml: activeBoundaries.systemicVenousV0Ml == null
        ? VASCULAR_DEFAULTS.systemicVeins.v0Ml
        : activeBoundaries.systemicVenousV0Ml,
      complianceMlPerMmHg: VASCULAR_DEFAULTS.systemicVeins.complianceMlPerMmHg,
      externalPressureMmHg: 0,
    });
    const ra = stressedVolumePressure({
      volumeMl: volumes.rightAtrium,
      v0Ml: VASCULAR_DEFAULTS.rightAtrium.v0Ml,
      complianceMlPerMmHg: VASCULAR_DEFAULTS.rightAtrium.complianceMlPerMmHg,
      externalPressureMmHg: pericardialPressureMmHg,
      clampStressedVolumeAtZero: false,
    });
    const pa = stressedVolumePressure({
      volumeMl: volumes.pulmonaryArtery,
      v0Ml: VASCULAR_DEFAULTS.pulmonaryArtery.v0Ml,
      complianceMlPerMmHg: VASCULAR_DEFAULTS.pulmonaryArtery.complianceMlPerMmHg,
      externalPressureMmHg: thoracicPressureMmHg,
    });
    const pc = stressedVolumePressure({
      volumeMl: volumes.pulmonaryCapillaries,
      v0Ml: VASCULAR_DEFAULTS.pulmonaryCapillaries.v0Ml,
      complianceMlPerMmHg: VASCULAR_DEFAULTS.pulmonaryCapillaries.complianceMlPerMmHg,
      externalPressureMmHg: thoracicPressureMmHg,
    });
    const pv = stressedVolumePressure({
      volumeMl: volumes.pulmonaryVeins,
      v0Ml: VASCULAR_DEFAULTS.pulmonaryVeins.v0Ml,
      complianceMlPerMmHg: VASCULAR_DEFAULTS.pulmonaryVeins.complianceMlPerMmHg,
      externalPressureMmHg: thoracicPressureMmHg,
    });
    const la = stressedVolumePressure({
      volumeMl: volumes.leftAtrium,
      v0Ml: VASCULAR_DEFAULTS.leftAtrium.v0Ml,
      complianceMlPerMmHg: VASCULAR_DEFAULTS.leftAtrium.complianceMlPerMmHg,
      externalPressureMmHg: pericardialPressureMmHg,
      clampStressedVolumeAtZero: false,
    });

    return { sa, sv, ra, pa, pc, pv, la };
  }

  function evaluate(boundaryNow) {
    const p = pressures(boundaryNow);

    const systemicOutflow = conductanceFlow({
      conductanceMlPerMinPerMmHg:
        activeBoundaries.systemicArterialConductanceMlPerMinPerMmHg,
      upstreamPressureMmHg: p.sa.pressureMmHg,
      downstreamPressureMmHg: p.sv.pressureMmHg,
    });

    const venousReturn = conductanceFlow({
      conductanceMlPerMinPerMmHg:
        activeBoundaries.systemicVenousConductanceMlPerMinPerMmHg,
      upstreamPressureMmHg: p.sv.pressureMmHg,
      downstreamPressureMmHg: p.ra.pressureMmHg,
    });

    const pulmonaryArterialOutflow = conductanceFlow({
      conductanceMlPerMinPerMmHg:
        VASCULAR_DEFAULTS.pulmonaryArtery.conductanceMlPerMinPerMmHg *
        (activeBoundaries.pulmonaryArterialConductanceMultiplier || 1),
      upstreamPressureMmHg: p.pa.pressureMmHg,
      downstreamPressureMmHg: p.pc.pressureMmHg,
    });
    const pulmonaryCapillaryOutflow = conductanceFlow({
      conductanceMlPerMinPerMmHg:
        VASCULAR_DEFAULTS.pulmonaryCapillaries.conductanceMlPerMinPerMmHg,
      upstreamPressureMmHg: p.pc.pressureMmHg,
      downstreamPressureMmHg: p.pv.pressureMmHg,
    });
    const pulmonaryVenousOutflow = conductanceFlow({
      conductanceMlPerMinPerMmHg:
        VASCULAR_DEFAULTS.pulmonaryVeins.conductanceMlPerMinPerMmHg,
      upstreamPressureMmHg: p.pv.pressureMmHg,
      downstreamPressureMmHg: p.la.pressureMmHg,
    });

    const rightPump = ventricularPump({
      side: 'right',
      atrialPressureMmHg: p.ra.pressureMmHg,
      arterialPressureMmHg: p.pa.pressureMmHg,
      pericardialPressureMmHg: boundaryNow.pericardialPressureMmHg,
      heartRatePerMin: activeBoundaries.heartRatePerMin,
      contractilityMultiplier: activeBoundaries.rightContractilityMultiplier || 1,
      stiffnessMultiplier: activeBoundaries.rightStiffnessMultiplier || 1,
    });
    const leftPump = ventricularPump({
      side: 'left',
      atrialPressureMmHg: p.la.pressureMmHg,
      arterialPressureMmHg: p.sa.pressureMmHg,
      pericardialPressureMmHg: boundaryNow.pericardialPressureMmHg,
      heartRatePerMin: activeBoundaries.heartRatePerMin,
      contractilityMultiplier: activeBoundaries.leftContractilityMultiplier || 1,
      stiffnessMultiplier: activeBoundaries.leftStiffnessMultiplier || 1,
    });

    // The pinned HumMod pumping algebra is StrokeVolume = EDV - ESV and
    // does not clamp the equation when extreme failure drives ESV above EDV.
    // In the reduced browser core, a negative raw stroke volume is treated as
    // entry into a nonphysical pump domain and therefore mechanical pump
    // failure. Preserve the raw source result, but expose zero forward flow so
    // the coupled terminal controller can convert this state to PEA rather
    // than crashing or propagating negative cardiac output.
    function terminalSafePump(pump) {
      if (pump.bloodFlowMlPerMin >= 0) {
        return Object.freeze({
          ...pump,
          rawStrokeVolumeMl: pump.strokeVolumeMl,
          rawBloodFlowMlPerMin: pump.bloodFlowMlPerMin,
          mechanicalPumpFailure: false,
        });
      }
      return Object.freeze({
        ...pump,
        rawStrokeVolumeMl: pump.strokeVolumeMl,
        rawBloodFlowMlPerMin: pump.bloodFlowMlPerMin,
        strokeVolumeMl: 0,
        bloodFlowMlPerMin: 0,
        ejectionFraction: 0,
        mechanicalPumpFailure: true,
      });
    }
    const safeRightPump = terminalSafePump(rightPump);
    const safeLeftPump = terminalSafePump(leftPump);

    return {
      pressures: {
        systemicArterialMmHg: p.sa.pressureMmHg,
        systemicVenousMmHg: p.sv.pressureMmHg,
        rightAtrialMmHg: p.ra.pressureMmHg,
        pulmonaryArteryMmHg: p.pa.pressureMmHg,
        pulmonaryCapillaryMmHg: p.pc.pressureMmHg,
        pulmonaryVenousMmHg: p.pv.pressureMmHg,
        leftAtrialMmHg: p.la.pressureMmHg,
      },
      flowsMlPerMin: {
        leftVentricular: safeLeftPump.bloodFlowMlPerMin,
        systemicOutflow,
        venousReturn,
        rightVentricular: safeRightPump.bloodFlowMlPerMin,
        pulmonaryArterialOutflow,
        pulmonaryCapillaryOutflow,
        pulmonaryVenousOutflow,
      },
      rightVentricle: safeRightPump,
      leftVentricle: safeLeftPump,
      mechanicalPumpFailure:
        safeRightPump.mechanicalPumpFailure || safeLeftPump.mechanicalPumpFailure,
    };
  }

  function derivative(e) {
    const q = e.flowsMlPerMin;
    return {
      systemicArteries: q.leftVentricular - q.systemicOutflow,
      systemicVeins: q.systemicOutflow - q.venousReturn,
      rightAtrium: q.venousReturn - q.rightVentricular,
      pulmonaryArtery: q.rightVentricular - q.pulmonaryArterialOutflow,
      pulmonaryCapillaries:
        q.pulmonaryArterialOutflow - q.pulmonaryCapillaryOutflow,
      pulmonaryVeins:
        q.pulmonaryCapillaryOutflow - q.pulmonaryVenousOutflow,
      leftAtrium: q.pulmonaryVenousOutflow - q.leftVentricular,
    };
  }

  function setBoundaries(next = {}) {
    const merged = { ...activeBoundaries, ...next };
    positive(merged.heartRatePerMin, 'heartRatePerMin');
    positive(merged.systemicArterialConductanceMlPerMinPerMmHg,
      'systemicArterialConductanceMlPerMinPerMmHg');
    positive(merged.systemicVenousConductanceMlPerMinPerMmHg,
      'systemicVenousConductanceMlPerMinPerMmHg');
    if (merged.systemicVenousV0Ml != null) {
      nonNegative(merged.systemicVenousV0Ml, 'systemicVenousV0Ml');
    }
    if (merged.pulmonaryArterialConductanceMultiplier != null) {
      positive(merged.pulmonaryArterialConductanceMultiplier,
        'pulmonaryArterialConductanceMultiplier');
    }
    activeBoundaries = merged;
    return Object.freeze({ ...activeBoundaries });
  }

  function step({ dtSec, thoracicPressureMmHg, pericardialPressureMmHg } = {}) {
    positive(dtSec, 'dtSec');
    finite(thoracicPressureMmHg, 'thoracicPressureMmHg');
    finite(pericardialPressureMmHg, 'pericardialPressureMmHg');

    const n = Math.max(1, Math.ceil(dtSec / maxSubstepSec));
    const hSec = dtSec / n;
    const hMin = hSec / 60;

    for (let k = 0; k < n; k++) {
      const e = evaluate({ thoracicPressureMmHg, pericardialPressureMmHg });
      const d = derivative(e);
      for (const name of requiredVolumes) {
        volumes[name] += d[name] * hMin;
        if (!(volumes[name] > 0) || !Number.isFinite(volumes[name])) {
          throw new Error('circulation volume became non-physical: ' + name);
        }
      }
      timeSec += hSec;
      last = e;
    }
    return snapshot();
  }

  function snapshot() {
    return Object.freeze({
      schema: 'hummod-ards-circulation/v1',
      timeSec,
      volumesMl: Object.freeze({ ...volumes }),
      ...(last || {}),
      activeBoundaries: Object.freeze({ ...activeBoundaries }),
      derivedResistance: Object.freeze({
        systemicVascularResistanceMmHgMinPerL:
          last && last.flowsMlPerMin.systemicOutflow > 0
            ? (last.pressures.systemicArterialMmHg - last.pressures.systemicVenousMmHg) /
              (last.flowsMlPerMin.systemicOutflow / 1000)
            : null,
        pulmonaryVascularResistanceMmHgMinPerL:
          last && last.flowsMlPerMin.pulmonaryArterialOutflow > 0
            ? (last.pressures.pulmonaryArteryMmHg - last.pressures.pulmonaryCapillaryMmHg) /
              (last.flowsMlPerMin.pulmonaryArterialOutflow / 1000)
            : null,
      }),
      provenance: Object.freeze({
        status: 'reduced-order-source-aligned-circulation',
        detailedOrganCirculation:
          'lumped into explicit systemic conductance boundaries',
        clinicalValidation: false,
      }),
    });
  }

  return Object.freeze({ kind:'hummod-ards-circulation', step, snapshot, setBoundaries });
}

module.exports = { createHumModArdsCirculation };
