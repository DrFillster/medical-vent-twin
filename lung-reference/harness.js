#!/usr/bin/env node
'use strict';
const fs=require('fs');
const M=require('./lung.js');
const A=require('./app.js');

function record(req) {
  const {lung,vent,gas,history}=A.configuration(req.config);
  let state=M.emptyState(lung);
  const states=history.map(p=>{state=M.stepPeep(lung,state,p);return [...state];});
  const hi=M.stateAfter(lung,[30,15]);
  const lo=M.stepPeep(lung,hi,Math.max(5,lung.cfg.aop));
  let ts=M.stateAfter(lung,[30]);
  const trialStates=[20,18,16,14,12,10,8,6,4].map(p=>{ts=M.stepPeep(lung,ts,p);return [...ts];});
  const capture=fn=>{try{return {ok:true,data:fn()};}catch(e){return {ok:false,error:e.message};}};
  return {
    snapshot:capture(()=>M.evaluate(lung,vent,gas,history)),
    mechanics:capture(()=>M.mechanics(lung,vent,state,req.work_n||240,!!req.trace)),
    gas:capture(()=>M.gasExchange(lung,vent,state,gas)),
    ri:capture(()=>M.riAnalogue(lung,vent.cfg.vt)),
    trial:capture(()=>M.peepTrial(lung,vent)),
    states,ri_states:[hi,lo],trial_states:trialStates
  };
}
function main() {
  const args=process.argv.slice(2);
  if(args[0]==='--batch') {
    const requests=JSON.parse(fs.readFileSync(0,'utf8'));
    console.log(JSON.stringify(requests.map(r=>record(r))));return;
  }
  const opts={};
  for(let i=0;i<args.length;i+=2){
    if(!['--case','--config','--history'].includes(args[i])||args[i+1]===undefined)
      throw new Error('Usage: node harness.js --case "Injury C" [--history "30,14"] OR --config file.json');
    opts[args[i]]=args[i+1];
  }
  let config=opts['--config']?JSON.parse(fs.readFileSync(opts['--config'],'utf8')):A.caseConfig(opts['--case']||'Baseline');
  if(opts['--history'])config={...config,history:A.historyFrom(opts['--history'],config.vent.peep)};
  console.log(JSON.stringify(A.runScenario(config),null,2));
}
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={record};
