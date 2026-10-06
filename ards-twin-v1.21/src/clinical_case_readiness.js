'use strict';

// clinical_case_readiness.js
//
// UI/runtime-facing readiness assessment for authored Berlin ARDS cases.
// This module does not calculate or infer missing clinical inputs. It explains
// which fields are already evidence-calibrated and which must be supplied
// before a case can become an executable clinical-twin session.

const { getBerlinCase } = require('./berlin_case_catalog.js');

function field(status, value, source, note = null) {
  return Object.freeze({ status, value, source, note });
}

function assessBerlinCaseReadiness(caseId) {
  const c = getBerlinCase(caseId);
  const v = c.startingVentilation || {};
  const init = c.initialization || {};
  const twin = c.systemicTwin || {};

  const fields = Object.freeze({
    berlinSeverity: field(
      'ready',
      c.clinical.berlinSeverity,
      'authored-case-definition'),
    recruitabilityPhenotype: field(
      'ready',
      c.phenotype.recruitability,
      'Vent-mechanical-construct'),
    mechanicsPreset: field(
      'ready',
      c.phenotype.mechanicsPresetId,
      'Vent-mechanical-construct'),
    peepCmH2O: field(
      typeof v.peepCmH2O === 'number' ? 'cohort-calibrated' : 'missing',
      v.peepCmH2O,
      'published-cohort-envelope',
      'Cohort target, not patient-specific truth.'),
    tidalVolumeMlPerKgPbw: field(
      typeof v.tidalVolumeMlPerKgPbw === 'number' ? 'cohort-calibrated' : 'missing',
      v.tidalVolumeMlPerKgPbw,
      'published-cohort-envelope',
      'Requires validated PBW workflow before converting to absolute VT.'),
    tidalVolumeMl: field(
      typeof v.tidalVolumeMl === 'number' ? 'ready' : 'required-explicit-input',
      v.tidalVolumeMl,
      'case-author-or-validated-PBW-workflow'),
    fio2Fraction: field(
      typeof v.fio2Fraction === 'number' ? 'ready' : 'required-explicit-input',
      v.fio2Fraction,
      'case-author'),
    respiratoryRatePerMin: field(
      typeof v.respiratoryRatePerMin === 'number' ? 'ready' : 'required-explicit-input',
      v.respiratoryRatePerMin,
      'case-author'),
    ventilatorMode: field(
      typeof v.mode === 'string' && v.mode ? 'ready' : 'required-explicit-input',
      v.mode,
      'case-author'),
    initialRecruitmentState: field(
      init.initialRecruitmentState ? 'ready' : 'required-explicit-input',
      init.initialRecruitmentState || null,
      'explicit-current-state-or-explicit-pressure-history',
      'Provide either a current recruitable fraction or vent-recruitment-history/v1; do not infer recruitment from Berlin severity.'),
    humModTrajectory: field(
      twin.trajectoryId ? 'ready' : 'required-external-data',
      twin.trajectoryId || null,
      'validated-HumMod-export',
      'A real validated HumMod trajectory is required for HumMod-backed replay.'),
  });

  const blockers = Object.entries(fields)
    .filter(([, entry]) =>
      entry.status === 'required-explicit-input' ||
      entry.status === 'required-external-data')
    .map(([name]) => name);

  return Object.freeze({
    caseId: c.id,
    caseName: c.name,
    executable: blockers.length === 0,
    blockers: Object.freeze(blockers),
    fields,
    status: blockers.length === 0
      ? 'ready-for-executable-session'
      : 'authored-case-not-yet-executable',
    note: 'Readiness is a data-completeness assessment, not clinical validation.',
  });
}

function listBerlinCaseReadiness() {
  const { listBerlinCases } = require('./berlin_case_catalog.js');
  return Object.freeze(listBerlinCases().map(c => assessBerlinCaseReadiness(c.id)));
}

module.exports = {
  assessBerlinCaseReadiness,
  listBerlinCaseReadiness,
};
