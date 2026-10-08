'use strict';
const {
  HEART_CONFIG,
  MEQ_ML_TO_MG_DL,
  GLUCOSE_TO_LACTATE,
  MG_TO_MEQ,
  calculateMyocardialLactateDerivatives,
}=require('../src/hummod_myocardial_lactate_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-12){assert(Math.abs(a-b)<=tol,a+' not near '+b);}

test('preserves left/right source diffusion asymmetry',()=>{
  near(HEART_CONFIG.left.diffusionConductance,18);
  near(HEART_CONFIG.right.diffusionConductance,3);
  near(HEART_CONFIG.left.initialMass,0.17);
  near(HEART_CONFIG.right.initialMass,0.03);
});

test('concentration conversions match HumMod source constants',()=>{
  const d=calculateMyocardialLactateDerivatives({
    side:'left',mass:0.17,liquidVolumeMl:100,
    anaerobicGlucoseUsedMgPerMin:0,lactateUsedMgPerMin:0,
    lactatePoolConcentration:0.001,dxMin:0.01,
  });
  near(d.concentration,0.0017);
  near(d.concentrationMeqPerL,1.7);
  near(d.concentrationMgDl,MEQ_ML_TO_MG_DL*0.0017);
});

test('lactate production from anaerobic glucose matches source',()=>{
  const d=calculateMyocardialLactateDerivatives({
    side:'left',mass:0.17,liquidVolumeMl:100,
    anaerobicGlucoseUsedMgPerMin:10,lactateUsedMgPerMin:0,
    lactatePoolConcentration:0.001,dxMin:0.01,
  });
  near(d.madeMgPerMin,GLUCOSE_TO_LACTATE*10);
  near(d.made,MG_TO_MEQ*d.madeMgPerMin);
});

test('undefined dx preserves source alpha zero branch',()=>{
  const d=calculateMyocardialLactateDerivatives({
    side:'right',mass:0.03,liquidVolumeMl:50,
    anaerobicGlucoseUsedMgPerMin:1,lactateUsedMgPerMin:0.5,
    lactatePoolConcentration:0.001,dxUndefined:true,
  });
  near(d.alpha,0);
});

test('large k*dx preserves source 4E-44 branch',()=>{
  const d=calculateMyocardialLactateDerivatives({
    side:'right',mass:0.03,liquidVolumeMl:0.01,
    anaerobicGlucoseUsedMgPerMin:1,lactateUsedMgPerMin:0.5,
    lactatePoolConcentration:0.001,dxMin:1,
  });
  near(d.alpha,4e-44,1e-50);
});

test('left and right hearts produce different outflux with same state',()=>{
  const common={
    mass:0.05,liquidVolumeMl:50,
    anaerobicGlucoseUsedMgPerMin:2,lactateUsedMgPerMin:1,
    lactatePoolConcentration:0.0005,dxMin:0.01,
  };
  const l=calculateMyocardialLactateDerivatives({side:'left',...common});
  const r=calculateMyocardialLactateDerivatives({side:'right',...common});
  assert(l.outflux!==r.outflux,'ventricular lactate flux must retain source asymmetry');
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
