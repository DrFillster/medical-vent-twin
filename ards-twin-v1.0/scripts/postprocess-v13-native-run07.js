#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const { HUMMOD_NATIVE_MUTABLE_PARAMETERS }=require('../src/hummod_native_scenario.js');
const { analyze }=require('./analyze-v13-native-myocardial-collapse.js');
const { analyze:replayMyocardialEquations }=require('./compare-v13-native-myocardial-equations.js');
const { build:buildCheckpoints }=require('./build-v13-run07-checkpoints.js');

const PINNED_SOURCE={
  repository:'riliescu/hummod-standalone',
  revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
};

const REQUIRED_ARTIFACTS=[
  'Vent.SOLN',
  'native-all-variables.json',
  'scenario-verification.json',
  'native-export-status.json',
  'myocardial-collapse-analysis.json',
  'myocardial-equation-replay.json',
  'run07-final-30s-checkpoints.csv',
  'source-and-executable-hashes.json',
];

function sha256File(file){
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function decodeXmlEntity(text){
  return text
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"')
    .replace(/&apos;/g,"'");
}

function parseFinite(raw,label){
  const s=raw.trim();
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)){
    throw new Error(label+' is not a strict numeric token');
  }
  const value=Number(s);
  if(!Number.isFinite(value)) throw new Error(label+' is nonfinite');
  return value;
}

function extractAllVariables(solnText){
  if(typeof solnText!=='string'||!solnText.length) throw new Error('native SOLN text required');
  if(!/<solution>[\s\S]*<\/solution>/.test(solnText)) throw new Error('invalid HumMod SOLN envelope');
  const indexMatch=solnText.match(/<index>\s*(\d+)\s*<\/index>/);
  if(!indexMatch) throw new Error('native SOLN index is required');
  const index=Number(indexMatch[1]);
  const sampleCount=index+1;
  const variables={};
  const rawVariables={};
  const varRe=/<var>\s*<name>\s*([\s\S]*?)\s*<\/name>([\s\S]*?)<\/var>/g;
  let match;
  while((match=varRe.exec(solnText))!==null){
    const name=decodeXmlEntity(match[1].trim());
    if(!name) throw new Error('native SOLN contains empty variable name');
    if(Object.prototype.hasOwnProperty.call(variables,name)) throw new Error('duplicate native variable: '+name);
    const numeric=[];
    const raw=[];
    const valRe=/<val>\s*([\s\S]*?)\s*<\/val>/g;
    let vm;
    while((vm=valRe.exec(match[2]))!==null){
      const token=vm[1].trim();
      raw.push(token);
      numeric.push(parseFinite(token,name+' value '+numeric.length));
    }
    if(numeric.length!==sampleCount){
      throw new Error(name+' has '+numeric.length+' values; expected '+sampleCount);
    }
    variables[name]=numeric;
    rawVariables[name]=raw;
  }
  if(!Object.keys(variables).length) throw new Error('native SOLN contains no variables');
  if(!variables['System.X']) throw new Error('native SOLN missing System.X');
  for(let i=1;i<variables['System.X'].length;i++){
    if(!(variables['System.X'][i]>variables['System.X'][i-1])){
      throw new Error('System.X must be strictly increasing at sample '+i);
    }
  }
  return {
    format:'lossless-numeric-extraction-of-native-SOLN',
    schema:'hummod-native-all-variables/v1',
    index,
    sampleCount,
    variableCount:Object.keys(variables).length,
    variables,
    rawNumericTokens:rawVariables,
  };
}

function verifyScenario(extraction,scenario){
  if(!scenario||typeof scenario!=='object'||!scenario.assignments) throw new Error('scenario assignments required');
  const checks={};
  let passed=true;
  for(const [symbol,expected] of Object.entries(scenario.assignments)){
    const values=extraction.variables[symbol];
    if(!Array.isArray(values)||!values.length){
      checks[symbol]={passed:false,expected,error:'symbol missing from native SOLN'};
      passed=false;
      continue;
    }
    const meta=HUMMOD_NATIVE_MUTABLE_PARAMETERS[symbol];
    const persistence=meta?.persistence||'unknown';
    const verificationSampleIndex=persistence==='dynamic-state'?0:values.length-1;
    const observed=values[verificationSampleIndex];
    const tolerance=Math.max(1e-9,Math.abs(Number(expected))*1e-9);
    const ok=Number.isFinite(observed)&&Math.abs(observed-Number(expected))<=tolerance;
    checks[symbol]={
      passed:ok,
      expected:Number(expected),
      observed,
      verificationSampleIndex,
      persistence,
      finalValue:values[values.length-1],
      tolerance,
    };
    if(!ok) passed=false;
  }
  return {
    schema:'hummod-v13-run07-scenario-verification/v1',
    scenarioId:scenario.id||null,
    scenarioClass:scenario.scenarioClass||null,
    passed,
    checks,
  };
}

