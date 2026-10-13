'use strict';

/**
 * v1.5 integrated cardiopulmonary candidate spine.
 *
 * Active candidate chain:
 * Vent-delivered VT + PaO2 + PaCO2
 * -> Ursino baroreceptor + pulmonary stretch + Magosso/Ursino gas autonomics
 * -> source-family sympathetic/vagal effectors
 * -> Ursino/Magosso five-bed cardiovascular plant
 * -> source local-O2 regulation in muscle, brain, and coronary beds.
 *
 * Vent remains the canonical owner of airway mechanics. The Karamolegkos
 * pressure/absolute-alveolar-volume pulmonary vascular path remains blocked
 * until the Vent coordinate bridge is source-verified.
 *
 * Candidate only. No canonical bedside authority.
 */

const {
  createUrsinoMagosso2000ExpandedPlantRuntime,
}=require('./ursino_magosso_2000_expanded_plant_runtime.js');
const {
  VASCULAR,
}=require('./ursino_magosso_2000_expanded_vascular_candidate.js');
const {
  createUrsinoBaroreceptorShadow,
}=require('./ursino_baroreceptor_shadow.js');
const {
  P:O2_2000_P,
  firstOrderExact,
  pulmonaryStretchStatic,
}=require('./ursino_magosso_autonomic_shadow.js');
const {
  createMagossoUrsinoGasAutonomicCandidate,
}=require('./magosso_ursino_2001_gas_autonomic_candidate.js');
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

const SOURCE=Object.freeze({
  cardiovascularPlant:
    'Ursino & Magosso 2000, doi:10.1152/ajpheart.2000.279.1.H149',
  heartBaroreflex:
    'Ursino 1998, doi:10.1152/ajpheart.1998.275.5.H1733',
  gasAutonomic:
    'Magosso & Ursino 2001, doi:10.1152/ajpheart.2001.281.5.H2036',
  localO2:
    'Ursino & Magosso 2000 Eqs. 41-48',
  pulmonaryMechanicalCandidate:
    'Karamolegkos/Albanese/Chbat 2021, doi:10.1109/OJEMB.2021.3128629',
  authority:'candidate-not-canonical',
});

