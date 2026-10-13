'use strict';

/**
 * v1.6 physician-testable persistent ARDS candidate.
 *
 * This is the bedside-facing composition harness, not a new physiology model.
 * It owns no physiologic equations. It preserves one Vent patient and one
 * integrated cardiopulmonary candidate while ventilator settings change.
 *
 * Required explicit case inputs:
 * - mechanical phenotype parameters;
 * - starting recruitment state;
 * - starting ventilator settings;
 * - anatomical shunt fraction;
 * - excess lung water boundary;
 * - blood/metabolic/environment boundaries.
 *
 * No Berlin-severity -> shunt, recruitment, or hemodynamic inference occurs.
 */

const {
  Simulation,
  VcAcController,
}=require('./simulation.js');
const {
  createV16IntegratedArdsCardiopulmonaryCandidate,
}=require('./v16_integrated_ards_cardiopulmonary_candidate.js');

const SOURCE=Object.freeze({
  role:'physician-facing persistent ARDS composition harness',
  mechanics:'Vent',
  cardiopulmonary:'v1.6 integrated ARDS candidate',
  authority:'candidate-not-canonical',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}
function fraction(v,label){
  finite(v,label);
  if(v<0||v>=1) throw new Error(label+' must be in [0,1)');
  return v;
}

function validateVcSettings(s){
  if(!s||typeof s!=='object') throw new Error('ventilatorSettings are required');
  nonNegative(s.peep,'ventilatorSettings.peep');
  positive(s.rr,'ventilatorSettings.rr');
  positive(s.vt,'ventilatorSettings.vt');
  finite(s.fio2,'ventilatorSettings.fio2');
  if(s.fio2<0||s.fio2>1) throw new Error('ventilatorSettings.fio2 must be in [0,1]');
  positive(s.inspiratoryFlow,'ventilatorSettings.inspiratoryFlow');
  if(s.inspiratoryPause!=null) nonNegative(s.inspiratoryPause,'ventilatorSettings.inspiratoryPause');
  return s;
}

function createV16PhysicianArdsCandidate({
  patientParams,
  initialRecruitmentState,
  ventilatorSettings,
  anatomicalShuntFraction,
  excessLungWaterMl,
  blood,
  metabolism,
  environment,
  dtSec=0.002,
  pulmonaryVascularInitialState={
    PpaTm:18,
    Fpa:80,
    PpalTm:13,
    PpcTm:9,
    PpvTm:10,
  },
  deadSpaceBtpsMlProvider=null,
  averagingWindowSec=1,
}={}){
  if(!patientParams) throw new Error('patientParams are required');
  if(!initialRecruitmentState) throw new Error('initialRecruitmentState is required');
  validateVcSettings(ventilatorSettings);
  fraction(anatomicalShuntFraction,'anatomicalShuntFraction');
  nonNegative(excessLungWaterMl,'excessLungWaterMl');
  if(!blood||!metabolism||!environment){
    throw new Error('blood, metabolism, and environment are required');
  }
  positive(dtSec,'dtSec');
  positive(averagingWindowSec,'averagingWindowSec');

  const controller=new VcAcController({...ventilatorSettings});
  const simulation=new Simulation({
    params:patientParams,
    controller,
    dt:dtSec,
    fio2:ventilatorSettings.fio2,
    trackGas:false,
    initialPEEP:ventilatorSettings.peep,
    initialRecruitmentState,
  });

  const integrated=createV16IntegratedArdsCardiopulmonaryCandidate({
    simulation,
    dtSec,
    pulmonaryVascularInitialState,
    pulmonaryShuntFractionProvider:()=>anatomicalShuntFraction,
    blood,
    metabolism,
    environment,
    excessLungWaterProvider:()=>excessLungWaterMl,
    deadSpaceBtpsMlProvider,
  });

  let accumulator={
    seconds:0,
    map:0,
    pap:0,
    rap:0,
    lap:0,
    lvOutflow:0,
  };
  let averages=null;
  let lastIntegrated=integrated.snapshot();

  function resetAccumulator(){
    accumulator={
      seconds:0,
      map:0,
      pap:0,
      rap:0,
      lap:0,
      lvOutflow:0,
    };
  }

  function integrateHemodynamics(snapshot){
    if(!snapshot?.cardiovascular?.cardiovascular?.hemodynamics) return;
    const h=snapshot.cardiovascular.cardiovascular.hemodynamics;
    accumulator.seconds+=dtSec;
    accumulator.map+=h.systemicArterialPressureMmHg*dtSec;
    accumulator.pap+=snapshot.physicianState.pulmonaryArteryPressureMmHg*dtSec;
    accumulator.rap+=h.rightAtrialPressureMmHg*dtSec;
    accumulator.lap+=h.leftAtrialPressureMmHg*dtSec;
    accumulator.lvOutflow+=h.leftVentricleOutflowMlPerSec*dtSec;

    if(accumulator.seconds+1e-12>=averagingWindowSec){
      const t=accumulator.seconds;
      averages=Object.freeze({
        windowSec:t,
        mapMmHg:accumulator.map/t,
        meanPulmonaryArteryPressureMmHg:accumulator.pap/t,
        rightAtrialPressureMmHg:accumulator.rap/t,
        leftAtrialPressureMmHg:accumulator.lap/t,
        cardiacOutputMlPerSec:accumulator.lvOutflow/t,
      });
      resetAccumulator();
    }
  }

  function step(){
    const ventResult=simulation.step();
    if(ventResult.failed){
      const e=new Error(
        'Vent mechanics step failed: '+
        (ventResult.output.failureKind||'STEP_FAILED')
      );
      e.diagnostics=ventResult.output;
      throw e;
    }
    lastIntegrated=integrated.step();
    integrateHemodynamics(lastIntegrated);
    return snapshot();
  }

  function runFor(seconds){
    nonNegative(seconds,'seconds');
    const n=Math.floor(seconds/dtSec+1e-9);
    for(let i=0;i<n;i++) step();
    const rem=seconds-n*dtSec;
    if(rem>1e-9){
      throw new Error('seconds must be an integer multiple of dtSec');
    }
    return snapshot();
  }

  function setPEEP(peepCmH2O){
    simulation.setPEEP(nonNegative(peepCmH2O,'peepCmH2O'));
    return snapshot();
  }

  function requestVentilatorSettings(next={}){
    const current=simulation.controller.settings;
    const merged={
      ...current,
      ...next,
    };
    validateVcSettings(merged);
    const nextController=new VcAcController(merged);
    simulation.requestControllerChange(nextController,{
      source:'v1.6 physician ARDS candidate',
      requestedSettings:Object.freeze({...merged}),
    });
    return snapshot();
  }

  function physicianHemodynamics(){
    if(!averages) return Object.freeze({
      status:'waiting-for-completed-averaging-window',
      requestedWindowSec:averagingWindowSec,
    });

    const h=lastIntegrated.physicianState;
    const coMlMin=averages.cardiacOutputMlPerSec*60;
    const coLMin=coMlMin/1000;
    const hr=h.heartRatePerMin;
    const svMl=hr>0 ? coMlMin/hr : null;
    const svr=coLMin>0
      ?(averages.mapMmHg-averages.rightAtrialPressureMmHg)/coLMin
      :null;
    const pvr=coLMin>0
      ?(averages.meanPulmonaryArteryPressureMmHg-
        averages.leftAtrialPressureMmHg)/coLMin
      :null;

    return Object.freeze({
      status:'ready',
      averagingWindowSec:averages.windowSec,
      heartRatePerMin:hr,
      meanArterialPressureMmHg:averages.mapMmHg,
      cardiacOutputLPerMin:coLMin,
      strokeVolumeMl:svMl,
      systemicVascularResistanceMmHgMinPerL:svr,
      pulmonaryVascularResistanceWoodUnits:pvr,
      meanPulmonaryArteryPressureMmHg:
        averages.meanPulmonaryArteryPressureMmHg,
      rightAtrialPressureMmHg:averages.rightAtrialPressureMmHg,
      leftAtrialPressureMmHg:averages.leftAtrialPressureMmHg,
    });
  }

  function advanceUntilMeasurement(kind,previousCount,maxAdvanceSec=90){
    positive(maxAdvanceSec,'maxAdvanceSec');
    const start=simulation.state.t;
    while(simulation.state.t-start<maxAdvanceSec){
      step();
      const count=simulation.measurements.filter(m=>m.kind===kind).length;
      if(count>previousCount) return snapshot();
    }
    throw new Error(kind+' did not complete within maxAdvanceSec');
  }

  function requestInspiratoryHold(durationSec=0.5){
    positive(durationSec,'durationSec');
    const count=simulation.measurements
      .filter(m=>m.kind==='INSPIRATORY_HOLD').length;
    simulation.requestInspiratoryHold(durationSec);
    return advanceUntilMeasurement('INSPIRATORY_HOLD',count,90);
  }

  function requestExpiratoryHold(durationSec=0.5){
    positive(durationSec,'durationSec');
    const count=simulation.measurements
      .filter(m=>m.kind==='EXPIRATORY_HOLD').length;
    simulation.requestExpiratoryHold(durationSec);
    return advanceUntilMeasurement('EXPIRATORY_HOLD',count,90);
  }

  function performPassiveMechanicsMeasurement({
    holdDurationSec=0.5,
    maxAdvanceSecPerHold=90,
  }={}){
    positive(holdDurationSec,'holdDurationSec');
    positive(maxAdvanceSecPerHold,'maxAdvanceSecPerHold');
    const inspCount=simulation.measurements
      .filter(m=>m.kind==='INSPIRATORY_HOLD').length;
    simulation.requestInspiratoryHold(holdDurationSec);
    advanceUntilMeasurement(
      'INSPIRATORY_HOLD',
      inspCount,
      maxAdvanceSecPerHold
    );

    const expCount=simulation.measurements
      .filter(m=>m.kind==='EXPIRATORY_HOLD').length;
    simulation.requestExpiratoryHold(holdDurationSec);
    return advanceUntilMeasurement(
      'EXPIRATORY_HOLD',
      expCount,
      maxAdvanceSecPerHold
    );
  }

  function snapshot(){
    const regional=lastIntegrated.regionalOxygen;
    const regionalRows=regional?.status==='ready'
      ?regional.regionalO2Perfusion.regions.map(r=>Object.freeze({
        id:r.id,
        alveolarVentilationStpdMlPerMin:
          r.alveolarVentilationStpdMlPerMin,
        alveolarPo2MmHg:r.pAlveolarO2MmHg,
        perfusionFraction:r.perfusionFraction,
        hpvResistanceCoefficient:r.hpvResistanceCoefficient,
      }))
      :[];

    return Object.freeze({
      schema:'v16-physician-ards-candidate/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec:simulation.state.t,
      ventilator:Object.freeze({
        mode:'VC_AC',
        settings:Object.freeze({...simulation.controller.settings}),
        airwayPressureCmH2O:simulation.state.airwayPressure,
        totalLungElasticVolumeL:simulation.state.totalVolume,
        pendingControllerChange:simulation.pendingControllerChange!=null,
      }),
      gas:Object.freeze({
        pao2MmHg:lastIntegrated.physicianState?.pao2MmHg??null,
        paco2MmHg:lastIntegrated.physicianState?.paco2MmHg??null,
        arterialPh:lastIntegrated.physicianState?.arterialPh??null,
        fio2:lastIntegrated.physicianState?.fio2??
          simulation.controller.settings.fio2,
        regionalStatus:regional?.status??'awaiting-integrated-step',
        regions:Object.freeze(regionalRows),
        anatomicalShuntFraction,
      }),
      hemodynamics:physicianHemodynamics(),
      pulmonary:Object.freeze({
        pulmonaryVascular:lastIntegrated.pulmonaryVascular??null,
        sourceCoordinate:
          lastIntegrated.pulmonaryVascular?.boundary?.coordinateSnapshot??null,
      }),
      recruitment:Object.freeze(
        simulation.state.compartments.map(c=>Object.freeze({
          id:c.id,
          fraction:c.recruitment,
        }))
      ),
      interventions:Object.freeze([...simulation.interventions]),
      measurements:Object.freeze([...simulation.measurements]),
      ownership:lastIntegrated.ownership??null,
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,
    runFor,
    snapshot,
    setPEEP,
    requestVentilatorSettings,
    requestInspiratoryHold,
    requestExpiratoryHold,
    performPassiveMechanicsMeasurement,
    simulation,
    integrated,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  validateVcSettings,
  createV16PhysicianArdsCandidate,
});
