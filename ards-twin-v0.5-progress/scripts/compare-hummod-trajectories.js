#!/usr/bin/env node
'use strict';

const fs=require('node:fs');

const baselinePath=process.argv[2], scenarioPath=process.argv[3], outputPath=process.argv[4];
if(!baselinePath||!scenarioPath||!outputPath) throw new Error('usage: node scripts/compare-hummod-trajectories.js <baseline.json> <scenario.json> <output.json>');
const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
const scenario=JSON.parse(fs.readFileSync(scenarioPath,'utf8'));
if(baseline.schema!=='vent-hummod-trajectory/v1'||scenario.schema!=='vent-hummod-trajectory/v1') throw new Error('canonical HumMod trajectories required');
if(!baseline.rows.length||!scenario.rows.length) throw new Error('trajectories must contain rows');
const b=baseline.rows[baseline.rows.length-1], s=scenario.rows[scenario.rows.length-1];
const symbols=[
  'PO2Artys.Pressure',
  'CO2Artys.Pressure',
  'BloodPh.ArtysPh',
  'Heart-Rate.Rate',
  'SystemicArtys.Pressure',
  'CardiacOutput.Flow(L/Min)',
];
const endpoints={};
for(const symbol of symbols){
  const bv=Number(b.values[symbol]), sv=Number(s.values[symbol]);
  if(!Number.isFinite(bv)||!Number.isFinite(sv)) throw new Error('missing finite endpoint '+symbol);
  endpoints[symbol]={baseline:bv,scenario:sv,delta:sv-bv};
}
const report={
  schema:'vent-hummod-native-comparison/v1',
  baselineTrajectoryId:baseline.trajectoryId,
  scenarioTrajectoryId:scenario.trajectoryId,
  baselineEndSec:b.timestampSec,
  scenarioEndSec:s.timestampSec,
  endpoints,
  interpretation:'engineering-delta-only',
  clinicalValidation:false,
};
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
