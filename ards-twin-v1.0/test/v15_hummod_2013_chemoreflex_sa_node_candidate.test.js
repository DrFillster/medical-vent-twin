'use strict';

const assert=require('node:assert/strict');
const {
  SOURCE,P,CURVES,hermite,beta1Effect,alpha1Effect,
  createHumMod2013ChemoreflexSaNodeCandidate,
}=require('../src/hummod_2013_chemoreflex_sa_node_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-10){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('source identity and chemoreflex delay parameters are pinned',()=>{
  assert.equal(SOURCE.revision,'51d369eb75669e150ef7c61e3ba8bcb1e068aecf');
  assert.equal(P.chemoCnsOnsetTauMin,5);
  assert.equal(P.chemoCnsAdaptationTauDays,15);
  assert.equal(P.chemoSsPhKPerMin,0.0001);
  near(hermite(CURVES.chemoCnsEffect,-10),0.6);
  near(hermite(CURVES.chemoCnsEffect,0),1);
  near(hermite(CURVES.chemoCnsEffect,10),3);
});

test('newer source keeps distinct sympathetic branches and cardiac SA-node ownership',()=>{
  const c=createHumMod2013ChemoreflexSaNodeCandidate({ecfvMl:15000});
  c.runFor(60,{
    dtSec:0.1,
    arterialPo2MmHg:94,
    arterialPh:7.44,
  });
  const s=c.snapshot();
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert(Number.isFinite(s.sympathetic.adrenalHz));
  assert(Number.isFinite(s.sympathetic.cardiacHz));
  assert(Number.isFinite(s.sympathetic.generalHz));
  near(s.ganglia.cardiacHz,s.sympathetic.cardiacHz);
  near(s.ganglia.generalHz,s.sympathetic.generalHz);
  near(s.ganglia.adrenalHz,s.sympathetic.adrenalHz);
});

test('source Beta1 and Alpha1 receptor occupancy are finite at native pool targets',()=>{
  const beta=beta1Effect({nePgPerMl:240,epiPgPerMl:40});
  const alpha=alpha1Effect({nePgPerMl:240,epiPgPerMl:40});
  assert(Number.isFinite(beta)&&beta>=0);
  assert(Number.isFinite(alpha)&&alpha>=0);
});

test('hypoxia increases chemoreceptor firing and CNS sympathoexcitation',()=>{
  const c=createHumMod2013ChemoreflexSaNodeCandidate({ecfvMl:15000});
  c.runFor(600,{dtSec:0.1,arterialPo2MmHg:94,arterialPh:7.44});
  const b=c.snapshot();
  c.runFor(600,{dtSec:0.1,arterialPo2MmHg:30,arterialPh:7.44});
  const h=c.snapshot();
  assert(h.chemoreceptor.firingRate>b.chemoreceptor.firingRate);
  assert(h.chemoreceptorsCns.effect>b.chemoreceptorsCns.effect);
  assert(h.sympathetic.cardiacHz>b.sympathetic.cardiacHz);
});

test('acute acidemia enters through DeltaPh rather than absolute pH shortcut',()=>{
  const c=createHumMod2013ChemoreflexSaNodeCandidate({ecfvMl:15000});
  c.runFor(600,{dtSec:0.1,arterialPo2MmHg:94,arterialPh:7.44});
  const b=c.snapshot();
  c.runFor(60,{dtSec:0.1,arterialPo2MmHg:94,arterialPh:7.10});
  const a=c.snapshot();
  assert(a.deltaPh<0);
  assert(a.chemoreceptor.phEffect>b.chemoreceptor.phEffect);
  assert(a.chemoreceptor.firingRate>b.chemoreceptor.firingRate);
});

test('candidate remains numerically convergent across tested step sizes',()=>{
  function run(dtSec){
    const c=createHumMod2013ChemoreflexSaNodeCandidate({ecfvMl:15000});
    c.runFor(600,{dtSec,arterialPo2MmHg:94,arterialPh:7.44});
    c.runFor(600,{dtSec,arterialPo2MmHg:30,arterialPh:7.10});
    return c.snapshot().heartRatePerMin;
  }
  const coarse=run(0.2),reference=run(0.1),fine=run(0.05);
  const coarseError=Math.abs(coarse-fine);
  const referenceError=Math.abs(reference-fine);
  assert(referenceError<=coarseError+1e-8);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
