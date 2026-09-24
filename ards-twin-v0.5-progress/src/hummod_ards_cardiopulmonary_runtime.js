'use strict';

const { createVentToArdsCoreSnapshot } = require('./hummod_ards_core_coupling.js');
const { createLiveCoreBoundaryFromVent } = require('./hummod_ards_core_vent_adapter.js');
const { createHumModArdsAutonomicController } = require('./hummod_ards_autonomic_controller.js');
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
}={}){
  if(!simulation||!thorax||!circulation||!gasRuntime){
    throw new Error('simulation, thorax, circulation, and gasRuntime are required');
  }
  if(!pressureAdapter||
     typeof pressureAdapter.cmH2OToMmHg!=='function'){
    throw new Error('validated pressureAdapter.cmH2OToMmHg is required');
  }
  finite(pericardialTmpMmHg,'pericardialTmpMmHg');

  let timeSec=0;
  let last=null;
  const decompensation = createHumModArdsDecompensationController();
  const autonomic = createHumModArdsAutonomicController({
    baseline: circulation.snapshot().activeBoundaries || systemicBoundaries.circulation || {
      heartRatePerMin: 75,
      systemicArterialConductanceMlPerMinPerMmHg: 60,
      systemicVenousConductanceMlPerMinPerMmHg: 692,
      leftContractilityMultiplier: 1,
    },
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

    let circ=circulation.step({
      dtSec,
      thoracicPressureMmHg,
      pericardialPressureMmHg,
    });

    const priorGas = last && last.gas && last.gas.gases
      ? last.gas.gases.arterial
      : null;
    const control = autonomic.step({
      dtSec,
      meanArterialPressureMmHg: circ.pressures.systemicArterialMmHg,
      thoracicPressureMmHg,
      arterialPo2MmHg: priorGas ? priorGas.po2MmHg : 90,
      arterialPco2MmHg: priorGas ? priorGas.pco2MmHg : 40,
      arterialPh: priorGas ? priorGas.pH : 7.40,
    });
    const priorDecomp=decompensation.snapshot();
    const effectiveContractility=
      control.contractilityMultiplier *
      priorDecomp.myocardialContractilityMultiplier;
    circulation.setBoundaries({
      heartRatePerMin: control.heartRatePerMin,
      leftContractilityMultiplier: effectiveContractility,
      rightContractilityMultiplier: effectiveContractility,
      systemicArterialConductanceMlPerMinPerMmHg:
        control.systemicArterialConductanceMlPerMinPerMmHg,
      systemicVenousV0Ml: control.systemicVenousV0Ml,
      pulmonaryArterialConductanceMultiplier:
        control.pulmonaryArterialConductanceMultiplier,
    });
    circ=circulation.snapshot();

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
