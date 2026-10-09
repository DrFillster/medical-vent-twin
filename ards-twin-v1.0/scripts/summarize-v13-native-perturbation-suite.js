#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=process.argv[2];
if(!root)throw new Error('usage: node scripts/summarize-v13-native-perturbation-suite.js <suite-output-root>');
const dirs=fs.readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort();
const rows=[];
for(const d of dirs){
  const p=path.join(root,d,'native-perturbation-summary.json');
  if(!fs.existsSync(p))continue;
  const s=JSON.parse(fs.readFileSync(p,'utf8'));
  rows.push({
    scenarioId:s.scenarioId,
    terminalSec:s.terminalSec,
    heartRateExceeded120:s.heartRateExceeded120,
    firstHeartRateAbove120Sec:s.firstHeartRateAbove120Sec,
    peakHeartRate:s.heartRate.max.value,
    peakSaNodeRate:s.saNodeRate.max.value,
    peakSympsCnsHz:s.sympsCnsHz.max.value,
    minimumVagusHz:s.vagusHz.min.value,
    peakExerciseSympatheticEffect:s.exerciseSympatheticEffect.max.value,
    peakAdrenalNerveHz:s.adrenalNerveHz.max.value,
    peakEpinephrine:s.epinephrinePool.max.value,
    peakNorepinephrine:s.norepinephrinePool.max.value,
    peakCardiacOutputMlPerMin:s.cardiacOutputMlPerMin.max.value,
    peakStrokeVolumeMl:s.strokeVolumeMl.max.value,
    minimumBloodVolumeMl:s.bloodVolumeMl.min.value,
    minimumMap:s.systemicArterialPressure.min.value,
    peakPeripheralResistance:s.peripheralResistance.max.value,
    organFlowClosure:s.organFlowClosure||null
  });
}
const report={
  schema:'hummod-v13-native-perturbation-suite-summary/v1',
  scenarioCount:rows.length,
  anyHeartRateAbove120:rows.some(x=>x.heartRateExceeded120),
  maximumObservedHeartRate:rows.length?Math.max(...rows.map(x=>x.peakHeartRate)):null,
  maximumOrganFlowClosureErrorMlPerMin:rows.length?Math.max(...rows.flatMap(x=>x.organFlowClosure?[
    x.organFlowClosure.peripheral.maxAbsoluteDifference,
    x.organFlowClosure.hepaticVein.maxAbsoluteDifference,
    x.organFlowClosure.systemicArterialOutflow.maxAbsoluteDifference
  ]:[0])):null,
  scenarios:rows
};
fs.writeFileSync(path.join(root,'native-perturbation-suite-summary.json'),JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify(report,null,2)+'\n');
