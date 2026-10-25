'use strict';

const {
  peripheralChemoreflexOperatingPointTerm,
  centralChemoreflexSympatheticGainPercent,
  createLin2012BaroChemoreflexInteraction,
}=require('../src/lin_2012_baro_chemoreflex_interaction_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}
function near(a,b,t=1e-9){assert(Math.abs(a-b)<=t,a+' != '+b);}

test('Lin Eq30 reproduces published piecewise gas relation',()=>{
  const v=peripheralChemoreflexOperatingPointTerm({
    arterialPo2MmHg:90,
    arterialPco2MmHg:40,
  });
  near(v,-13.8+0.182*40+828/90);
  const high=peripheralChemoreflexOperatingPointTerm({
    arterialPo2MmHg:35,
    arterialPco2MmHg:110,
  });
  near(high,-13.8+0.182*110+828/35);
  assert(high>v);
});

test('Lin Eq31 increases central sympathetic gain with hypercapnia',()=>{
  near(centralChemoreflexSympatheticGainPercent({arterialPco2MmHg:40}),
    40-18.118);
  near(centralChemoreflexSympatheticGainPercent({arterialPco2MmHg:110}),
    110-18.118);
});

test('severe gas state resets baroreflex operating point upward without fitted gain',()=>{
  const m=createLin2012BaroChemoreflexInteraction({
    referenceArterialPo2MmHg:90,
    referenceArterialPco2MmHg:40,
  });
  const s=m.evaluate({
    arterialPo2MmHg:35,
    arterialPco2MmHg:110,
  });
  assert(s.baroreflexOperatingPointShiftMmHg>20,
    'severe hypoxia/hypercapnia should materially reset source operating point');
  assert(s.sympatheticGainShiftPercentagePoints===70,
    'PaCO2 40->110 should change Lin Eq31 by exactly 70 percentage points');
  assert(s.controlAuthority===false,
    'shadow must not acquire control authority before downstream source equations are complete');
});

console.log(JSON.stringify({
  baseline:{
    eq30:peripheralChemoreflexOperatingPointTerm({
      arterialPo2MmHg:90,arterialPco2MmHg:40,
    }),
    eq31:centralChemoreflexSympatheticGainPercent({
      arterialPco2MmHg:40,
    }),
  },
  severe:{
    eq30:peripheralChemoreflexOperatingPointTerm({
      arterialPo2MmHg:35,arterialPco2MmHg:110,
    }),
    eq31:centralChemoreflexSympatheticGainPercent({
      arterialPco2MmHg:110,
    }),
  }
},null,2));

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
