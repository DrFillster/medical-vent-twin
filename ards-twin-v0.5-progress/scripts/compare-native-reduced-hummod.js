#!/usr/bin/env node
'use strict';

const fs=require('node:fs');

const targetPath=process.argv[2], reducedPath=process.argv[3], outputPath=process.argv[4];
if(!targetPath||!reducedPath||!outputPath) throw new Error('usage: node scripts/compare-native-reduced-hummod.js <native-target.json> <reduced-probe.json> <output.json>');
const native=JSON.parse(fs.readFileSync(targetPath,'utf8'));
const reduced=JSON.parse(fs.readFileSync(reducedPath,'utf8'));
if(native.schema!=='vent-native-reduced-hummod-calibration-target/v1') throw new Error('native calibration target required');
if(reduced.schema!=='vent-reduced-hummod-native-alignment-probe/v1') throw new Error('reduced alignment probe required');

const fields=['pao2MmHg','paco2MmHg','pH','heartRatePerMin','meanArterialPressureMmHg','cardiacOutputLPerMin'];
const endpoints={};
for(const field of fields){
  const n=native.endpoints[field], r=reduced.endpoints[field];
  if(typeof n!=='number'||!Number.isFinite(n)||typeof r!=='number'||!Number.isFinite(r)) throw new Error('non-finite endpoint '+field);
  endpoints[field]={native:n,reduced:r,deltaReducedMinusNative:r-n,absoluteDelta:Math.abs(r-n)};
}

const report={
  schema:'vent-native-vs-reduced-hummod-comparison/v1',
  nativeTargetId:native.targetId,
  reducedCaseId:reduced.caseId,
  controls:reduced.ventilator,
  endpoints,
  interpretation:{
    status:'engineering-discrepancy-report',
    automaticEquivalenceDecision:false,
    note:'Endpoint discrepancies identify calibration work; no tolerance here establishes physiologic, clinical, or structural equivalence.',
    nativePeepLimitation:'Pinned native HumMod has no PEEP control; reduced probe uses zero set PEEP only to minimize this specific control mismatch, while its Vent lung mechanics remain a synthetic ARDS case.',
    fullHumModEquivalent:false,
    berlinArdsCalibration:false,
    clinicalValidation:false,
  },
};
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
