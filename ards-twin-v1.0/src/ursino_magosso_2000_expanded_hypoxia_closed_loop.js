'use strict';

/**
 * Ursino & Magosso 2000 expanded hypoxia closed-loop candidate.
 *
 * Source-family composition:
 * - Ursino 1998 heart and baroreceptor mechanics;
 * - Ursino & Magosso 2000 hypoxia autonomic pathways;
 * - Ursino & Magosso 2000 split systemic reflex effectors;
 * - Ursino & Magosso 2000 local O2 vascular regulation;
 * - Ursino & Magosso 2000 five-bed systemic vascular plant;
 * - optional Ursino & Magosso 2000 spontaneous-VT validation pathway.
 *
 * Candidate only. No canonical bedside authority.
 */

const {
  createUrsinoMagosso2000ExpandedPlantRuntime,
}=require('./ursino_magosso_2000_expanded_plant_runtime.js');
const {
  createUrsinoBaroreceptorShadow,
}=require('./ursino_baroreceptor_shadow.js');
const {
  createUrsinoMagossoAutonomicShadow,
}=require('./ursino_magosso_autonomic_shadow.js');
const {
  createUrsinoMagosso2000SplitEffectorsRuntime,
}=require('./ursino_magosso_2000_split_effectors_runtime.js');
const {
  createUrsinoMagosso2000LocalO2Candidate,
}=require('./ursino_magosso_2000_local_o2_candidate.js');
const {
  P:O2_P,
  instantaneousCardiacPumpPowerMmHgMlPerSec,
}=require('./ursino_magosso_2000_oxygen_metabolic_candidate.js');
const {
  createUrsinoMagosso2000TidalVolumeCandidate,
}=require('./ursino_magosso_2000_tidal_volume_candidate.js');

