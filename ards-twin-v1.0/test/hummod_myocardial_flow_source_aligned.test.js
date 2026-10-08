'use strict';
const {
  HEART_FLOW_CONFIG,
  IMPLICIT_ERROR_LIMIT_MMHG,
  SYMPS_ON_CONDUCTANCE,
  PO2_ON_CONDUCTANCE,
  ADH_ON_CONDUCTANCE,
  PO2_ON_AEROBIC_FRACTION,
  METABOLISM_ON_CONDUCTANCE,
  hermite,
  solveMyocardialFlow,
}=require('../src/hummod_myocardial_flow_source_aligned.js');
const {
  setupHgbProps,
}=require('../src/hummod_hgb_tissue_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-10){assert(Math.abs(a-b)<=tol,a+' not near '+b);}

test('preserves native myocardial flow constants and curve knots',()=>{
  near(HEART_FLOW_CONFIG.left.smallVesselBasicConductance,2.2);
  near(HEART_FLOW_CONFIG.left.largeVesselBasicConductance,50);
  near(HEART_FLOW_CONFIG.right.smallVesselBasicConductance,0.4);
  near(HEART_FLOW_CONFIG.right.largeVesselBasicConductance,10);
  near(IMPLICIT_ERROR_LIMIT_MMHG,0.17);
  near(hermite(SYMPS_ON_CONDUCTANCE,1),1);
  near(hermite(PO2_ON_CONDUCTANCE,17),1);
  near(hermite(ADH_ON_CONDUCTANCE,0.8),1);
  near(hermite(PO2_ON_AEROBIC_FRACTION,10),1);
  near(hermite(METABOLISM_ON_CONDUCTANCE,30),1);
});

test('implicit solver respects native PO2 search bounds and residual tolerance',()=>{
  const h=setupHgbProps({tempC:37,pH:7.35,pCO2MmHg:45,carboxyPercent:0.4});
  const s=solveMyocardialFlow({
    side:'left',
    arterialPo2MmHg:90,
    pressureGradientMmHg:90,
    alphaReceptorActivity:1,
    adhPoolLog10Conc:0.8,
    o2NeedMlPerMin:25,
    arterialO2ContentMlPerMl:0.19,
    o2MaxMlPerMl:0.20,
    hgbP50:h.p50,
    hgbScaleForSat:h.scaleForSat,
    plasmaVolumeFraction:0.55,
  });
  assert(s.po2MmHg>=0&&s.po2MmHg<=90);
  assert(Math.abs(s.residualMmHg)<=IMPLICIT_ERROR_LIMIT_MMHG,'implicit residual must meet HumMod error limit');
  assert(s.solver.converged===true);
  assert(s.solver.exactDesSolverIdentity===false);
});

test('plasma flow follows native BloodFlow * PVCrit relation',()=>{
  const h=setupHgbProps({tempC:37,pH:7.35,pCO2MmHg:45,carboxyPercent:0.4});
  const s=solveMyocardialFlow({
    side:'left',
    arterialPo2MmHg:90,pressureGradientMmHg:90,alphaReceptorActivity:1,
    adhPoolLog10Conc:0.8,o2NeedMlPerMin:25,
    arterialO2ContentMlPerMl:0.19,o2MaxMlPerMl:0.20,
    hgbP50:h.p50,hgbScaleForSat:h.scaleForSat,plasmaVolumeFraction:0.55,
  });
  near(s.plasmaFlowMlPerMin,s.bloodFlowMlPerMin*0.55);
});

test('lower tissue PO2 reduces aerobic fraction by source curve',()=>{
  assert(hermite(PO2_ON_AEROBIC_FRACTION,2)===0);
  assert(hermite(PO2_ON_AEROBIC_FRACTION,10)===1);
  assert(hermite(PO2_ON_AEROBIC_FRACTION,6)>0&&hermite(PO2_ON_AEROBIC_FRACTION,6)<1);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
