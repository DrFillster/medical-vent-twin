'use strict';

const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {
  extractAllVariables,
  verifyScenario,
  processRun07,
}=require('../scripts/postprocess-v13-native-run07.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}

const scenario={
  schema:'vent-hummod-native-scenario/v1',
  id:'synthetic-run07-test',
  scenarioClass:'test-fixture',
  assignments:{
    'Ventilator.Switch':1,
    'Ventilator.Rate':4,
    'Ventilator.TidalVolume':100,
    'AirSupply-GasTanks.Switch':1,
    'AirSupply-GasTanks.O2Valve(%)':20,
    'AirSupply-GasTanks.N2Valve(%)':80,
    'AirSupply-GasTanks.CO2Valve(%)':0,
    'AirSupply-GasTanks.COValve(PPM)':0,
    'AirSupply-GasTanks.AnestheticValve(%)':0,
  },
};

const vars={
  'System.X':[0,2.4,2.55,2.7],
  'Heart-Rate.Rate':[72,84,70,0],
  'CardiacOutput.Flow':[5500,4200,1800,0],
  'SANode-Rate.Rate':[72,84,72,72],
  'SANode-Rate.Is_SinusRhythm':[1,1,1,0],
  'Heart-Asystole.Is_Asystole':[0,0,0,1],
  'LeftHeart-CO2.PCO2':[45,55,70,85],
  'RightHeart-CO2.PCO2':[45,60,75,90],
  'LeftHeart-Lactate.[Lac-]':[1,3,8,14],
  'RightHeart-Lactate.[Lac-]':[1,4,9,16],
  'LeftHeart-Ph.[SID]':[40,37,33,29],
  'RightHeart-Ph.[SID]':[40,36,32,28],
  'LeftHeart-Ph.Ph':[7.1,6.9,6.7,6.6],
  'RightHeart-Ph.Ph':[7.1,6.85,6.65,6.55],
  'LeftHeart-Function.PhEffect':[1,1,1,0],
  'RightHeart-Function.PhEffect':[1,1,0.5,0],
  'LeftHeart-Function.FuelEffect':[1,0.98,0.96,0.94],
  'RightHeart-Function.FuelEffect':[1,0.97,0.95,0.93],
  'LeftHeart-Function.Effect':[1,0.8,0.3,0],
  'RightHeart-Function.Effect':[1,0.7,0.15,0],
  'LeftHeart-Function.Failed':[0,0,0,1],
  'RightHeart-Function.Failed':[0,0,0,1],
  'LeftHeart-Flow.BloodFlow':[200,180,120,0],
  'RightHeart-Flow.BloodFlow':[200,170,100,0],
  'LeftHeart-Flow.PO2':[40,30,20,10],
  'RightHeart-Flow.PO2':[40,28,18,8],
  'LeftHeart-Metabolism.O2Use':[10,10,8,0],
  'RightHeart-Metabolism.O2Use':[10,10,7,0],
  'LeftHeart-Metabolism.O2Need':[10,11,12,12],
  'RightHeart-Metabolism.O2Need':[10,11,12,12],
  'LeftHeart-Metabolism.O2Lack':[0,1,4,12],
  'RightHeart-Metabolism.O2Lack':[0,1,5,12],
  'LeftHeart-Metabolism.AnaerobicCals':[0,1,4,10],
  'RightHeart-Metabolism.AnaerobicCals':[0,1,5,11],
  'LeftHeart-Fuel.FractUse':[1,0.9,0.8,0.7],
  'RightHeart-Fuel.FractUse':[1,0.9,0.8,0.7],
  'LeftHeart-Fuel.FractUseDelay':[1,0.95,0.85,0.78],
  'RightHeart-Fuel.FractUseDelay':[1,0.94,0.84,0.77],
};

for(const [symbol,value] of Object.entries(scenario.assignments)){
  vars[symbol]=[value,value,value,value];
}

function solnText(){
  return '<solution>\n<index> 3 </index>\n'+Object.entries(vars).map(([name,values])=>
    '<var>\n<name> '+name+' </name>\n'+
    values.map(v=>'<val> '+String(v)+' </val>').join('\n')+
    '\n</var>').join('\n')+'\n</solution>\n';
}

test('lossless extraction retains every aligned native variable and raw numeric token',()=>{
  const out=extractAllVariables(solnText());
  assert(out.format==='lossless-numeric-extraction-of-native-SOLN');
  assert(out.sampleCount===4);
  assert(out.variableCount===Object.keys(vars).length);
  assert(out.variables['RightHeart-Ph.Ph'][3]===6.55);
  assert(out.rawNumericTokens['RightHeart-Ph.Ph'][3]==='6.55');
});

test('scenario verification checks the native assignment values',()=>{
  const out=verifyScenario(extractAllVariables(solnText()),scenario);
  assert(out.passed===true);
  assert(out.checks['Ventilator.Rate'].expected===4);
  assert(out.checks['AirSupply-GasTanks.O2Valve(%)'].observed===20);
});

test('run07 postprocessor creates and validates the required evidence set',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'run07-postprocess-'));
  fs.writeFileSync(path.join(dir,'Vent.SOLN'),solnText());
  fs.writeFileSync(path.join(dir,'native-export-status.json'),JSON.stringify({
    schema:'vent-hummod-native-export/v1',
    repository:'riliescu/hummod-standalone',
    revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
    advanceMenuLabel:'1 Sec',
    advanceCount:180,
    interAdvanceDelayMilliseconds:250,
    outputCaptured:true,
    executableSha256:'a'.repeat(64),
  },null,2));
  const scenarioPath=path.join(dir,'scenario.json');
  fs.writeFileSync(scenarioPath,JSON.stringify(scenario,null,2));

  const report=processRun07(dir,{scenarioPath});
  assert(report.ok===true);
  assert(report.terminalSec>153.365933);
  for(const name of [
    'native-all-variables.json',
    'scenario-verification.json',
    'myocardial-collapse-analysis.json',
    'run07-final-30s-checkpoints.csv',
    'source-and-executable-hashes.json',
    'run07-postprocess-status.json',
  ]){
    assert(fs.existsSync(path.join(dir,name)),name+' missing');
    assert(fs.statSync(path.join(dir,name)).size>0,name+' empty');
  }
  const analysis=JSON.parse(fs.readFileSync(path.join(dir,'myocardial-collapse-analysis.json'),'utf8'));
  assert(analysis.sourceMechanismChecks.leftFailureAndAsystoleSameSample===true);
});

test('run07 postprocessor rejects stale five-minute exporter status',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'run07-postprocess-bad-'));
  fs.writeFileSync(path.join(dir,'Vent.SOLN'),solnText());
  fs.writeFileSync(path.join(dir,'native-export-status.json'),JSON.stringify({
    revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
    advanceMenuLabel:'5 Min',
    advanceCount:1,
    interAdvanceDelayMilliseconds:250,
    outputCaptured:true,
    executableSha256:'b'.repeat(64),
  }));
  let threw=false;
  try{processRun07(dir,{scenarioPath:path.join(dir,'missing.json')});}
  catch(e){threw=/advanceMenuLabel/.test(e.message);}
  assert(threw,'expected run07 exporter-mode rejection');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