const SOURCE=Object.freeze({
  primary:'Ursino M, Magosso E. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
  doi:'10.1152/ajpheart.2000.279.1.H149',
  authority:'candidate-not-canonical',
  role:'expanded-source-hypoxia-closed-loop-reproduction',
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
function firstOrderExact(current,target,dtSec,tauSec){
  finite(current,'current'); finite(target,'target');
  nonNegative(dtSec,'dtSec'); positive(tauSec,'tauSec');
  if(dtSec===0) return current;
  const d=Math.exp(-dtSec/tauSec);
  return target+(current-target)*d;
}

function createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec=0.002,
  pao2MmHg=95,
  paco2MmHg=40,
  tidalVolumeL=0.583,
  ventilationMode='external-delivered-vt',
}={}){
  positive(dtSec,'dtSec');
  nonNegative(pao2MmHg,'pao2MmHg');
  positive(paco2MmHg,'paco2MmHg');
  nonNegative(tidalVolumeL,'tidalVolumeL');
  if(![
    'external-delivered-vt',
    'ursino-magosso-2000-spontaneous-validation',
  ].includes(ventilationMode)){
    throw new Error('unknown ventilationMode: '+ventilationMode);
  }

  const plant=createUrsinoMagosso2000ExpandedPlantRuntime({dtSec});
  const baro=createUrsinoBaroreceptorShadow();
  const autonomic=createUrsinoMagossoAutonomicShadow();
  const localO2=createUrsinoMagosso2000LocalO2Candidate();
  const sourceVentilation=ventilationMode===
    'ursino-magosso-2000-spontaneous-validation'
      ?createUrsinoMagosso2000TidalVolumeCandidate()
      :null;

  let environment=Object.freeze({pao2MmHg,paco2MmHg,tidalVolumeL});
  let effectors=null;
  let autonomicState=null;
  let localState=null;
  let sourceVentilationState=sourceVentilation
    ?sourceVentilation.snapshot()
    :null;
  let averagePumpPowerMmHgMlPerSec=
    O2_P.metabolism.heartBasalPowerMmHgMlPerSec;

  function setEnvironment(next={}){
    const x={...environment,...next};
    nonNegative(x.pao2MmHg,'pao2MmHg');
    positive(x.paco2MmHg,'paco2MmHg');
    nonNegative(x.tidalVolumeL,'tidalVolumeL');
    environment=Object.freeze(x);
    return snapshot();
  }

  function bedFlows(s){
    const p=s.state;
    const e=s.effectors;
    const flows={
      brain:(p.Psp-p.Pbv)/e.Rbp,
      heart:(p.Psp-p.Phv)/e.Rhp,
      muscle:(p.Psp-p.Pmv)/e.Rmp,
    };
    for(const [k,v] of Object.entries(flows)){
      if(!(v>0&&Number.isFinite(v))){
        throw new Error(k+' source bed flow became non-positive');
      }
    }
    return flows;
  }

  function step(){
    const before=plant.snapshot();
    const baroState=baro.step({
      dtSec,
      arterialPressureMmHg:before.hemodynamics.systemicArterialPressureMmHg,
    });

    const activeTidalVolumeL=sourceVentilationState
      ?sourceVentilationState.tidalVolumeL
      :environment.tidalVolumeL;

    autonomicState=autonomic.step({
      dtSec,
      pao2MmHg:environment.pao2MmHg,
      tidalVolumeL:activeTidalVolumeL,
      fAbSpikesPerSec:baroState.fAbSpikesPerSec,
    });

    if(sourceVentilation){
      sourceVentilationState=sourceVentilation.step({
        dtSec,
        fAcSpikesPerSec:autonomicState.fAcSpikesPerSec,
      });
    }

    if(effectors==null){
      effectors=createUrsinoMagosso2000SplitEffectorsRuntime({
        initialVascularSympatheticSpikesPerSec:
          autonomicState.fSpSpikesPerSec,
        initialCardiacSympatheticSpikesPerSec:
          autonomicState.fShSpikesPerSec,
        initialCardiacVagalSpikesPerSec:
          autonomicState.fVSpikesPerSec,
      });
    }

    const reflex=effectors.step({
      dtSec,
      vascularSympatheticSpikesPerSec:autonomicState.fSpSpikesPerSec,
      cardiacSympatheticSpikesPerSec:autonomicState.fShSpikesPerSec,
      cardiacVagalSpikesPerSec:autonomicState.fVSpikesPerSec,
    });

    const flows=bedFlows(before);
    const h=before.hemodynamics;
    const instantaneousPower=instantaneousCardiacPumpPowerMmHgMlPerSec({
      leftVentriclePressureMmHg:h.leftVentriclePressureMmHg,
      dLeftVentricleVolumeDtMlPerSec:h.leftVentricleVolumeRateMlPerSec,
      rightVentriclePressureMmHg:h.rightVentriclePressureMmHg,
      dRightVentricleVolumeDtMlPerSec:h.rightVentricleVolumeRateMlPerSec,
    });
    averagePumpPowerMmHgMlPerSec=firstOrderExact(
      averagePumpPowerMmHgMlPerSec,
      instantaneousPower,
      dtSec,
      O2_P.metabolism.cardiacPowerTauSec
    );

    localState=localO2.step({
      dtSec,
      pao2MmHg:environment.pao2MmHg,
      paco2MmHg:environment.paco2MmHg,
      brainFlowMlPerSec:flows.brain,
      coronaryFlowMlPerSec:flows.heart,
      muscleFlowMlPerSec:flows.muscle,
      muscleNormalResistanceMmHgSecPerMl:reflex.absolute.RmpNormal,
      averageCardiacPumpPowerMmHgMlPerSec:
        averagePumpPowerMmHgMlPerSec,
    });

    plant.setEffectors({
      EmaxLv:reflex.absolute.EmaxLv,
      EmaxRv:reflex.absolute.EmaxRv,
      Rsp:reflex.absolute.Rsp,
      Rep:reflex.absolute.Rep,
      Rmp:localState.resistanceMmHgSecPerMl.muscle,
      Rbp:localState.resistanceMmHgSecPerMl.brain,
      Rhp:localState.resistanceMmHgSecPerMl.heart,
      Vusv:reflex.absolute.Vusv,
      Vuev:reflex.absolute.Vuev,
      Vumv:reflex.absolute.Vumv,
      heartPeriodSec:reflex.absolute.heartPeriodSec,
      dVusvDtMlPerSec:reflex.rate.Vusv,
      dVumvDtMlPerSec:reflex.rate.Vumv,
    });

    plant.step();
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

  function snapshot(){
    const p=plant.snapshot();
    return Object.freeze({
      timeSec:p.timeSec,
      environment,
      ventilation:Object.freeze({
        mode:ventilationMode,
        activeTidalVolumeL:sourceVentilationState
          ?sourceVentilationState.tidalVolumeL
          :environment.tidalVolumeL,
        canonicalVentilatorAuthority:false,
        sourceValidationState:sourceVentilationState,
      }),
      hemodynamics:p.hemodynamics,
      vascularState:p.state,
      vascularEffectors:p.effectors,
      autonomic:autonomicState,
      localO2:localState,
      averagePumpPowerMmHgMlPerSec,
      conservation:p.conservation,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      candidatePlantControlAuthority:true,
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,runFor,snapshot,setEnvironment,source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
});
