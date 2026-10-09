'use strict';
const {kidneyBloodFlow}=require('../src/hummod_kidney_flow_source_aligned.js');
let p=0,f=0;function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function a(v,m){if(!v)throw new Error(m||'assertion failed');}
t('renal flow uses serial arcuate afferent and efferent conductances',()=>{const s=kidneyBloodFlow({pressureGradientMmHg:90,plasmaVolumeFraction:0.56,
  nephronCountFraction:1,tgfVascularSignal:1.3,kidneyAlphaReceptorActivity:1.5,myogenicPressureChangeMmHg:0,
  a2PoolLog10Conc:1.3,anesthesiaVascularConductance:1,arcuateStenosis:1});a(s.bloodFlowMlPerMin>0);a(s.conductance<s.afferentConductance);});
console.log('\nTests: passed='+p+' failed='+f);process.exit(f?1:0);