function validateExportStatus(status){
  if(!status||typeof status!=='object') throw new Error('native-export-status.json must contain an object');
  if(status.revision!==PINNED_SOURCE.revision) throw new Error('native exporter revision does not match pinned HumMod revision');
  if(status.advanceMenuLabel!=='1 Sec') throw new Error('run07 requires advanceMenuLabel = 1 Sec');
  if(Number(status.advanceCount)!==180) throw new Error('run07 requires advanceCount = 180');
  if(Number(status.interAdvanceDelayMilliseconds)!==250) throw new Error('run07 requires 250 ms inter-advance delay');
  if(!status.outputCaptured) throw new Error('native exporter did not report outputCaptured=true');
  if(!/^[0-9a-f]{64}$/i.test(String(status.executableSha256||''))) throw new Error('native exporter executable SHA-256 missing or invalid');
}

function validateTerminalTime(extraction,minSec=153.365933){
  const clock=extraction.variables['System.X'];
  const terminalSec=clock[clock.length-1]*60;
  if(!(terminalSec>minSec)){
    throw new Error('run07 terminal time '+terminalSec+' sec did not pass prior terminal time '+minSec+' sec');
  }
  return terminalSec;
}

function processRun07(runDir,{scenarioPath}={}){
  const dir=path.resolve(runDir);
  const solnPath=path.join(dir,'Vent.SOLN');
  const statusPath=path.join(dir,'native-export-status.json');
  if(!fs.existsSync(solnPath)) throw new Error('missing Vent.SOLN');
  if(!fs.existsSync(statusPath)) throw new Error('missing native-export-status.json');

  const status=JSON.parse(fs.readFileSync(statusPath,'utf8'));
  validateExportStatus(status);

  const scenarioFile=scenarioPath||path.resolve(__dirname,'..','hummod-runner','native-v13-myocardial-collapse-probe.json');
  const scenario=JSON.parse(fs.readFileSync(scenarioFile,'utf8'));

  const extraction=extractAllVariables(fs.readFileSync(solnPath,'utf8'));
  const terminalSec=validateTerminalTime(extraction);
  const extractionPath=path.join(dir,'native-all-variables.json');
  fs.writeFileSync(extractionPath,JSON.stringify(extraction,null,2)+'\n');

  const scenarioVerification=verifyScenario(extraction,scenario);
  if(!scenarioVerification.passed){
    throw new Error('native run07 scenario verification failed');
  }
  const scenarioVerificationPath=path.join(dir,'scenario-verification.json');
  fs.writeFileSync(scenarioVerificationPath,JSON.stringify(scenarioVerification,null,2)+'\n');

  const analysis=analyze(extraction);
  const analysisPath=path.join(dir,'myocardial-collapse-analysis.json');
  fs.writeFileSync(analysisPath,JSON.stringify(analysis,null,2)+'\n');

  const equationReplay=replayMyocardialEquations(extraction);
  const equationReplayPath=path.join(dir,'myocardial-equation-replay.json');
  fs.writeFileSync(equationReplayPath,JSON.stringify(equationReplay,null,2)+'\n');

  const checkpoints=buildCheckpoints(extraction,30);
  const checkpointPath=path.join(dir,'run07-final-30s-checkpoints.csv');
  fs.writeFileSync(checkpointPath,checkpoints.csv);

  const hashes={
    schema:'hummod-v13-run07-provenance/v1',
    nativeSource:PINNED_SOURCE,
    executableSha256:String(status.executableSha256).toLowerCase(),
    ventSolnSha256:sha256File(solnPath),
    nativeExportStatusSha256:sha256File(statusPath),
    scenarioFile:path.relative(path.resolve(__dirname,'..'),scenarioFile),
    scenarioFileSha256:sha256File(scenarioFile),
  };
  const hashesPath=path.join(dir,'source-and-executable-hashes.json');
  fs.writeFileSync(hashesPath,JSON.stringify(hashes,null,2)+'\n');

  const missing=REQUIRED_ARTIFACTS.filter(name=>!fs.existsSync(path.join(dir,name))||fs.statSync(path.join(dir,name)).size===0);
  if(missing.length) throw new Error('run07 required artifacts missing/empty: '+missing.join(', '));

  const report={
    schema:'hummod-v13-run07-postprocess/v1',
    ok:true,
    runDir:dir,
    sampleCount:extraction.sampleCount,
    variableCount:extraction.variableCount,
    terminalSec,
    asystoleSec:analysis.terminalTimestampSec,
    equationReplayMaxima:equationReplay.maxima,
    checkpointRows:checkpoints.rows.length,
    requiredArtifacts:REQUIRED_ARTIFACTS.slice(),
  };
  fs.writeFileSync(path.join(dir,'run07-postprocess-status.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}

if(require.main===module){
  const runDir=process.argv[2];
  if(!runDir) throw new Error('usage: node scripts/postprocess-v13-native-run07.js <run07-output-dir> [scenario.json]');
  const report=processRun07(runDir,{scenarioPath:process.argv[3]});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}

module.exports={
  PINNED_SOURCE,
  REQUIRED_ARTIFACTS,
  extractAllVariables,
  verifyScenario,
  validateExportStatus,
  validateTerminalTime,
  processRun07,
};
