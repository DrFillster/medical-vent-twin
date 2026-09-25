#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const hummodRoot = process.argv[2];
const sessionDir = process.argv[3] ||
  path.resolve(process.cwd(), 'runtime', 'lung-water-perm-validation');

if (!hummodRoot) {
  throw new Error('usage: node lung-water-perm-validation.js <HumModRoot> [session-dir]');
}
fs.mkdirSync(sessionDir, { recursive: true });

const hostScript = path.resolve(__dirname, 'gas-grid-session-host.ps1');
const proc = spawn('pwsh', [
  '-NoProfile','-File',hostScript,
  '-HumModRoot',path.resolve(hummodRoot),
  '-SessionDirectory',path.resolve(sessionDir),
], { stdio:['pipe','pipe','inherit'] });

let buffer='';
const waiters=[];
proc.stdout.setEncoding('utf8');
proc.stdout.on('data', chunk => {
  buffer += chunk;
  while(buffer.includes('\n')){
    const i=buffer.indexOf('\n');
    const line=buffer.slice(0,i).trim();
    buffer=buffer.slice(i+1);
    if(!line) continue;
    let parsed;
    try{parsed=JSON.parse(line);}catch{continue;}
    const waiter=waiters.shift();
    if(waiter) waiter.resolve(parsed);
  }
});

function nextMessage(timeoutMs=120000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('timed out waiting for native host')),timeoutMs);
    waiters.push({resolve(v){clearTimeout(timer);resolve(v);}});
  });
}
async function command(payload,timeoutMs=180000){
  const pending=nextMessage(timeoutMs);
  proc.stdin.write(JSON.stringify(payload)+'\n');
  const r=await pending;
  if(!r.ok) throw new Error(r.error||'native command failed');
  return r;
}

const symbols=[
  'ExcessLungWater.Perm',
  'ExcessLungWater.Volume',
  'ExcessLungWater.Flux',
  'ExcessLungWater.Lymph',
  'PulmonaryMembrane.Thickness-H2O',
  'PulmonaryMembrane.Thickness',
  'PulmonaryMembrane.DiffusingCapacity',
  'PO2Artys.Pressure',
  'CO2Artys.Pressure',
  'BloodPh.ArtysPh',
];

async function main(){
  const ready=await nextMessage(45000);
  if(!ready.ok||ready.event!=='ready') throw new Error('native host did not become ready');

  await command({command:'initialize'});
  await command({command:'checkpoint',checkpointId:'lung-water-baseline'});
  const baseline=await command({command:'read',symbols});

  // Native baseline is 3.0. Use the next clearly higher repeat-list value.
  const requestedPerm=4.0;
  const liveSet=await command({
    command:'live-set',
    assignments:{'ExcessLungWater.Perm':requestedPerm},
  });

  const immediate=await command({command:'read',symbols});
  await command({command:'advance',durationSec:60},240000);
  const after60Sec=await command({command:'read',symbols},120000);

  await command({command:'restore',checkpointId:'lung-water-baseline'},120000);
  const restored=await command({command:'read',symbols},120000);
  await command({command:'terminate'},30000);

  const report={
    schema:'hummod-vent-core/lung-water-perm-validation/v1',
    provenance:{
      upstreamRevision:ready.upstreamRevision,
      executableSha256:ready.executableSha256,
      processId:ready.processId,
    },
    intervention:{requestedPerm,durationSec:60},
    baseline,
    liveSet,
    immediate,
    after60Sec,
    restored,
    deltas:{
      excessLungWaterVolume:
        after60Sec.state['ExcessLungWater.Volume']-baseline.state['ExcessLungWater.Volume'],
      capillaryFiltration:
        after60Sec.state['ExcessLungWater.Flux']-baseline.state['ExcessLungWater.Flux'],
      waterThickness:
        after60Sec.state['PulmonaryMembrane.Thickness-H2O']-baseline.state['PulmonaryMembrane.Thickness-H2O'],
      diffusingCapacity:
        after60Sec.state['PulmonaryMembrane.DiffusingCapacity']-baseline.state['PulmonaryMembrane.DiffusingCapacity'],
      pao2MmHg:
        after60Sec.state['PO2Artys.Pressure']-baseline.state['PO2Artys.Pressure'],
      paco2MmHg:
        after60Sec.state['CO2Artys.Pressure']-baseline.state['CO2Artys.Pressure'],
      ph:
        after60Sec.state['BloodPh.ArtysPh']-baseline.state['BloodPh.ArtysPh'],
    },
    checks:{
      sameProcessSession:true,
      liveSetReadbackMatches:
        Math.abs(liveSet.state['ExcessLungWater.Perm']-requestedPerm)<1e-9,
      survivesSolverAdvance:
        Math.abs(after60Sec.state['ExcessLungWater.Perm']-requestedPerm)<1e-9,
      checkpointRestoreExact:
        symbols.every(s=>restored.state[s]===baseline.state[s]),
    }
  };

  fs.writeFileSync(
    path.join(sessionDir,'lung-water-perm-validation.json'),
    JSON.stringify(report,null,2)+'\n'
  );
  console.log(JSON.stringify(report,null,2));

  if(!report.checks.liveSetReadbackMatches ||
     !report.checks.survivesSolverAdvance ||
     !report.checks.checkpointRestoreExact) process.exitCode=1;
}
main().catch(err=>{
  console.error(err);
  try{proc.kill();}catch{}
  process.exitCode=1;
});
