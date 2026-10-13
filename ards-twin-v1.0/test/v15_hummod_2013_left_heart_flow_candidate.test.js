'use strict';

const assert=require('node:assert/strict');
const {
  SMALL_CONDUCTANCE_PER_G,
  LARGE_CONDUCTANCE_PER_G,
  SYMPS_ON_CONDUCTANCE,
  ADH_ON_CONDUCTANCE,
  PO2_ON_AEROBIC_FRACTION,
  METABOLISM_ON_CONDUCTANCE,
  hermite,
  solveLeftHeartFlow2013,
}=require('../src/hummod_2013_left_heart_flow_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-10){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

const BASE={
  arterialPo2MmHg:90,
  initialLeftHeartMassG:300,
  pressureGradientMmHg:80,
  alphaReceptorActivity:1,
  adhPoolLog10Conc:0.8,
  o2NeedMlPerMin:40,
  viscosityConductanceEffect:1,
  anesthesiaVascularConductance:1,
  vasculatureEffect:1,
  infarctionEffect:1,
  arterialO2ContentMlPerMl:0.19,
  o2MaxMlPerMl:0.20,
  hgbP50:26.6,
  hgbScaleForSat:1.01,
  plasmaVolumeFraction:0.56,
};

test('2012/2013 coronary conductance constants and curves are preserved',()=>{
  near(SMALL_CONDUCTANCE_PER_G,0.00670);
  near(LARGE_CONDUCTANCE_PER_G,0.177508);
  near(hermite(SYMPS_ON_CONDUCTANCE,1),1);
  near(hermite(ADH_ON_CONDUCTANCE,0.8),1);
  near(hermite(PO2_ON_AEROBIC_FRACTION,2),0);
  near(hermite(PO2_ON_AEROBIC_FRACTION,10),1);
  near(hermite(METABOLISM_ON_CONDUCTANCE,30),1);
  near(hermite(METABOLISM_ON_CONDUCTANCE,100),3);
});

test('nominal coronary conductance scales with source initial left-heart mass',()=>{
  const a=solveLeftHeartFlow2013(BASE);
  const b=solveLeftHeartFlow2013({...BASE,initialLeftHeartMassG:600});
  near(b.nominalSmallConductance,2*a.nominalSmallConductance);
  near(b.nominalLargeConductance,2*a.nominalLargeConductance);
  assert(b.bloodFlowMlPerMin>a.bloodFlowMlPerMin);
});

test('pre-2025 imported HumMod coronary equation excludes NO effect',()=>{
  const s=solveLeftHeartFlow2013(BASE);
  assert.equal(Object.prototype.hasOwnProperty.call(s,'noEffect'),false);
});

test('coronary pressure gradient is an explicit live-coupling coordinate',()=>{
  const low=solveLeftHeartFlow2013({...BASE,pressureGradientMmHg:40});
  const high=solveLeftHeartFlow2013({...BASE,pressureGradientMmHg:80});
  assert(high.bloodFlowMlPerMin>low.bloodFlowMlPerMin);
});

test('solver reports non-DES numerical adaptation explicitly',()=>{
  const s=solveLeftHeartFlow2013(BASE);
  assert(Number.isFinite(s.po2MmHg));
  assert(Number.isFinite(s.o2UseMlPerMin));
  assert.equal(s.solver.exactDesSolverIdentity,false);
  assert.equal(s.controlAuthority,false);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
