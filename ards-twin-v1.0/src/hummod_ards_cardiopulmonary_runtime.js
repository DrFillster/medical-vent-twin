'use strict';

const { createVentToArdsCoreSnapshot } = require('./hummod_ards_core_coupling.js');
const { createLiveCoreBoundaryFromVent } = require('./hummod_ards_core_vent_adapter.js');
const { createHumModArdsAutonomicController } = require('./hummod_ards_autonomic_controller.js');
const { createHumModSourceAlignedAutonomicController } = require('./hummod_ards_autonomic_source_aligned.js');
const { createHumModSourceAlignedCatecholamines } = require('./hummod_ards_catecholamines_source_aligned.js');
const { sourceSympatheticVascularComponents } = require('./hummod_ards_vascular_sympathetic_source_aligned.js');
const { createHumModSourceAlignedBrainHypoxia } = require('./hummod_brain_hypoxia_source_aligned.js');
const { exerciseSympsTotalEffect } = require('./hummod_exercise_sympathetic_source_aligned.js');
const { createHumModExerciseMetabolism } = require('./hummod_exercise_metabolism_source_aligned.js');
const { createHumModBloodVolume } = require('./hummod_blood_volume_source_aligned.js');
const { hgbConcentrationFromHematocrit } = require('./hummod_hgb_concentration_source_aligned.js');
const { exerciseMusclePumpEffect } = require('./hummod_exercise_muscle_pump_source_aligned.js');
const {
  createHumModArdsDecompensationController,
} = require('./hummod_ards_decompensation_controller.js');

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label); if(!(v>0)) throw new Error(label+' must be > 0'); return v;
}

function meanAirwayPressureCmH2O(simulation, recentSamples=1500){
  const s=createVentToArdsCoreSnapshot(simulation,{recentSamples});
  const tr=s.mechanics.recentTrace;
  if(!tr.length) return s.mechanics.airwayPressureCmH2O;
  return tr.reduce((a,row)=>a+row.airwayPressureCmH2O,0)/tr.length;
}

