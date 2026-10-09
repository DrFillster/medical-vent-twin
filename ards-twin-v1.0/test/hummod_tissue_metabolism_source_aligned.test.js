'use strict';
const {CAL_PER_MIN_PER_G,tissueMetabolicO2Need}=require('../src/hummod_tissue_metabolism_source_aligned.js');
let p=0,f=0;function t(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
function near(a,b,tol=1e-9){if(Math.abs(a-b)>tol)throw new Error(a+' not near '+b);}
t('preserves native tissue calorie-rate constants',()=>{near(CAL_PER_MIN_PER_G.bone,0.0081);near(CAL_PER_MIN_PER_G.fat,0.0018);near(CAL_PER_MIN_PER_G.giTract,0.0718);near(CAL_PER_MIN_PER_G.otherTissue,0.0106);});
t('tissue O2 need follows native multiplicative metabolism equation',()=>{const s=tissueMetabolicO2Need({tissue:'fat',massG:10000,calMultiplier:1,thyroidEffect:1.1,heatMetabolismCore:1.2,structureEffect:0.9,calToO2:0.2});near(s.normalCalsUsed,18);near(s.totalCalsUsed,21.384);near(s.o2NeedMlPerMin,4.2768);});
console.log('\nTests: passed='+p+' failed='+f);process.exit(f?1:0);