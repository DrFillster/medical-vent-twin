'use strict';
const assert=require('node:assert/strict');
const {createHumMod2013GeneralInsulinReceptors}=require('../src/hummod_2013_general_insulin_receptors.js');
let p=0,f=0;function test(n,fn){try{fn();console.log('ok -',n);p++;}catch(e){console.error('FAIL -',n,':',e.message);f++;}}
test('general insulin receptors preserve total receptor count at T2D=0',()=>{const r=createHumMod2013GeneralInsulinReceptors();const s=r.step({dtSec:60,insulinSourceConcentration:20,t2d:0});assert(Math.abs((s.bound+s.free)-19000)<1e-9);assert(s.boundFractionPercent>=0);});
test('receptor occupancy responds to insulin concentration',()=>{const a=createHumMod2013GeneralInsulinReceptors().step({dtSec:60,insulinSourceConcentration:0});const b=createHumMod2013GeneralInsulinReceptors().step({dtSec:60,insulinSourceConcentration:100});assert(b.boundFractionPercent>a.boundFractionPercent);});
console.log('\nTests: passed='+p+' failed='+f);process.exit(f===0?0:1);