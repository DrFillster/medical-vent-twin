'use strict';

const assert=require('node:assert/strict');
const {
  createHumMod2013MyocardialAcidBaseRuntime,
}=require('../src/hummod_2013_myocardial_acid_base_runtime.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-9){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

const BASE=Object.freeze({
  dtSec:0.1,
  liquidVolumeMl:100,
  intracellularPotassium:0.145,
  bloodFlowMlPerMin:200,
  plasmaFlowMlPerMin:112,
  o2UseMlPerMin:25,
  aerobicCalsPerMin:119.45,
  totalCalsUsedPerMin:140,
  insulinReceptorBoundFractionPercent:8,
  glucosePoolMgPerMl:1.10,
  fattyAcidPoolMgPerMl:0.160,
  lactatePoolMeqPerMl:0.0017,
  bloodSid:0.040,
  arterialHco3:0.024,
  respiratoryQuotient:0.8,
});

function make(){
  return createHumMod2013MyocardialAcidBaseRuntime({
    initialLiquidVolumeMl:100,
  });
}

test('runtime derives finite myocardial pHi and remains noncanonical',()=>{
  const r=make();
  const s=r.step(BASE);
  assert(Number.isFinite(s.myocardialIntracellularPh));
  assert(Number.isFinite(s.myocardialPco2MmHg));
  assert(Number.isFinite(s.myocardialSidMeqPerL));
  assert.equal(s.authority,'candidate-not-canonical');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.controlAuthority,false);
});

test('arterial pH is not a myocardial-pHi input',()=>{
  const a=make();
  const b=make();
  const sa=a.step({...BASE,arterialPh:7.44});
  const sb=b.step({...BASE,arterialPh:6.90});
  near(sa.myocardialIntracellularPh,sb.myocardialIntracellularPh);
  assert.equal(
    Object.prototype.hasOwnProperty.call(sa.inputs,'arterialPh'),
    false
  );
});

test('2013 source keeps anaerobic glucose use and local lactate production zero',()=>{
  const r=make();
  const s=r.step(BASE);
  assert.equal(s.fuel.anaerobicGlucoseUsedCalsPerMin,0);
  assert.equal(s.fuel.anaerobicGlucoseUsedMgPerMin,0);
  near(s.lactate.madeMgPerMin,0);
  near(s.lactate.madeMeqPerMin,0);
});

test('substrate inadequacy lowers fuel adequacy without inventing lactate production',()=>{
  const r=make();
  let s=null;
  for(let i=0;i<6000;i++){
    s=r.step({
      ...BASE,
      glucosePoolMgPerMl:0.001,
      fattyAcidPoolMgPerMl:0.001,
      lactatePoolMeqPerMl:0.000001,
    });
  }
  assert(s.fuelAdequacy<1);
  assert(s.fuelFractUseDelay<1);
  assert.equal(s.fuel.anaerobicGlucoseUsedMgPerMin,0);
  near(s.lactate.madeMgPerMin,0);
});

test('missing intracellular potassium or liquid volume fails closed',()=>{
  const r=make();
  const noK={...BASE};
  delete noK.intracellularPotassium;
  assert.throws(()=>r.step(noK),/intracellularPotassium/);

  const noVol={...BASE};
  delete noVol.liquidVolumeMl;
  assert.throws(()=>r.step(noVol),/liquidVolumeMl/);
});

test('composed myocardial-pHi trajectory converges with timestep refinement',()=>{
  function run(dtSec){
    const r=createHumMod2013MyocardialAcidBaseRuntime({
      initialLiquidVolumeMl:100,
    });
    const n=Math.round(300/dtSec);
    for(let i=0;i<n;i++){
      r.step({...BASE,dtSec});
    }
    return r.snapshot();
  }
  const coarse=run(1);
  const medium=run(0.2);
  const fine=run(0.1);
  assert(
    Math.abs(medium.myocardialIntracellularPh-fine.myocardialIntracellularPh) <
    Math.abs(coarse.myocardialIntracellularPh-fine.myocardialIntracellularPh)
  );
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
