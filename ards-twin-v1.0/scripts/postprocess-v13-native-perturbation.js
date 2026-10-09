#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {extractAllVariables,verifyScenario}=require('./postprocess-v13-native-run07.js');

const PINNED_REVISION='8dab57e05631f779bf5020fe0dd51874d8ae98c1';

function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function series(v,name){const x=v[name];if(!Array.isArray(x)||!x.length)throw new Error('missing native variable: '+name);return x;}
function extrema(values,clock,mode){
  let idx=0;
  for(let i=1;i<values.length;i++){
    if((mode==='max'&&values[i]>values[idx])||(mode==='min'&&values[i]<values[idx])) idx=i;
  }
  return {value:values[idx],sampleIndex:idx,timestampSec:clock[idx]*60};
}
function summarize(extraction,scenario){
  const v=extraction.variables;
  const clock=series(v,'System.X');
  const hr=series(v,'Heart-Rate.Rate');
  const sa=series(v,'SANode-Rate.Rate');
  const co=series(v,'CardiacOutput.Flow');
  const sv=series(v,'CardiacOutput.StrokeVolume');
  const tpr=series(v,'PeripheralResistance.TPR');
  const map=series(v,'SystemicArtys.Pressure');
  const symps=series(v,'SympsCNS.NA(Hz)');
  const vagus=series(v,'VagusNerve.NA(Hz)');
  const baro=series(v,'Baroreflex.NA');
  const lowp=series(v,'LowPressureReceptors.NA');
  const exercise=series(v,'ExerciseSymps.TotalEffect');
  const adrenal=series(v,'AdrenalNerve.NA(Hz)');
  const epi=series(v,'EpiPool.[Epi]');
  const ne=series(v,'NEPool.[NE]');
  const bloodVol=series(v,'BloodVol.Vol');
  const rap=series(v,'RightAtrium.Pressure');
  const pao2=series(v,'PO2Artys.Pressure');
  const paco2=series(v,'CO2Artys.Pressure');
  const ph=series(v,'BloodPh.ArtysPh');
  const brain=series(v,'Brain-Function.Effect');
  const thresholdIndices=[];
  for(let i=0;i<hr.length;i++) if(hr[i]>120) thresholdIndices.push(i);
  return {
    schema:'hummod-v13-native-perturbation-summary/v1',
    scenarioId:scenario.id,
    scenarioClass:scenario.scenarioClass,
    sampleCount:extraction.sampleCount,
    terminalSec:clock[clock.length-1]*60,
    heartRateExceeded120:thresholdIndices.length>0,
    firstHeartRateAbove120Sec:thresholdIndices.length?clock[thresholdIndices[0]]*60:null,
    heartRate:{max:extrema(hr,clock,'max'),min:extrema(hr,clock,'min')},
    saNodeRate:{max:extrema(sa,clock,'max'),min:extrema(sa,clock,'min')},
    cardiacOutputMlPerMin:{max:extrema(co,clock,'max'),min:extrema(co,clock,'min')},
    strokeVolumeMl:{max:extrema(sv,clock,'max'),min:extrema(sv,clock,'min')},
    peripheralResistance:{max:extrema(tpr,clock,'max'),min:extrema(tpr,clock,'min')},
    systemicArterialPressure:{max:extrema(map,clock,'max'),min:extrema(map,clock,'min')},
    sympsCnsHz:{max:extrema(symps,clock,'max'),min:extrema(symps,clock,'min')},
    vagusHz:{max:extrema(vagus,clock,'max'),min:extrema(vagus,clock,'min')},
    baroreflexNA:{max:extrema(baro,clock,'max'),min:extrema(baro,clock,'min')},
    lowPressureReceptorsNA:{max:extrema(lowp,clock,'max'),min:extrema(lowp,clock,'min')},
    exerciseSympatheticEffect:{max:extrema(exercise,clock,'max'),min:extrema(exercise,clock,'min')},
    adrenalNerveHz:{max:extrema(adrenal,clock,'max'),min:extrema(adrenal,clock,'min')},
    epinephrinePool:{max:extrema(epi,clock,'max'),min:extrema(epi,clock,'min')},
    norepinephrinePool:{max:extrema(ne,clock,'max'),min:extrema(ne,clock,'min')},
    bloodVolumeMl:{max:extrema(bloodVol,clock,'max'),min:extrema(bloodVol,clock,'min')},
    rightAtrialPressure:{max:extrema(rap,clock,'max'),min:extrema(rap,clock,'min')},
    arterialPo2:{max:extrema(pao2,clock,'max'),min:extrema(pao2,clock,'min')},
    arterialPco2:{max:extrema(paco2,clock,'max'),min:extrema(paco2,clock,'min')},
    arterialPh:{max:extrema(ph,clock,'max'),min:extrema(ph,clock,'min')},
    brainFunction:{max:extrema(brain,clock,'max'),min:extrema(brain,clock,'min')}
  };
}
function processPerturbation(runDir,scenarioPath){
  const dir=path.resolve(runDir);
  const soln=path.join(dir,'Vent.SOLN');
  const statusPath=path.join(dir,'native-export-status.json');
  if(!fs.existsSync(soln)) throw new Error('missing Vent.SOLN');
  if(!fs.existsSync(statusPath)) throw new Error('missing native-export-status.json');
  const status=JSON.parse(fs.readFileSync(statusPath,'utf8'));
  if(status.revision!==PINNED_REVISION) throw new Error('native revision mismatch');
  if(!status.outputCaptured) throw new Error('native exporter did not capture output');
  if(status.advanceMenuLabel!=='1 Sec') throw new Error('perturbation suite requires 1 Sec native stepping');
  const scenario=JSON.parse(fs.readFileSync(path.resolve(scenarioPath),'utf8'));
  const extraction=extractAllVariables(fs.readFileSync(soln,'utf8'));
  const verification=verifyScenario(extraction,scenario);
  if(!verification.passed) throw new Error('native scenario verification failed');
  fs.writeFileSync(path.join(dir,'native-all-variables.json'),JSON.stringify(extraction,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'scenario-verification.json'),JSON.stringify(verification,null,2)+'\n');
  const summary=summarize(extraction,scenario);
  fs.writeFileSync(path.join(dir,'native-perturbation-summary.json'),JSON.stringify(summary,null,2)+'\n');
  const provenance={
    schema:'hummod-v13-native-perturbation-provenance/v1',
    revision:status.revision,
    executableSha256:status.executableSha256||null,
    ventSolnSha256:sha256(soln),
    scenarioSha256:sha256(path.resolve(scenarioPath)),
    nativeExportStatusSha256:sha256(statusPath)
  };
  fs.writeFileSync(path.join(dir,'native-perturbation-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
  return summary;
}
if(require.main===module){
  const dir=process.argv[2],scenario=process.argv[3];
  if(!dir||!scenario)throw new Error('usage: node scripts/postprocess-v13-native-perturbation.js <run-dir> <scenario.json>');
  process.stdout.write(JSON.stringify(processPerturbation(dir,scenario),null,2)+'\n');
}
module.exports={summarize,processPerturbation};
