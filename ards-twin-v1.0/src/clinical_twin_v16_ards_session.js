'use strict';

/**
 * Browser/session adapter for the v1.6 integrated ARDS candidate.
 *
 * This module does not add physiology. It maps the persistent v1.6 physician
 * candidate into the stable clinical-browser snapshot/actions contract.
 *
 * Case-specific inputs remain explicit:
 * - recruitment state
 * - ventilator settings
 * - anatomical shunt fraction
 * - excess lung water
 *
 * Blood/metabolic/environment values below are authored synthetic
 * reference-subject boundaries for the physician evaluation build, not
 * patient measurements and not Berlin-severity-derived values.
 */

const { getBerlinCase }=require('./berlin_case_catalog.js');
const { makePatientParams }=require('./contracts.js');
const { summarizeSimulationMeasurements }=require('./bedside_measurements.js');
const {
  createV16PhysicianArdsCandidate,
}=require('./v16_physician_ards_candidate.js');

const V16_BROWSER_REFERENCE_BOUNDARIES=Object.freeze({
  status:'authored-synthetic-reference-subject-boundaries-not-patient-data',
  blood:Object.freeze({
    sidMolPerL:0.040,
    o2MaxMlPerMl:1.34*0.15,
    tempC:37,
    carboxyPercent:0,
  }),
  metabolism:Object.freeze({
    tissueO2UseMlPerMin:250,
    tissueCo2ProductionMmolPerMin:200*0.0446,
  }),
  environment:Object.freeze({
    barometricPressureMmHg:760,
    inspiredCo2Fraction:0,
  }),
  pulmonaryReference:Object.freeze({
    absoluteAlveolarVolumeL:2.25,
    referencePleuralPressureCmH2O:-5,
    absoluteAlveolarVolumeProvenance:Object.freeze({
      sourceQualified:true,
      source:'Karamolegkos 2021 nominal FRC',
      patientSpecific:false,
    }),
    pleuralPressureProvenance:Object.freeze({
      sourceQualified:true,
      source:'Albanese public CP-model respiratory reference state',
      patientSpecific:false,
    }),
  }),
  provenance:Object.freeze({
    role:'browser physician-evaluation reference boundaries',
    patientSpecific:false,
    berlinDerived:false,
    note:
      'These boundaries are visible model inputs for the synthetic reference patient, not measured patient values.',
  }),
});

