'use strict';
// Read-only display sampling. Never feeds the mechanical or physiological solvers.
function sampleWaveformForDisplay(trace, timeOriginSec, windowSec = 30, maxSamples = 2000) {
  if (!trace.length) return Object.freeze([]);
  const cutoff = trace[trace.length - 1].t - windowSec;
  let lo = 0, hi = trace.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (trace[mid].t < cutoff) lo = mid + 1; else hi = mid;
  }
  const count = trace.length - lo;
  const samples = Math.min(count, maxSamples);
  const rows = [];
  for (let i = 0; i < samples; i++) {
    const index = samples === 1 ? trace.length - 1 : lo + Math.floor(i * (count - 1) / (samples - 1));
    const row = trace[index];
    rows.push(Object.freeze({t:row.t-timeOriginSec,pressureCmH2O:row.output.airwayPressure,
      flowLps:row.output.airwayFlow,volumeL:row.output.totalVolume,phase:row.phase,maneuver:row.maneuver}));
  }
  return Object.freeze(rows);
}
module.exports = {sampleWaveformForDisplay};
