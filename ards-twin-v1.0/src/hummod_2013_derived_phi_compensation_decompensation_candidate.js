'use strict';

/**
 * HumMod 2013 compensation -> source-derived myocardial pHi ->
 * LV decompensation candidate.
 *
 * This is the first candidate in which myocardial intracellular pH is derived
 * internally from the 2013 source-generation myocardial flow/fuel/lactate/CO2
 * chain rather than supplied as an external coordinate.
 *
 * Remaining upstream physiology (ADH, KCell, current LV water/mass, systemic
 * substrate pools, insulin receptor occupancy, thyroid pool, etc.) remains
 * explicit and fail-closed.
 */

const {
  createHumMod2013ChemoreflexSaNodeCandidate,
}=require('./hummod_2013_chemoreflex_sa_node_candidate.js');
const {
  leftHeartAlphaReceptorActivity,
  viscosityFromHematocrit,
}=require('./hummod_2013_coronary_flow_provider_primitives.js');
const {
  hgbConcentrationFromHematocrit,
}=require('./hummod_hgb_concentration_source_aligned.js');
const {
  setupHgbProps,
}=require('./hummod_hgb_tissue_source_aligned.js');
const {
  solveLeftHeartFlow2013,
}=require('./hummod_2013_left_heart_flow_candidate.js');
const {
  leftHeartO2Demand2013,
  O2_TO_CAL_PER_ML,
}=require('./hummod_2013_left_heart_metabolism_provider.js');
const {
  thyroidEffectFromPool2013,
  heatMetabolismCoreFromTemp2013,
}=require('./hummod_2013_myocardial_metabolic_modifiers.js');
const {
  createHumMod2013LeftHeartStructure,
}=require('./hummod_2013_left_heart_structure.js');
const {
  createHumMod2013MyocardialAcidBaseRuntime,
}=require('./hummod_2013_myocardial_acid_base_runtime.js');
const {
  leftHeartContractility,
}=require('./hummod_2013_left_heart_contractility_candidate.js');
const {
  solveLeftHeartPump2013,
}=require('./hummod_2013_left_heart_pump_candidate.js');

