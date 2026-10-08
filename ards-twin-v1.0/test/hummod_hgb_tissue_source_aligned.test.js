'use strict';
const {
  HILL_CONSTANT,
  PO2_SATURATED,
  O2_SOLUBILITY,
  P50_BASIC,
  setupHgbProps,
  o2ContentToPo2,
  po2ToO2Content,
}=require('../src/hummod_hgb_tissue_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-10){assert(Math.abs(a-b)<=tol,a+' not near '+b);}

test('preserves native hemoglobin constants',()=>{
  near(HILL_CONSTANT,2.3);
  near(PO2_SATURATED,120);
  near(O2_SOLUBILITY,0.00003);
  near(P50_BASIC,26.6);
});

test('normal setup returns native P50 basic value',()=>{
  const s=setupHgbProps({tempC:37,pH:7.4,pCO2MmHg:40,carboxyPercent:0});
  near(s.tempEffect,1);
  near(s.phEffect,1);
  near(s.pco2Effect,1);
  near(s.coEffect,1);
  near(s.p50,26.6);
});

test('source pCO2 below 1 branch uses log value zero',()=>{
  const s=setupHgbProps({tempC:37,pH:7.4,pCO2MmHg:0.5,carboxyPercent:0});
  near(s.pco2Effect,10**(0.06*(0-Math.log10(40))));
});

test('O2 content above capacity uses dissolved oxygen branch',()=>{
  const p=o2ContentToPo2({
    o2ContentMlPerMl:0.205,
    o2MaxMlPerMl:0.200,
    p50:26.6,
    scaleForSat:1,
  });
  near(p,120+(0.005/0.00003));
});

test('PO2 above saturation uses dissolved oxygen branch',()=>{
  const c=po2ToO2Content({
    po2MmHg:130,o2MaxMlPerMl:0.2,p50:26.6,scaleForSat:1,
  });
  near(c,0.2+(10*0.00003));
});

test('Hill conversions round-trip below saturation',()=>{
  const props=setupHgbProps({tempC:37,pH:7.35,pCO2MmHg:45,carboxyPercent:0.4});
  const c=po2ToO2Content({
    po2MmHg:40,o2MaxMlPerMl:0.2,p50:props.p50,scaleForSat:props.scaleForSat,
  });
  const p=o2ContentToPo2({
    o2ContentMlPerMl:c,o2MaxMlPerMl:0.2,p50:props.p50,scaleForSat:props.scaleForSat,
  });
  near(p,40,1e-8);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
