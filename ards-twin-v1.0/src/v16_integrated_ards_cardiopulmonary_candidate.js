'use strict';

/**
 * v1.6 integrated ARDS cardiopulmonary candidate.
 *
 * Persistent source-family composition:
 *   Vent mechanics
 *     -> source-qualified pulmonary mechanics coordinate boundary
 *     -> Karamolegkos pulmonary vascular runtime
 *     -> pulmonary perfusion/shunt
 *     -> HumMod source-aligned ARDS gas runtime
 *     -> PaO2/PaCO2
 *     -> Ursino/Magosso cardiovascular/autonomic candidate
 *     -> RV outflow / LA pressure
 *     -> pulmonary vascular runtime on next split step
 *
 * Numerical coupling is sequential operator splitting. No physiologic gain is
 * added by this composition layer.
 *
 * Candidate only. No canonical bedside authority.
 */

const {
  createV15IntegratedCardiopulmonaryCandidate,
}=require('./v15_integrated_cardiopulmonary_candidate.js');
const {
  deriveSourceSteadyPulmonarySeed,
  createV16KaramolegkosPulmonaryVascularRuntime,
}=require('./v16_karamolegkos_pulmonary_vascular_runtime.js');
const {
  createV16ArdsPulmonaryGasCandidate,
}=require('./v16_ards_pulmonary_gas_candidate.js');
const {
  createVentRegionalArdsOxygenState,
}=require('./v16_vent_regional_ards_oxygen_bridge.js');

