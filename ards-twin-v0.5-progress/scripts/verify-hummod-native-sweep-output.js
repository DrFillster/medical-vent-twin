#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');

const root=process.argv[2], output=process.argv[3];
if(!root||!output) throw new Error('usage: node scripts/verify-hummod-native-sweep-output.js <sweep-output-dir> <output.json>');
const runPath=path.join(root,'sweep-run.json');
const summaryPath=path.join(root,'sensitivity-summary.json');
if(!fs.existsSync(runPath)) throw new Error('sweep-run.json is required');
const run=JSON.parse(fs.readFileSync(runPath,'utf8'));
const findings=[];
let acceptable=true;

if(!run.baselineAvailable){acceptable=false;findings.push({level:'error',code:'BASELINE_MISSING'});}
for(const c of run.cases||[]){
  if(c.status!=='passed'){acceptable=false;findings.push({level:'error',code:'CASE_NOT_PASSED',case:c.case,status:c.status,error:c.error||null});}
}
if(!fs.existsSync(summaryPath)){acceptable=false;findings.push({level:'error',code:'SENSITIVITY_SUMMARY_MISSING'});}

const calibrationTargetPath=path.join(root,'native-reduced-calibration-target.json');
const decompositionPath=path.join(root,'native-reduced-error-decomposition.json');
if(!fs.existsSync(calibrationTargetPath)){
  acceptable=false;findings.push({level:'error',code:'NATIVE_REDUCED_CALIBRATION_TARGET_MISSING'});
} else {
  const target=JSON.parse(fs.readFileSync(calibrationTargetPath,'utf8'));
  if(!target.nativeReducedState||target.nativeReducedState.available!==true){
    acceptable=false;findings.push({level:'error',code:'NATIVE_REDUCED_GAS_STATE_UNAVAILABLE',missing:target.nativeReducedState?.missingSymbols||null});
  }
  if(!target.nativeCirculationState||target.nativeCirculationState.available!==true){
    acceptable=false;findings.push({level:'error',code:'NATIVE_REDUCED_CIRCULATION_STATE_UNAVAILABLE',missing:target.nativeCirculationState?.missingSymbols||null});
  }
}
if(!fs.existsSync(decompositionPath)){
  acceptable=false;findings.push({level:'error',code:'NATIVE_REDUCED_ERROR_DECOMPOSITION_MISSING'});
}

if(fs.existsSync(summaryPath)){
  const summary=JSON.parse(fs.readFileSync(summaryPath,'utf8'));
  for(const row of summary.rows||[]){
    const d=row.pulmonaryDiagnostics||{};
    const inspired=d['AirSupply-InspiredAir.O2(%)'];
    if(!inspired||Math.abs(inspired.scenarioFinal-50)>1e-6){
      acceptable=false;findings.push({level:'error',code:'INSPIRED_O2_NOT_VERIFIED',case:row.case,observed:inspired?.scenarioFinal??null});
    }
    const mechanismSymbols=[
      'LungBloodFlow.AlveolarShunt','LungBloodFlow.TotalShunt',
      'RightHemithorax.LungInflation','LeftHemithorax.LungInflation',
      'PulmonaryMembrane.Permeability','PulmonaryMembrane.DiffusingCapacity',
      'PulmonaryMembrane.Thickness','PulmonaryMembrane.Recruitment','ExcessLungWater.Volume'
    ];
    const engaged=mechanismSymbols.some(s=>d[s]&&Math.abs(d[s].deltaFinal)>1e-9);
    if(!engaged) findings.push({level:'warning',code:'NO_TRACKED_PULMONARY_DIAGNOSTIC_CHANGED',case:row.case});
    const endpointChanged=[row.deltaPaO2,row.deltaPaCO2,row.deltaPH,row.deltaMAP,row.deltaCardiacOutput].some(v=>typeof v==='number'&&Math.abs(v)>1e-9);
    if(!endpointChanged) findings.push({level:'warning',code:'NO_TRACKED_SYSTEMIC_ENDPOINT_CHANGED',case:row.case});
  }
}

const report={
  schema:'vent-hummod-native-sweep-verification/v1',
  acceptableForEngineeringInterpretation:acceptable,
  findings,
  berlinClassificationAllowed:false,
  clinicalValidation:false,
};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
process.exit(acceptable?0:2);
