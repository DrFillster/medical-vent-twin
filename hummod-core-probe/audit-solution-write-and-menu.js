#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const hummodRoot = process.argv[2];
const sessionDir = process.argv[3] ||
  path.resolve(process.cwd(), 'runtime', 'solution-write-audit');

if (!hummodRoot) {
  throw new Error(
    'usage: node scripts/audit-solution-write-and-menu.js <HumModRoot> [session-dir]'
  );
}
fs.mkdirSync(sessionDir, { recursive: true });

const proc = spawn(
  'pwsh',
  [
    '-NoProfile',
    '-File', path.resolve(__dirname, 'audit-session-host.ps1'),
    '-HumModRoot', path.resolve(hummodRoot),
    '-SessionDirectory', path.resolve(sessionDir),
  ],
  { stdio: ['pipe', 'pipe', 'inherit'] }
);

let buffer='';
const waiters=[];
proc.stdout.setEncoding('utf8');
proc.stdout.on('data',chunk=>{
  buffer+=chunk;
  while(buffer.includes('\n')){
    const i=buffer.indexOf('\n');
    const line=buffer.slice(0,i).trim();
    buffer=buffer.slice(i+1);
    if(!line) continue;
    let msg;
    try{msg=JSON.parse(line);}catch{continue;}
    const waiter=waiters.shift();
    if(waiter) waiter.resolve(msg);
  }
});

function nextMessage(timeoutMs=60000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(
      ()=>reject(new Error('timed out waiting for native host response')),
      timeoutMs
    );
    waiters.push({resolve(v){clearTimeout(timer);resolve(v);}});
  });
}

async function command(payload,timeoutMs=60000){
  const pending=nextMessage(timeoutMs);
  proc.stdin.write(JSON.stringify(payload)+'\n');
  const response=await pending;
  if(!response.ok) throw new Error(response.error||'native command failed');
  return response;
}

const symbols=[
  'Ventilator.Switch',
  'Ventilator.Rate',
  'Ventilator.TidalVolume',
  'AirSupply-GasTanks.Switch',
  'AirSupply-GasTanks.O2Valve(%)',
  'AirSupply-GasTanks.N2Valve(%)',
  'AirSupply-GasTanks.CO2Valve(%)',
];

async function main(){
  const ready=await nextMessage(30000);
  if(!ready.ok||ready.event!=='ready') throw new Error('native host not ready');

  await command({command:'initialize'});
  const baseline=await command({command:'read',symbols});

  const setResponse=await command({
    command:'set',
    assignments:{
      'Ventilator.Switch':1,
      'Ventilator.Rate':12,
      'Ventilator.TidalVolume':500,
      'AirSupply-GasTanks.Switch':1,
      'AirSupply-GasTanks.O2Valve(%)':40,
      'AirSupply-GasTanks.N2Valve(%)':60,
      'AirSupply-GasTanks.CO2Valve(%)':0,
    },
  });

  const immediate=await command({command:'read',symbols});
  await command({command:'advance',durationSec:1});
  const afterAdvance=await command({command:'read',symbols});
  const menu=await command({command:'inspect-menu'});
  await command({command:'terminate'},30000);

  const expected={
    'Ventilator.Switch':1,
    'Ventilator.Rate':12,
    'Ventilator.TidalVolume':500,
    'AirSupply-GasTanks.Switch':1,
    'AirSupply-GasTanks.O2Valve(%)':40,
    'AirSupply-GasTanks.N2Valve(%)':60,
    'AirSupply-GasTanks.CO2Valve(%)':0,
  };

  const persisted={};
  for(const symbol of symbols){
    persisted[symbol]=afterAdvance.state[symbol]===expected[symbol];
  }

  const relevantMenu=menu.items.filter(item=>
    /ventilat|thorax|lung|clinic|physiology|pneumo/i.test(item.path)
  );

  const report={
    schema:'hummod-vent-core/solution-write-audit/v1',
    ready,
    baseline,
    setResponse,
    immediate,
    afterAdvance,
    persisted,
    allPersisted:Object.values(persisted).every(Boolean),
    relevantMenu,
    fullMenu:menu.items,
  };

  fs.writeFileSync(
    path.join(sessionDir,'solution-write-audit.json'),
    JSON.stringify(report,null,2)+'\n'
  );
  console.log(JSON.stringify(report,null,2));
}

main().catch(error=>{
  console.error(error);
  try{proc.kill();}catch{}
  process.exitCode=1;
});
