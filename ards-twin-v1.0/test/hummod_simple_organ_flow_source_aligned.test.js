'use strict';
const {setupHgbProps}=require('../src/hummod_hgb_tissue_source_aligned.js');
const {SIMPLE_ORGAN_FLOW_CONFIG,solveSimpleOrganFlow}=require('../src/hummod_simple_organ_flow_source_aligned.js');
let passed=0,failed=0;
function test(n,f){try{f();console.log('ok -',n);passed++;}catch(e){console.error('FAIL -',n,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,t=1e-9){if(Math.abs(a-b)>t)throw new Error(a+' not near '+b);}
test('preserves HumMod simple organ flow source constants',()=>{
  near(SIMPLE_ORGAN_FLOW_CONFIG.giTract.basicConductance,11.2);
  near(SIMPLE_ORGAN_FLOW_CONFIG.giTract.implicitErrorLimitMmHg,0.54);
  near(SIMPLE_ORGAN_FLOW_CONFIG.fat.basicConductance,2.7);
  near(SIMPLE_ORGAN_FLOW_CONFIG.fat.implicitErrorLimitMmHg,0.52);
  near(SIMPLE_ORGAN_FLOW_CONFIG.otherTissue.basicConductance,4.2);
  near(SIMPLE_ORGAN_FLOW_CONFIG.otherTissue.implicitErrorLimitMmHg,0.45);
});
test('GI, fat, and other-tissue implicit flows converge without fitted residual conductance',()=>{
  const h=setupHgbProps({tempC:37,pH:7.4,pCO2MmHg:40,carboxyPercent:0});
  for(const organ of ['giTract','fat','otherTissue']){
    const s=solveSimpleOrganFlow({
      organ,arterialPo2MmHg:90,pressureGradientMmHg:90,alphaReceptorActivity:1,
      a2PoolLog10Conc:1.3,adhPoolLog10Conc:0.8,o2NeedMlPerMin:30,
      arterialO2ContentMlPerMl:0.20,o2MaxMlPerMl:0.20,hgbP50:h.p50,hgbScaleForSat:h.scaleForSat,
      plasmaVolumeFraction:0.56,
    });
    assert(s.solver.converged,organ+' solver did not converge');
    assert(s.bloodFlowMlPerMin>0);
  }
});
console.log('\nTests: passed='+passed+' failed='+failed);process.exit(failed?1:0);
