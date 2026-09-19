'use strict';

const { getBerlinCase } = require('../src/berlin_case_catalog.js');
const { makePatientParams } = require('../src/contracts.js');
const { Simulation, VcAcController } = require('../src/simulation.js');

let passed=0, failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}

test('near-closed recruitable compartment does not poison global solver scaling',()=>{
  const clinicalCase=getBerlinCase('berlin-moderate-moderate-aspiration');
  const params=makePatientParams(clinicalCase.phenotype.mechanicsParams);
  const controller=new VcAcController({
    fio2:0.60,
    peep:14,
    rr:20,
    vt:0.42,
    inspiratoryFlow:0.70,
    inspiratoryPause:0.20,
  });
  const sim=new Simulation({
    params,
    controller,
    dt:0.002,
    trackGas:false,
    initialPEEP:14,
    initialRecruitmentState:{
      normal:1,
      recruitable:1e-8,
      consolidated:0,
    },
  });

  sim.runFor(5);
  assert(sim.state.t>=5);
  assert(Number.isFinite(sim.state.totalVolume));
  assert(sim.state.compartments.every(c=>Number.isFinite(c.volume)));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
