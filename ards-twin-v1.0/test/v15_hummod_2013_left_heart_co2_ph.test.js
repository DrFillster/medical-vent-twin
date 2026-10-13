'use strict';

const assert=require('node:assert/strict');
const {
  CELL_PH_PK,
  TISSUE_CO2_P50_MMHG,
  TISSUE_CO2_K_MULTIPLIER,
  INITIAL_PCO2_MMHG,
  INITIAL_SID,
  BLOOD_CO2_K_MULTIPLIER,
  LITERS_TO_MOLS,
  pco2ToHco3,
  hco3ToPco2,
  myocardialSid2013,
  cellPh2013,
  initialLeftHeartCo2Mass2013,
  createHumMod2013LeftHeartCo2Ph,
}=require('../src/hummod_2013_left_heart_co2_ph.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function near(a,b,tol=1e-9){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),
    a+' not near '+b);
}

test('source CO2 and cell-pH constants are preserved',()=>{
  near(CELL_PH_PK,7.15);
  near(TISSUE_CO2_P50_MMHG,32);
  near(TISSUE_CO2_K_MULTIPLIER,0.760);
  near(INITIAL_PCO2_MMHG,60);
  near(INITIAL_SID,0.036);
  near(BLOOD_CO2_K_MULTIPLIER,1.09);
  near(LITERS_TO_MOLS,0.0446);
});

test('source rational HCO3-PCO2 mappings invert each other in interior domain',()=>{
  const k=0.760*0.036;
  const h=pco2ToHco3({pCO2MmHg:60,k,p50MmHg:32});
  const p=hco3ToPco2({hco3:h,k,p50MmHg:32});
  near(p,60);
});

test('CO2 initial mass is derived from initial pCO2 SID and liquid volume',()=>{
  const i=initialLeftHeartCo2Mass2013({initialLiquidVolumeMl:100});
  const k=0.760*0.036;
  const h=k*(60/(32+60));
  near(i.initialHco3,h);
  near(i.initialMass,h*100);
});

test('source myocardial SID and PhCells algebra are preserved',()=>{
  const sid=myocardialSid2013({
    intracellularPotassium:0.145,
    myocardialLactateMeqPerMl:0.0017,
  });
  near(sid.sid,0.145+0.012-0.117-0.0017);
  const ph=cellPh2013({
    pCO2MmHg:60,
    sidMeqPerL:sid.sidMeqPerL,
  });
  near(ph.pH,7.15+Math.log10(sid.sidMeqPerL/60));
});

test('CO2 runtime reports non-DES numerical adaptation explicitly',()=>{
  const c=createHumMod2013LeftHeartCo2Ph({initialLiquidVolumeMl:100});
  const s=c.step({
    dtSec:1,
    liquidVolumeMl:100,
    intracellularPotassium:0.145,
    myocardialLactateMeqPerMl:0.0017,
    bloodFlowMlPerMin:200,
    o2UseMlPerMin:25,
    bloodSid:0.040,
    arterialHco3:0.024,
    respiratoryQuotient:0.8,
  });
  assert(Number.isFinite(s.intracellularPh));
  assert(Number.isFinite(s.pCO2MmHg));
  assert.equal(s.numericalImplementation.exactDesIntegratorIdentity,false);
  assert.equal(s.controlAuthority,false);
});

test('fixed-step CO2/pHi trajectory converges with timestep refinement',()=>{
  function run(dtSec){
    const c=createHumMod2013LeftHeartCo2Ph({initialLiquidVolumeMl:100});
    const n=Math.round(300/dtSec);
    for(let i=0;i<n;i++){
      c.step({
        dtSec,
        liquidVolumeMl:100,
        intracellularPotassium:0.145,
        myocardialLactateMeqPerMl:0.0017,
        bloodFlowMlPerMin:200,
        o2UseMlPerMin:25,
        bloodSid:0.040,
        arterialHco3:0.024,
        respiratoryQuotient:0.8,
      });
    }
    return c.snapshot().intracellularPh;
  }
  const coarse=run(1),medium=run(0.2),fine=run(0.1);
  assert(Math.abs(medium-fine)<Math.abs(coarse-fine));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
