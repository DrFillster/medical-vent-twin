'use strict';
const {
  NORMAL_HCT,
  BASIC_HGB_G_PER_ML,
  O2_MAX_ML_PER_G_HGB,
  hgbConcentrationFromHematocrit,
}=require('../src/hummod_hgb_concentration_source_aligned.js');

let p=0,f=0;
function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function near(a,b,tol=1e-12){if(Math.abs(a-b)>tol)throw new Error(a+' not near '+b);}

t('HumMod normal Hct gives basic Hgb concentration and O2 capacity',()=>{
  const s=hgbConcentrationFromHematocrit({hematocritFraction:NORMAL_HCT});
  near(s.totalHgbGPerMl,BASIC_HGB_G_PER_ML);
  near(s.o2MaxMlPerMl,BASIC_HGB_G_PER_ML*O2_MAX_ML_PER_G_HGB);
});

t('falling hematocrit lowers Hgb and O2 capacity proportionally',()=>{
  const normal=hgbConcentrationFromHematocrit({hematocritFraction:0.44});
  const low=hgbConcentrationFromHematocrit({hematocritFraction:0.22});
  near(low.totalHgbGPerMl,normal.totalHgbGPerMl/2);
  near(low.o2MaxMlPerMl,normal.o2MaxMlPerMl/2);
});

t('carboxy fraction reduces free Hgb O2 capacity',()=>{
  const s=hgbConcentrationFromHematocrit({hematocritFraction:0.44,carboxyPercent:10});
  near(s.freeHgbGPerMl,0.135);
  near(s.o2MaxMlPerMl,0.135*1.34);
});

console.log('\nTests: passed='+p+' failed='+f);
process.exit(f?1:0);
