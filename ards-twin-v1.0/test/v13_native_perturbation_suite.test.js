'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {validateNativeHumModScenario}=require('../src/hummod_native_scenario.js');
const {summarize}=require('../scripts/postprocess-v13-native-perturbation.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}

const root=path.resolve(__dirname,'..');
const suite=JSON.parse(fs.readFileSync(path.join(root,'NATIVE_PERTURBATION_SUITE.json'),'utf8'));

test('native perturbation suite scenarios exist and validate',()=>{
  assert(suite.scenarios.length>=5,'expected at least five native perturbations');
  for(const entry of suite.scenarios){
    const p=path.join(root,entry.scenarioFile);
    assert(fs.existsSync(p),'missing '+entry.scenarioFile);
    const spec=JSON.parse(fs.readFileSync(p,'utf8'));
    validateNativeHumModScenario(spec);
    assert(Number.isInteger(entry.durationSec)&&entry.durationSec>0,'invalid duration for '+entry.id);
  }
});

test('exercise probes use native bicycle mode and HumMod work controls',()=>{
  const a=JSON.parse(fs.readFileSync(path.join(root,'hummod-runner/native-v13-exercise-bike-100w.json'),'utf8'));
  const b=JSON.parse(fs.readFileSync(path.join(root,'hummod-runner/native-v13-exercise-bike-200w.json'),'utf8'));
  assert(a.assignments['Exercise-Control.Request']===3);
  assert(a.assignments['Exercise-Bike.Power(W)']===100);
  assert(b.assignments['Exercise-Control.Request']===3);
  assert(b.assignments['Exercise-Bike.Power(W)']===200);
});

test('perturbation summary detects HR above 120 without a fitted threshold response',()=>{
  const names=suite.requiredSeries;
  const variables={};
  for(const name of names) variables[name]=[1,1,1];
  variables['System.X']=[0,1/60,2/60];
  variables['Heart-Rate.Rate']=[72,121,118];
  variables['SANode-Rate.Rate']=[72,121,118];
  variables['CardiacOutput.Flow']=[5000,7000,6500];
  variables['CardiacOutput.StrokeVolume']=[70,80,75];
  variables['PeripheralResistance.TPR']=[0.018,0.014,0.015];
  variables['SystemicArtys.Pressure']=[95,100,98];
  variables['SympsCNS.NA(Hz)']=[1.5,3,2.8];
  variables['VagusNerve.NA(Hz)']=[2,1,1.1];
  variables['Baroreflex.NA']=[1,0.8,0.9];
  variables['LowPressureReceptors.NA']=[1,0.9,0.95];
  variables['ExerciseSymps.TotalEffect']=[0,1,0.8];
  variables['AdrenalNerve.NA(Hz)']=[2,4,3.5];
  variables['EpiPool.[Epi]']=[0.04,0.08,0.07];
  variables['NEPool.[NE]']=[0.24,0.4,0.35];
  variables['BloodVol.Vol']=[5000,5000,5000];
  variables['RightAtrium.Pressure']=[5,6,5.5];
  variables['PO2Artys.Pressure']=[90,85,88];
  variables['CO2Artys.Pressure']=[40,42,41];
  variables['BloodPh.ArtysPh']=[7.4,7.39,7.4];
  variables['Brain-Function.Effect']=[1,1,1];
  const extraction={sampleCount:3,variables};
  const out=summarize(extraction,{id:'fixture',scenarioClass:'test'});
  assert(out.heartRateExceeded120===true);
  assert(out.firstHeartRateAbove120Sec===1);
  assert(out.heartRate.max.value===121);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
