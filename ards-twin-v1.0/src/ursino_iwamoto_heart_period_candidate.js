'use strict';

/**
 * Source-pinned candidate heart-period effector.
 *
 * Primary implementation source:
 * Iwamoto M, Hirabayashi S, Atsumi N. PLoS Comput Biol. 2024;20:e1012645.
 * DOI 10.1371/journal.pcbi.1012645. Equations 26-30 and Table 3.
 *
 * Lineage: Ursino 1998; Ursino & Magosso 2003.
 *
 * Candidate only. It does not own canonical HR until the upstream autonomic
 * signals and integrated ICU validation gate are satisfied.
 */

const SOURCE = Object.freeze({
  primary: Object.freeze({
    citation:
      'Iwamoto M, Hirabayashi S, Atsumi N. In-silico simultaneous respiratory and circulatory measurement during voluntary breathing, exercise, and mental stress: A computational approach. PLoS Comput Biol. 2024;20(12):e1012645.',
    doi: '10.1371/journal.pcbi.1012645',
    pmid: '39689064',
    pmcid: 'PMC11651585',
    equations: Object.freeze([26, 27, 28, 29, 30]),
    parameterTable: 3,
  }),
  lineage: Object.freeze({
    ursino1998: '10.1152/ajpheart.1998.275.5.H1733',
    ursinoMagosso2003: '10.1152/ajpheart.00850.2002',
  }),
  authority: 'candidate-not-canonical',
});

const PARAMETERS = Object.freeze({
  sympatheticThresholdSpikesPerSec: 2.66,
  sympatheticGainSec: -0.13,
  sympatheticTauSec: 2,
  sympatheticDelaySec: 2,
  baselineHeartPeriodSec: 0.58,
  vagalGainSecPerSpikePerSec: 0.09,
  vagalTauSec: 1.5,
  vagalDelaySec: 0.2,
});

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(label + ' must be finite');
  }
  return v;
}

function nonNegative(v, label) {
  finite(v, label);
  if (v < 0) throw new Error(label + ' must be >= 0');
  return v;
}

// Iwamoto 2024 Eq. 26 for j=7.
function sympatheticStaticHeartPeriodChangeSec(fEsSpikesPerSec) {
  nonNegative(fEsSpikesPerSec, 'fEsSpikesPerSec');
  const threshold = PARAMETERS.sympatheticThresholdSpikesPerSec;
  if (fEsSpikesPerSec < threshold) return 0;
  return PARAMETERS.sympatheticGainSec *
    Math.log(fEsSpikesPerSec - threshold + 1);
}

// Iwamoto 2024 Eq. 28.
function vagalStaticHeartPeriodChangeSec(fEvSpikesPerSec) {
  nonNegative(fEvSpikesPerSec, 'fEvSpikesPerSec');
  return PARAMETERS.vagalGainSecPerSpikePerSec * fEvSpikesPerSec;
}

// Exact solution of Eq. 27 or Eq. 29 over a piecewise-constant target.
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

function delayedValue(history, timeSec, delaySec, fallback) {
  nonNegative(timeSec, 'timeSec');
  nonNegative(delaySec, 'delaySec');
  finite(fallback, 'fallback');
  if (!history.length) return fallback;
  const target = timeSec - delaySec;
  if (target <= history[0].timeSec) return history[0].value;
  for (let i = history.length - 1; i >= 1; i--) {
    const b = history[i];
    const a = history[i - 1];
    if (a.timeSec <= target && target <= b.timeSec) {
      const span = b.timeSec - a.timeSec;
      if (!(span > 0)) return a.value;
      const w = (target - a.timeSec) / span;
      return a.value + (b.value - a.value) * w;
    }
  }
  return history[history.length - 1].value;
}