const BLOCKED_BRIDGES=Object.freeze({
  ventAbsoluteAlveolarVolume:
    'No source-verified mapping from Vent elastic volume to Karamolegkos absolute V_A.',
  ventPleuralAlveolarPressure:
    'Karamolegkos pressure-coupled pulmonary vascular runtime is not active in this spine.',
  myocardialEnergeticsToChamber:
    'Source-valid myocardial energetic/acid-base to chamber-mechanics ownership is not yet integrated.',
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

function createV15IntegratedCardiopulmonaryCandidate({
  dtSec=0.002,
  pao2MmHg=95,
  paco2MmHg=40,
  deliveredTidalVolumeL=0.5,
}={}){
  positive(dtSec,'dtSec');
  nonNegative(pao2MmHg,'pao2MmHg');
  positive(paco2MmHg,'paco2MmHg');
  nonNegative(deliveredTidalVolumeL,'deliveredTidalVolumeL');

  const plant=createUrsinoMagosso2000ExpandedPlantRuntime({dtSec});
  const baro=createUrsinoBaroreceptorShadow();
  const gas=createMagossoUrsinoGasAutonomicCandidate();
  const localO2=createUrsinoMagosso2000LocalO2Candidate();

  let inputs=Object.freeze({
    pao2MmHg,
    paco2MmHg,
    deliveredTidalVolumeL,
  });
  let fAp=null;
  let effectors=null;
  let controllerState=null;
  let localO2State=null;
  let myocardialSourceState=null;
  let averagePumpPowerMmHgMlPerSec=
    O2_P.metabolism.heartBasalPowerMmHgMlPerSec;

  function setCanonicalInputs(next={}){
    const forbidden=[
      'absoluteAlveolarVolumeL',
      'alveolarPressureMmHg',
      'pleuralPressureMmHg',
    ];
    for(const key of forbidden){
      if(Object.prototype.hasOwnProperty.call(next,key)){
        throw new Error(
          key+' is blocked until the Vent-to-Karamolegkos coordinate bridge is source-verified'
        );
      }
    }

    const merged={...inputs,...next};
    nonNegative(merged.pao2MmHg,'pao2MmHg');
    positive(merged.paco2MmHg,'paco2MmHg');
    nonNegative(merged.deliveredTidalVolumeL,'deliveredTidalVolumeL');
    inputs=Object.freeze(merged);
    return snapshot();
  }

  function bedFlows(s){
    const p=s.state;
    const e=s.effectors;
    const flows=Object.freeze({
      brain:(p.Psp-p.Pbv)/e.Rbp,
      heart:(p.Psp-p.Phv)/e.Rhp,
      muscle:(p.Psp-p.Pmv)/e.Rmp,
    });
    for(const [key,value] of Object.entries(flows)){
      if(!(value>0&&Number.isFinite(value))){
        throw new Error(key+' source bed flow became non-positive');
      }
    }
    return flows;
  }

  function step(){
    const before=plant.snapshot();
    const h=before.hemodynamics;

    const b=baro.step({
      dtSec,
      arterialPressureMmHg:h.systemicArterialPressureMmHg,
      arterialPressureRateMmHgPerSec:
        h.systemicArterialPressureRateMmHgPerSec,
    });

    const phiAp=pulmonaryStretchStatic(inputs.deliveredTidalVolumeL);
    fAp=firstOrderExact(
      fAp,
      phiAp,
      dtSec,
      O2_2000_P.pulmonaryStretch.tauSec
    );

    const a=gas.step({
      dtSec,
      pao2MmHg:inputs.pao2MmHg,
      paco2MmHg:inputs.paco2MmHg,
      fAbSpikesPerSec:b.fAbSpikesPerSec,
      fApSpikesPerSec:fAp,
    });

    if(effectors==null){
      effectors=createUrsinoMagosso2000SplitEffectorsRuntime({
        initialVascularSympatheticSpikesPerSec:a.fSpSpikesPerSec,
        initialCardiacSympatheticSpikesPerSec:a.fShSpikesPerSec,
        initialCardiacVagalSpikesPerSec:a.fVSpikesPerSec,
      });
    }

    const e=effectors.step({
      dtSec,
      vascularSympatheticSpikesPerSec:a.fSpSpikesPerSec,
      cardiacSympatheticSpikesPerSec:a.fShSpikesPerSec,
      cardiacVagalSpikesPerSec:a.fVSpikesPerSec,
    });

    const flows=bedFlows(before);
    const instantaneousPower=instantaneousCardiacPumpPowerMmHgMlPerSec({
      leftVentriclePressureMmHg:h.leftVentriclePressureMmHg,
      dLeftVentricleVolumeDtMlPerSec:h.leftVentricleVolumeRateMlPerSec,
      rightVentriclePressureMmHg:h.rightVentriclePressureMmHg,
      dRightVentricleVolumeDtMlPerSec:h.rightVentricleVolumeRateMlPerSec,
    });

    averagePumpPowerMmHgMlPerSec=(
      O2_P.metabolism.cardiacPowerTauSec>0
        ? averagePumpPowerMmHgMlPerSec+
          (
            instantaneousPower-averagePumpPowerMmHgMlPerSec
          )*(
            1-Math.exp(-dtSec/O2_P.metabolism.cardiacPowerTauSec)
          )
        : instantaneousPower
    );

    localO2State=localO2.step({
      dtSec,
      pao2MmHg:inputs.pao2MmHg,
      paco2MmHg:inputs.paco2MmHg,
      brainFlowMlPerSec:flows.brain,
      coronaryFlowMlPerSec:flows.heart,
      muscleFlowMlPerSec:flows.muscle,
      muscleNormalResistanceMmHgSecPerMl:e.absolute.RmpNormal,
      averageCardiacPumpPowerMmHgMlPerSec,
    });

    myocardialSourceState=Object.freeze({
      coronaryBloodFlowMlPerMin:flows.heart*60,
      myocardialO2UseMlPerMin:
        localO2State.oxygenConsumptionMlPerSec.heart*60,
      sourceFlowCoordinate:'Ursino/Magosso 2000 coronary bed flow',
      sourceO2UseCoordinate:
        'Ursino/Magosso 2000 Eq. 46 cardiac O2 consumption from averaged pump power',
      conversionOnly:Object.freeze({
        secondsPerMinute:60,
        physiologicGainAdded:false,
      }),
    });

    plant.setEffectors({
      EmaxLv:e.absolute.EmaxLv,
      EmaxRv:e.absolute.EmaxRv,
      Rsp:e.absolute.Rsp,
      Rep:e.absolute.Rep,
      Rmp:localO2State.resistanceMmHgSecPerMl.muscle,
      Rbp:localO2State.resistanceMmHgSecPerMl.brain,
      Rhp:localO2State.resistanceMmHgSecPerMl.heart,
      Vusv:e.absolute.Vusv,
      Vuev:e.absolute.Vuev,
      Vumv:e.absolute.Vumv,
      heartPeriodSec:e.absolute.heartPeriodSec,
      dVusvDtMlPerSec:e.rate.Vusv,
      dVumvDtMlPerSec:e.rate.Vumv,
    });

    plant.step();

    controllerState=Object.freeze({
      afferents:Object.freeze({
        fAbSpikesPerSec:b.fAbSpikesPerSec,
        fAcSpikesPerSec:a.fAcSpikesPerSec,
        fApSpikesPerSec:fAp,
      }),
      autonomic:Object.freeze({
        fSpSpikesPerSec:a.fSpSpikesPerSec,
        fSvSpikesPerSec:a.fSvSpikesPerSec,
        fShSpikesPerSec:a.fShSpikesPerSec,
        fVSpikesPerSec:a.fVSpikesPerSec,
      }),
      effectors:e,
    });

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
    const s=plant.snapshot();
    const h=s.hemodynamics;
    return Object.freeze({
      schema:'v15-integrated-cardiopulmonary-candidate/v1',
      timeSec:s.timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      candidatePlantControlAuthority:true,
      inputs,
      physicianState:Object.freeze({
        heartRatePerMin:h.heartRatePerMin,
        systemicArterialPressureMmHg:h.systemicArterialPressureMmHg,
        pulmonaryArteryPressureMmHg:h.pulmonaryArteryPressureMmHg,
        rightAtrialPressureMmHg:h.rightAtrialPressureMmHg,
        leftAtrialPressureMmHg:h.leftAtrialPressureMmHg,
        pao2MmHg:inputs.pao2MmHg,
        paco2MmHg:inputs.paco2MmHg,
        deliveredTidalVolumeL:inputs.deliveredTidalVolumeL,
      }),
      cardiovascular:Object.freeze({
        hemodynamics:h,
        vascularState:s.state,
        vascularEffectors:s.effectors,
        controller:controllerState,
        localO2:localO2State,
        myocardialSourceState,
        averagePumpPowerMmHgMlPerSec,
        conservation:s.conservation,
      }),
      ownership:Object.freeze({
        ventMechanics:'external-canonical-owner',
        arterialGas:'external-canonical-input',
        cardiovascularPlant:'candidate-source-family-owner',
        autonomicController:'candidate-source-family-owner',
        regionalSystemicO2Control:'candidate-source-family-owner',
        pulmonaryMechanicalCoupling:'blocked-not-active',
        myocardialEnergeticContractility:'blocked-not-active',
      }),
      blockedBridges:BLOCKED_BRIDGES,
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,
    runFor,
    snapshot,
    setCanonicalInputs,
    source:SOURCE,
    blockedBridges:BLOCKED_BRIDGES,
  });
}

module.exports=Object.freeze({
  SOURCE,
  BLOCKED_BRIDGES,
  createV15IntegratedCardiopulmonaryCandidate,
});
