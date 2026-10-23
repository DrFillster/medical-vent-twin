'use strict';

const {
  createV21PulmonaryVascularController,
}=require('../src/v21_pulmonary_vascular_controller.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed+=1;}
  catch(e){console.error('FAIL -',name,':',e.message);failed+=1;}
}
function assert(cond,msg){if(!cond) throw new Error(msg||'assertion failed');}

function stepMany(c,n,input){
  let s;
  for(let i=0;i<n;i++) s=c.step({dtSec:0.1,...input});
  return s;
}

test('baseline pulmonary vascular projection is finite and normalized',()=>{
  const c=createV21PulmonaryVascularController({dtSec:0.0005});
  const s=stepMany(c,20,{
    meanAirwayPressureCmH2O:8,
    arterialPo2MmHg:90,
    mixedVenousPo2MmHg:40,
    arterialPco2MmHg:40,
    arterialPh:7.40,
  });
  [
    s.pulmonaryArterialConductanceMultiplier,
    s.totalResistanceRatio,
    s.coordinate.alveolarVolumeL,
  ].forEach(v=>assert(Number.isFinite(v),'expected finite value'));
  assert(s.pulmonaryArterialConductanceMultiplier>0);
  assert(s.provenance.clinicalValidation===false);
});

test('higher airway pressure increases Karamolegkos mechanical pulmonary load',()=>{
  const c=createV21PulmonaryVascularController({dtSec:0.0005});
  const b=stepMany(c,30,{
    meanAirwayPressureCmH2O:8,
    arterialPo2MmHg:90,
    mixedVenousPo2MmHg:40,
    arterialPco2MmHg:40,
    arterialPh:7.40,
  });
  const h=stepMany(c,50,{
    meanAirwayPressureCmH2O:20,
    arterialPo2MmHg:90,
    mixedVenousPo2MmHg:40,
    arterialPco2MmHg:40,
    arterialPh:7.40,
  });
  assert(h.coordinate.alveolarVolumeL>b.coordinate.alveolarVolumeL,
    'higher airway pressure should raise source-coordinate alveolar volume');
  assert(h.mechanicalResistanceRatio>b.mechanicalResistanceRatio,
    'higher alveolar volume should increase Karamolegkos arteriolar resistance');
});

test('hypoxia plus hypercapnic acidemia increases total PVR load and lowers conductance',()=>{
  const c=createV21PulmonaryVascularController({dtSec:0.0005});
  const b=stepMany(c,30,{
    meanAirwayPressureCmH2O:8,
    arterialPo2MmHg:90,
    mixedVenousPo2MmHg:40,
    arterialPco2MmHg:40,
    arterialPh:7.40,
  });
  const s=stepMany(c,30,{
    meanAirwayPressureCmH2O:8,
    arterialPo2MmHg:35,
    mixedVenousPo2MmHg:25,
    arterialPco2MmHg:100,
    arterialPh:7.10,
  });
  assert(s.hpvResistanceRatio>b.hpvResistanceRatio,
    'hypoxia should increase the Marshall HPV component');
  assert(s.hypercapnicAcidosisResistanceRatio>1,
    'hypercapnic acidemia should increase the bounded HCA PVR component');
  assert(s.totalResistanceRatio>b.totalResistanceRatio,
    'combined pulmonary load should increase');
  assert(s.pulmonaryArterialConductanceMultiplier<
    b.pulmonaryArterialConductanceMultiplier,
    'higher PVR load should reduce projected pulmonary conductance');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
