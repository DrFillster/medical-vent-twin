'use strict';

const { createVentToArdsCoreSnapshot } = require('./hummod_ards_core_coupling.js');
const { createLiveCoreBoundaryFromVent } = require('./hummod_ards_core_vent_adapter.js');
const { createV2SourceAutonomicController } = require('./v2_source_autonomic_controller.js');
const {
  createHumModArdsDecompensationController,
} = require('./hummod_ards_decompensation_controller.js');
const {
  createV21PulmonaryVascularController,
} = require('./v21_pulmonary_vascular_controller.js');
const {
  evaluateV22SepsisDiseaseLayer,
} = require('./v22_sepsis_disease_layer.js');

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
  sepsisState=null,
}={}){
  if(!simulation||!thorax||!circulation||!gasRuntime){
    throw new Error('simulation, thorax, circulation, and gasRuntime are required');
  }
  if(!pressureAdapter||
     typeof pressureAdapter.cmH2OToMmHg!=='function'){
    throw new Error('validated pressureAdapter.cmH2OToMmHg is required');
  }
  finite(pericardialTmpMmHg,'pericardialTmpMmHg');
  if(sepsisState!=null){
    if(!sepsisState||typeof sepsisState!=='object'||Array.isArray(sepsisState)){
      throw new Error('sepsisState must be an object or null');
    }
    finite(sepsisState.inflammationNStar,'sepsisState.inflammationNStar');
    if(sepsisState.inflammationNStar<0){
      throw new Error('sepsisState.inflammationNStar must be >= 0');
    }
    if(sepsisState.antiInflammatoryMediatorCA!=null){
      finite(
        sepsisState.antiInflammatoryMediatorCA,
        'sepsisState.antiInflammatoryMediatorCA'
      );
      if(sepsisState.antiInflammatoryMediatorCA<0){
        throw new Error('sepsisState.antiInflammatoryMediatorCA must be >= 0');
      }
    }
  }

  let timeSec=0;
  let last=null;
  const decompensation = createHumModArdsDecompensationController();
  const autonomic = createV2SourceAutonomicController({
    baseline: circulation.snapshot().activeBoundaries || systemicBoundaries.circulation || {
      heartRatePerMin: 75,
      systemicArterialConductanceMlPerMinPerMmHg: 60,
      systemicVenousConductanceMlPerMinPerMmHg: 692,
      leftContractilityMultiplier: 1,
    },
  });
  const pulmonaryVascular = createV21PulmonaryVascularController({
    dtSec: 0.0005,
  });

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

    const sepsisDisease=sepsisState==null
      ? null
      : evaluateV22SepsisDiseaseLayer({
          inflammationNStar:sepsisState.inflammationNStar,
          antiInflammatoryMediatorCA:
            sepsisState.antiInflammatoryMediatorCA==null
              ?0
              :sepsisState.antiInflammatoryMediatorCA,
          sourceAr:sepsisState.sourceAr==null
            ?null
            :sepsisState.sourceAr,
          capillaryExchange:sepsisState.capillaryExchange==null
            ?null
            :sepsisState.capillaryExchange,
        });

    let circ=circulation.step({
      dtSec,
      thoracicPressureMmHg,
      pericardialPressureMmHg,
      externalSystemicVolumeRateMlPerSec:
        sepsisDisease&&sepsisDisease.capillaryExchange
          ?sepsisDisease.capillaryExchange.bloodVolumeRateMlPerSec
          :0,
    });

    const priorGasState = last && last.gas && last.gas.gases
      ? last.gas.gases
      : null;
    const priorGas = priorGasState ? priorGasState.arterial : null;
    const control = autonomic.step({
      dtSec,
      meanArterialPressureMmHg: circ.pressures.systemicArterialMmHg,
      tidalVolumeL:
        simulation.controller && simulation.controller.settings
          ? simulation.controller.settings.vt
          : 0.5,
      arterialPo2MmHg: priorGas ? priorGas.po2MmHg : 90,
      arterialPco2MmHg: priorGas ? priorGas.pco2MmHg : 40,
      arterialPh: priorGas ? priorGas.pH : 7.40,
    });
    const pulmonaryControl=pulmonaryVascular.step({
      dtSec,
      meanAirwayPressureCmH2O:meanPaw,
      arterialPo2MmHg:priorGas ? Math.max(1,priorGas.po2MmHg) : 90,
      mixedVenousPo2MmHg:priorGasState && priorGasState.venous
        ? Math.max(1,priorGasState.venous.po2MmHg)
        : 40,
      arterialPco2MmHg:priorGas ? Math.max(1,priorGas.pco2MmHg) : 40,
      arterialPh:priorGas ? priorGas.pH : 7.40,
    });
    const priorDecomp=decompensation.snapshot();
    const sepsisLeftPerformanceMultiplier=sepsisDisease
      ? sepsisDisease.leftMyocardialPerformanceMultiplier
      : 1;
    const effectiveLeftContractility=
      control.leftContractilityMultiplier *
      control.acidoticContractilityMultiplier *
      sepsisLeftPerformanceMultiplier *
      priorDecomp.myocardialContractilityMultiplier;
    const effectiveRightContractility=
      control.rightContractilityMultiplier *
      control.acidoticContractilityMultiplier *
      priorDecomp.myocardialContractilityMultiplier;
    const effectiveHeartRatePerMin =
      control.heartRatePerMin *
      priorDecomp.chronotropicReserveMultiplier;
    const sourceAutonomicSystemicConductance=
      control.systemicArterialConductanceMlPerMinPerMmHg;
    const appliedSystemicConductance=
      sepsisDisease&&sepsisDisease.systemicResistanceRatio!=null
        ?sourceAutonomicSystemicConductance/
          sepsisDisease.systemicResistanceRatio
        :sourceAutonomicSystemicConductance;

    circulation.setBoundaries({
      heartRatePerMin: effectiveHeartRatePerMin,
      leftContractilityMultiplier: effectiveLeftContractility,
      rightContractilityMultiplier: effectiveRightContractility,
      systemicArterialConductanceMlPerMinPerMmHg:
        appliedSystemicConductance,
      systemicVenousV0Ml: control.systemicVenousV0Ml,
      pulmonaryArterialConductanceMultiplier:
        pulmonaryControl.pulmonaryArterialConductanceMultiplier,
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
        systemicVascularControl:Object.freeze({
          sourceAutonomicConductanceMlPerMinPerMmHg:
            sourceAutonomicSystemicConductance,
          appliedConductanceMlPerMinPerMmHg:
            appliedSystemicConductance,
          sepsisResistanceRatio:
            sepsisDisease?sepsisDisease.systemicResistanceRatio:null,
        }),
        pulmonaryVascular:pulmonaryControl,
        sepsisDisease,
        decompensation:terminalDecomp,
        effectiveHeartRatePerMin:0,
        effectiveContractilityMultiplier:0,
        effectiveLeftContractilityMultiplier:0,
        effectiveRightContractilityMultiplier:0,
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
      systemicVascularControl:Object.freeze({
        sourceAutonomicConductanceMlPerMinPerMmHg:
          sourceAutonomicSystemicConductance,
        appliedConductanceMlPerMinPerMmHg:
          appliedSystemicConductance,
        sepsisResistanceRatio:
          sepsisDisease?sepsisDisease.systemicResistanceRatio:null,
      }),
      pulmonaryVascular:pulmonaryControl,
      sepsisDisease,
      decompensation:decomp,
      effectiveHeartRatePerMin,
      effectiveContractilityMultiplier:effectiveLeftContractility,
      effectiveLeftContractilityMultiplier:effectiveLeftContractility,
      effectiveRightContractilityMultiplier:effectiveRightContractility,
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
        circulation:'v1.0 reduced circulation with v2.0 Ursino/Magosso systemic control and v2.1 source-backed pulmonary vascular load',
        gasExchange:'source-aligned HumMod reduced gas core',
        decompensation:'oxygen-debt-driven reduced shock/collapse controller',
        sepsis:'v2.2 Yamanaka Eq.31 LV performance active when explicit sepsisState is supplied; Eq.29/30 remain diagnostic pending source-safe bridges',
        pressureUnits:'caller-supplied validated adapter',
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
