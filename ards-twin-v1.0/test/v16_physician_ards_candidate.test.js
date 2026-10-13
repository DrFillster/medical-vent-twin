'use strict';

const assert=require('node:assert/strict');
const {PRESETS}=require('../src/presets.js');
const {
  createV16PhysicianArdsCandidate,
}=require('../src/v16_physician_ards_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.stack||e.message);failed++;}
}

function createCandidate(){
  return createV16PhysicianArdsCandidate({
    patientParams:PRESETS.phenotype_moderate_recruitability(),
    initialRecruitmentState:{
      normal:1,
      recruitable:0.5,
      consolidated:0,
    },
    ventilatorSettings:{
      fio2:0.6,
      peep:10,
      rr:20,
      vt:0.42,
      inspiratoryFlow:0.5,
      inspiratoryPause:0,
    },
    anatomicalShuntFraction:0.05,
    anatomicalShuntProvenance:{
      sourceQualified:true,
      fixture:'focused physician shunt case state only',
      canonical:false,
    },
    referenceAbsoluteAlveolarVolumeL:2.25,
    referenceAbsoluteAlveolarVolumeProvenance:{
      sourceQualified:true,
      fixture:'focused synchronized absolute-volume reference only',
      canonical:false,
    },
    referencePleuralPressureCmH2O:-5,
    referencePleuralPressureProvenance:{
      sourceQualified:true,
      fixture:'focused passive pleural-pressure reference only',
      canonical:false,
    },
    excessLungWaterMl:0,
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
    deadSpaceBtpsMlProvider:()=>150,
    dtSec:0.002,
    averagingWindowSec:1,
  });
}

test('physician candidate produces one persistent bedside ARDS state',()=>{
  const c=createCandidate();
  const s=c.runFor(3.2);
  assert.equal(s.schema,'v16-physician-ards-candidate/v1');
  assert.equal(s.gas.regionalStatus,'ready');
  assert.equal(s.gas.regions.length,3);
  assert.equal(s.hemodynamics.status,'ready');
  for(const key of [
    'heartRatePerMin',
    'meanArterialPressureMmHg',
    'cardiacOutputLPerMin',
    'strokeVolumeMl',
    'systemicVascularResistanceMmHgMinPerL',
    'pulmonaryVascularResistanceWoodUnits',
    'meanPulmonaryArteryPressureMmHg',
  ]){
    assert(Number.isFinite(s.hemodynamics[key]),key+' must be finite');
  }
  assert(Number.isFinite(s.gas.pao2MmHg));
  assert(Number.isFinite(s.gas.paco2MmHg));
  assert(Number.isFinite(s.gas.arterialPh));
  assert.equal(
    s.pulmonaryReferenceState.absoluteAlveolarVolumeL,
    2.25
  );
  assert.equal(
    s.pulmonaryReferenceState.referencePleuralPressureCmH2O,
    -5
  );
  assert.equal(s.myocardial.status,'source-flow-and-o2-use-live');
  assert(Number.isFinite(s.myocardial.coronaryBloodFlowMlPerMin));
  assert(s.myocardial.coronaryBloodFlowMlPerMin>0);
  assert(Number.isFinite(s.myocardial.myocardialO2UseMlPerMin));
  assert(s.myocardial.myocardialO2UseMlPerMin>=0);
  assert.equal(s.myocardial.intracellularPh,null);
  assert.equal(s.myocardial.contractilityAuthority,'not-coupled-fail-closed');
});

test('PEEP changes preserve patient state and intervention history',()=>{
  const c=createCandidate();
  const before=c.runFor(3.2);
  const t0=before.timeSec;
  const recruitmentBefore=before.recruitment.map(x=>x.fraction);
  c.setPEEP(14);
  const after=c.runFor(0.2);
  assert(after.timeSec>t0);
  assert.equal(after.ventilator.settings.peep,14);
  assert(after.interventions.some(x=>x.kind==='SET_PEEP'));
  assert.equal(after.recruitment.length,recruitmentBefore.length);
  assert.equal(after.gas.anatomicalShuntFraction,0.05);
});

test('VT RR and FiO2 controller changes apply at a breath boundary without reset',()=>{
  const c=createCandidate();
  c.runFor(3.2);
  const t0=c.snapshot().timeSec;
  c.requestVentilatorSettings({
    vt:0.36,
    rr:24,
    fio2:0.8,
  });
  const queued=c.snapshot();
  assert.equal(queued.ventilator.pendingControllerChange,true);
  c.runFor(3.2);
  const after=c.snapshot();
  assert(after.timeSec>t0);
  assert.equal(after.ventilator.settings.vt,0.36);
  assert.equal(after.ventilator.settings.rr,24);
  assert.equal(after.ventilator.settings.fio2,0.8);
  assert(after.interventions.some(x=>x.kind==='APPLY_CONTROLLER_CHANGE'));
  assert.equal(after.gas.anatomicalShuntFraction,0.05);
});

test('bedside hold advances the same coupled patient and records plateau',()=>{
  const c=createCandidate();
  c.runFor(3.2);
  const t0=c.snapshot().timeSec;
  const s=c.requestInspiratoryHold(0.1);
  assert(s.timeSec>t0);
  assert(
    s.measurements.some(m=>
      m.kind==='INSPIRATORY_HOLD' &&
      Number.isFinite(m.plateauPressureCmH2O)
    )
  );
  assert.equal(s.hemodynamics.status,'ready');
});

test('candidate refuses to infer anatomical shunt',()=>{
  assert.throws(()=>createV16PhysicianArdsCandidate({
    patientParams:PRESETS.phenotype_moderate_recruitability(),
    initialRecruitmentState:{normal:1,recruitable:0.5,consolidated:0},
    ventilatorSettings:{
      fio2:0.6,peep:10,rr:20,vt:0.42,
      inspiratoryFlow:0.5,inspiratoryPause:0,
    },
    excessLungWaterMl:0,
    blood:{sidMolPerL:0.040,o2MaxMlPerMl:0.201,tempC:37,carboxyPercent:0},
    metabolism:{tissueO2UseMlPerMin:250,tissueCo2ProductionMmolPerMin:9},
    environment:{barometricPressureMmHg:760,inspiredCo2Fraction:0},
  }),/anatomicalShuntFraction/);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