const SOURCE=Object.freeze({
  role:'v1.6 browser physician ARDS session adapter',
  candidate:'v16_physician_ards_candidate.js',
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
function shuntFraction(v,label){
  finite(v,label);
  if(v<0||v>=1) throw new Error(label+' must be in [0,1)');
  return v;
}
function validateRecruitmentState(v){
  if(!v||typeof v!=='object') throw new Error('initialRecruitmentState is required');
  for(const key of ['normal','recruitable','consolidated']){
    finite(v[key],'initialRecruitmentState.'+key);
  }
  if(v.normal!==1) throw new Error('initialRecruitmentState.normal must be 1');
  if(v.recruitable<0||v.recruitable>1){
    throw new Error('initialRecruitmentState.recruitable must be in [0,1]');
  }
  if(v.consolidated!==0){
    throw new Error('initialRecruitmentState.consolidated must be 0');
  }
  return v;
}

function browserVentilatorSettings(ventilation){
  if(!ventilation||ventilation.mode!=='VC_AC'){
    throw new Error('v1.6 physician ARDS browser provider currently supports VC_AC only');
  }
  return Object.freeze({
    fio2:finite(ventilation.fio2,'ventilation.fio2'),
    peep:nonNegative(ventilation.peep,'ventilation.peep'),
    rr:positive(ventilation.rr,'ventilation.rr'),
    vt:positive(ventilation.vtL,'ventilation.vtL'),
    inspiratoryFlow:positive(
      ventilation.inspiratoryFlowLps,
      'ventilation.inspiratoryFlowLps'
    ),
    inspiratoryPause:
      ventilation.inspiratoryPauseSec==null
        ?0
        :nonNegative(
          ventilation.inspiratoryPauseSec,
          'ventilation.inspiratoryPauseSec'
        ),
  });
}

function createBerlinV16ArdsSession({
  caseId,
  ventilation,
  initialRecruitmentState,
  anatomicalShuntFraction,
  excessLungWaterMl,
  dt=0.002,
  referenceBoundaries=V16_BROWSER_REFERENCE_BOUNDARIES,
}={}){
  const clinicalCase=getBerlinCase(caseId);
  validateRecruitmentState(initialRecruitmentState);
  const ventSettings=browserVentilatorSettings(ventilation);
  shuntFraction(anatomicalShuntFraction,'anatomicalShuntFraction');
  nonNegative(excessLungWaterMl,'excessLungWaterMl');
  positive(dt,'dt');

  if(!referenceBoundaries?.blood||
     !referenceBoundaries?.metabolism||
     !referenceBoundaries?.environment){
    throw new Error('referenceBoundaries blood/metabolism/environment are required');
  }

  const candidate=createV16PhysicianArdsCandidate({
    patientParams:makePatientParams(clinicalCase.phenotype.mechanicsParams),
    initialRecruitmentState,
    ventilatorSettings:ventSettings,
    anatomicalShuntFraction,
    anatomicalShuntProvenance:{
      sourceQualified:true,
      source:
        'explicit case input; 35% browser reference is Karamolegkos/Dhainaut ARDS validation when selected',
      caseValue:anatomicalShuntFraction,
      berlinDerived:false,
    },
    referenceAbsoluteAlveolarVolumeL:
      referenceBoundaries.pulmonaryReference.absoluteAlveolarVolumeL,
    referenceAbsoluteAlveolarVolumeProvenance:
      referenceBoundaries.pulmonaryReference.absoluteAlveolarVolumeProvenance,
    referencePleuralPressureCmH2O:
      referenceBoundaries.pulmonaryReference.referencePleuralPressureCmH2O,
    referencePleuralPressureProvenance:
      referenceBoundaries.pulmonaryReference.pleuralPressureProvenance,
    excessLungWaterMl,
    blood:referenceBoundaries.blood,
    metabolism:referenceBoundaries.metabolism,
    environment:referenceBoundaries.environment,
    dtSec:dt,
    averagingWindowSec:1,
  });

  let initialized=false;
  const sessionEvents=[];

  function ensureReady(maxSec=12){
    const start=candidate.snapshot().timeSec;
    while(candidate.snapshot().timeSec-start<maxSec){
      const s=candidate.snapshot();
      if(s.gas.regionalStatus==='ready' &&
         s.hemodynamics.status==='ready'){
        return s;
      }
      candidate.step();
    }
    throw new Error(
      'v1.6 ARDS candidate did not produce completed-breath regional gas and hemodynamic window during numerical initialization'
    );
  }

  function currentVentilator(){
    const s=candidate.simulation.controller.settings;
    return Object.freeze({
      mode:'VC_AC',
      fio2:s.fio2,
      peepCmH2O:s.peep,
      rrPerMin:s.rr,
      vtL:s.vt,
      inspiratoryFlowLps:s.inspiratoryFlow,
      inspiratoryPauseSec:s.inspiratoryPause,
    });
  }

  function gasView(raw){
    const integrated=candidate.integrated.snapshot();
    const gases=integrated.pulmonaryGas?.gas?.gases||{};
    const arterial=gases.arterial||{};
    const venous=gases.venous||{};
    return Object.freeze({
      pao2MmHg:raw.gas.pao2MmHg,
      paco2MmHg:raw.gas.paco2MmHg,
      pH:raw.gas.arterialPh,
      sao2Fraction:
        Number.isFinite(arterial.saturationFraction)
          ?arterial.saturationFraction:null,
      pvo2MmHg:Number.isFinite(venous.po2MmHg)?venous.po2MmHg:null,
      svo2Fraction:
        Number.isFinite(venous.saturationFraction)
          ?venous.saturationFraction:null,
      anatomicalShuntFraction:raw.gas.anatomicalShuntFraction,
      regionalStatus:raw.gas.regionalStatus,
      regionalOxygen:Object.freeze(raw.gas.regions),
      arterialO2Authority:
        integrated.ownership?.arterialOxygen??null,
    });
  }

  function hemodynamicView(raw){
    const h=raw.hemodynamics;
    if(h.status!=='ready'){
      return Object.freeze({status:h.status});
    }
    return Object.freeze({
      status:'ready',
      heartRatePerMin:h.heartRatePerMin,
      meanArterialPressureMmHg:h.meanArterialPressureMmHg,
      cardiacOutputMlPerMin:h.cardiacOutputLPerMin*1000,
      strokeVolumeMl:h.strokeVolumeMl,
      systemicVascularResistanceMmHgMinPerL:
        h.systemicVascularResistanceMmHgMinPerL,
      pulmonaryVascularResistanceMmHgMinPerL:
        h.pulmonaryVascularResistanceWoodUnits,
      rightAtrialPressureMmHg:h.rightAtrialPressureMmHg,
      pulmonaryArteryPressureMmHg:h.meanPulmonaryArteryPressureMmHg,
      leftAtrialPressureMmHg:h.leftAtrialPressureMmHg,
      averagingWindowSec:h.averagingWindowSec,
      systemicOutflowMode:'Ursino-Magosso-source-family-candidate',
      systemicOutflowAuthority:'candidate-not-canonical',
    });
  }

  function waveform(){
    return Object.freeze(
      candidate.simulation.trace.slice(-2000).map(row=>Object.freeze({
        t:row.t,
        pressureCmH2O:row.output.airwayPressure,
        flowLps:row.output.airwayFlow,
        volumeL:row.output.totalVolume,
        phase:row.phase,
        maneuver:row.maneuver,
      }))
    );
  }

  function snapshot(){
    const raw=candidate.snapshot();
    const mechanics=summarizeSimulationMeasurements(candidate.simulation);
    return Object.freeze({
      sessionSchema:'berlin-clinical-twin-v16-integrated-ards-session/v1',
      timeSec:raw.timeSec,
      case:Object.freeze({
        id:clinicalCase.id,
        name:clinicalCase.name,
        berlinSeverity:clinicalCase.clinical.berlinSeverity,
        recruitability:clinicalCase.phenotype.recruitability,
        synthetic:true,
      }),
      ventilator:currentVentilator(),
      ventilatorChangePending:
        Boolean(candidate.simulation.pendingControllerChange),
      pulmonary:Object.freeze({
        engine:'Vent',
        airwayPressureCmH2O:candidate.simulation.state.airwayPressure,
        airwayFlowLps:candidate.simulation.state.totalFlow,
        totalLungVolumeL:candidate.simulation.state.totalVolume,
        measurements:mechanics,
        recentWaveform:waveform(),
        waveformStatus:'most-recent-2000-committed-Vent-samples',
        regionalOxygen:raw.gas.regions,
        anatomicalShuntFraction,
        excessLungWaterMl,
        gasExchangeAuthority:
          'v1.6 regional VQ/HPV oxygen + HumMod-source gas candidate',
      }),
      systemic:Object.freeze({
        source:'v1.6 integrated ARDS cardiopulmonary candidate',
        status:'live-coupled-candidate',
        gasExchange:gasView(raw),
        hemodynamics:hemodynamicView(raw),
        decompensation:null,
        autonomicShadow:null,
        physicianComparison:null,
      }),
      coupling:Object.freeze({
        mode:'v1.6-integrated-ards-candidate',
        systemicResponseToVentInterventions:'modeled-by-persistent-candidate',
        clinicalValidation:false,
        canonicalAuthority:false,
      }),
      events:Object.freeze([
        ...sessionEvents,
        ...raw.interventions,
      ]),
      engineeringBoundaries:Object.freeze({
        referenceSubject:referenceBoundaries,
        anatomicalShunt:Object.freeze({
          value:anatomicalShuntFraction,
          status:'explicit-case-input',
        }),
        excessLungWater:Object.freeze({
          valueMl:excessLungWaterMl,
          status:'explicit-case-input',
        }),
        pulmonaryReference:Object.freeze({
          ...referenceBoundaries.pulmonaryReference,
          derivedSplitInitialization:
            candidate.integrated.snapshot().pulmonaryInitialization??null,
        }),
      }),
      provenance:Object.freeze({
        pulmonaryMechanics:'Vent',
        regionalVq:'Das 2015 + Marshall 1994 candidate',
        pulmonaryVascular:'Karamolegkos 2021 candidate',
        gas:'HumMod source-aligned candidate',
        cardiovascular:'Ursino/Magosso source-family candidate',
        patient:'synthetic physician-evaluation case',
        authority:SOURCE.authority,
      }),
    });
  }

  return Object.freeze({
    kind:'berlin-clinical-twin-v16-integrated-ards-session',
    clinicalCase,
    candidate,

    initialize(){
      if(initialized) return snapshot();
      ensureReady();
      initialized=true;
      sessionEvents.push(Object.freeze({
        t:candidate.snapshot().timeSec,
        kind:'SESSION_INITIALIZED',
        provider:'v1.6-integrated-ards-candidate',
      }));
      return snapshot();
    },

    runFor(seconds){
      if(!initialized) throw new Error('session must be initialized before runFor');
      candidate.runFor(nonNegative(seconds,'seconds'));
      return snapshot();
    },

    setPEEP(value){
      if(!initialized) throw new Error('session must be initialized before interventions');
      candidate.setPEEP(value);
      sessionEvents.push(Object.freeze({
        t:candidate.snapshot().timeSec,
        kind:'SET_PEEP',
        valueCmH2O:value,
      }));
      return snapshot();
    },

    requestVentilationChange(nextVentilation){
      if(!initialized) throw new Error('session must be initialized before interventions');
      const s=browserVentilatorSettings(nextVentilation);
      candidate.requestVentilatorSettings(s);
      sessionEvents.push(Object.freeze({
        t:candidate.snapshot().timeSec,
        kind:'REQUEST_VENTILATION_CHANGE',
        application:'next-completed-breath-boundary',
        settings:s,
      }));
      return snapshot();
    },

    performPassiveMechanicsMeasurement(options={}){
      if(!initialized) throw new Error('session must be initialized before interventions');
      candidate.performPassiveMechanicsMeasurement(options);
      return snapshot();
    },

    requestInspiratoryHold(durationSec=0.5){
      if(!initialized) throw new Error('session must be initialized before interventions');
      candidate.requestInspiratoryHold(durationSec);
      return snapshot();
    },

    requestExpiratoryHold(durationSec=0.5){
      if(!initialized) throw new Error('session must be initialized before interventions');
      candidate.requestExpiratoryHold(durationSec);
      return snapshot();
    },

    snapshot,
  });
}

module.exports=Object.freeze({
  SOURCE,
  V16_BROWSER_REFERENCE_BOUNDARIES,
  createBerlinV16ArdsSession,
});
