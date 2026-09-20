'use strict';

const {
  parseHumModNativeSolution,
} = require('../src/hummod_native_solution.js');
const {
  convertHumModRawSeries,
} = require('../src/hummod_raw_series_adapter.js');

let passed=0, failed=0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}

const vars = {
  'System.X':[0,0.5,1],
  'PO2Artys.Pressure':[94,93,92],
  'CO2Artys.Pressure':[40,40.5,41],
  'BloodPh.ArtysPh':[7.42,7.41,7.40],
  'Heart-Rate.Rate':[72,73,74],
  'SystemicArtys.Pressure':[96,95,94],
  'CardiacOutput.Flow(L/Min)':[5.5,5.4,5.3],
  'Ventilator.Rate':[16,16,16],
  'ExcessLungWater.Volume':[250,249,248],
  'AirSupply-InspiredAir.O2(%)':[50,50,50],
  'AirSupply-InspiredAir.PO2':[380,380,380],
  'LungBloodFlow.AlveolarShunt':[0,100,120],
  'LungBloodFlow.TotalShunt':[220,320,340],
  'RightHemithorax.LungInflation':[1,0.8,0.8],
  'LeftHemithorax.LungInflation':[1,0.8,0.8],
  'PulmonaryMembrane.Permeability':[97,60,55],
  'PulmonaryMembrane.DiffusingCapacity':[19.4,12,11],
  'PulmonaryMembrane.Thickness':[0.6,1.0,1.1],
  'PulmonaryMembrane.Recruitment':[0.26,0.24,0.23],
};
function fixture(overrides={}) {
  const source={...vars,...overrides};
  return '<solution>\n<index> 2 </index>\n' +
    Object.entries(source).map(([name,values]) =>
      '<var>\n<name> '+name+' </name>\n' +
      values.map(v=>'<val> '+v+' </val>').join('\n') +
      '\n</var>').join('\n') + '\n</solution>';
}

test('native SOLN parses exact verified HumMod symbols',()=>{
  const raw=parseHumModNativeSolution(fixture(),{trajectoryId:'native-test'});
  assert(raw.rows.length===3);
  assert(raw.rows[1]['System.X']===0.5);
  assert(raw.rows[2]['PO2Artys.Pressure']===92);
  assert(raw.nativeSolution.sampleCount===3);
  assert(raw.nativeSolution.scenarioApplied===false);
});

test('native SOLN feeds canonical trajectory conversion',()=>{
  const canonical=convertHumModRawSeries(parseHumModNativeSolution(fixture()));
  assert(canonical.rows.length===3);
  assert(canonical.rows[1].timestampSec===30);
  assert(canonical.rows[2].timestampSec===60);
  assert(canonical.rows[0].values['CardiacOutput.Flow(L/Min)']===5.5);
});


test('native SOLN preserves explicit scenario provenance',()=>{
  const raw=parseHumModNativeSolution(fixture(),{
    scenario:{id:'transport-probe',scenarioClass:'engineering-transport-probe',clinicalValidation:false}
  });
  assert(raw.nativeSolution.scenarioApplied===true);
  assert(raw.nativeSolution.scenario.id==='transport-probe');
  assert(raw.nativeSolution.scenario.clinicalValidation===false);
});


test('native SOLN verifies persisted scenario assignments',()=>{
  const raw=parseHumModNativeSolution(fixture(),{
    scenario:{id:'verify',scenarioClass:'engineering',clinicalValidation:false,assignments:{'Ventilator.Rate':16}}
  });
  assert(raw.nativeSolution.scenario.appliedAssignments['Ventilator.Rate'].observedAtVerificationPoint===16 && raw.nativeSolution.scenario.appliedAssignments['Ventilator.Rate'].persistence==='parameter');
});

test('native SOLN verifies evolving state at initial loaded sample',()=>{
  const raw=parseHumModNativeSolution(fixture(),{
    scenario:{id:'water',scenarioClass:'engineering',clinicalValidation:false,assignments:{'ExcessLungWater.Volume':250}}
  });
  const v=raw.nativeSolution.scenario.appliedAssignments['ExcessLungWater.Volume'];
  assert(v.observedAtVerificationPoint===250);
  assert(v.finalValue===248);
  assert(v.persistence==='dynamic-state');
});

test('native SOLN rejects scenario assignment mismatch',()=>{
  let threw=false;
  try {
    parseHumModNativeSolution(fixture(),{
      scenario:{id:'verify',scenarioClass:'engineering',clinicalValidation:false,assignments:{'Ventilator.Rate':99}}
    });
  } catch(e){ threw=/assignment mismatch/.test(e.message); }
  assert(threw);
});


test('native SOLN retains pulmonary diagnostic endpoints',()=>{
  const raw=parseHumModNativeSolution(fixture());
  assert(raw.nativeSolution.diagnostics['AirSupply-InspiredAir.O2(%)'].final===50);
  assert(raw.nativeSolution.diagnostics['LungBloodFlow.AlveolarShunt'].final===120);
  assert(raw.nativeSolution.diagnostics['PulmonaryMembrane.Thickness'].delta===0.5000000000000001 || Math.abs(raw.nativeSolution.diagnostics['PulmonaryMembrane.Thickness'].delta-0.5)<1e-12);
});

test('native SOLN rejects missing verified symbols',()=>{
  const missing={...vars}; delete missing['BloodPh.ArtysPh'];
  let threw=false; try { parseHumModNativeSolution(fixture(missing).replace(
    '<var>\n<name> BloodPh.ArtysPh </name>\n<val> 7.42 </val>\n<val> 7.41 </val>\n<val> 7.4 </val>\n</var>','')); } catch(e){threw=/missing verified/.test(e.message);}
  assert(threw);
});

test('native SOLN rejects mismatched sample counts',()=>{
  let threw=false; try { parseHumModNativeSolution(fixture({'System.X':[0,0.5]})); } catch(e){threw=/expected 3/.test(e.message);}
  assert(threw);
});

test('native SOLN rejects nonmonotonic System.X through raw-series contract',()=>{
  let threw=false; try { parseHumModNativeSolution(fixture({'System.X':[0,0.5,0.5]})); } catch(e){threw=/strictly increasing/.test(e.message);}
  assert(threw);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
