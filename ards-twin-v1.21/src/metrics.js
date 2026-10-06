// metrics.js — breath metrics analyzer.
//
// Independent of any controller: walks a Simulation.trace and emits one
// metrics record per completed breath. Metrics are derived from the
// waveform/state data, never copied from controller settings.
//
// Definition of phases (matches controller/VENTILATOR_CONTRACT.md):
//   EXPIRATION → INSPIRATION → PAUSE → EXPIRATION
// A "completed breath" is the segment between two consecutive
// EXPIRATION→INSPIRATION transitions.
//
// Measurement windows:
//   - PEEP:        median(Paw) over last 200 ms of the EXPIRATION phase
//                  before the next INSPIRATION.
//   - Ppeak:       max(Paw) during the INSPIRATION phase.
//   - Pplat:       median(Paw) over the late PAUSE phase (after the
//                  initial Paw equilibration), with flow |Q| < 0.05 L/s.
//                  "Late" = the second half of the PAUSE rows.
//   - driving ΔP:  Pplat − PEEP.
//   - Vt (inspired): end-inspiratory totalVolume − start-inspiratory totalVolume.
//   - Vt (expired): start-inspiratory totalVolume (breath n+1) −
//                   end-expiratory totalVolume (breath n). Falls back
//                   to the minimum totalVolume during EXPIRATION if the
//                   next breath hasn't started.
//   - Volume error: inspired Vt − expired Vt.
//   - RR:          1 / breath duration (s), reported as breaths/min.
//   - MV:          RR × Vt (L/min).
//   - Ti, Te:      phase durations, I:E = Ti/Te.
//   - Qpeak insp:  max(Q_airway) during INSPIRATION.
//   - Qpeak exp:   max(|Q_airway|) during EXPIRATION (peak expiratory flow).
//   - auto-PEEP:   if end-expiratory Paw is materially > set PEEP, the
//                  excess is reported as intrinsic PEEP (cmH2O). Zero
//                  when the model has fully equilibrated.
//   - compartment volumes and flows: end-inspiratory and end-expiratory
//                  per-compartment values from the trace.

const PLATEAU_FLOW_THRESHOLD = 0.05;     // L/s — flows below this count as static
const PEEP_WINDOW_MS = 200;              // last 200 ms of EXPIRATION
const PLATEAU_LATE_FRACTION = 0.5;       // second half of PAUSE rows

