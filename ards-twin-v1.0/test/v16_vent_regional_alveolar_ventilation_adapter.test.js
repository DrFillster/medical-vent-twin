'use strict';

const assert=require('node:assert/strict');
const {
  ventRegionalAlveolarVentilationStpd,
}=require('../src/v16_vent_regional_alveolar_ventilation_adapter.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.stack||e.message);failed++;}
}

function mockSimulation(){
  const compartments=[
    {id:'fast',perfusionFraction:0.8},
    {id:'slow',perfusionFraction:0.1},
    {id:'recruitable',perfusionFraction:0.1},
  ];
  return {
    params:{compartments},
    state:{
      compartments:[
        {id:'fast',recruitment:1},
        {id:'slow',recruitment:0.8},
        {id:'recruitable',recruitment:0.5},
      ],
    },
    metrics:()=>[{
      breathIndex:4,
      breathStartT:10,
      breathEndT:13,
      RR:20,
      compartments:{
        comp_0:{endInspV:0.30,endExpV:0.10,endInspP:20,endExpP:10},
        comp_1:{endInspV:0.20,endExpV:0.10,endInspP:20,endExpP:10},
        comp_2:{endInspV:0.12,endExpV:0.10,endInspP:20,endExpP:10},
      },
    }],
  };
}

test('Vent adapter uses measured regional tidal volume and ignores perfusion metadata',()=>{
  const s=ventRegionalAlveolarVentilationStpd({
    simulation:mockSimulation(),
    barometricPressureMmHg:760,
    bodyTempC:37,
  });
  assert.equal(s.status,'ready');
  assert.equal(s.regions.length,3);
  assert(s.regions[0].alveolarVentilationStpdMlPerMin>
    s.regions[1].alveolarVentilationStpdMlPerMin);
  assert(s.regions[1].alveolarVentilationStpdMlPerMin>
    s.regions[2].alveolarVentilationStpdMlPerMin);
  for(const r of s.regions){
    assert.equal(r.perfusionMetadataUsed,false);
  }
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
