'use strict';

const assert=require('node:assert/strict');
const {
  createVentRegionalArdsOxygenState,
}=require('../src/v16_vent_regional_ards_oxygen_bridge.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.stack||e.message);failed++;}
}

function simulation(){
  return {
    controller:{
      settings:{fio2:0.6},
      constructor:{name:'VcAcController'},
    },
    params:{
      compartments:[
        {id:'fast',perfusionFraction:0.98},
        {id:'slow',perfusionFraction:0.01},
        {id:'recruitable',perfusionFraction:0.01},
      ],
    },
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

const pulmonaryVascularSnapshot={
  pulmonaryPerfusionState:{
    sourceQualified:true,
    totalPulmonaryBloodFlowMlPerMin:5000,
    ventilatedPulmonaryBloodFlowMlPerMin:4915,
    shuntFraction:0.017,
  },
};

const gasSnapshot={
  gas:{
    gases:{
      arterial:{
        pH:7.40,
        pco2MmHg:40,
        po2MmHg:90,
        o2ContentMlPerMl:0.19,
      },
      venous:{
        pH:7.36,
        pco2MmHg:46,
        po2MmHg:40,
        o2ContentMlPerMl:0.15,
      },
    },
  },
};

test('live regional bridge produces finite arterial O2 without Vent perfusion metadata',()=>{
  const s=createVentRegionalArdsOxygenState({
    simulation:simulation(),
    pulmonaryVascularSnapshot,
    gasSnapshot,
    blood:{
      o2MaxMlPerMl:0.201,
      tempC:37,
      carboxyPercent:0,
    },
    environment:{
      barometricPressureMmHg:760,
      inspiredCo2Fraction:0,
    },
  });
  assert.equal(s.status,'ready');
  assert(Number.isFinite(s.arterialPo2MmHg));
  assert(s.arterialPo2MmHg>0);
  assert.equal(s.legacyVentPerfusionMetadataUsed,false);
  assert.equal(s.regionalO2Perfusion.regions.length,3);
});

test('poorly ventilated Vent region receives lower dynamic perfusion',()=>{
  const s=createVentRegionalArdsOxygenState({
    simulation:simulation(),
    pulmonaryVascularSnapshot,
    gasSnapshot,
    blood:{
      o2MaxMlPerMl:0.201,
      tempC:37,
      carboxyPercent:0,
    },
    environment:{
      barometricPressureMmHg:760,
      inspiredCo2Fraction:0,
    },
  });
  const r=s.regionalO2Perfusion.regions;
  assert(r[2].alveolarVentilationStpdMlPerMin<
    r[0].alveolarVentilationStpdMlPerMin);
  assert(r[2].pAlveolarO2MmHg<r[0].pAlveolarO2MmHg);
  assert(r[2].perfusionFraction<r[0].perfusionFraction);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