const SOURCE=Object.freeze({
  cardiovascular:'Ursino/Magosso source-family candidate',
  pulmonaryVascular:'Karamolegkos/Albanese/Chbat 2021',
  gas:'HumMod source-aligned ARDS gas equations',
  mechanics:'Vent',
  coupling:'sequential operator splitting; no physiologic gain',
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

function createV16IntegratedArdsCardiopulmonaryCandidate({
  simulation,
  dtSec=0.002,
  pulmonaryVascularInitialState=null,
  pulmonaryMechanicsBoundaryProvider=null,
  pulmonaryCoordinateAdapter=null,
  pulmonaryShuntFractionProvider=null,
  blood,
  metabolism,
  environment,
  excessLungWaterProvider,
  deadSpaceBtpsMlProvider=null,
  initialPao2MmHg=95,
  initialPaco2MmHg=40,
}={}){
  if(!simulation) throw new Error('simulation is required');
  positive(dtSec,'dtSec');
  if(pulmonaryMechanicsBoundaryProvider!=null &&
     typeof pulmonaryMechanicsBoundaryProvider!=='function'){
    throw new Error('pulmonaryMechanicsBoundaryProvider must be a function or null');
  }
  if(pulmonaryMechanicsBoundaryProvider==null){
    if(!pulmonaryCoordinateAdapter ||
       typeof pulmonaryCoordinateAdapter.snapshot!=='function'){
      throw new Error(
        'pulmonaryCoordinateAdapter.snapshot is required when no explicit pulmonaryMechanicsBoundaryProvider is supplied'
      );
    }
    if(typeof pulmonaryShuntFractionProvider!=='function'){
      throw new Error(
        'pulmonaryShuntFractionProvider is required with pulmonaryCoordinateAdapter'
      );
    }
  }

  const cv=createV15IntegratedCardiopulmonaryCandidate({
    dtSec,
    pao2MmHg:initialPao2MmHg,
    paco2MmHg:initialPaco2MmHg,
    deliveredTidalVolumeL:simulation.controller?.settings?.vt ?? 0.5,
  });

  let cvSnapshot=cv.snapshot();
  let pulmonarySnapshot=null;
  let gasSnapshot=null;
  let regionalO2Snapshot=null;
  let last=null;
  let timeSec=0;
  let pulmonaryInitialization=null;

  let resolvedPulmonaryInitialState=pulmonaryVascularInitialState;
  if(resolvedPulmonaryInitialState==null &&
     pulmonaryMechanicsBoundaryProvider==null){
    const coordinate=pulmonaryCoordinateAdapter.snapshot();
    if(!coordinate||coordinate.sourceQualified!==true){
      throw new Error(
        'pulmonaryCoordinateAdapter must return source-qualified coordinates for initialization'
      );
    }
    const initialShuntState=pulmonaryShuntFractionProvider({
      timeSec:0,
      simulation,
      cardiovascular:cvSnapshot,
      previousPulmonary:null,
      previousGas:null,
      coordinate,
    });
    if(!initialShuntState||typeof initialShuntState!=='object'||
       initialShuntState.sourceQualified!==true){
      throw new Error(
        'pulmonaryShuntFractionProvider must return a source-qualified case state for initialization'
      );
    }
    const initialShuntFraction=finite(
      initialShuntState.shuntFraction,
      'initial pulmonary shunt fraction'
    );
    if(initialShuntFraction<0||initialShuntFraction>=1){
      throw new Error('initial pulmonary shunt fraction must be in [0,1)');
    }

    pulmonaryInitialization=deriveSourceSteadyPulmonarySeed({
      alveolarPressureMmHg:coordinate.alveolarPressureMmHg,
      pleuralPressureMmHg:coordinate.pleuralPressureMmHg,
      alveolarVolumeL:coordinate.alveolarVolumeL,
      shuntFraction:initialShuntFraction,
    });
    resolvedPulmonaryInitialState=pulmonaryInitialization.state;
  }
  if(resolvedPulmonaryInitialState==null){
    throw new Error(
      'pulmonaryVascularInitialState is required with an explicit pulmonaryMechanicsBoundaryProvider'
    );
  }

  const pulmonary=createV16KaramolegkosPulmonaryVascularRuntime({
    dtSec,
    initialState:resolvedPulmonaryInitialState,
    boundaryProvider:({timeSec:pvTimeSec,previous})=>{
      const h=cvSnapshot.cardiovascular.hemodynamics;
      let mechanics;
      if(pulmonaryMechanicsBoundaryProvider){
        mechanics=pulmonaryMechanicsBoundaryProvider({
          timeSec:pvTimeSec,
          simulation,
          cardiovascular:cvSnapshot,
          previousPulmonary:previous,
          previousGas:gasSnapshot,
        });
        if(!mechanics||mechanics.sourceQualified!==true){
          throw new Error(
            'pulmonaryMechanicsBoundaryProvider must return source-qualified coordinates'
          );
        }
      }else{
        const coordinate=pulmonaryCoordinateAdapter.snapshot();
        if(!coordinate||coordinate.sourceQualified!==true){
          throw new Error(
            'pulmonaryCoordinateAdapter must return source-qualified coordinates'
          );
        }
        const shuntState=pulmonaryShuntFractionProvider({
          timeSec:pvTimeSec,
          simulation,
          cardiovascular:cvSnapshot,
          previousPulmonary:previous,
          previousGas:gasSnapshot,
          coordinate,
        });
        if(!shuntState||typeof shuntState!=='object'||
           shuntState.sourceQualified!==true){
          throw new Error(
            'pulmonaryShuntFractionProvider must return a source-qualified case state'
          );
        }
        const shuntFraction=finite(
          shuntState.shuntFraction,
          'pulmonary shunt fraction'
        );
        if(shuntFraction<0||shuntFraction>=1){
          throw new Error('pulmonary shunt fraction must be in [0,1)');
        }
        mechanics=Object.freeze({
          sourceQualified:true,
          alveolarVolumeL:coordinate.alveolarVolumeL,
          alveolarPressureMmHg:coordinate.alveolarPressureMmHg,
          pleuralPressureMmHg:coordinate.pleuralPressureMmHg,
          shuntFraction,
          shuntProvenance:Object.freeze({
            ...(shuntState.provenance||{}),
          }),
          coordinateSnapshot:coordinate,
        });
      }
      return Object.freeze({
        ...mechanics,
        sourceQualified:true,
        rvOutflowMlPerSec:h.rightVentricleOutflowMlPerSec,
        leftAtrialPressureMmHg:h.leftAtrialPressureMmHg,
      });
    },
  });

  const gas=createV16ArdsPulmonaryGasCandidate({
    simulation,
    useHumModSourceInitialGasState:true,
    blood,
    metabolism,
    environment,
    pulmonaryPerfusionProvider:()=>{
      if(!pulmonarySnapshot){
        throw new Error('pulmonary vascular runtime must advance before gas exchange');
      }
      return pulmonarySnapshot.pulmonaryPerfusionState;
    },
    excessLungWaterProvider,
    deadSpaceBtpsMlProvider,
  });

  function step(){
    pulmonarySnapshot=pulmonary.step();

    if(gasSnapshot==null){
      gasSnapshot=gas.initialize();
    }

    regionalO2Snapshot=createVentRegionalArdsOxygenState({
      simulation,
      pulmonaryVascularSnapshot:pulmonarySnapshot,
      gasSnapshot,
      blood,
      environment,
    });

    const arterialO2TargetOverride=
      regionalO2Snapshot.status==='ready'
        ?Object.freeze({
          sourceQualified:true,
          o2ContentMlPerMl:regionalO2Snapshot.arterialO2ContentMlPerMl,
          authority:
            'Vent + Das-Marshall regional VQ/HPV + HumMod blood-O2 candidate',
        })
        :null;

    gasSnapshot=gas.step({
      dtSec,
      arterialO2TargetOverride,
    });

    const arterial=gasSnapshot.gas.gases.arterial;
    const candidatePao2MmHg=arterial.po2MmHg;

    cv.setCanonicalInputs({
      pao2MmHg:candidatePao2MmHg,
      paco2MmHg:arterial.pco2MmHg,
      deliveredTidalVolumeL:gasSnapshot.mechanics.tidalVolumeL,
    });
    cvSnapshot=cv.step();

    timeSec+=dtSec;
    const h=cvSnapshot.cardiovascular.hemodynamics;
    const activeController=cvSnapshot.cardiovascular.controller;
    const heartRateCoupling=activeController
      ?Object.freeze({
        sourceQualified:true,
        owner:'Ursino/Magosso delayed sympathetic/vagal heart-period effectors -> cardiovascular plant',
        heartPeriodSec:
          activeController.effectors?.absolute?.heartPeriodSec??null,
        heartRatePerMin:h.heartRatePerMin,
        cardiacSympatheticSpikesPerSec:
          activeController.autonomic?.fShSpikesPerSec??null,
        cardiacVagalSpikesPerSec:
          activeController.autonomic?.fVSpikesPerSec??null,
        physiologicGainAdded:false,
      })
      :null;
    const myocardialSourceState=
      cvSnapshot.cardiovascular.myocardialSourceState||null;
    const perf=pulmonarySnapshot.pulmonaryPerfusionState;

    last=Object.freeze({
      schema:'v16-integrated-ards-cardiopulmonary-candidate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      physicianState:Object.freeze({
        heartRatePerMin:h.heartRatePerMin,
        systemicArterialPressureMmHg:h.systemicArterialPressureMmHg,
        pulmonaryArteryPressureMmHg:
          pulmonarySnapshot.pressuresMmHg.pulmonaryArtery,
        rightAtrialPressureMmHg:h.rightAtrialPressureMmHg,
        leftAtrialPressureMmHg:h.leftAtrialPressureMmHg,
        pao2MmHg:candidatePao2MmHg,
        paco2MmHg:arterial.pco2MmHg,
        regionalArterialPo2TargetMmHg:
          regionalO2Snapshot.status==='ready'
            ?regionalO2Snapshot.arterialPo2MmHg
            :null,
        arterialPh:arterial.pH,
        fio2:gasSnapshot.mechanics.fio2,
        tidalVolumeL:gasSnapshot.mechanics.tidalVolumeL,
        respiratoryRatePerMin:gasSnapshot.mechanics.rrPerMin,
        pulmonaryShuntFraction:perf.shuntFraction,
        ventilatedPulmonaryBloodFlowMlPerMin:
          perf.ventilatedPulmonaryBloodFlowMlPerMin,
      }),
      cardiovascular:cvSnapshot,
      heartRateCoupling,
      myocardialSourceState,
      pulmonaryVascular:pulmonarySnapshot,
      pulmonaryInitialization,
      pulmonaryGas:gasSnapshot,
      regionalOxygen:regionalO2Snapshot,
      ownership:Object.freeze({
        ventilatorMechanics:'Vent',
        cardiovascularAutonomic:'Ursino/Magosso-candidate',
        heartRate:
          'Ursino/Magosso cardiac sympathetic + vagal effectors -> heart period -> cardiovascular plant',
        myocardialFlowAndO2Use:
          'Ursino/Magosso coronary bed flow + source cardiac O2-use candidate; diagnostic source state only',
        myocardialAcidBaseContractility:
          'fail-closed-not-yet-coupled',
        pulmonaryVascular:'Karamolegkos-candidate',
        gasExchangeCo2PhMixedVenous:
          'HumMod-source-aligned-candidate',
        arterialOxygen:
          regionalO2Snapshot.status==='ready'
            ?'Vent + Das-Marshall regional VQ/HPV + HumMod blood-O2 candidate'
            :'HumMod whole-lung startup fallback until completed Vent breath',
        pulmonaryMechanicsCoordinate:
          pulmonaryMechanicsBoundaryProvider
            ?'external-source-qualified-boundary'
            :'reference-anchored Vent delta-volume + passive Albanese/Karamolegkos A34/A40 coordinate adapter',
      }),
      unresolvedBoundary:Object.freeze({
        shuntFraction:
          'Karamolegkos anatomical shunt remains explicit source/case boundary; low V/Q is modeled regionally and is not relabeled as shunt',
        postCapillaryResistance:
          'derived internally from Karamolegkos Appendix A25 and shunt fraction',
      }),
      coupling:Object.freeze({
        order:'pulmonary-vascular -> regional-O2-target -> gas-delay/CO2 -> autonomic effectors -> heart period -> cardiovascular plant',
        method:'sequential-operator-splitting',
        heartRateCoupledToPlant:true,
        physiologicGainAdded:false,
      }),
      provenance:SOURCE,
    });
    return last;
  }

  function runFor(seconds){
    finite(seconds,'seconds');
    if(seconds<0) throw new Error('seconds must be >= 0');
    const n=Math.floor(seconds/dtSec+1e-9);
    for(let i=0;i<n;i++) step();
    const rem=seconds-n*dtSec;
    if(rem>1e-9) throw new Error('seconds must be an integer multiple of dtSec');
    return snapshot();
  }

  function snapshot(){
    return last||Object.freeze({
      schema:'v16-integrated-ards-cardiopulmonary-candidate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      status:'awaiting-first-step',
      cardiovascular:cvSnapshot,
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,
    runFor,
    snapshot,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  createV16IntegratedArdsCardiopulmonaryCandidate,
});
