'use strict';
importScripts('./engine.js?v=0.4.5');
self.onmessage = ({ data }) => {
  try {
    const result = VENT.runScenario(data, progress => self.postMessage({ type: 'progress', progress }));
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message, diagnostics: error.diagnostics || null });
  }
};
