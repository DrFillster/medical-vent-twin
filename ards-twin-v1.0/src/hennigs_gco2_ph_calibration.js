'use strict';

const SOURCE = Object.freeze({
  targetExperiment: Object.freeze({
    hypercapnia: Object.freeze({
      inspiredCo2Fraction: 0.07,
      durationSec: 25 * 60,
      reference: 'Reynolds et al. J Appl Physiol. 1972;33(1):47-54',
      cohort: '14 normal subjects at 7% CO2 per Cheng et al. 2016',
    }),
    hypoxia: Object.freeze({
      inspiredO2Fraction: 0.08,
      durationSec: 10 * 60,
      reference: 'Reynolds and Milhorn Jr. transient ventilatory response to hypoxia',
    }),
  }),
  hennigsAcceptance: Object.freeze({
    metric: 'MAPE',
    comparisonPercent: 10,
    note:
      'Comparison benchmark only, not a universal pass/fail threshold. Hennigs T1 evaluates RR(t), VT(t), baseline, peak, TTP, and AUC and reports individual errors that can exceed 10 percent.',
  }),
  authority: 'calibration-framework-only',
});

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(label + ' must be finite');
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
function requireSeries(series, label) {
  if (!Array.isArray(series) || series.length < 2) {
    throw new Error(label + ' must contain at least two points');
  }
  let lastTime = -Infinity;
  return series.map((row, index) => {
    if (!row || typeof row !== 'object') {
      throw new Error(label + '[' + index + '] must be an object');
    }
    const timeSec = nonNegative(row.timeSec, label + '[' + index + '].timeSec');
    const respiratoryRatePerMin = positive(
      row.respiratoryRatePerMin,
      label + '[' + index + '].respiratoryRatePerMin'
    );
    const tidalVolumeL = positive(
      row.tidalVolumeL,
      label + '[' + index + '].tidalVolumeL'
    );
    if (timeSec <= lastTime) {
      throw new Error(label + ' times must be strictly increasing');
    }
    lastTime = timeSec;
    return Object.freeze({ timeSec, respiratoryRatePerMin, tidalVolumeL });
  });
}

function createCalibrationTarget({
  hypercapniaSeries,
  hypoxiaSeries,
  provenance,
} = {}) {
  if (!provenance || typeof provenance !== 'object') {
    throw new Error('provenance object is required');
  }
  if (!provenance.hypercapnia || !provenance.hypoxia) {
    throw new Error('separate hypercapnia and hypoxia provenance is required');
  }
  const hypercapnia = requireSeries(hypercapniaSeries, 'hypercapniaSeries');
  const hypoxia = requireSeries(hypoxiaSeries, 'hypoxiaSeries');
  return Object.freeze({
    hypercapnia: Object.freeze(hypercapnia),
    hypoxia: Object.freeze(hypoxia),
    provenance: Object.freeze({
      hypercapnia: Object.freeze({ ...provenance.hypercapnia }),
      hypoxia: Object.freeze({ ...provenance.hypoxia }),
    }),
    authority: 'reference-data-target',
    source: SOURCE,
  });
}

function meanAbsolutePercentageError(reference, predicted, label) {
  if (!Array.isArray(reference) || !Array.isArray(predicted) ||
      reference.length !== predicted.length || reference.length === 0) {
    throw new Error(label + ' arrays must have equal non-zero length');
  }
  let sum = 0;
  for (let i = 0; i < reference.length; i += 1) {
    const r = positive(reference[i], label + '.reference[' + i + ']');
    const p = finite(predicted[i], label + '.predicted[' + i + ']');
    sum += Math.abs((p - r) / r);
  }
  return (sum / reference.length) * 100;
}

function scoreCandidate({
  target,
  hypercapniaPrediction,
  hypoxiaPrediction,
  candidateGPco2Ph,
  candidateProvenance = null,
} = {}) {
  if (!target || target.authority !== 'reference-data-target') {
    throw new Error('provenance-locked calibration target is required');
  }
  nonNegative(candidateGPco2Ph, 'candidateGPco2Ph');

  const hypercapnia = requireSeries(
    hypercapniaPrediction,
    'hypercapniaPrediction'
  );
  const hypoxia = requireSeries(hypoxiaPrediction, 'hypoxiaPrediction');

  if (hypercapnia.length !== target.hypercapnia.length ||
      hypoxia.length !== target.hypoxia.length) {
    throw new Error('predicted and reference series lengths must match');
  }

  const score = (reference, prediction, condition) => {
    for (let i = 0; i < reference.length; i += 1) {
      if (Math.abs(reference[i].timeSec - prediction[i].timeSec) > 1e-9) {
        throw new Error(condition + ' time grid must match reference data');
      }
    }
    const rr = meanAbsolutePercentageError(
      reference.map(x => x.respiratoryRatePerMin),
      prediction.map(x => x.respiratoryRatePerMin),
      condition + '.RR'
    );
    const vt = meanAbsolutePercentageError(
      reference.map(x => x.tidalVolumeL),
      prediction.map(x => x.tidalVolumeL),
      condition + '.VT'
    );
    return Object.freeze({
      rrMapePercent: rr,
      vtMapePercent: vt,
      meanMapePercent: (rr + vt) / 2,
    });
  };

  const hypercapniaScore = score(
    target.hypercapnia,
    hypercapnia,
    'hypercapnia'
  );
  const hypoxiaScore = score(target.hypoxia, hypoxia, 'hypoxia');
  const overallMapePercent =
    (hypercapniaScore.rrMapePercent +
      hypercapniaScore.vtMapePercent +
      hypoxiaScore.rrMapePercent +
      hypoxiaScore.vtMapePercent) / 4;

  return Object.freeze({
    candidateGPco2Ph,
    hypercapnia: hypercapniaScore,
    hypoxia: hypoxiaScore,
    overallMapePercent,
    withinNominalTenPercentComparison:
      overallMapePercent <= SOURCE.hennigsAcceptance.comparisonPercent,
    authority: 'calibrated-candidate-not-source-exact',
    candidateProvenance: candidateProvenance
      ? Object.freeze({ ...candidateProvenance })
      : null,
    targetProvenance: target.provenance,
    source: SOURCE,
  });
}

module.exports = Object.freeze({
  SOURCE,
  createCalibrationTarget,
  meanAbsolutePercentageError,
  scoreCandidate,
});
