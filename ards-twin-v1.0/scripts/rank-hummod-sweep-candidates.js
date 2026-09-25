#!/usr/bin/env node
'use strict';

const fs=require('node:fs');

const input=process.argv[2], output=process.argv[3];
if(!input||!output) throw new Error('usage: node scripts/rank-hummod-sweep-candidates.js <sensitivity-summary.json> <output.json>');
const summary=JSON.parse(fs.readFileSync(input,'utf8'));
if(summary.schema!=='vent-hummod-native-sensitivity-summary/v1') throw new Error('unsupported sensitivity summary schema');

function finite(v,label){ if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite'); return v; }

const baseline=summary.baselineEndpoints||{};
const rows=(summary.rows||[]).map(row=>{
  const paO2=finite((baseline.paO2||0)+row.deltaPaO2,'paO2');
  const paCO2=finite((baseline.paCO2||0)+row.deltaPaCO2,'paCO2');
  const pH=finite((baseline.pH||0)+row.deltaPH,'pH');
  const map=finite((baseline.map||0)+row.deltaMAP,'map');
  const cardiacOutput=finite((baseline.cardiacOutput||0)+row.deltaCardiacOutput,'cardiacOutput');
  const flags=[];
  if(paO2<baseline.paO2) flags.push('oxygenation-worsened');
  if(paCO2>baseline.paCO2) flags.push('co2-retention');
  if(map<baseline.map) flags.push('map-decreased');
  if(cardiacOutput<baseline.cardiacOutput) flags.push('cardiac-output-decreased');
  if(pH<baseline.pH) flags.push('ph-decreased');
  return {
    case:row.case,mechanism:row.mechanism,assignments:row.assignments,
    endpoints:{paO2,paCO2,pH,map,cardiacOutput},
    deltas:{paO2:row.deltaPaO2,paCO2:row.deltaPaCO2,pH:row.deltaPH,map:row.deltaMAP,cardiacOutput:row.deltaCardiacOutput},
    flags,
    clinicalValidation:false,
    berlinClassification:null,
  };
});

const report={
  schema:'vent-hummod-native-calibration-screen/v1',
  baseline,
  candidates:rows,
  selectionRule:'No automatic winner. Review mechanisms that worsen oxygenation while preserving interpretable hemodynamics; Berlin calibration remains separate and requires explicit FiO2/PEEP context.',
  berlinArdsCalibration:false,
  clinicalValidation:false,
};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
