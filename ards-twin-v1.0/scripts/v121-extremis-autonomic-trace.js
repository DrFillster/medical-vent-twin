#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function finiteOrNull(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function loadBundle() {
  const enginePath = path.resolve(__dirname, '../web/engine.js');
  const source = fs.readFileSync(enginePath, 'utf8');
  const context = { console, setTimeout, clearTimeout, Math, JSON, Object, Array, Number, String, Boolean, Date, Error, TypeError, RangeError };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: enginePath });
  if (!context.VENT) throw new Error('web/engine.js did not expose VENT');
  return context.VENT;
}

function rowFromSnapshot(s) {
  const h = s.systemic.hemodynamics || {};
  const a = h.sourceAlignedAutonomic || {};
  const c = h.catecholamines || {};
  const g = s.systemic.gasExchange || {};
  const d = s.systemic.decompensation || {};
  return {
    tSec: finiteOrNull(s.timeSec),
    hrPerMin: finiteOrNull(h.heartRatePerMin),
    sourceSaNodeHrPerMin: finiteOrNull(h.sourceSaNodeHeartRatePerMin),
    mapMmHg: finiteOrNull(h.meanArterialPressureMmHg),
    cardiacOutputMlPerMin: finiteOrNull(h.cardiacOutputMlPerMin),
    carotidPressureMmHg: finiteOrNull(a.carotidPressureMmHg),
    adaptedCarotidPressureMmHg: finiteOrNull(a.adaptedPressureMmHg),
    baroreflexNa: finiteOrNull(a.baroreflexNa),
    averageAtrialTmpMmHg: finiteOrNull(a.averageAtrialTmpMmHg),
    lowPressureNa: finiteOrNull(a.lowPressureNa),
    sympsCnsBaroEffect: finiteOrNull(a.sympsCnsBaroEffect),
    sympsCnsLowPressureEffect: finiteOrNull(a.sympsCnsLowPressureEffect),
    sympsCnsReflexNa: finiteOrNull(a.sympsCnsReflexNa),
    sympsCnsNa: finiteOrNull(a.sympsCnsNa),
    sympsCnsHz: finiteOrNull(a.sympsCnsHz),
    vagusHz: finiteOrNull(a.vagusHz),
    saBetaActivity: finiteOrNull(a.saBetaActivity),
    parasympatheticEffectPerMin: finiteOrNull(a.parasympatheticEffectPerMin),
    sympatheticEffectPerMin: finiteOrNull(a.sympatheticEffectPerMin),
    humoralBetaPoolEffect: finiteOrNull(a.humoralBetaPoolEffect),
    nePgPerMl: finiteOrNull(c.nePgPerMl),
    epiPgPerMl: finiteOrNull(c.epiPgPerMl),
    pao2MmHg: finiteOrNull(g.pao2MmHg),
    paco2MmHg: finiteOrNull(g.paco2MmHg),
    pH: finiteOrNull(g.pH),
    cardiacArrest: Boolean(d.cardiacArrest),
  };
}

const VENT = loadBundle();
const session = VENT.createBerlinLiveHumModSession({
  caseId: 'berlin-moderate-moderate-aspiration',
  ventilation: {
    mode: 'VC_AC', fio2: 0.60, peep: 8, rr: 20,
    vtL: 0.42, inspiratoryFlowLps: 0.70, inspiratoryPauseSec: 0.20,
  },
  initialRecruitmentState: { normal: 1, recruitable: 0.35, consolidated: 0 },
  dt: 0.002,
  mechanicalWarmupSec: 3,
});

session.initialize();
session.requestVentilationChange({
  mode: 'VC_AC', fio2: 0.20, peep: 8, rr: 4,
  vtL: 0.10, inspiratoryFlowLps: 0.20, inspiratoryPauseSec: 0,
});

const rows = [];
for (let elapsed = 0; elapsed < 1200; elapsed += 10) {
  const snapshot = session.runFor(10);
  rows.push(rowFromSnapshot(snapshot));
  if (snapshot.systemic.decompensation?.cardiacArrest) break;
}

const maxHr = rows.reduce((best, row) =>
  best == null || (row.hrPerMin != null && row.hrPerMin > best.hrPerMin) ? row : best, null);

const report = {
  schema: 'vent-v1.21-extremis-autonomic-trace/v1',
  purpose: 'Diagnostic trace only; no HR target is imposed.',
  scenario: {
    baseline: { fio2: 0.60, peepCmH2O: 8, rrPerMin: 20, vtL: 0.42 },
    extremis: { fio2: 0.20, peepCmH2O: 8, rrPerMin: 4, vtL: 0.10 },
  },
  maxHr,
  rows,
};

const outPath = process.argv[2] || path.resolve(__dirname, '../V1_21_EXTREMIS_AUTONOMIC_TRACE.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ outPath, rows: rows.length, maxHr }, null, 2));
