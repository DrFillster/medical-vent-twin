#!/usr/bin/env node
'use strict';

const {
  peripheralChemoreceptorStatic,
  peripheralSympatheticFiring,
  pulmonaryStretchStatic,
  cnsHypoxiaStatic,
  P:AUTONOMIC_P,
}=require('../src/ursino_magosso_autonomic_shadow.js');
const {
  sourceTargets,
}=require('../src/ursino_magosso_2000_split_effectors_candidate.js');
const {
  VASCULAR_2000,
}=require('../src/ursino_magosso_2000_hypoxia_plant_parameters.js');

function parallel(...rs){
  return 1/rs.reduce((sum,r)=>sum+1/r,0);
}

// Isolated chemoreflex component test:
// - hold baroreceptor, lung-stretch, and CNS offset at their normoxic values;
// - change only peripheral chemoreceptor afferent firing;
// - compare steady reflex-controlled peripheral resistance.
// This follows the source parameter-assignment experiment concept rather than
// the full Fig. 11 interacting closed loop.

const pao2Baseline=95;
const pao2Deep=28;
const tidalVolumeL=0.583;

const fAb=25; // source vagal/baroreflex central firing coordinate, held fixed.
const fAp=pulmonaryStretchStatic(tidalVolumeL);
const thetaSp=cnsHypoxiaStatic(pao2Baseline,'sp');

function stateAt(pao2MmHg){
  const fAc=peripheralChemoreceptorStatic(pao2MmHg);
  const fSp=peripheralSympatheticFiring({
    fAbSpikesPerSec:fAb,
    fAcSpikesPerSec:fAc,
    fApSpikesPerSec:fAp,
    thetaSpSpikesPerSec:thetaSp,
  });
  const e=sourceTargets({
    vascularSympatheticSpikesPerSec:fSp,
    cardiacSympatheticSpikesPerSec:6,
    cardiacVagalSpikesPerSec:4,
  }).absolute;

  // Total systemic peripheral resistance for the five parallel beds.
  // Brain and coronary resistances are held at their basal local-control values;
  // the reflex arm acts on splanchnic, remaining extrasplanchnic, and muscle.
  const totalPeripheralResistance=parallel(
    e.Rsp,e.Rep,e.RmpNormal,
    VASCULAR_2000.bp.R,
    VASCULAR_2000.hp.R
  );

  return {
    pao2MmHg,
    fAcSpikesPerSec:fAc,
    fSpSpikesPerSec:fSp,
    Rsp:e.Rsp,
    Rep:e.Rep,
    Rmp:e.RmpNormal,
    totalPeripheralResistanceMmHgSecPerMl:totalPeripheralResistance,
  };
}

const baseline=stateAt(pao2Baseline);
const deep=stateAt(pao2Deep);
const percentChange=100*(
  deep.totalPeripheralResistanceMmHgSecPerMl-
  baseline.totalPeripheralResistanceMmHgSecPerMl
)/baseline.totalPeripheralResistanceMmHgSecPerMl;

console.log(JSON.stringify({
  schema:'ursino-magosso-2000-isolated-chemoreflex-resistance/v1',
  authority:'diagnostic-source-component-only',
  sourceTarget:'60-70% increase in total systemic resistance with other mechanisms excluded',
  held:{
    fAbSpikesPerSec:fAb,
    tidalVolumeL,
    fApSpikesPerSec:fAp,
    thetaSpSpikesPerSec:thetaSp,
    cnsHypoxiaHeldAtNormoxic:true,
    localHypoxicVasodilationDisabled:true,
  },
  baseline,
  deep,
  percentChange,
},null,2));
