'use strict';

const {
  HUMMOD_V13_AUTONOMIC_NATIVE_SYMBOLS,
  listV13AutonomicNativeSymbols,
}=require('../src/hummod_v13_autonomic_native_symbols.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}

test('v1.3 native diagnostic roster has no duplicate symbols',()=>{
  const symbols=listV13AutonomicNativeSymbols();
  assert(new Set(symbols).size===symbols.length,'duplicate native diagnostic symbol');
});

test('v1.3 native diagnostic roster covers myocardial collapse chain',()=>{
  const symbols=new Set(listV13AutonomicNativeSymbols());
  [
    'LeftHeart-Flow.BloodFlow','RightHeart-Flow.BloodFlow',
    'LeftHeart-Flow.PO2','RightHeart-Flow.PO2',
    'LeftHeart-Metabolism.O2Lack','RightHeart-Metabolism.O2Lack',
    'LeftHeart-Fuel.AnaerobicGlucoseUsed(mG/Min)','RightHeart-Fuel.AnaerobicGlucoseUsed(mG/Min)',
    'LeftHeart-Lactate.[Lac-]','RightHeart-Lactate.[Lac-]',
    'LeftHeart-CO2.PCO2','RightHeart-CO2.PCO2',
    'LeftHeart-Ph.[SID]','RightHeart-Ph.[SID]',
    'LeftHeart-Ph.Ph','RightHeart-Ph.Ph',
    'LeftHeart-Function.Effect','RightHeart-Function.Effect',
    'LeftHeart-Function.Failed','RightHeart-Function.Failed',
    'Heart-Asystole.Is_Asystole','SANode-Rate.Is_SinusRhythm',
  ].forEach(symbol=>assert(symbols.has(symbol),'missing '+symbol));
});

test('each native diagnostic symbol has source provenance and role',()=>{
  for(const entry of HUMMOD_V13_AUTONOMIC_NATIVE_SYMBOLS){
    assert(typeof entry.sourceFile==='string'&&entry.sourceFile.length>0,'sourceFile required for '+entry.symbol);
    assert(typeof entry.role==='string'&&entry.role.length>0,'role required for '+entry.symbol);
  }
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