function phaseSegments(trace) {
  // Returns array of {phase, startIdx, endIdx} for each contiguous phase.
  const out = [];
  if (!trace || trace.length === 0) return out;
  let cur = { phase: trace[0].phase, startIdx: 0 };
  for (let i = 1; i < trace.length; i++) {
    if (trace[i].phase !== cur.phase) {
      cur.endIdx = i - 1;
      out.push(cur);
      cur = { phase: trace[i].phase, startIdx: i };
    }
  }
  cur.endIdx = trace.length - 1;
  out.push(cur);
  return out;
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function maxAbs(arr) {
  if (arr.length === 0) return 0;
  let m = 0;
  for (const x of arr) {
    const a = Math.abs(x);
    if (a > m) m = a;
  }
  return m;
}

function analyzeBreath(trace, breathStartIdx, breathEndIdx) {
  // breathStartIdx: index of first EXPIRATION row (or 0 if first breath)
  // breathEndIdx:   index of the last row of the same breath
  const segs = phaseSegments(trace.slice(breathStartIdx, breathEndIdx + 1))
    .map(s => ({
      phase: s.phase,
      startIdx: s.startIdx + breathStartIdx,
      endIdx: s.endIdx + breathStartIdx,
    }));
  const insp = segs.find(s => s.phase === 'INSPIRATION');
  const pause = segs.find(s => s.phase === 'PAUSE');
  const expir = segs.find(s => s.phase === 'EXPIRATION');

  const rows = (s) => {
    if (!s) return [];
    return trace.slice(s.startIdx, s.endIdx + 1);
  };

  const inspRows = rows(insp);
  const pauseRows = rows(pause);
  const expirRows = rows(expir);

  // Ti = INSPIRATION duration; Te = EXPIRATION duration; pause adds to Ti
  // (typical convention: Ti = insp + pause, Te = expir).
  const Ti = insp && pause
    ? (trace[pause.endIdx].t - trace[insp.startIdx].t)
    : insp
      ? (trace[insp.endIdx].t - trace[insp.startIdx].t)
      : 0;
  const Te = expir ? (trace[expir.endIdx].t - trace[expir.startIdx].t) : 0;
  const breathDuration = Ti + Te;
  const RR = breathDuration > 0 ? 60 / breathDuration : 0;

  // Vt inspired = V at end of last phase before EXPIRATION - V at start of INSPIRATION
  let VtInspired = 0;
  if (insp) {
    const lastPhase = pause || insp;
    const vStart = trace[insp.startIdx].output.totalVolume;
    const vEnd = trace[lastPhase.endIdx].output.totalVolume;
    VtInspired = vEnd - vStart;
  }

  // Ppeak during INSPIRATION
  const pawsInsp = inspRows.map(r => r.output.airwayPressure);
  const Ppeak = pawsInsp.length ? Math.max(...pawsInsp) : 0;

  // Pplat: median Paw over the LATE half of PAUSE rows with |Q| below threshold.
  // If PAUSE is short or absent, fall back to the last INSPIRATION row's Paw
  // (which equals the static plateau when the controller has switched to
  // zero-flow after Vt target).
  let Pplat = 0;
  if (pauseRows.length > 0) {
    const start = Math.floor(pauseRows.length * PLATEAU_LATE_FRACTION);
    const late = pauseRows.slice(start);
    const staticLate = late.filter(r => Math.abs(r.output.airwayFlow) < PLATEAU_FLOW_THRESHOLD);
    const pool = staticLate.length > 0 ? staticLate : late;
    Pplat = median(pool.map(r => r.output.airwayPressure));
  } else if (inspRows.length > 0) {
    // No dedicated PAUSE phase — plateau is the equilibrated Paw at end
    // of inspiration (controller switched to zero-flow at Vt target).
    const tail = inspRows.slice(-Math.max(20, Math.floor(inspRows.length * 0.2)));
    Pplat = median(tail.map(r => r.output.airwayPressure));
  }

  // PEEP: median Paw over last 200 ms of EXPIRATION
  let PEEP = 0;
  if (expirRows.length > 0) {
    const lastT = trace[expir.endIdx].t;
    const cutoff = lastT - PEEP_WINDOW_MS / 1000;
    const window = expirRows.filter(r => r.t >= cutoff);
    const pool = window.length > 0 ? window : expirRows.slice(-10);
    PEEP = median(pool.map(r => r.output.airwayPressure));
  }

  const drivingPressure = Pplat - PEEP;

  // Peak inspiratory and expiratory flows
  const QpeakInsp = inspRows.length ? maxAbs(inspRows.map(r => r.output.airwayFlow)) : 0;
  const QpeakExp = expirRows.length ? maxAbs(expirRows.map(r => r.output.airwayFlow)) : 0;

  // Vt expired: minimum totalVolume during EXPIRATION, measured from
  // the start of inspiration (peak after a fully equilibrated breath)
  // to the trough of expiration.
  let VtExpired = 0;
  if (expirRows.length > 0 && insp) {
    const vPeak = trace[insp.endIdx].output.totalVolume; // approximate peak
    const vMin = Math.min(...expirRows.map(r => r.output.totalVolume));
    VtExpired = vPeak - vMin;
  }

  const volumeError = VtInspired - VtExpired;
  const MV = (RR * VtInspired) / 60 * 60; // L/min  (RR in /min × Vt in L)
  // auto-PEEP = (PEEP measured - PEEP set). Caller passes set PEEP.
  const autoPEEP = 0; // computed by caller from set vs measured

  // Compartment end-inspiratory / end-expiratory values
  const compartments = {};
  if (insp) {
    const cs = trace[pause ? pause.endIdx : insp.endIdx].output;
    for (let i = 0; i < (cs.compartmentVolumes || []).length; i++) {
      compartments[`comp_${i}`] = {
        endInspV: cs.compartmentVolumes[i],
        endInspF: (cs.compartmentFlows || [])[i],
        endInspP: (cs.compartmentPressures || [])[i],
      };
    }
  }
  if (expir) {
    const cs = trace[expir.endIdx].output;
    for (let i = 0; i < (cs.compartmentVolumes || []).length; i++) {
      const key = `comp_${i}`;
      if (!compartments[key]) compartments[key] = {};
      compartments[key].endExpV = cs.compartmentVolumes[i];
      compartments[key].endExpF = (cs.compartmentFlows || [])[i];
      compartments[key].endExpP = (cs.compartmentPressures || [])[i];
    }
  }

  return {
    Ti,
    Te,
    breathDuration,
    RR,
    MV,
    PEEP,
    Ppeak,
    Pplat,
    drivingPressure,
    VtInspired,
    VtExpired,
    volumeError,
    QpeakInsp,
    QpeakExp,
    autoPEEP,
    compartments,
  };
}

function analyzeAll(trace, setPEEP) {
  // Walk the trace and emit one metrics record per completed breath.
  // First breath starts at index 0. Each breath ends at the last row
  // before the next EXPIRATION→INSPIRATION transition (or end of trace).
  const metrics = [];
  const segments = phaseSegments(trace);
  // Find EXPIRATION starts (each is a breath boundary). The first breath
  // begins at trace start.
  const expirStarts = [0, ...segments
    .filter((s, i) => i > 0 && s.phase === 'EXPIRATION')
    .map(s => s.startIdx)];
  for (let i = 0; i < expirStarts.length; i++) {
    const startIdx = expirStarts[i];
    const endIdx = (i + 1 < expirStarts.length) ? expirStarts[i + 1] - 1 : trace.length - 1;
    if (endIdx <= startIdx) continue;
    const m = analyzeBreath(trace, startIdx, endIdx);
    m.breathIndex = i;
    m.breathStartT = trace[startIdx].t;
    m.breathEndT = trace[endIdx].t;
    m.autoPEEP = m.PEEP - (setPEEP || 0);
    metrics.push(m);
  }
  return metrics;
}

module.exports = { analyzeAll, analyzeBreath, phaseSegments };
