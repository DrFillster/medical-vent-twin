'use strict';
const {
  PH_CELLS_PK,
  phGeneral,
  phCells,
  bloodGasToBase,
  tissueBaseToGas,
}=require('../src/hummod_acid_base_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-12){assert(Math.abs(a-b)<=tol,a+' not near '+b);}

test('PhCells preserves source pK',()=>near(PH_CELLS_PK,7.15));

test('PhGeneral preserves pCO2 <= 0 branch',()=>{
  const s=phGeneral({pK:7.15,pCO2:0,SID:40});
  near(s.pH,10.15);
});

test('PhGeneral preserves low SID/pCO2 branch',()=>{
  const s=phGeneral({pK:7.15,pCO2:100,SID:0.01});
  near(s.pH,4.15);
});

test('PhGeneral logarithmic branch matches source equation',()=>{
  const s=phCells({pCO2:50,SID:40});
  near(s.pH,7.15+Math.log10(40/50));
  near(s.hydrogen,10**(9-s.pH));
});

test('Blood-GasToBase matches source linear equation',()=>{
  const s=bloodGasToBase({pCO2:40,SID:0.04});
  near(s.hco3,(0.2325*0.04)+(0.00036*40));
});

test('Blood-GasToBase preserves source fallback',()=>{
  near(bloodGasToBase({pCO2:0,SID:0.04}).hco3,0.0001);
});

test('Tissue-BaseToGas matches source linear equation',()=>{
  const s=tissueBaseToGas({hco3:0.025,SID:0.04});
  near(s.pCO2,Math.max((-1411.4*0.04)+(5988*0.025),0.0001));
});

test('Tissue-BaseToGas preserves source floor/fallback',()=>{
  near(tissueBaseToGas({hco3:0,SID:0.04}).pCO2,0.0001);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
