'use strict';

// clinical_twin_runtime.js
//
// Binds one authored Berlin ARDS case to one validated HumMod replay trajectory.
// This is deliberately a composition layer: Vent continues to own pulmonary
// mechanics and ventilator interactions, while HumMod replay owns the systemic
// snapshot fields present in the validated trajectory.
//
// A replay is not a live HumMod solver. Arbitrary Vent interventions must not be
// forwarded to the replay provider as if the systemic trajectory could respond.

const { getBerlinCase } = require('./berlin_case_catalog.js');
const { createReplayProviderFromHumModExport,
        validateHumModTrajectoryExport } = require('./hummod_export_contract.js');

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function createBerlinHumModReplayRuntime({ caseId, humModExport } = {}) {
  if (typeof caseId !== 'string' || !caseId) throw new Error('caseId is required');
  requireObject(humModExport, 'humModExport');

  const clinicalCase = getBerlinCase(caseId);
  validateHumModTrajectoryExport(humModExport);

  const provider = createReplayProviderFromHumModExport(humModExport, {
    subjectId: clinicalCase.id,
    runId: humModExport.trajectoryId,
  });

  let initialized = false;
  let currentSystemicSnapshot = null;

  return Object.freeze({
    kind: 'berlin-hummod-replay-runtime',
    mode: 'deterministic-systemic-replay',
    clinicalCase,
    trajectoryId: humModExport.trajectoryId,
    systemicSource: Object.freeze({
      provider: 'HumMod-replay',
      repository: humModExport.source.repository,
      revision: humModExport.source.revision,
      exporterVersion: humModExport.source.exporterVersion,
      status: 'validated-replay-source-not-live-coupling',
    }),

    initialize() {
      currentSystemicSnapshot = provider.initialize();
      initialized = true;
      return this.snapshot();
    },

    sample(timestampSec) {
      if (!initialized) throw new Error('runtime must be initialized before sampling');
      currentSystemicSnapshot = provider.sample(timestampSec);
      return this.snapshot();
    },

    snapshot() {
      return Object.freeze({
        caseId: clinicalCase.id,
        caseName: clinicalCase.name,
        berlinSeverity: clinicalCase.clinical.berlinSeverity,
        recruitability: clinicalCase.phenotype.recruitability,
        systemic: currentSystemicSnapshot,
        systemicStatus: initialized ? 'attached-hummod-replay' : 'not-initialized',
        pulmonaryStatus: 'Vent runtime not instantiated by this composition object',
        couplingStatus: 'replay-only-no-bidirectional-intervention-response',
      });
    },

    applyVentIntervention() {
      throw new Error(
        'HumMod replay runtime cannot synthesize systemic response to Vent interventions; ' +
        'use a live coupled provider or an authored trajectory containing that intervention');
    },
  });
}

module.exports = { createBerlinHumModReplayRuntime };
