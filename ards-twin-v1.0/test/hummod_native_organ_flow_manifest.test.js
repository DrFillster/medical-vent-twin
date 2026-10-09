'use strict';
const {PERIPHERAL_FLOW_SYMBOLS,SPLANCHNIC_FLOW_SYMBOLS,AGGREGATE_FLOW_SYMBOLS}=require('../src/hummod_native_organ_flow_manifest.js');
let passed=0,failed=0;
function test(n,f){try{f();console.log('ok -',n);passed++;}catch(e){console.error('FAIL -',n,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
test('manifest matches HumMod OrganFlow peripheral composition',()=>{
  const s=Object.values(PERIPHERAL_FLOW_SYMBOLS);
  ['A-VFistula-Flow.BloodFlow','Bone-Flow.BloodFlow','Brain-Flow.BloodFlow','Fat-Flow.BloodFlow',
   'Kidney-Flow.BloodFlow','LeftHeart-Flow.BloodFlow','OtherTissue-Flow.BloodFlow',
   'RespiratoryMuscle-Flow.BloodFlow','RightHeart-Flow.BloodFlow','SkeletalMuscle-Flow.BloodFlow',
   'Skin-Flow.BloodFlow'].forEach(x=>assert(s.includes(x),x));
  assert(s.length===11);
});
test('manifest matches HumMod hepatic vein composition',()=>{
  assert(SPLANCHNIC_FLOW_SYMBOLS.giTract==='GITract-Flow.BloodFlow');
  assert(SPLANCHNIC_FLOW_SYMBOLS.hepaticArtery==='HepaticArty.Flow');
});
test('manifest exposes exact native aggregate closure variables',()=>{
  assert(AGGREGATE_FLOW_SYMBOLS.peripheral==='OrganFlow.PeripheralFlow');
  assert(AGGREGATE_FLOW_SYMBOLS.hepaticVein==='OrganFlow.HepaticVeinFlow');
  assert(AGGREGATE_FLOW_SYMBOLS.systemicArterialOutflow==='SystemicArtys.Outflow');
  assert(AGGREGATE_FLOW_SYMBOLS.systemicArterialInflow==='SystemicArtys.Inflow');
});
console.log('\nTests: passed='+passed+' failed='+failed);process.exit(failed?1:0);
