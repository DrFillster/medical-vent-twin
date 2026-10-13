'use strict';

/**
 * v1.6 ARDS pulmonary-gas candidate.
 *
 * Governing rule:
 * Vent owns mechanics. Source-qualified pulmonary perfusion/shunt must be
 * supplied by a pulmonary vascular/VQ provider. Static phenotype
 * perfusionFraction x recruitment is NOT accepted here as final physiology.
 *
 * The gas/membrane equations are HumMod-source aligned. This composition layer
 * is candidate-only and deliberately fails closed at unresolved V/Q authority.
 */

const {
  pulmonaryMembraneState,
}=require('./hummod_ards_core_pulmonary_membrane.js');
const {
  createHumModArdsGasRuntime,
}=require('./hummod_ards_core_runtime.js');
const {
  humModLegacyDeadSpaceMl,
}=require('./hummod_ards_core_breathing.js');
const {
  createVentToArdsCoreSnapshot,
}=require('./hummod_ards_core_coupling.js');

const SOURCE=Object.freeze({
  gas:'HumMod LungO2/LungCO2/LungVein O2/CO2 source-aligned runtime',
  membrane:'HumMod PulmonaryMembrane.DES',
  mechanics:'Vent canonical mechanics',
  authority:'candidate-not-canonical',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}
function fraction(v,label){
  finite(v,label);
  if(v<0||v>1) throw new Error(label+' must be in [0,1]');
  return v;
}

function validatePulmonaryPerfusionState(state){
  if(!state||typeof state!=='object'){
    throw new Error('source-qualified pulmonaryPerfusionState is required');
  }
  if(state.sourceQualified!==true){
    throw new Error('pulmonaryPerfusionState must be source-qualified');
  }
  positive(state.totalPulmonaryBloodFlowMlPerMin,'totalPulmonaryBloodFlowMlPerMin');
  positive(state.ventilatedPulmonaryBloodFlowMlPerMin,'ventilatedPulmonaryBloodFlowMlPerMin');
  if(state.ventilatedPulmonaryBloodFlowMlPerMin>state.totalPulmonaryBloodFlowMlPerMin){
    throw new Error('ventilated pulmonary flow cannot exceed total pulmonary flow');
  }
  if(state.shuntFraction!=null) fraction(state.shuntFraction,'shuntFraction');
  return state;
}

function createV16ArdsPulmonaryGasCandidate({
  simulation,
  gasInitialState,
  useHumModSourceInitialGasState=false,
  blood,
  metabolism,
  environment,
  pulmonaryPerfusionProvider,
  excessLungWaterProvider,
  deadSpaceBtpsMlProvider=null,
}={}){
  if(!simulation) throw new Error('simulation is required');
  if(typeof pulmonaryPerfusionProvider!=='function'){
    throw new Error('pulmonaryPerfusionProvider is required');
  }
  if(typeof excessLungWaterProvider!=='function'){
    throw new Error('excessLungWaterProvider is required');
  }
  if(deadSpaceBtpsMlProvider!=null&&typeof deadSpaceBtpsMlProvider!=='function'){
    throw new Error('deadSpaceBtpsMlProvider must be a function or null');
  }
  if(!blood||!metabolism||!environment){
    throw new Error('blood, metabolism, and environment boundaries are required');
  }

  let timeSec=0;
  let runtime=null;
  let last=null;

  function buildBoundary(){
    const vent=createVentToArdsCoreSnapshot(simulation);
    if(vent.ventilator.mode!=='VC_AC'){
      throw new Error('v1.6 ARDS pulmonary candidate currently supports VC_AC only');
    }

    const vtMl=positive(vent.ventilator.settings.vt*1000,'tidalVolumeBtpsMl');
    const perf=validatePulmonaryPerfusionState(
      pulmonaryPerfusionProvider({timeSec,simulation,previous:last})
    );
    const excessLungWaterMl=finite(
      excessLungWaterProvider({timeSec,simulation,previous:last}),
      'excessLungWaterMl'
    );
    if(excessLungWaterMl<0) throw new Error('excessLungWaterMl must be >= 0');

    const membrane=pulmonaryMembraneState({
      alveolarPulmonaryBloodFlowMlPerMin:
        perf.ventilatedPulmonaryBloodFlowMlPerMin,
      excessLungWaterMl,
    });

    const deadSpaceBtpsMl=deadSpaceBtpsMlProvider
      ? positive(deadSpaceBtpsMlProvider({timeSec,simulation,previous:last}),'deadSpaceBtpsMl')
      : humModLegacyDeadSpaceMl(vtMl);

    return Object.freeze({
      vent,
      perf,
      membrane,
      boundary:Object.freeze({
        ventilation:Object.freeze({
          respiratoryRatePerMin:vent.ventilator.rrPerMin,
          tidalVolumeBtpsMl:vtMl,
          deadSpaceBtpsMl,
          fio2:vent.ventilator.fio2,
        }),
        pulmonary:Object.freeze({
          membranePermeabilityMlPerMinPerMmHg:
            membrane.permeabilityMlPerMinPerMmHg,
          ventilatedPulmonaryBloodFlowMlPerMin:
            perf.ventilatedPulmonaryBloodFlowMlPerMin,
        }),
        circulation:Object.freeze({
          cardiacOutputMlPerMin:perf.totalPulmonaryBloodFlowMlPerMin,
        }),
        metabolism:Object.freeze({...metabolism}),
        blood:Object.freeze({...blood}),
        environment:Object.freeze({...environment}),
      }),
    });
  }

  function ensureRuntime(){
    const built=buildBoundary();
    if(runtime==null){
      runtime=createHumModArdsGasRuntime({
        initialState:gasInitialState,
        useHumModSourceInitialState:useHumModSourceInitialGasState,
        boundary:built.boundary,
      });
    }
    return built;
  }

  function composeSnapshot({gas,built,status='ready'}={}){
    return Object.freeze({
      schema:'v16-ards-pulmonary-gas-candidate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      status,
      gas,
      mechanics:Object.freeze({
        mode:built.vent.ventilator.mode,
        rrPerMin:built.vent.ventilator.rrPerMin,
        tidalVolumeL:built.vent.ventilator.settings.vt,
        fio2:built.vent.ventilator.fio2,
        airwayPressureCmH2O:built.vent.mechanics.airwayPressureCmH2O,
      }),
      pulmonaryPerfusion:built.perf,
      pulmonaryMembrane:built.membrane,
      ownership:Object.freeze({
        mechanics:'Vent',
        gasExchange:'HumMod-source-aligned-candidate',
        pulmonaryPerfusion:'external-source-qualified-provider',
        excessLungWater:'external-source-qualified-provider',
      }),
      prohibitedShortcut:
        'static phenotype perfusionFraction x recruitment is not accepted as final pulmonary perfusion',
      provenance:SOURCE,
    });
  }

  function initialize(){
    const built=ensureRuntime();
    const gas=runtime.snapshot();
    last=composeSnapshot({
      gas,
      built,
      status:'initialized-no-time-advance',
    });
    return last;
  }

  function step({
    dtSec,
    arterialO2TargetOverride=null,
  }={}){
    positive(dtSec,'dtSec');
    const built=ensureRuntime();
    const gas=runtime.step({
      dtSec,
      boundary:built.boundary,
      arterialO2TargetOverride,
    });
    timeSec+=dtSec;
    last=composeSnapshot({gas,built,status:'ready'});
    return last;
  }

  function snapshot(){
    return last||Object.freeze({
      schema:'v16-ards-pulmonary-gas-candidate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      status:'awaiting-initialization',
      provenance:SOURCE,
    });
  }

  return Object.freeze({initialize,step,snapshot,source:SOURCE});
}

module.exports=Object.freeze({
  SOURCE,
  validatePulmonaryPerfusionState,
  createV16ArdsPulmonaryGasCandidate,
});
