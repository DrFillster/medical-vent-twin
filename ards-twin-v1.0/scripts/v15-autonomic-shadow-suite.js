#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createBerlinLiveHumModSession } =
  require('../src/clinical_twin_live_hummod_session.js');

function finiteOrNull(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function row(snapshot, scenarioId) {
  const sys = snapshot.systemic || {};
  const h = sys.hemodynamics || {};
  const a = h.sourceAlignedAutonomic || {};
  const sh = sys.autonomicShadow || {};
  const g = sys.gasExchange || {};
  return {
    scenarioId,
    tSec: finiteOrNull(snapshot.timeSec),
    pao2MmHg: finiteOrNull(g.pao2MmHg),
    paco2MmHg: finiteOrNull(g.paco2MmHg),
    pH: finiteOrNull(g.pH),
    ventActualTidalVolumeL: finiteOrNull(sh.tidalVolumeL),
    humModBaroreflexNa: finiteOrNull(a.baroreflexNa),
    humModSympsCnsHz: finiteOrNull(a.sympsCnsHz),
    humModVagusHz: finiteOrNull(a.vagusHz),
    humModSaNodeRatePerMin: finiteOrNull(h.sourceSaNodeHeartRatePerMin),
    humModHeartRatePerMin: finiteOrNull(h.heartRatePerMin),
    ursinoFAcSpikesPerSec: finiteOrNull(sh.fAcSpikesPerSec),
    ursinoFApSpikesPerSec: finiteOrNull(sh.fApSpikesPerSec),
    ursinoThetaSpSpikesPerSec: finiteOrNull(sh.thetaSpSpikesPerSec),
    ursinoThetaShSpikesPerSec: finiteOrNull(sh.thetaShSpikesPerSec),
    ursinoFSpSpikesPerSec: finiteOrNull(sh.fSpSpikesPerSec),
    ursinoFShSpikesPerSec: finiteOrNull(sh.fShSpikesPerSec),
    ursinoFVSpikesPerSec: finiteOrNull(sh.fVSpikesPerSec),
    baroreceptorMappingStatus: sh.baroreceptorMappingStatus || null,
  };
}
