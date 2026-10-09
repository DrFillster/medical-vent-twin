'use strict';

const {createHumModBloodVolume}=require('../src/hummod_blood_volume_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.message);failed++;}
}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-9){if(Math.abs(a-b)>tol)throw new Error(a+' not near '+b);}

test('initializes textbook HumMod blood volume and hematocrit',()=>{
  const x=createHumModBloodVolume().snapshot();
  near(x.bloodVolumeMl,5400);
  near(x.hematocritFraction,0.44);
  near(x.plasmaVolumeFraction,0.56);
});

test('hemorrhage removes RBC and plasma in current Hct proportions',()=>{
  const x=createHumModBloodVolume({initialBloodVolumeMl:5400,initialHematocritFraction:0.44});
  const s=x.step({dtSec:60,hemorrhageSwitch:true,hemorrhageTargetRateMlPerMin:500});
  near(s.hemorrhageRbcRateMlPerMin,220);
  near(s.hemorrhagePlasmaRateMlPerMin,280);
  near(s.bloodVolumeMl,4900);
  near(s.hemorrhageVolumeMl,500);
  near(s.hematocritFraction,0.44);
});

test('hemorrhage switch off preserves volume when other gains and losses are neutral',()=>{
  const x=createHumModBloodVolume();
  const a=x.snapshot();
  const b=x.step({dtSec:120,hemorrhageSwitch:false,hemorrhageTargetRateMlPerMin:500});
  near(a.bloodVolumeMl,b.bloodVolumeMl);
  near(b.hemorrhageVolumeMl,0);
});

test('explicit non-hemorrhage boundaries remain mass balanced',()=>{
  const x=createHumModBloodVolume({initialBloodVolumeMl:5400,initialHematocritFraction:0.44});
  const s=x.step({
    dtSec:60,
    rbcGainMlPerMin:10,
    plasmaGainMlPerMin:20,
    otherRbcLossMlPerMin:5,
    otherPlasmaLossMlPerMin:7,
  });
  near(s.bloodVolumeMl,5400+10+20-5-7);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
