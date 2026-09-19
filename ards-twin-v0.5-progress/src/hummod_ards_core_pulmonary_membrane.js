'use strict';

// hummod_ards_core_pulmonary_membrane.js
//
// Reduced implementation of HumMod PulmonaryMembrane.DES.
//
// Source curve:
//   LungBloodFlow.Alveolar (mL/min) -> membrane Recruitment
//     0     -> 0.01, slope 0
//     5500  -> 0.30, slope 0.0001
//     15000 -> 1.00, slope 0
//
// Source equations:
//   Thickness-H2O = ExcessLungWater.Volume / TotalArea
//   Thickness = Thickness-Structure + Thickness-H2O
//   ActiveArea = TotalArea * Recruitment
//   DiffusingCapacity = DC_SCALER * ActiveArea / Thickness
//   Permeability = DC_TO_PERM * DiffusingCapacity
//
// The DES runtime interpolation algorithm is not distributed here as an
// executable library. We preserve the source points and endpoint derivatives
// using piecewise cubic Hermite interpolation and expose that implementation
// choice in provenance.

const HUMMOD_PULMONARY_MEMBRANE_SOURCE = Object.freeze({
  repository: 'riliescu/hummod-standalone',
  revision: '8dab57e05631f779bf5020fe0dd51874d8ae98c1',
  path: 'Structure/Lungs/PulmonaryMembrane.DES',
});

const TOTAL_AREA = 80.0;
const THICKNESS_STRUCTURE = 0.6;
const DC_SCALER = 0.55;
const DC_TO_PERM = 5.0;

const RECRUITMENT_POINTS = Object.freeze([
  Object.freeze({ x: 0, y: 0.01, slope: 0 }),
  Object.freeze({ x: 5500, y: 0.30, slope: 0.0001 }),
  Object.freeze({ x: 15000, y: 1.00, slope: 0 }),
]);

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(label + ' must be a finite number');
  }
  return v;
}

function hermiteSegment(x, a, b) {
  const h = b.x - a.x;
  const t = (x - a.x) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * a.y +
    h10 * h * a.slope +
    h01 * b.y +
    h11 * h * b.slope;
}

function pulmonaryMembraneRecruitmentForAlveolarFlow(
  alveolarPulmonaryBloodFlowMlPerMin
) {
  finite(
    alveolarPulmonaryBloodFlowMlPerMin,
    'alveolarPulmonaryBloodFlowMlPerMin'
  );
  if (alveolarPulmonaryBloodFlowMlPerMin < 0) {
    throw new Error(
      'alveolarPulmonaryBloodFlowMlPerMin must be >= 0');
  }

  const x = alveolarPulmonaryBloodFlowMlPerMin;
  if (x <= RECRUITMENT_POINTS[0].x) return RECRUITMENT_POINTS[0].y;
  const last = RECRUITMENT_POINTS[RECRUITMENT_POINTS.length - 1];
  if (x >= last.x) return last.y;

  for (let i = 0; i < RECRUITMENT_POINTS.length - 1; i += 1) {
    const a = RECRUITMENT_POINTS[i];
    const b = RECRUITMENT_POINTS[i + 1];
    if (x <= b.x) {
      const y = hermiteSegment(x, a, b);
      return Math.max(
        Math.min(y, Math.max(a.y, b.y)),
        Math.min(a.y, b.y)
      );
    }
  }
  return last.y;
}

function pulmonaryMembraneState({
  alveolarPulmonaryBloodFlowMlPerMin,
  excessLungWaterMl = 0,
} = {}) {
  finite(excessLungWaterMl, 'excessLungWaterMl');
  if (excessLungWaterMl < 0) {
    throw new Error('excessLungWaterMl must be >= 0');
  }

  const recruitment =
    pulmonaryMembraneRecruitmentForAlveolarFlow(
      alveolarPulmonaryBloodFlowMlPerMin);
  const thicknessH2O = excessLungWaterMl / TOTAL_AREA;
  const thickness = THICKNESS_STRUCTURE + thicknessH2O;
  const activeArea = TOTAL_AREA * recruitment;
  const diffusingCapacity =
    DC_SCALER * activeArea / thickness;
  const permeabilityMlPerMinPerMmHg =
    DC_TO_PERM * diffusingCapacity;

  return Object.freeze({
    alveolarPulmonaryBloodFlowMlPerMin,
    recruitment,
    totalArea: TOTAL_AREA,
    activeArea,
    thicknessStructure: THICKNESS_STRUCTURE,
    thicknessH2O,
    thickness,
    diffusingCapacity,
    permeabilityMlPerMinPerMmHg,
    excessLungWaterMl,
    provenance: Object.freeze({
      source: HUMMOD_PULMONARY_MEMBRANE_SOURCE,
      equations: 'source-preserved',
      curvePointsAndSlopes: 'source-preserved',
      interpolation:
        'piecewise-cubic-Hermite; DES runtime interpolation not independently verified',
    }),
  });
}

module.exports = {
  HUMMOD_PULMONARY_MEMBRANE_SOURCE,
  RECRUITMENT_POINTS,
  pulmonaryMembraneRecruitmentForAlveolarFlow,
  pulmonaryMembraneState,
};
