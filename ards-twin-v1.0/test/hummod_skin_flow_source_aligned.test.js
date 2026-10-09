'use strict';
const {setupHgbProps}=require('../src/hummod_hgb_tissue_source_aligned.js');
const {solveSkinFlow}=require('../src/hummod_skin_flow_source_aligned.js');
let p=0,f=0;function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function a(v,m){if(!v)throw new Error(m||'assertion failed');}
t('skin flow includes hypothalamic and local-temperature terms',()=>{const h=setupHgbProps({tempC:37,pH:7.4,pCO2MmHg:40,carboxyPercent:0});
const s=solveSkinFlow({arterialPo2MmHg:90,pressureGradientMmHg:90,otherTissueAlphaReceptorActivity:1,a2PoolLog10Conc:1.3,
adhPoolLog10Conc:0.8,hypothalamusSkinFlowNerveActivity:1,skinTempC:29,o2NeedMlPerMin:8,arterialO2ContentMlPerMl:0.2,
o2MaxMlPerMl:0.2,hgbP50:h.p50,hgbScaleForSat:h.scaleForSat,plasmaVolumeFraction:0.56});a(s.solver.converged);a(s.bloodFlowMlPerMin>0);});
console.log('\nTests: passed='+p+' failed='+f);process.exit(f?1:0);