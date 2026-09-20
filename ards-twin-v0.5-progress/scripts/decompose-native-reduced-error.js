#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const beforePath=process.argv[2], afterPath=process.argv[3], outputPath=process.argv[4];
if(!beforePath||!afterPath||!outputPath) throw new Error('usage: node scripts/decompose-native-reduced-error.js <uncalibrated-comparison.json> <native-state-calibrated-comparison.json> <output.json>');
const before=JSON.parse(fs.readFileSync(beforePath,'utf8'));
const after=JSON.parse(fs.readFileSync(afterPath,'utf8'));
for(const x of [before,after]) if(x.schema!=='vent-native-vs-reduced-hummod-comparison/v1') throw new Error('comparison schema required');

const endpoints={};
for(const field of Object.keys(before.endpoints)){
  if(!after.endpoints[field]) throw new Error('calibrated comparison missing endpoint '+field);
  const b=before.endpoints[field].absoluteDelta;
  const a=after.endpoints[field].absoluteDelta;
  endpoints[field]={
    absoluteErrorBefore:b,
    absoluteErrorAfterNativeStateCalibration:a,
    absoluteErrorChange:a-b,
    improved:a<b,
  };
}
const report={
  schema:'vent-native-reduced-error-decomposition/v1',
  endpoints,
  interpretation:{
    status:'engineering-error-attribution',
    nativeStateCalibration:'gas state, seven reduced circulation compartment volumes, and heart rate',
    residualMismatch:'may reflect unmatched mechanics, hemodynamic volumes/conductances, pulmonary perfusion/shunt, metabolism, gas-exchange boundaries, or reduced equations',
    automaticEquivalenceDecision:false,
    fullHumModEquivalent:false,
    berlinArdsCalibration:false,
    clinicalValidation:false,
  },
};
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
