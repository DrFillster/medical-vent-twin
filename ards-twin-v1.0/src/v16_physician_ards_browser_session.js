'use strict';

/**
 * Browser/session adapter for the v1.6 physician ARDS candidate.
 *
 * This owns no physiology. It:
 * - resolves the selected Berlin case to its Vent mechanical phenotype;
 * - preserves explicit case inputs (recruitment, shunt, excess lung water);
 * - supplies published generic-reference chemistry/environment boundaries;
 * - maps the v1.6 physician snapshot into the existing browser monitor schema.
 */

const { getBerlinCase } = require('./berlin_case_catalog.js');
const { makePatientParams } = require('./contracts.js');
const {
  summarizeSimulationMeasurements,
}=require('./bedside_measurements.js');
const {
  createV16PhysicianArdsCandidate,
}=require('./v16_physician_ards_candidate.js');

const SOURCE=Object.freeze({
  role:'v1.6 physician browser/session adapter',
  physiologyAuthority:false,
  authority:'composition-and-display-only',
});

const V16_BROWSER_REFERENCE_BOUNDARIES=Object.freeze({
  referenceAbsoluteAlveolarVolumeL:2.25,
  referenceAbsoluteAlveolarVolumeProvenance:Object.freeze({
    sourceQualified:true,
    source:'Karamolegkos et al. 2021 Table II nominal FRC',
    doi:'10.1109/OJEMB.2021.3128629',
    patientSpecific:false,
  }),
  referencePleuralPressureCmH2O:-5,
  referencePleuralPressureProvenance:Object.freeze({
    sourceQualified:true,
    source:'Albanese/Karamolegkos passive respiratory coordinate initialization',
    patientSpecific:false,
  }),
  blood:Object.freeze({
    sidMolPerL:0.040,
    o2MaxMlPerMl:0.201,
    tempC:37,
    carboxyPercent:0,
  }),
  metabolism:Object.freeze({
    tissueO2UseMlPerMin:250,
    tissueCo2ProductionMmolPerMin:9,
  }),
  environment:Object.freeze({
    barometricPressureMmHg:760,
    inspiredCo2Fraction:0,
  }),
  deadSpaceBtpsMl:150,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
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

function vcSettingsFromBrowser(ventilation){
  if(!ventilation||ventilation.mode!=='VC_AC'){
    throw new Error('v1.6 physician browser candidate currently supports VC-AC only');
  }
  return Object.freeze({
    fio2:ventilation.fio2,
    peep:ventilation.peep,
    rr:ventilation.rr,
    vt:ventilation.vtL,
    inspiratoryFlow:ventilation.inspiratoryFlowLps,
    inspiratoryPause:ventilation.inspiratoryPauseSec||0,
  });
}

function recentWaveform(simulation,maxPoints=1800){
  const trace=Array.isArray(simulation?.trace)?simulation.trace:[];
  const start=Math.max(0,trace.length-maxPoints);
  return Object.freeze(trace.slice(start).map(row=>Object.freeze({
    t:row.t,
    pressureCmH2O:row.output?.airwayPressure??null,
    flowLps:row.output?.airwayFlow??null,
    volumeL:row.output?.totalVolume??null,
    phase:row.phase??null,
    maneuver:row.maneuver??null,
  })));
}

function normalizeSnapshot(candidate,caseId){
  const s=candidate.snapshot();
  const sim=candidate.simulation;
  const settings=s.ventilator.settings;
  const m=summarizeSimulationMeasurements(sim);
  const h=s.hemodynamics||{};
  const raw=candidate.integrated.snapshot();
  const gasRaw=raw?.pulmonaryGas?.gas?.gases||{};
  const arterial=gasRaw.arterial||{};
  const venous=gasRaw.venous||{};

  const cardiacOutputMlPerMin=
    Number.isFinite(h.cardiacOutputLPerMin)
      ?h.cardiacOutputLPerMin*1000
      :null;

  return Object.freeze({
    sessionSchema:'v16-physician-ards-browser-session/v1',
    case:Object.freeze({id:caseId}),
    timeSec:s.timeSec,
    ventilator:Object.freeze({
      mode:s.ventilator.mode,
      fio2:settings.fio2,
      peepCmH2O:settings.peep,
      rrPerMin:settings.rr,
      vtL:settings.vt,
      inspiratoryFlowLps:settings.inspiratoryFlow,
      inspiratoryPauseSec:settings.inspiratoryPause||0,
    }),
    ventilatorChangePending:Boolean(s.ventilator.pendingControllerChange),
    systemic:Object.freeze({
      source:'v1.6 integrated ARDS cardiopulmonary candidate',
      status:'candidate-not-canonical',
      gasExchange:Object.freeze({
        pao2MmHg:s.gas.pao2MmHg,
        paco2MmHg:s.gas.paco2MmHg,
        pH:s.gas.arterialPh,
        sao2Fraction:Number.isFinite(arterial.saturationFraction)
          ?arterial.saturationFraction:null,
        pvo2MmHg:Number.isFinite(venous.po2MmHg)?venous.po2MmHg:null,
        svo2Fraction:Number.isFinite(venous.saturationFraction)
          ?venous.saturationFraction:null,
      }),
      hemodynamics:Object.freeze({
        heartRatePerMin:h.heartRatePerMin??null,
        meanArterialPressureMmHg:h.meanArterialPressureMmHg??null,
        cardiacOutputMlPerMin,
        strokeVolumeMl:h.strokeVolumeMl??null,
        systemicVascularResistanceMmHgMinPerL:
          h.systemicVascularResistanceMmHgMinPerL??null,
        pulmonaryVascularResistanceMmHgMinPerL:
          h.pulmonaryVascularResistanceWoodUnits??null,
        rightAtrialPressureMmHg:h.rightAtrialPressureMmHg??null,
        leftAtrialPressureMmHg:h.leftAtrialPressureMmHg??null,
        pulmonaryArteryPressureMmHg:
          h.meanPulmonaryArteryPressureMmHg??null,
        systemicOutflowMode:'v1.6-integrated-candidate',
      }),
      regionalOxygen:Object.freeze({
        status:s.gas.regionalStatus,
        regions:s.gas.regions,
        anatomicalShuntFraction:s.gas.anatomicalShuntFraction,
      }),
      decompensation:Object.freeze({
        cardiacArrest:false,
        status:'terminal-state integration not promoted in v1.6 ARDS browser candidate',
      }),
    }),
    pulmonary:Object.freeze({
      measurements:m,
      recentWaveform:recentWaveform(sim),
      recruitment:s.recruitment,
      pulmonaryVascular:s.pulmonary.pulmonaryVascular,
      sourceCoordinate:s.pulmonary.sourceCoordinate,
    }),
    coupling:Object.freeze({
      mode:'v1.6-integrated-ards-candidate',
      authority:'candidate-not-canonical',
    }),
    v16Candidate:s,
    browserAdapter:Object.freeze({
      physiologyAuthority:false,
      provenance:SOURCE,
    }),
  });
}

function createV16PhysicianArdsBrowserSession({
  caseId,
  ventilation,
  initialRecruitmentState,
  dt=0.002,
  anatomicalShuntFraction,
  excessLungWaterMl,
  referenceAbsoluteAlveolarVolumeL=
    V16_BROWSER_REFERENCE_BOUNDARIES.referenceAbsoluteAlveolarVolumeL,
  referencePleuralPressureCmH2O=
    V16_BROWSER_REFERENCE_BOUNDARIES.referencePleuralPressureCmH2O,
}={}){
  const clinicalCase=getBerlinCase(caseId);
  const patientParams=makePatientParams(clinicalCase.phenotype.mechanicsParams);
  fraction(anatomicalShuntFraction,'anatomicalShuntFraction');
  nonNegative(excessLungWaterMl,'excessLungWaterMl');
  finite(referenceAbsoluteAlveolarVolumeL,'referenceAbsoluteAlveolarVolumeL');
  finite(referencePleuralPressureCmH2O,'referencePleuralPressureCmH2O');

  const candidate=createV16PhysicianArdsCandidate({
    patientParams,
    initialRecruitmentState,
    ventilatorSettings:vcSettingsFromBrowser(ventilation),
    anatomicalShuntFraction,
    anatomicalShuntProvenance:Object.freeze({
      sourceQualified:true,
      kind:'explicit-browser-case-input',
      patientSpecific:false,
      note:'Explicit research case state; not inferred from Berlin severity or recruitment.',
    }),
    referenceAbsoluteAlveolarVolumeL,
    referenceAbsoluteAlveolarVolumeProvenance:
      V16_BROWSER_REFERENCE_BOUNDARIES.referenceAbsoluteAlveolarVolumeProvenance,
    referencePleuralPressureCmH2O,
    referencePleuralPressureProvenance:
      V16_BROWSER_REFERENCE_BOUNDARIES.referencePleuralPressureProvenance,
    excessLungWaterMl,
    blood:V16_BROWSER_REFERENCE_BOUNDARIES.blood,
    metabolism:V16_BROWSER_REFERENCE_BOUNDARIES.metabolism,
    environment:V16_BROWSER_REFERENCE_BOUNDARIES.environment,
    deadSpaceBtpsMlProvider:
      ()=>V16_BROWSER_REFERENCE_BOUNDARIES.deadSpaceBtpsMl,
    dtSec:dt,
    averagingWindowSec:1,
  });

  function initialize(){
    return normalizeSnapshot(candidate,caseId);
  }
  function runFor(seconds){
    candidate.runFor(seconds);
    return normalizeSnapshot(candidate,caseId);
  }
  function setPEEP(valueCmH2O){
    candidate.setPEEP(valueCmH2O);
    return normalizeSnapshot(candidate,caseId);
  }
  function requestVentilationChange(next){
    candidate.requestVentilatorSettings(vcSettingsFromBrowser(next));
    return normalizeSnapshot(candidate,caseId);
  }
  function requestInspiratoryHold(durationSec){
    candidate.requestInspiratoryHold(durationSec==null?0.5:durationSec);
    return normalizeSnapshot(candidate,caseId);
  }
  function requestExpiratoryHold(durationSec){
    candidate.requestExpiratoryHold(durationSec==null?0.5:durationSec);
    return normalizeSnapshot(candidate,caseId);
  }
  function performPassiveMechanicsMeasurement(options={}){
    candidate.performPassiveMechanicsMeasurement(options);
    return normalizeSnapshot(candidate,caseId);
  }
  function snapshot(){
    return normalizeSnapshot(candidate,caseId);
  }

  return Object.freeze({
    initialize,
    runFor,
    setPEEP,
    requestVentilationChange,
    requestInspiratoryHold,
    requestExpiratoryHold,
    performPassiveMechanicsMeasurement,
    snapshot,
    candidate,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  V16_BROWSER_REFERENCE_BOUNDARIES,
  recentWaveform,
  normalizeSnapshot,
  createV16PhysicianArdsBrowserSession,
});
