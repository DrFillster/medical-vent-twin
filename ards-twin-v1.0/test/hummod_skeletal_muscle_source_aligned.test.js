'use strict';

const {setupHgbProps}=require('../src/hummod_hgb_tissue_source_aligned.js');
const {
  BASIC_CONDUCTANCE,
  IMPLICIT_ERROR_LIMIT_MMHG,
  A2_ON_CONDUCTANCE,
  SYMPS_ON_CONDUCTANCE,
  PO2_ON_CONDUCTANCE,
  ADH_ON_CONDUCTANCE,
  PO2_ON_AEROBIC_FRACTION,
  solveSkeletalMuscleFlow,
}=require('../src/hummod_skeletal_muscle_flow_source_aligned.js');
const {
  skeletalMusclePumpingEffect,
  createSkeletalMuscleMetabolicVasodilation,
}=require('../src/hummod_skeletal_muscle_vascular_source_aligned.js');
const {
  skeletalMuscleMetabolism,
}=require('../src/hummod_skeletal_muscle_metabolism_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-9){if(Math.abs(a-b)>tol)throw new Error(a+' not near '+b);}

test('preserves HumMod skeletal muscle flow constants and curve knots',()=>{
  near(BASIC_CONDUCTANCE,7.2);
  near(IMPLICIT_ERROR_LIMIT_MMHG,0.38);
  assert(A2_ON_CONDUCTANCE[1].x===1.3&&A2_ON_CONDUCTANCE[1].y===1);
  assert(SYMPS_ON_CONDUCTANCE[1].x===1&&SYMPS_ON_CONDUCTANCE[1].y===1);
  assert(PO2_ON_CONDUCTANCE[2].x===35&&PO2_ON_CONDUCTANCE[2].y===1);
  assert(ADH_ON_CONDUCTANCE[0].x===0.8&&ADH_ON_CONDUCTANCE[0].y===1);
  assert(PO2_ON_AEROBIC_FRACTION[2].x===20&&PO2_ON_AEROBIC_FRACTION[2].y===1);
});

test('skeletal muscle metabolism adds work calories to basal demand',()=>{
  const rest=skeletalMuscleMetabolism({muscleMassG:28000});
  const work=skeletalMuscleMetabolism({
    muscleMassG:28000,
    workTotalCalsPerMin:1000,
  });
  assert(work.totalCalsUsed>rest.totalCalsUsed);
  assert(work.o2NeedMlPerMin>rest.o2NeedMlPerMin);
});

test('local muscle pumping rises with exercise motion and contraction rate',()=>{
  const rest=skeletalMusclePumpingEffect({motionWatts:0,contractionRatePerMin:0});
  const exercise=skeletalMusclePumpingEffect({motionWatts:100,contractionRatePerMin:50});
  near(rest.effect,1);
  assert(exercise.effect>rest.effect);
});

test('metabolic vasodilation follows source on/off time constants',()=>{
  const d=createSkeletalMuscleMetabolicVasodilation();
  const on=d.step({dtSec:12,o2NeedMlPerMin:1000});
  assert(on.effect>1);
  assert(on.tauMin===0.2);
  const before=on.effect;
  const off=d.step({dtSec:12,o2NeedMlPerMin:50});
  assert(off.effect<before);
  assert(off.tauMin===1.0);
});

test('skeletal muscle implicit flow solves source tissue-PO2 relation',()=>{
  const hgb=setupHgbProps({
    tempC:37,
    pH:7.38,
    pCO2MmHg:45,
    carboxyPercent:0,
  });
  const s=solveSkeletalMuscleFlow({
    arterialPo2MmHg:90,
    pressureGradientMmHg:90,
    alphaReceptorActivity:1,
    a2PoolLog10Conc:1.3,
    adhPoolLog10Conc:0.8,
    o2NeedMlPerMin:40,
    metabolicVasodilationEffect:1,
    viscosityConductanceEffect:1,
    anesthesiaVascularConductance:1,
    vasculatureEffect:1,
    musclePumpingEffect:1,
    arterialO2ContentMlPerMl:0.20,
    o2MaxMlPerMl:0.20,
    hgbP50:hgb.p50,
    hgbScaleForSat:hgb.scaleForSat,
    plasmaVolumeFraction:0.56,
  });
  assert(s.solver.converged,'implicit muscle-flow solver did not converge');
  assert(Math.abs(s.residualMmHg)<=IMPLICIT_ERROR_LIMIT_MMHG);
  assert(s.bloodFlowMlPerMin>0);
  assert(s.o2UseMlPerMin>0);
  assert(s.plasmaFlowMlPerMin>0);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
