'use strict';

// clinical_session_record.js
//
// Produces a compact, reproducible record of a composed clinical session.
// The record intentionally references, rather than embeds, the HumMod trajectory.

const SUPPORTED_SESSION_SCHEMAS = new Set([
  'berlin-clinical-twin-session/v1',
  'berlin-clinical-twin-live-hummod-session/v1',
]);

function requireSnapshot(snapshot) {
  if (!snapshot || !SUPPORTED_SESSION_SCHEMAS.has(snapshot.sessionSchema)) {
    throw new Error('valid berlin-clinical-twin-session/v1 or berlin-clinical-twin-live-hummod-session/v1 snapshot is required');
  }
  return snapshot;
}

function createClinicalSessionRecord(snapshot) {
  requireSnapshot(snapshot);

  const systemicSource = snapshot.systemic && snapshot.systemic.source
    ? snapshot.systemic.source
    : null;

  const isLiveHumModSession = snapshot.sessionSchema === 'berlin-clinical-twin-live-hummod-session/v1';

  return Object.freeze({
    schema: 'vent-clinical-session-record/v1',
    createdFromSessionSchema: snapshot.sessionSchema,
    case: Object.freeze({ ...snapshot.case }),
    timeSec: snapshot.timeSec,
    ventilator: Object.freeze({ ...snapshot.ventilator }),
    ventilatorChangePending: Boolean(snapshot.ventilatorChangePending),
    initialization: snapshot.pulmonary && snapshot.pulmonary.initialization
      ? snapshot.pulmonary.initialization
      : null,
    pulmonary: Object.freeze({
      measurements: snapshot.pulmonary ? snapshot.pulmonary.measurements : null,
      compartments: snapshot.pulmonary ? snapshot.pulmonary.compartments : null,
      gasExchangeAuthority: snapshot.pulmonary ? snapshot.pulmonary.gasExchangeAuthority : null,
    }),
    systemicReference: Object.freeze({
      trajectoryId: systemicSource ? systemicSource.runId || null : null,
      subjectId: systemicSource ? systemicSource.subjectId || null : null,
      modelVersion: systemicSource ? systemicSource.modelVersion || null : null,
      exporterVersion: systemicSource ? systemicSource.exporterVersion || null : null,
      provider: systemicSource ? systemicSource.provider || null : 'HumMod-replay',
      timestampSec: snapshot.systemic ? snapshot.systemic.timestampSec : null,
    }),
    coupling: Object.freeze({ ...(snapshot.coupling || {}) }),
    events: Object.freeze((snapshot.events || []).map(event => Object.freeze({ ...event }))),
    gasExchange: isLiveHumModSession && snapshot.systemic && snapshot.systemic.gasExchange
      ? Object.freeze({ ...snapshot.systemic.gasExchange })
      : null,
    hemodynamics: isLiveHumModSession && snapshot.systemic && snapshot.systemic.hemodynamics
      ? Object.freeze({ ...snapshot.systemic.hemodynamics })
      : null,
    provenance: Object.freeze({
      ...(snapshot.provenance || {}),
      status: 'simulation-record-not-clinical-validation',
    }),
  });
}

module.exports = {
  createClinicalSessionRecord,
};
