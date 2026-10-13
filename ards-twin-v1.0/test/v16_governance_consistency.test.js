'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..','..');
const start=fs.readFileSync(path.join(root,'START_HERE.md'),'utf8');
const state=JSON.parse(fs.readFileSync(path.join(root,'candidate-state.json'),'utf8'));
const handoff=fs.readFileSync(path.join(root,'ards-twin-v1.0','HANDOFF.md'),'utf8');
const agents=fs.readFileSync(path.join(root,'AGENTS.md'),'utf8');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}

test('governance files agree on active branch/version',()=>{
  assert.equal(state.version,'1.6');
  assert.equal(state.branch,'v1.6');
  assert(start.includes('v1.6'));
  assert(handoff.startsWith('# CURRENT RECOVERY POINT'));
  assert(handoff.includes('v1.6'));
});

test('ARDS is the explicit current milestone',()=>{
  assert.match(state.current_milestone,/ARDS/i);
  assert.match(start,/finish the integrated ARDS candidate first/i);
  assert.match(handoff,/Finish the physician-testable integrated ARDS candidate first/i);
  assert.match(agents,/finish the physician-testable integrated ARDS candidate first/i);
});

test('sepsis and pressors remain deferred until ARDS candidate',()=>{
  assert(state.deferred_until_ards_candidate.includes('sepsis-vasoplegia-activation'));
  assert(state.deferred_until_ards_candidate.includes('pressor-drug-activation'));
  assert.match(agents,/do not activate sepsis\/vasoplegia/);
  assert.match(agents,/do not activate pressors\/inotropes/);
});

test('forbidden pulmonary shortcuts remain explicit',()=>{
  const joined=state.forbidden_shortcuts.join('\n');
  assert(joined.includes('FRC + Vent.totalVolume'));
  assert(joined.includes('perfusionFraction * recruitment'));
  assert(start.includes('FRC + Vent.totalVolume'));
  assert(start.includes('perfusionFraction * recruitment'));
});

test('startup read order includes all governance sources',()=>{
  for(const required of state.required_startup_reads){assert.equal(typeof required,'string');}
  assert(state.required_startup_reads.includes('START_HERE.md'));
  assert(state.required_startup_reads.includes('candidate-state.json'));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