function createIwamotoHeartPeriodCandidate() {
  let sympatheticHistory = [];
  let vagalHistory = [];
  let sympatheticChangeSec = null;
  let vagalChangeSec = null;
  let previousTimeSec = null;

  let state = Object.freeze({
    timeSec: null,
    heartPeriodSec: null,
    heartRatePerMin: null,
    sympatheticHeartPeriodChangeSec: null,
    vagalHeartPeriodChangeSec: null,
    authority: SOURCE.authority,
    provenance: SOURCE,
  });

  function step({
    timeSec,
    cardiacSympatheticSpikesPerSec,
    cardiacVagalSpikesPerSec,
  } = {}) {
    nonNegative(timeSec, 'timeSec');
    nonNegative(cardiacSympatheticSpikesPerSec,
      'cardiacSympatheticSpikesPerSec');
    nonNegative(cardiacVagalSpikesPerSec, 'cardiacVagalSpikesPerSec');

    if (previousTimeSec != null && timeSec < previousTimeSec) {
      throw new Error('timeSec must be monotonic');
    }
    const dtSec = previousTimeSec == null ? 0 : timeSec - previousTimeSec;
    previousTimeSec = timeSec;

    sympatheticHistory.push({
      timeSec,
      value: cardiacSympatheticSpikesPerSec,
    });
    vagalHistory.push({ timeSec, value: cardiacVagalSpikesPerSec });

    const retainAfter = timeSec -
      Math.max(PARAMETERS.sympatheticDelaySec, PARAMETERS.vagalDelaySec) - 5;
    while (sympatheticHistory.length > 2 &&
           sympatheticHistory[1].timeSec < retainAfter) {
      sympatheticHistory.shift();
    }
    while (vagalHistory.length > 2 &&
           vagalHistory[1].timeSec < retainAfter) {
      vagalHistory.shift();
    }

    const delayedSympathetic = delayedValue(
      sympatheticHistory,
      timeSec,
      PARAMETERS.sympatheticDelaySec,
      cardiacSympatheticSpikesPerSec);
    const delayedVagal = delayedValue(
      vagalHistory,
      timeSec,
      PARAMETERS.vagalDelaySec,
      cardiacVagalSpikesPerSec);

    const sympatheticTarget =
      sympatheticStaticHeartPeriodChangeSec(delayedSympathetic);
    const vagalTarget = vagalStaticHeartPeriodChangeSec(delayedVagal);

    sympatheticChangeSec = firstOrderExact(
      sympatheticChangeSec,
      sympatheticTarget,
      dtSec,
      PARAMETERS.sympatheticTauSec);
    vagalChangeSec = firstOrderExact(
      vagalChangeSec,
      vagalTarget,
      dtSec,
      PARAMETERS.vagalTauSec);

    // Iwamoto 2024 Eq. 30.
    const heartPeriodSec =
      PARAMETERS.baselineHeartPeriodSec +
      sympatheticChangeSec +
      vagalChangeSec;
    const heartRatePerMin =
      Number.isFinite(heartPeriodSec) && heartPeriodSec > 0
        ? 60 / heartPeriodSec
        : null;

    state = Object.freeze({
      timeSec,
      cardiacSympatheticSpikesPerSec,
      cardiacVagalSpikesPerSec,
      delayedCardiacSympatheticSpikesPerSec: delayedSympathetic,
      delayedCardiacVagalSpikesPerSec: delayedVagal,
      sympatheticTargetHeartPeriodChangeSec: sympatheticTarget,
      vagalTargetHeartPeriodChangeSec: vagalTarget,
      sympatheticHeartPeriodChangeSec: sympatheticChangeSec,
      vagalHeartPeriodChangeSec: vagalChangeSec,
      heartPeriodSec,
      heartRatePerMin,
      authority: SOURCE.authority,
      provenance: SOURCE,
    });
    return state;
  }

  return Object.freeze({
    step,
    snapshot: () => state,
    parameters: PARAMETERS,
    source: SOURCE,
  });
}

module.exports = Object.freeze({
  SOURCE,
  PARAMETERS,
  sympatheticStaticHeartPeriodChangeSec,
  vagalStaticHeartPeriodChangeSec,
  firstOrderExact,
  createIwamotoHeartPeriodCandidate,
});