const SOURCE=Object.freeze({
  authority:'candidate-not-canonical',
  autonomic:'HumMod 2012/2013 chemoreflex/sympathoadrenal/SA-node',
  coronaryFlow:'initial imported HumMod LeftHeart-Flow at 93ee1b30',
  myocardialAcidBase:'initial imported HumMod 2012/2013 fuel/lactate/CO2/pH',
  ventricularPump:'HumMod 2012/2013 LV contractility/pump candidate',
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

function createHumMod2013DerivedPhiCompensationDecompensationCandidate({
  ecfvMl,
  sourceSizing,
  initialLeftHeartMassG,
  initialLeftHeartLiquidVolumeMl,
  initialArterialPh=7.44,
}={}){
  positive(ecfvMl,'ecfvMl');
  positive(initialLeftHeartMassG,'initialLeftHeartMassG');
  positive(initialLeftHeartLiquidVolumeMl,'initialLeftHeartLiquidVolumeMl');
  if(!sourceSizing||typeof sourceSizing!=='object'){
    throw new Error('sourceSizing is required');
  }

  const autonomic=createHumMod2013ChemoreflexSaNodeCandidate({
    ecfvMl,
    initialArterialPh,
  });
  const structure=createHumMod2013LeftHeartStructure({
    initialEffect:1,
  });
  const acidBase=createHumMod2013MyocardialAcidBaseRuntime({
    initialLiquidVolumeMl:initialLeftHeartLiquidVolumeMl,
  });

  let timeSec=0;
  let last=null;

  function step({
    dtSec,

    // Arterial gas state for chemoreflex and coronary extraction.
    arterialPo2MmHg,
    arterialPh,
    arterialPco2MmHg,
    arterialO2ContentMlPerMl,
    arterialHco3,
    bloodSid,
    bloodTempC,
    carboxyPercent,

    // Hemodynamic state.
    meanArterialPressureMmHg,
    systemicVenousPressureMmHg,
    leftAtrialPressureMmHg,
    pericardialPressureMmHg,

    // Current myocardial size/water and systemic biochemical providers.
    myocardialMassG,
    myocardialLiquidVolumeMl,
    intracellularPotassium,
    hematocritFraction,
    adhPoolLog10Conc,
    insulinReceptorBoundFractionPercent,
    glucosePoolMgPerMl,
    fattyAcidPoolMgPerMl,
    lactatePoolMeqPerMl,
    thyroidPoolTotalT4T3,
    coreTempC,

    // Explicit source scenario/intervention states.
    calMultiplier,
    anesthesiaVascularConductance,
    vasculatureEffect,
    infarctionEffect,
    contractileProteinFunctionalRatio,
    digoxinPoolConcentration,
    anesthesiaHeartContractility,
    basicContractility,
    stiffness,
    systolicX,
    mitralStenosisEffect,
    aorticStenosisEffect,
    mitralRegurgitationEffect,
    aorticRegurgitationEffect,
    respiratoryQuotient=0.8,
  }={}){
    positive(dtSec,'dtSec');
    [
      ['arterialPo2MmHg',arterialPo2MmHg],
      ['arterialPh',arterialPh],
      ['arterialPco2MmHg',arterialPco2MmHg],
      ['arterialO2ContentMlPerMl',arterialO2ContentMlPerMl],
      ['arterialHco3',arterialHco3],
      ['bloodSid',bloodSid],
      ['bloodTempC',bloodTempC],
      ['carboxyPercent',carboxyPercent],
      ['meanArterialPressureMmHg',meanArterialPressureMmHg],
      ['systemicVenousPressureMmHg',systemicVenousPressureMmHg],
      ['leftAtrialPressureMmHg',leftAtrialPressureMmHg],
      ['pericardialPressureMmHg',pericardialPressureMmHg],
      ['myocardialMassG',myocardialMassG],
      ['myocardialLiquidVolumeMl',myocardialLiquidVolumeMl],
      ['intracellularPotassium',intracellularPotassium],
      ['hematocritFraction',hematocritFraction],
      ['adhPoolLog10Conc',adhPoolLog10Conc],
      ['insulinReceptorBoundFractionPercent',insulinReceptorBoundFractionPercent],
      ['glucosePoolMgPerMl',glucosePoolMgPerMl],
      ['fattyAcidPoolMgPerMl',fattyAcidPoolMgPerMl],
      ['lactatePoolMeqPerMl',lactatePoolMeqPerMl],
      ['thyroidPoolTotalT4T3',thyroidPoolTotalT4T3],
      ['coreTempC',coreTempC],
      ['calMultiplier',calMultiplier],
      ['anesthesiaVascularConductance',anesthesiaVascularConductance],
      ['vasculatureEffect',vasculatureEffect],
      ['infarctionEffect',infarctionEffect],
      ['contractileProteinFunctionalRatio',contractileProteinFunctionalRatio],
      ['digoxinPoolConcentration',digoxinPoolConcentration],
      ['anesthesiaHeartContractility',anesthesiaHeartContractility],
      ['basicContractility',basicContractility],
      ['stiffness',stiffness],
      ['systolicX',systolicX],
      ['mitralStenosisEffect',mitralStenosisEffect],
      ['aorticStenosisEffect',aorticStenosisEffect],
      ['mitralRegurgitationEffect',mitralRegurgitationEffect],
      ['aorticRegurgitationEffect',aorticRegurgitationEffect],
      ['respiratoryQuotient',respiratoryQuotient],
    ].forEach(([k,v])=>finite(v,k));

    if(hematocritFraction<=0||hematocritFraction>=1){
      throw new Error('hematocritFraction must be in (0,1)');
    }

    const a=autonomic.step({
      dtSec,
      arterialPo2MmHg,
      arterialPh,
    });

    const alphaReceptor=leftHeartAlphaReceptorActivity({
      cardiacGangliaHz:a.ganglia.cardiacHz,
      alpha1PoolEffect:a.catecholamines.alpha1Effect,
    });

    const hgb=hgbConcentrationFromHematocrit({
      hematocritFraction,
      carboxyPercent,
    });
    const hgbProps=setupHgbProps({
      tempC:bloodTempC,
      pH:arterialPh,
      pCO2MmHg:arterialPco2MmHg,
      carboxyPercent,
    });
    const viscosity=viscosityFromHematocrit({
      hematocritFraction,
    });
    const plasmaVolumeFraction=1-hematocritFraction;

    const thyroid=thyroidEffectFromPool2013({
      totalT4T3:thyroidPoolTotalT4T3,
    });
    const heat=heatMetabolismCoreFromTemp2013({
      coreTempC,
    });
    const structureBefore=structure.snapshot();

    const metabolism=leftHeartO2Demand2013({
      myocardialMassG,
      initialMyocardialMassG:initialLeftHeartMassG,
      calMultiplier,
      thyroidEffect:thyroid.thyroidEffect,
      heatMetabolismCore:heat.heatMetabolismCore,
      structureEffect:structureBefore.effect,
    });

    const pressureGradientMmHg=Math.max(
      meanArterialPressureMmHg-systemicVenousPressureMmHg,
      0
    );

    const flow=solveLeftHeartFlow2013({
      arterialPo2MmHg,
      initialLeftHeartMassG,
      pressureGradientMmHg,
      alphaReceptorActivity:alphaReceptor.activity,
      adhPoolLog10Conc,
      o2NeedMlPerMin:metabolism.o2NeedMlPerMin,
      viscosityConductanceEffect:viscosity.conductanceEffect,
      anesthesiaVascularConductance,
      vasculatureEffect,
      infarctionEffect,
      arterialO2ContentMlPerMl,
      o2MaxMlPerMl:hgb.o2MaxMlPerMl,
      hgbP50:hgbProps.p50,
      hgbScaleForSat:hgbProps.scaleForSat,
      plasmaVolumeFraction,
    });

    const aerobicCalsPerMin=O2_TO_CAL_PER_ML*flow.o2UseMlPerMin;

    const acid=acidBase.step({
      dtSec,
      liquidVolumeMl:myocardialLiquidVolumeMl,
      intracellularPotassium,
      bloodFlowMlPerMin:flow.bloodFlowMlPerMin,
      plasmaFlowMlPerMin:flow.plasmaFlowMlPerMin,
      o2UseMlPerMin:flow.o2UseMlPerMin,
      aerobicCalsPerMin,
      totalCalsUsedPerMin:metabolism.totalCalsUsed,
      insulinReceptorBoundFractionPercent,
      glucosePoolMgPerMl,
      fattyAcidPoolMgPerMl,
      lactatePoolMeqPerMl,
      bloodSid,
      arterialHco3,
      respiratoryQuotient,
    });

    const structureAfter=structure.step({
      dtSec,
      myocardialIntracellularPh:acid.myocardialIntracellularPh,
      fuelFractUseDelay:acid.fuelFractUseDelay,
      coreTempC,
    });

    const contractility=leftHeartContractility({
      cardiacGangliaHz:a.ganglia.cardiacHz,
      beta1PoolEffect:a.catecholamines.beta1Effect,
      myocardialIntracellularPh:acid.myocardialIntracellularPh,
      contractileProteinFunctionalRatio,
      digoxinPoolConcentration,
      anesthesiaHeartContractility,
      basic:basicContractility,
    });

    const pump=solveLeftHeartPump2013({
      meanArterialPressureMmHg,
      leftAtrialPressureMmHg,
      pericardialPressureMmHg,
      heartRatePerMin:a.heartRatePerMin,
      contractility:contractility.contractility,
      sourceSizing,
      stiffness,
      systolicX,
      mitralStenosisEffect,
      aorticStenosisEffect,
      mitralRegurgitationEffect,
      aorticRegurgitationEffect,
    });

    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-derived-phi-compensation-decompensation/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      autonomic:a,
      alphaReceptor,
      blood:Object.freeze({
        hematocritFraction,
        plasmaVolumeFraction,
        hgb,
        hgbProps,
        viscosity,
      }),
      thyroid,
      heat,
      metabolism,
      coronaryFlow:flow,
      acidBase:acid,
      leftHeartStructure:Object.freeze({
        before:structureBefore,
        after:structureAfter,
      }),
      leftHeartContractility:contractility,
      leftHeartPump:pump,
      myocardialIntracellularPh:acid.myocardialIntracellularPh,
      heartRatePerMin:a.heartRatePerMin,
      strokeVolumeMl:pump.strokeVolumeMl,
      cardiacOutputMlPerMin:pump.bloodFlowMlPerMin,
      controlAuthority:false,
      ownership:Object.freeze({
        arterialPh:'chemoreflex + hemoglobin dissociation input only',
        myocardialIntracellularPh:
          'derived by 2013 LeftHeart fuel/lactate/CO2/SID/Ph runtime',
        coronaryFlow:
          '2013 LeftHeart-Flow candidate with explicit unresolved systemic providers',
        ventricularOutput:
          '2013 LeftHeart contractility + beat-averaged pump',
      }),
      numericalImplementation:Object.freeze({
        operatorSplit:
          'autonomic -> prior structure demand -> coronary flow -> myocardial acid-base -> structure update -> contractility/pump',
        qualificationRequired:true,
      }),
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot(){
    return last||Object.freeze({
      schema:'hummod-2013-derived-phi-compensation-decompensation/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      myocardialIntracellularPh:null,
      heartRatePerMin:null,
      strokeVolumeMl:null,
      cardiacOutputMlPerMin:null,
      controlAuthority:false,
      provenance:SOURCE,
    });
  }

  return Object.freeze({step,snapshot,source:SOURCE});
}

module.exports=Object.freeze({
  SOURCE,
  createHumMod2013DerivedPhiCompensationDecompensationCandidate,
});
