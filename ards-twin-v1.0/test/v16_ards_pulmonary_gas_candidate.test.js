'use strict';

const assert=require('node:assert/strict');
const {
  validatePulmonaryPerfusionState,
  createV16ArdsPulmonaryGasCandidate,
}=require('../src/v16_ards_pulmonary_gas_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.stack||e.message);failed++;}
}

class VcAcController{
  constructor(){
    this.settings={fio2:0.5,peep:10,rr:20,vt:0.42};
  }
}
function mockVent(){
  return {
    controller:new VcAcController(),
    trace:[],
    state:{
      t:0,
      airwayPressure:20,
      totalFlow:0,
      totalVolume:0.42,
      compartments:[
        {id:'fast',volume:0.14,flow:0,alveolarPressure:10,recruitment:1},
        {id:'slow',volume:0.14,flow:0,alveolarPressure:10,recruitment:0.8},
        {id:'recruitable',volume:0.14,flow:0,alveolarPressure:10,recruitment:0.5},
      ],
    },
  };
}

test('pulmonary perfusion contract rejects synthetic/unqualified state',()=>{
  assert.throws(()=>validatePulmonaryPerfusionState({
    totalPulmonaryBloodFlowMlPerMin:5000,
    ventilatedPulmonaryBloodFlowMlPerMin:4000,
    sourceQualified:false,
  }),/source-qualified/);
});

test('pulmonary perfusion contract accepts explicit source-qualified flow',()=>{
  const s=validatePulmonaryPerfusionState({
    totalPulmonaryBloodFlowMlPerMin:5000,
    ventilatedPulmonaryBloodFlowMlPerMin:4000,
    shuntFraction:0.2,
    sourceQualified:true,
    provenance:{fixture:'source-qualified-test-boundary'},
  });
  assert.equal(s.totalPulmonaryBloodFlowMlPerMin,5000);
  assert.equal(s.ventilatedPulmonaryBloodFlowMlPerMin,4000);
});

test('ARDS gas candidate advances from Vent mechanics plus qualified perfusion',()=>{
  const c=createV16ArdsPulmonaryGasCandidate({
    simulation:mockVent(),
    useHumModSourceInitialGasState:true,
    blood:{
      sidMolPerL:0.040,
      o2MaxMlPerMl:0.201,
      tempC:37,
      carboxyPercent:0,
    },
    metabolism:{
      tissueO2UseMlPerMin:250,
      tissueCo2ProductionMmolPerMin:9,
    },
    environment:{
      barometricPressureMmHg:760,
      inspiredCo2Fraction:0,
    },
    pulmonaryPerfusionProvider:()=>({
      totalPulmonaryBloodFlowMlPerMin:5000,
      ventilatedPulmonaryBloodFlowMlPerMin:4000,
      shuntFraction:0.2,
      sourceQualified:true,
      provenance:{fixture:'source-qualified-test-boundary'},
    }),
    excessLungWaterProvider:()=>0,
    deadSpaceBtpsMlProvider:()=>150,
  });
  const s=c.step({dtSec:0.01});
  assert.equal(s.schema,'v16-ards-pulmonary-gas-candidate/v1');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.ownership.mechanics,'Vent');
  assert(Number.isFinite(s.gas.gases.arterial.po2MmHg));
  assert(Number.isFinite(s.gas.gases.arterial.pco2MmHg));
  assert(Number.isFinite(s.gas.gases.arterial.pH));
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
