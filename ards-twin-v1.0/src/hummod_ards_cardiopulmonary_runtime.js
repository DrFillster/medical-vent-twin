'use strict';

const { createVentToArdsCoreSnapshot } = require('./hummod_ards_core_coupling.js');
const { createLiveCoreBoundaryFromVent } = require('./hummod_ards_core_vent_adapter.js');
const { createHumModArdsAutonomicController } = require('./hummod_ards_autonomic_controller.js');
const { createHumModSourceAlignedAutonomicController } = require('./hummod_ards_autonomic_source_aligned.js');
const { createHumModSourceAlignedCatecholamines } = require('./hummod_ards_catecholamines_source_aligned.js');
const { sourceSympatheticVascularComponents } = require('./hummod_ards_vascular_sympathetic_source_aligned.js');
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
  if(nativeAutonomicInputsProvider!=null &&
     typeof nativeAutonomicInputsProvider!=='function'){
    throw new Error('nativeAutonomicInputsProvider must be a function or null');
  }
  if(!['legacy','source-aligned'].includes(autonomicMode)) throw new Error('unsupported autonomicMode: '+autonomicMode);

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

    let circ=circulation.step({
      dtSec,
      thoracicPressureMmHg,
      pericardialPressureMmHg,
    });

    const priorGas = last && last.gas && last.gas.gases
      ? last.gas.gases.arterial
      : null;
    const legacyControl = autonomic.step({
      dtSec,
      meanArterialPressureMmHg: circ.pressures.systemicArterialMmHg,
      thoracicPressureMmHg,
      arterialPo2MmHg: priorGas ? priorGas.po2MmHg : 90,
      arterialPco2MmHg: priorGas ? priorGas.pco2MmHg : 40,
      arterialPh: priorGas ? priorGas.pH : 7.40,
    });
    const currentCatecholamines = catecholamines ? catecholamines.snapshot() : null;
    const rightAtrialTmpMmHg =
      circ.pressures.rightAtrialMmHg - pericardialPressureMmHg;
    const leftAtrialTmpMmHg =
      circ.pressures.leftAtrialMmHg - pericardialPressureMmHg;
    const averageAtrialTmpMmHg =
      (rightAtrialTmpMmHg + leftAtrialTmpMmHg) / 2;
    const nativeAutonomicInputs = nativeAutonomicInputsProvider
      ? nativeAutonomicInputsProvider({
          timeSec,
          dtSec,
          meanArterialPressureMmHg: circ.pressures.systemicArterialMmHg,
          averageAtrialTmpMmHg,
          priorArterialGas: priorGas,
        })
      : null;
    if(nativeAutonomicInputs!=null &&
       (typeof nativeAutonomicInputs!=='object' ||
        Array.isArray(nativeAutonomicInputs))){
      throw new Error('nativeAutonomicInputsProvider must return an object or null');
    }
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
        nativeAutonomicInputs?.brainFunctionEffect ?? 1,
      exerciseSympsTotalEffect:
        nativeAutonomicInputs?.exerciseSympsTotalEffect ?? 0,
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

    // HumMod sinus HR remains the source baseline. While the reduced model
    // lacks native Brain-Fuel/metaboreflex state, v1.3 may add a separately
    // labeled, bounded in-vivo hypercapnic chronotropy bridge from the legacy
    // control layer. The bridge is not folded into SANode gains and is faded
    // during the late asphyxial-collapse phase so the response can peak and
    // then deteriorate instead of remaining artificially tachycardic.
    const nativeMetabolicAutonomicActive = Boolean(
      nativeAutonomicInputs &&
      (
        nativeAutonomicInputs.brainFuelFractUseDelay != null ||
        nativeAutonomicInputs.a2PoolLog10Conc != null ||
        nativeAutonomicInputs.exerciseSympsTotalEffect != null
      )
    );
    const empiricalChronotropicBoostPerMin =
      autonomicMode==='source-aligned' && !nativeMetabolicAutonomicActive
        ? (legacyControl.empiricalChronotropicBoostPerMin || 0)
        : 0;
    const chronotropicExposureSec =
      legacyControl.hypercapnicChronotropyExposureSec || 0;
    const chronotropicBridgeEnvelope =
      chronotropicExposureSec <= 180
        ? 1
        : Math.max(
            0,
            (684 - chronotropicExposureSec) /
            (684 - 180));
    const appliedEmpiricalChronotropicBoostPerMin =
      empiricalChronotropicBoostPerMin * chronotropicBridgeEnvelope;
    const effectiveHeartRatePerMin =
      sourceSaNodeHeartRatePerMin + appliedEmpiricalChronotropicBoostPerMin;
    circulation.setBoundaries({
      heartRatePerMin: effectiveHeartRatePerMin,
      leftContractilityMultiplier: effectiveContractility,
      rightContractilityMultiplier: effectiveContractility,
      systemicArterialConductanceMlPerMinPerMmHg:
        control.systemicArterialConductanceMlPerMinPerMmHg,
      systemicVenousV0Ml: control.systemicVenousV0Ml,
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
      blood:bloodBoundaries,
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
        gasExchange:'source-aligned HumMod reduced gas core',
        decompensation:'oxygen-debt-driven reduced shock/collapse controller',
        pressureUnits:'caller-supplied validated adapter',
        autonomicMode,
        autonomicAuthority: autonomicMode==='source-aligned'
          ? 'HumMod source-aligned HR/contractility/venous-V0 + legacy reduced arterial/pulmonary vascular control'
          : 'legacy reduced engineering autonomic controller',
        nativeMetabolicAutonomicAuthority: nativeAutonomicInputsProvider
          ? 'external native HumMod autonomic input provider'
          : 'unavailable; empirical chronotropy bridge may be used',
        catecholamineAuthority: catecholamines
          ? 'HumMod source-aligned NE/Epi pools with explicit ECFV boundary'
          : 'normalized humoral fallback; dynamic catecholamine pools disabled because ECFV unavailable',
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
