'use strict';

const assert=require('node:assert/strict');
const {
  createV16IntegratedArdsCardiopulmonaryCandidate,
}=require('../src/v16_integrated_ards_cardiopulmonary_candidate.js');
const {
  createReferenceAnchoredAlveolarVolumeAdapter,
}=require('../src/v16_reference_anchored_alveolar_volume_adapter.js');
const {
  createVentKaramolegkosPressureCoordinateAdapter,
}=require('../src/v16_vent_karamolegkos_pressure_coordinate_adapter.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.stack||e.message);failed++;}
}

class VcAcController{
  constructor(){
    this.settings={fio2:0.6,peep:10,rr:20,vt:0.42};
  }
}
function mockVent(){
  return {
    controller:new VcAcController(),
    trace:[],
    params:{
      airwayOpeningPressure:0,
      compartments:[
        {id:'fast',perfusionFraction:0.8},
        {id:'slow',perfusionFraction:0.1},
        {id:'recruitable',perfusionFraction:0.1},
      ],
    },
    measurements:[],
    metrics:()=>[{
      breathIndex:1,
      breathStartT:0,
      breathEndT:3,
      RR:20,
      compartments:{
        comp_0:{endInspV:0.30,endExpV:0.10,endInspP:20,endExpP:10},
        comp_1:{endInspV:0.20,endExpV:0.10,endInspP:20,endExpP:10},
        comp_2:{endInspV:0.12,endExpV:0.10,endInspP:20,endExpP:10},
      },
    }],
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

function pulmonaryMechanicsBoundary(){
  return Object.freeze({
    sourceQualified:true,
    alveolarVolumeL:2.25,
    alveolarPressureMmHg:0,
    pleuralPressureMmHg:-3,
    shuntFraction:0.05,
    provenance:Object.freeze({
      fixture:'focused integration test only',
      canonical:false,
    }),
  });
}

test('integrated ARDS candidate advances one persistent sourced composition',()=>{
  const simulation=mockVent();
  const volumeAdapter=createReferenceAnchoredAlveolarVolumeAdapter({
    simulation,
    referenceAbsoluteAlveolarVolumeL:2.25,
    referenceProvenance:{
      sourceQualified:true,
      fixture:'focused synchronized absolute-volume reference only',
    },
  });
  const coordinateAdapter=createVentKaramolegkosPressureCoordinateAdapter({
    alveolarVolumeAdapter:volumeAdapter,
    referencePleuralPressureCmH2O:-5,
    passivePatient:true,
    referenceProvenance:{
      sourceQualified:true,
      fixture:'focused passive pleural-pressure reference only',
    },
  });

  const candidate=createV16IntegratedArdsCardiopulmonaryCandidate({
    simulation,
    dtSec:0.0005,
    pulmonaryVascularInitialState:{
      PpaTm:18,
      Fpa:80,
      PpalTm:13,
      PpcTm:9,
      PpvTm:10,
    },
    pulmonaryCoordinateAdapter:coordinateAdapter,
    pulmonaryShuntFractionProvider:()=>Object.freeze({
      sourceQualified:true,
      shuntFraction:0.05,
      provenance:Object.freeze({
        fixture:'focused source-qualified shunt case state only',
      }),
    }),
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
    excessLungWaterProvider:()=>0,
    deadSpaceBtpsMlProvider:()=>150,
  });

  const s=candidate.runFor(0.01);
  assert.equal(s.schema,'v16-integrated-ards-cardiopulmonary-candidate/v1');
  assert.equal(s.canonicalControlAuthority,false);
  assert.equal(s.coupling.physiologicGainAdded,false);
  assert.equal(s.ownership.ventilatorMechanics,'Vent');
  assert.match(
    s.ownership.pulmonaryMechanicsCoordinate,
    /reference-anchored Vent delta-volume/
  );

  for(const [k,v] of Object.entries(s.physicianState)){
    if(typeof v==='number'){
      assert(Number.isFinite(v),k+' must be finite');
    }
  }

  assert(s.pulmonaryVascular.pulmonaryPerfusionState.sourceQualified);
  assert.equal(
    s.pulmonaryVascular.boundary.coordinateSnapshot.sourceQualified,
    true
  );
  assert.equal(
    s.pulmonaryVascular.boundary.coordinateSnapshot.passivePatient,
    true
  );
  assert(Number.isFinite(s.pulmonaryGas.gas.gases.arterial.po2MmHg));
  assert(Number.isFinite(s.pulmonaryGas.gas.gases.arterial.pco2MmHg));
  assert.equal(s.regionalOxygen.status,'ready');
  assert.equal(s.regionalOxygen.legacyVentPerfusionMetadataUsed,false);
  assert.match(
    s.ownership.arterialOxygen,
    /Das[-\/]Marshall regional VQ/
  );
  assert.match(
    s.pulmonaryGas.gas.exchange.massBalance.arterialO2TargetAuthority,
    /regional VQ/
  );
  assert(Number.isFinite(s.regionalOxygen.arterialPo2MmHg));
  assert.equal(
    s.physicianState.pao2MmHg,
    s.pulmonaryGas.gas.gases.arterial.po2MmHg
  );
  assert(Number.isFinite(s.physicianState.regionalArterialPo2TargetMmHg));
  assert(Number.isFinite(
    s.cardiovascular.cardiovascular.hemodynamics.heartRatePerMin
  ));
});

test('integrated ARDS candidate refuses unsourced default pulmonary coordinates',()=>{
  assert.throws(()=>createV16IntegratedArdsCardiopulmonaryCandidate({
    simulation:mockVent(),
    dtSec:0.0005,
    pulmonaryVascularInitialState:{
      PpaTm:18,
      Fpa:80,
      PpalTm:13,
      PpcTm:9,
      PpvTm:10,
    },
    pulmonaryShuntFractionProvider:()=>Object.freeze({
      sourceQualified:true,
      shuntFraction:0.05,
    }),
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
    excessLungWaterProvider:()=>0,
  }),/pulmonaryCoordinateAdapter/);
});

test('integrated ARDS candidate refuses unqualified pulmonary mechanics',()=>{
  const c=createV16IntegratedArdsCardiopulmonaryCandidate({
    simulation:mockVent(),
    dtSec:0.0005,
    pulmonaryVascularInitialState:{
      PpaTm:18,
      Fpa:80,
      PpalTm:13,
      PpcTm:9,
      PpvTm:10,
    },
    pulmonaryMechanicsBoundaryProvider:()=>({
      ...pulmonaryMechanicsBoundary(),
      sourceQualified:false,
    }),
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
    excessLungWaterProvider:()=>0,
    deadSpaceBtpsMlProvider:()=>150,
  });

  assert.throws(()=>c.step(),/source-qualified coordinates/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