function createHumModArdsCardiopulmonaryRuntime({
  simulation,
  thorax,
  circulation,
  gasRuntime,
  pressureAdapter,
  systemicBoundaries,
  pulmonaryBoundaries,
  bloodBoundaries,
  environmentBoundaries,
  pericardialTmpMmHg=0,
  autonomicMode='legacy',
  catecholamineEcfvMl=null,
  nativeAutonomicInputsProvider=null,
  sourceBloodVolumeInitialMl=null,
  sourceBloodVolumeInitialHematocritFraction=0.44,
  systemicOutflowMode='conductance',
  explicitSystemicOutflowProvider=null,
}={}){
  if(!simulation||!thorax||!circulation||!gasRuntime){
    throw new Error('simulation, thorax, circulation, and gasRuntime are required');
  }
  if(!pressureAdapter||
     typeof pressureAdapter.cmH2OToMmHg!=='function'){
    throw new Error('validated pressureAdapter.cmH2OToMmHg is required');
  }
  finite(pericardialTmpMmHg,'pericardialTmpMmHg');
  if(catecholamineEcfvMl!=null) positive(catecholamineEcfvMl,'catecholamineEcfvMl');
  if(sourceBloodVolumeInitialMl!=null) positive(sourceBloodVolumeInitialMl,'sourceBloodVolumeInitialMl');
  finite(sourceBloodVolumeInitialHematocritFraction,'sourceBloodVolumeInitialHematocritFraction');
  if(nativeAutonomicInputsProvider!=null &&
     typeof nativeAutonomicInputsProvider!=='function'){
    throw new Error('nativeAutonomicInputsProvider must be a function or null');
  }
  if(!['legacy','source-aligned'].includes(autonomicMode)) throw new Error('unsupported autonomicMode: '+autonomicMode);
  if(!['conductance','explicit-organ-network'].includes(systemicOutflowMode)){
    throw new Error('unsupported systemicOutflowMode: '+systemicOutflowMode);
  }
  if(systemicOutflowMode==='explicit-organ-network' && typeof explicitSystemicOutflowProvider!=='function'){
    throw new Error('explicit-organ-network mode requires explicitSystemicOutflowProvider');
  }
  if(explicitSystemicOutflowProvider!=null && typeof explicitSystemicOutflowProvider!=='function'){
    throw new Error('explicitSystemicOutflowProvider must be a function or null');
  }

  let timeSec=0;
  let last=null;
  const decompensation = createHumModArdsDecompensationController();
  const autonomicBaseline = circulation.snapshot().activeBoundaries || systemicBoundaries.circulation || {
    heartRatePerMin: 75,
    systemicArterialConductanceMlPerMinPerMmHg: 60,
    systemicVenousConductanceMlPerMinPerMmHg: 692,
    systemicVenousV0Ml: 1700,
    leftContractilityMultiplier: 1,
  };
  const autonomic = createHumModArdsAutonomicController({
    baseline: autonomicBaseline,
  });
  const sourceAlignedAutonomic = createHumModSourceAlignedAutonomicController({
    initialCarotidPressureMmHg: 97,
    saNodeBasicRatePerMin: 82,
    systemicVenousV0BasicMl:
      autonomicBaseline.systemicVenousV0Ml == null ? 1700 : autonomicBaseline.systemicVenousV0Ml,
  });
  const catecholamines = catecholamineEcfvMl == null
    ? null
    : createHumModSourceAlignedCatecholamines({ ecfvMl: catecholamineEcfvMl });
  const brainHypoxia = createHumModSourceAlignedBrainHypoxia();
  const exerciseMetabolism = createHumModExerciseMetabolism();
  const sourceBloodVolume = sourceBloodVolumeInitialMl == null
    ? null
    : createHumModBloodVolume({
        initialBloodVolumeMl:sourceBloodVolumeInitialMl,
        initialHematocritFraction:sourceBloodVolumeInitialHematocritFraction,
      });
  if(sourceBloodVolume){
    circulation.setBoundaries({
      bloodVolumeMl:sourceBloodVolume.snapshot().bloodVolumeMl,
    });
  }
  circulation.setBoundaries({systemicOutflowMode});


  function step({dtSec}={}){
    positive(dtSec,'dtSec');

    // Once cardiovascular collapse has met the explicit experimental arrest
    // criteria, the reduced core enters a terminal state. We preserve the last
    // physiologic snapshot for provenance rather than continuing to integrate
    // a circulation that is no longer physiologically meaningful.
    if(decompensation.snapshot().cardiacArrest){
      timeSec+=dtSec;
      return snapshot();
    }

    const meanPaw=meanAirwayPressureCmH2O(simulation);
    const thoraxState=thorax.atStaticAirwayPressure(meanPaw);
    const thoracicPressureMmHg=pressureAdapter.cmH2OToMmHg(
      thoraxState.pleuralPressureCmH2O);
    finite(thoracicPressureMmHg,'converted thoracic pressure');
    const pericardialPressureMmHg=thoracicPressureMmHg+pericardialTmpMmHg;

    if(systemicOutflowMode==='explicit-organ-network'){
      const priorCirculation=circulation.snapshot();
      const explicitSystemicOutflow=explicitSystemicOutflowProvider({
        timeSec,
        dtSec,
        circulation:priorCirculation,
        previousStep:last,
      });
      if(!explicitSystemicOutflow || explicitSystemicOutflow.complete!==true){
        throw new Error('explicitSystemicOutflowProvider returned an incomplete organ network');
      }
      circulation.setBoundaries({
        systemicOutflowMode:'explicit-organ-network',
        explicitSystemicOutflow,
      });
    }

    let circ=circulation.step({
      dtSec,
      thoracicPressureMmHg,
      pericardialPressureMmHg,
    });

    const gasBefore = last && last.gas ? last.gas : gasRuntime.snapshot();
    const priorGas = gasBefore && gasBefore.gases
      ? gasBefore.gases.arterial
      : null;
    const priorVenousGas = gasBefore && gasBefore.gases
      ? gasBefore.gases.venous
      : null;
    const legacyControl = autonomic.step({
      dtSec,
      meanArterialPressureMmHg: circ.pressures.systemicArterialMmHg,
      thoracicPressureMmHg,
      arterialPo2MmHg: priorGas ? priorGas.po2MmHg : 90,
      arterialPco2MmHg: priorGas ? priorGas.pco2MmHg : 40,
      arterialPh: priorGas ? priorGas.pH : 7.40,
    });
    const brainHypoxiaState = brainHypoxia.step({
      dtSec,
      arterialPo2MmHg: priorGas ? priorGas.po2MmHg : 90,
      arterialO2ContentMlPerMl: priorGas ? priorGas.o2ContentMlPerMl : 0.196,
      o2MaxMlPerMl: gasBefore?.boundary?.blood?.o2MaxMlPerMl || 0.201,
      venousPh: priorVenousGas ? priorVenousGas.pH : 7.38,
      venousPco2MmHg: priorVenousGas ? priorVenousGas.pco2MmHg : 44.8,
      carboxyPercent: gasBefore?.boundary?.blood?.carboxyPercent || 0,
      tempC: gasBefore?.boundary?.blood?.tempC || 37,
      pressureGradientMmHg: Math.max(
        0,
        circ.pressures.systemicArterialMmHg -
        circ.pressures.systemicVenousMmHg),
      brainPco2MmHg: priorVenousGas ? priorVenousGas.pco2MmHg : 46.6,
    });
    const currentCatecholamines = catecholamines ? catecholamines.snapshot() : null;

    // Read upstream native inputs before applying source blood-volume changes.
    // The prior implementation could reference nativeAutonomicInputs before
    // initialization when the source blood-volume module was enabled.
    const preBloodRightAtrialTmpMmHg =
      circ.pressures.rightAtrialMmHg - pericardialPressureMmHg;
    const preBloodLeftAtrialTmpMmHg =
      circ.pressures.leftAtrialMmHg - pericardialPressureMmHg;
    const preBloodAverageAtrialTmpMmHg =
      (preBloodRightAtrialTmpMmHg + preBloodLeftAtrialTmpMmHg) / 2;
    const nativeAutonomicInputs = nativeAutonomicInputsProvider
      ? nativeAutonomicInputsProvider({
          timeSec,
          dtSec,
          meanArterialPressureMmHg: circ.pressures.systemicArterialMmHg,
          averageAtrialTmpMmHg:preBloodAverageAtrialTmpMmHg,
          priorArterialGas: priorGas,
        })
      : null;
    if(nativeAutonomicInputs!=null &&
       (typeof nativeAutonomicInputs!=='object' ||
        Array.isArray(nativeAutonomicInputs))){
      throw new Error('nativeAutonomicInputsProvider must return an object or null');
    }

    const bloodVolumeState = sourceBloodVolume
      ? sourceBloodVolume.step({
          dtSec,
          hemorrhageSwitch:Boolean(nativeAutonomicInputs?.hemorrhageSwitch),
          hemorrhageTargetRateMlPerMin:
            nativeAutonomicInputs?.hemorrhageTargetRateMlPerMin ?? 0,
          rbcGainMlPerMin:nativeAutonomicInputs?.rbcGainMlPerMin ?? 0,
          plasmaGainMlPerMin:nativeAutonomicInputs?.plasmaGainMlPerMin ?? 0,
          otherRbcLossMlPerMin:nativeAutonomicInputs?.otherRbcLossMlPerMin ?? 0,
          otherPlasmaLossMlPerMin:
            nativeAutonomicInputs?.otherPlasmaLossMlPerMin ?? 0,
        })
      : null;
    let hgbConcentrationState=null;
    if(bloodVolumeState){
      circulation.setBoundaries({
        bloodVolumeMl:bloodVolumeState.bloodVolumeMl,
      });
      circ=circulation.snapshot();
      hgbConcentrationState=hgbConcentrationFromHematocrit({
        hematocritFraction:bloodVolumeState.hematocritFraction,
        carboxyPercent:bloodBoundaries.carboxyPercent || 0,
      });
    }
    const rightAtrialTmpMmHg =
      circ.pressures.rightAtrialMmHg - pericardialPressureMmHg;
    const leftAtrialTmpMmHg =
      circ.pressures.leftAtrialMmHg - pericardialPressureMmHg;
    const averageAtrialTmpMmHg =
      (rightAtrialTmpMmHg + leftAtrialTmpMmHg) / 2;
    let exerciseMetabolismState=null;
    let exerciseSympatheticState=null;
    let exerciseSympsEffect=0;
    if(nativeAutonomicInputs?.exerciseMode != null){
      exerciseMetabolismState=exerciseMetabolism.step({
        dtSec,
        exertionMode:nativeAutonomicInputs.exerciseMode,
        bikePowerW:nativeAutonomicInputs.exerciseBikePowerW ?? 0,
        bikeRpm:nativeAutonomicInputs.exerciseBikeRpm ?? 50,
        bikeEfficiencyFraction:
          nativeAutonomicInputs.exerciseBikeEfficiencyFraction ?? 0.30,
      });
    }
    const sourceExerciseTotalWatts =
      exerciseMetabolismState?.totalWatts ??
      nativeAutonomicInputs?.exerciseTotalWatts ??
      null;
    if(sourceExerciseTotalWatts != null &&
       nativeAutonomicInputs?.skeletalMusclePh != null){
      exerciseSympatheticState=exerciseSympsTotalEffect({
        totalWatts:sourceExerciseTotalWatts,
        skeletalMusclePh:nativeAutonomicInputs.skeletalMusclePh,
        skeletalMuscleFunctionFailed:
          Boolean(nativeAutonomicInputs.skeletalMuscleFunctionFailed),
      });
      exerciseSympsEffect=exerciseSympatheticState.totalEffect;
    } else if(nativeAutonomicInputs?.exerciseSympsTotalEffect != null){
      exerciseSympsEffect=nativeAutonomicInputs.exerciseSympsTotalEffect;
    }

    const exerciseMusclePumpState = sourceExerciseTotalWatts == null
      ? null
      : exerciseMusclePumpEffect(sourceExerciseTotalWatts);

    const sourceControl = sourceAlignedAutonomic.step({
      dtSec,
      carotidPressureMmHg: circ.pressures.systemicArterialMmHg,
      averageAtrialTmpMmHg,
      humoralAlphaPoolEffect:
        currentCatecholamines ? currentCatecholamines.alphaEffect : 1,
      humoralBetaPoolEffect:
        currentCatecholamines ? currentCatecholamines.betaEffect : 1,
      brainFuelFractUseDelay:
        nativeAutonomicInputs?.brainFuelFractUseDelay ?? null,
      a2PoolLog10Conc:
        nativeAutonomicInputs?.a2PoolLog10Conc ?? null,
      brainFunctionEffect:
        nativeAutonomicInputs?.brainFunctionEffect ??
        brainHypoxiaState.brainFunctionEffect,
      exerciseSympsTotalEffect:exerciseSympsEffect,
    });
    const updatedCatecholamines = catecholamines
      ? catecholamines.step({
          dtSec,
          adrenalNerveHz: sourceControl.sympsCnsHz,
          generalGangliaHz: sourceControl.gangliaHz,
        })
      : null;
    const vascularSympatheticComponents = sourceSympatheticVascularComponents({
      gangliaHz: sourceControl.gangliaHz,
      alphaPoolEffect: currentCatecholamines ? currentCatecholamines.alphaEffect : 1,
    });
    const control = autonomicMode==='source-aligned'
      ? Object.freeze({
          ...legacyControl,
          sourceAligned: sourceControl,
          catecholamines: updatedCatecholamines,
          vascularSympatheticComponents,
          heartRatePerMin: sourceControl.heartRatePerMin,
          contractilityMultiplier: sourceControl.contractilityMultiplier,
          systemicVenousV0Ml: sourceControl.systemicVenousV0Ml,
          authority: Object.freeze({
            heartRate:'HumMod source-aligned acute subset',
            contractility:'HumMod source-aligned beta-receptor pathway',
            venousV0:'HumMod source-aligned venous alpha pathway',
            systemicArterialConductance:'legacy reduced controller',
            pulmonaryArterialConductance:'legacy reduced controller',
            acidoticContractility:'not applied to source-aligned HumMod pumping; legacy-only arterial-pH modifier',
            humoralAlphaBeta: catecholamines
              ? 'HumMod source-aligned dynamic NE/Epi pools'
              : 'normalized HumMod humoral fallback (ECFV unavailable)',
          }),
        })
      : legacyControl;
    const priorDecomp=decompensation.snapshot();
    // In the pinned HumMod source, ventricular pumping contractility is
    // Contractility-Basic * cardiac beta-receptor activity. The separate
    // LeftHeart/RightHeart Function pH subsystem is not multiplied into the
    // ventricular systole contractility equation. Therefore the legacy
    // arterial-pH respiratory-acidosis penalty must not be imposed on the
    // source-aligned HumMod pumping path.
    const directAcidoticContractilityMultiplier =
      autonomicMode==='source-aligned'
        ? 1
        : control.acidoticContractilityMultiplier;
    const effectiveContractility=
      control.contractilityMultiplier *
      directAcidoticContractilityMultiplier *
      priorDecomp.myocardialContractilityMultiplier;
    const sourceSaNodeHeartRatePerMin = control.heartRatePerMin;
    const chronotropicReserveMultiplier =
      priorDecomp.chronotropicReserveMultiplier;

    // Fidelity path: source-aligned mode uses the HumMod SA-node rate only.
    // The former empirical hypercapnic chronotropy overlay is retained in the
    // legacy controller for comparison but is never added to source-aligned HR.
    // Hypoxia reaches source HR through the native Brain-Flow ->
    // BrainInsult-PO2 -> Brain-Function -> SympsCNS path above.
    const nativeMetabolicAutonomicActive = Boolean(
      nativeAutonomicInputs &&
      (
        nativeAutonomicInputs.brainFuelFractUseDelay != null ||
        nativeAutonomicInputs.a2PoolLog10Conc != null ||
        nativeAutonomicInputs.exerciseSympsTotalEffect != null ||
        nativeAutonomicInputs.exerciseMode != null ||
        nativeAutonomicInputs.exerciseTotalWatts != null ||
        nativeAutonomicInputs.hemorrhageSwitch != null ||
        nativeAutonomicInputs.hemorrhageTargetRateMlPerMin != null ||
        nativeAutonomicInputs.skeletalMusclePh != null ||
        nativeAutonomicInputs.brainFunctionEffect != null
      )
    );
    const empiricalChronotropicBoostPerMin =
      legacyControl.empiricalChronotropicBoostPerMin || 0;
    const chronotropicExposureSec =
      legacyControl.hypercapnicChronotropyExposureSec || 0;
    const chronotropicBridgeEnvelope = 0;
    const appliedEmpiricalChronotropicBoostPerMin = 0;
    const effectiveHeartRatePerMin =
      autonomicMode==='source-aligned'
        ? sourceSaNodeHeartRatePerMin
        : control.heartRatePerMin;
    circulation.setBoundaries({
      heartRatePerMin: effectiveHeartRatePerMin,
      leftContractilityMultiplier: effectiveContractility,
      rightContractilityMultiplier: effectiveContractility,
      systemicArterialConductanceMlPerMinPerMmHg:
        control.systemicArterialConductanceMlPerMinPerMmHg,
      systemicVenousV0Ml: control.systemicVenousV0Ml,
      systemicVenousConductanceMultiplier:
        exerciseMusclePumpState ? exerciseMusclePumpState.effect : 1,
      pulmonaryArterialConductanceMultiplier:
        control.pulmonaryArterialConductanceMultiplier,
    });
    circ=circulation.snapshot();

    if(circ.mechanicalPumpFailure){
      const terminalDecomp=decompensation.forceArrest({
        reason:'mechanical-pump-failure',
        rhythm:'PEA',
      });
      timeSec+=dtSec;
      last=Object.freeze({
        meanAirwayPressureCmH2O:meanPaw,
        thorax:thoraxState,
        thoracicPressureMmHg,
        pericardialPressureMmHg,
        circulation:circ,
        autonomic:control,
        decompensation:terminalDecomp,
        effectiveHeartRatePerMin:0,
        effectiveContractilityMultiplier:0,
        gas:last && last.gas ? last.gas : gasRuntime.snapshot(),
        adapterDiagnostics:last && last.adapterDiagnostics
          ? last.adapterDiagnostics
          : null,
      });
      return snapshot();
    }

    const cardiacOutputMlPerMin=circ.flowsMlPerMin.leftVentricular;
    positive(cardiacOutputMlPerMin,'left ventricular cardiac output');

    const adapted=createLiveCoreBoundaryFromVent({
      simulation,
      systemic:{
        ...systemicBoundaries,
        cardiacOutputMlPerMin,
      },
      pulmonary:pulmonaryBoundaries,
      blood:hgbConcentrationState
        ? {
            ...bloodBoundaries,
            o2MaxMlPerMl:hgbConcentrationState.o2MaxMlPerMl,
          }
        : bloodBoundaries,
      environment:environmentBoundaries,
    });

    const gas=gasRuntime.step({
      dtSec,
      boundary:adapted.boundary,
    });

    const massBalance=gas.exchange && gas.exchange.massBalance
      ? gas.exchange.massBalance
      : null;
    const decomp=decompensation.step({
      dtSec,
      meanArterialPressureMmHg:circ.pressures.systemicArterialMmHg,
      mixedVenousO2SaturationFraction:gas.gases.venous.saturationFraction,
      requestedTissueO2UseMlPerMin:
        massBalance.requestedTissueO2UseMlPerMin,
      oxygenSupplyDeficitMlPerMin:
        massBalance.oxygenSupplyDeficitMlPerMin,
      arterialPh: gas.gases.arterial.pH,
      arterialPco2MmHg: gas.gases.arterial.pco2MmHg,
      deliveryToCriticalRatio:
        massBalance.deliveryToCriticalRatio,
    });

    timeSec+=dtSec;
    last=Object.freeze({
      meanAirwayPressureCmH2O:meanPaw,
      thorax:thoraxState,
      thoracicPressureMmHg,
      pericardialPressureMmHg,
      circulation:circ,
      autonomic:control,
      decompensation:decomp,
      sourceSaNodeHeartRatePerMin,
      chronotropicReserveMultiplier,
      effectiveHeartRatePerMin,
      nativeAutonomicInputs,
      exerciseMetabolism:exerciseMetabolismState,
      exerciseMusclePump:exerciseMusclePumpState,
      exerciseSympathetic:exerciseSympatheticState,
      sourceBloodVolume:bloodVolumeState,
      hgbConcentration:hgbConcentrationState,
      brainHypoxia:brainHypoxiaState,
      nativeMetabolicAutonomicActive,
      empiricalChronotropicBoostPerMin,
      chronotropicExposureSec,
      chronotropicBridgeEnvelope,
      appliedEmpiricalChronotropicBoostPerMin,
      rightAtrialTmpMmHg,
      leftAtrialTmpMmHg,
      averageAtrialTmpMmHg,
      directAcidoticContractilityMultiplier,
      effectiveContractilityMultiplier:effectiveContractility,
      gas,
      adapterDiagnostics:adapted.diagnostics,
    });
    return snapshot();
  }

  function snapshot(){
    return Object.freeze({
      schema:'hummod-ards-cardiopulmonary-runtime/v1',
      timeSec,
      lastStep:last,
      provenance:Object.freeze({
        pulmonaryMechanics:'Vent',
        thorax:'explicit passive chest-wall phenotype',
        circulation:'reduced source-aligned HumMod circulation with dynamic autonomic control',
        systemicOutflowMode,
        systemicOutflowAuthority: systemicOutflowMode==='explicit-organ-network'
          ? 'complete HumMod explicit organ-flow provider; fails closed when incomplete'
          : 'reduced systemic arterial conductance',
        gasExchange:'source-aligned HumMod reduced gas core',
        decompensation:'oxygen-debt-driven reduced shock/collapse controller',
        pressureUnits:'caller-supplied validated adapter',
        autonomicMode,
        autonomicAuthority: autonomicMode==='source-aligned'
          ? 'HumMod source-aligned HR/contractility/venous-V0 + legacy reduced arterial/pulmonary vascular control'
          : 'legacy reduced engineering autonomic controller',
        nativeMetabolicAutonomicAuthority: nativeAutonomicInputsProvider
          ? 'source-aligned upstream HumMod boundary provider; native bicycle mode can generate Exercise-Metabolism TotalWatts dynamically before MotorRadiation/metaboreflex drive'
          : 'source-aligned browser brain-hypoxia subset; no empirical chronotropy overlay',
        catecholamineAuthority: catecholamines
          ? 'HumMod source-aligned NE/Epi pools with explicit ECFV boundary'
          : 'normalized humoral fallback; dynamic catecholamine pools disabled because ECFV unavailable',
        bloodVolumeAuthority: sourceBloodVolume
          ? 'HumMod source-aligned RBC/plasma hemorrhage balance coupled to circulation total-volume residual'
          : 'disabled; reduced circulation conserves its initialized modeled vascular volume',
        exerciseVenousReturnAuthority:
          'HumMod Exercise-MusclePump effect multiplies systemic venous conductance when source exercise TotalWatts is available',
        clinicalValidation:false,
      }),
    });
  }

  return Object.freeze({
    kind:'hummod-ards-cardiopulmonary-runtime',
    step,
    snapshot,
  });
}

module.exports={
  meanAirwayPressureCmH2O,
  createHumModArdsCardiopulmonaryRuntime,
};
