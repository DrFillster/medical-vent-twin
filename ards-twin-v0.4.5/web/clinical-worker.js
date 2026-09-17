'use strict';

importScripts('./engine.js?v=0.5-alpha');

let session = null;

function requireSession() {
  if (!session) throw new Error('Clinical twin session is not initialized');
  return session;
}

self.onmessage = ({ data }) => {
  try {
    const type = data && data.type;

    if (type === 'initialize') {
      session = VENT.createBerlinClinicalTwinSession(data.payload);
      const snapshot = session.initialize();
      self.postMessage({ type: 'initialized', snapshot });
      return;
    }

    if (type === 'runFor') {
      const snapshot = requireSession().runFor(data.seconds);
      self.postMessage({ type: 'snapshot', action: 'runFor', snapshot });
      return;
    }

    if (type === 'setPEEP') {
      const snapshot = requireSession().setPEEP(data.valueCmH2O);
      self.postMessage({ type: 'snapshot', action: 'setPEEP', snapshot });
      return;
    }

    if (type === 'requestVentilationChange') {
      const snapshot = requireSession().requestVentilationChange(data.ventilation);
      self.postMessage({ type: 'snapshot', action: 'requestVentilationChange', snapshot });
      return;
    }

    if (type === 'performPassiveMechanics') {
      const snapshot = requireSession().performPassiveMechanicsMeasurement({
        holdDurationSec: data.holdDurationSec == null ? 0.5 : data.holdDurationSec,
        maxAdvanceSecPerHold: data.maxAdvanceSecPerHold == null ? 90 : data.maxAdvanceSecPerHold,
      });
      self.postMessage({ type: 'snapshot', action: 'performPassiveMechanics', snapshot });
      return;
    }

    if (type === 'requestInspiratoryHold') {
      const snapshot = requireSession().requestInspiratoryHold(data.durationSec);
      self.postMessage({ type: 'snapshot', action: 'requestInspiratoryHold', snapshot });
      return;
    }

    if (type === 'requestExpiratoryHold') {
      const snapshot = requireSession().requestExpiratoryHold(data.durationSec);
      self.postMessage({ type: 'snapshot', action: 'requestExpiratoryHold', snapshot });
      return;
    }

    if (type === 'snapshot') {
      self.postMessage({ type: 'snapshot', action: 'snapshot', snapshot: requireSession().snapshot() });
      return;
    }

    if (type === 'reset') {
      session = null;
      self.postMessage({ type: 'reset-complete' });
      return;
    }

    throw new Error('Unknown clinical worker message type: ' + String(type));
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error.message,
      diagnostics: error.diagnostics || null,
    });
  }
};
