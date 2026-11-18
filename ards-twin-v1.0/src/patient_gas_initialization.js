'use strict';

const {
  HUMMOD_SOURCE_INITIAL_GAS_STATE,
  deriveBloodGasOutputs,
} = require('./hummod_ards_core_runtime.js');
const { hco3FromPco2Sid, o2ContentFromPo2 } =
  require('./hummod_ards_core_gas_exchange.js');
const { hemoglobinProperties } =
  require('./hummod_ards_core_chemistry.js');

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

function createPatientArterialGasInitialState({
  po2MmHg,
  pco2MmHg,
  pH,
  blood,
} = {}) {
  positive(po2MmHg, 'po2MmHg');
  positive(pco2MmHg, 'pco2MmHg');
  finite(pH, 'pH');
  if (!blood) throw new Error('blood boundary is required');

  const arterialHco3MolPerL = hco3FromPco2Sid({
    pco2MmHg,
    sidMolPerL: blood.sidMolPerL,
  }).hco3MolPerL;

  // The reduced core derives pH from fixed SID + HCO3. Use that same
  // internally consistent pH for the O2-content inverse so PaO2 round-trips
  // exactly through deriveBloodGasOutputs. Measured pH is retained only as a
  // diagnostic target; it is not used to create an unmeasured patient SID.
  const provisionalState = {
    arterialO2ContentMlPerMl: 0.196,
    arterialHco3MolPerL,
    venousO2ContentMlPerMl:
      HUMMOD_SOURCE_INITIAL_GAS_STATE.venousO2ContentMlPerMl,
    venousHco3MolPerL:
      HUMMOD_SOURCE_INITIAL_GAS_STATE.venousHco3MolPerL,
  };
  const impliedBeforeO2 = deriveBloodGasOutputs({
    state: provisionalState,
    blood,
  }).arterial;

  const hgb = hemoglobinProperties({
    tempC: blood.tempC,
    pH: impliedBeforeO2.pH,
    pco2MmHg,
    carboxyPercent: blood.carboxyPercent || 0,
  });
  const arterialO2ContentMlPerMl = o2ContentFromPo2({
    po2MmHg,
    o2MaxMlPerMl: blood.o2MaxMlPerMl,
    p50MmHg: hgb.p50MmHg,
    scaleForSat: hgb.scaleForSat,
  });

  const state = Object.freeze({
    arterialO2ContentMlPerMl,
    arterialHco3MolPerL,
    venousO2ContentMlPerMl:
      HUMMOD_SOURCE_INITIAL_GAS_STATE.venousO2ContentMlPerMl,
    venousHco3MolPerL:
      HUMMOD_SOURCE_INITIAL_GAS_STATE.venousHco3MolPerL,
    provenance: Object.freeze({
      arterialO2: 'patient-pretransition-PaO2-through-HumMod-O2-content-inverse',
      arterialHco3: 'patient-pretransition-PaCO2-through-HumMod-gas-to-base-at-fixed-SID',
      arterialMeasuredPH: pH,
      venousO2: 'HumMod-source-prior-no-patient-venous-measurement',
      venousHco3: 'HumMod-source-prior-no-patient-venous-measurement',
    }),
  });

  const implied = deriveBloodGasOutputs({ state, blood }).arterial;
  return Object.freeze({
    state,
    diagnostics: Object.freeze({
      requestedPo2MmHg: po2MmHg,
      requestedPco2MmHg: pco2MmHg,
      requestedPH: pH,
      initializedPo2MmHg: implied.po2MmHg,
      initializedPco2MmHg: implied.pco2MmHg,
      initializedPH: implied.pH,
      sidMolPerL: blood.sidMolPerL,
      phPolicy:
        'measured pH retained as diagnostic only; fixed-SID reduced core determines initialized pH and O2 affinity',
      venousPolicy: 'HumMod source prior retained',
    }),
  });
}

module.exports = Object.freeze({ createPatientArterialGasInitialState });
