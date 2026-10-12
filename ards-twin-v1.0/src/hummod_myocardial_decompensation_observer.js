'use strict';

/**
 * Noncanonical myocardial decompensation observer.
 *
 * Composes existing source-aligned HumMod coronary-flow, metabolism, fuel,
 * lactate/CO2/SID/pHi, and Shimayoshi/Crampin-Smith component-factor shadows.
 *
 * This observer deliberately has NO whole-heart mechanics authority.
 * All required upstream states are explicit; no nominal backfill is allowed.
 */

const {
  solveMyocardialFlow,
}=require('./hummod_myocardial_flow_source_aligned.js');
const {
  myocardialMetabolism,
}=require('./hummod_myocardial_metabolism_source_aligned.js');
const {
  myocardialFuelSelection,
}=require('./hummod_myocardial_fuel_source_aligned.js');
const {
  createHumModMyocardialAcidBaseRuntime,
}=require('./hummod_myocardial_acid_base_runtime.js');
const {
  candidateSnapshot,
}=require('./myocardial_hypoxia_acidosis_shadow.js');

const SOURCE=Object.freeze({
  authority:'candidate-not-canonical',
  controlAuthority:false,
  coronaryFlow:'HumMod source-aligned myocardial flow',
  metabolism:'HumMod source-aligned myocardial metabolism',
  fuel:'HumMod source-aligned myocardial fuel selection',
  acidBase:'HumMod source-aligned myocardial lactate/CO2/SID/pHi runtime',
  cellFactors:'Crampin-Smith / Shimayoshi component shadow only',
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
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function createHumModMyocardialDecompensationObserver({
  side='left',
  initialLactateMassMeq,
  initialCo2MassMeq,
}={}){
  if(side!=='left'&&side!=='right') throw new Error('side must be left or right');

  const acidBase=createHumModMyocardialAcidBaseRuntime({
    side,
    ...(initialLactateMassMeq==null?{}:{initialLactateMassMeq}),
    ...(initialCo2MassMeq==null?{}:{initialCo2MassMeq}),
  });

  let last=null;

  function step({
    dtSec,
    arterialPo2MmHg,
    pressureGradientMmHg,
    alphaReceptorActivity,
    adhPoolLog10Conc,
    myocardialMassG,
    initialMyocardialMassG=myocardialMassG,
    calMultiplier=1,
    thyroidEffect=1,
    heatMetabolismCore=1,
    structureEffect=1,
    viscosityConductanceEffect,
    anesthesiaVascularConductance,
    vasculatureEffect,
    infarctionEffect,
    arterialO2ContentMlPerMl,
    o2MaxMlPerMl,
    hgbP50,
    hgbScaleForSat,
    plasmaVolumeFraction,
    fattyAcidConcentrationMgPerMl,
    fattyAcidConcentrationMgDl,
    glucoseConcentrationMgPerMl,
    glucoseConcentrationMgDl,
    myocardialLactateMgDlForFuel,
    intracellularPotassium,
    liquidVolumeMl,
    bloodSid,
    arterialHco3,
    lactatePoolConcentration,
    respiratoryQuotient,
    intracellularO2Mm=null,
    atpMgMm=null,
    phosphocreatineMm=null,
    phosphateMm=null,
  }={}){
    positive(dtSec,'dtSec');
    [
      ['arterialPo2MmHg',arterialPo2MmHg],
      ['pressureGradientMmHg',pressureGradientMmHg],
      ['alphaReceptorActivity',alphaReceptorActivity],
      ['adhPoolLog10Conc',adhPoolLog10Conc],
      ['myocardialMassG',myocardialMassG],
      ['initialMyocardialMassG',initialMyocardialMassG],
      ['calMultiplier',calMultiplier],
      ['thyroidEffect',thyroidEffect],
      ['heatMetabolismCore',heatMetabolismCore],
      ['structureEffect',structureEffect],
      ['viscosityConductanceEffect',viscosityConductanceEffect],
      ['anesthesiaVascularConductance',anesthesiaVascularConductance],
      ['vasculatureEffect',vasculatureEffect],
      ['infarctionEffect',infarctionEffect],
      ['arterialO2ContentMlPerMl',arterialO2ContentMlPerMl],
      ['o2MaxMlPerMl',o2MaxMlPerMl],
      ['hgbP50',hgbP50],
      ['hgbScaleForSat',hgbScaleForSat],
      ['plasmaVolumeFraction',plasmaVolumeFraction],
      ['fattyAcidConcentrationMgPerMl',fattyAcidConcentrationMgPerMl],
      ['fattyAcidConcentrationMgDl',fattyAcidConcentrationMgDl],
      ['glucoseConcentrationMgPerMl',glucoseConcentrationMgPerMl],
      ['glucoseConcentrationMgDl',glucoseConcentrationMgDl],
      ['myocardialLactateMgDlForFuel',myocardialLactateMgDlForFuel],
      ['intracellularPotassium',intracellularPotassium],
      ['liquidVolumeMl',liquidVolumeMl],
      ['bloodSid',bloodSid],
      ['arterialHco3',arterialHco3],
      ['lactatePoolConcentration',lactatePoolConcentration],
    ].forEach(([k,v])=>finite(v,k));

    if(plasmaVolumeFraction<0||plasmaVolumeFraction>1){
      throw new Error('plasmaVolumeFraction must be between 0 and 1');
    }
    [
      ['fattyAcidConcentrationMgPerMl',fattyAcidConcentrationMgPerMl],
      ['fattyAcidConcentrationMgDl',fattyAcidConcentrationMgDl],
      ['glucoseConcentrationMgPerMl',glucoseConcentrationMgPerMl],
      ['glucoseConcentrationMgDl',glucoseConcentrationMgDl],
      ['myocardialLactateMgDlForFuel',myocardialLactateMgDlForFuel],
    ].forEach(([k,v])=>nonNegative(v,k));

    // O2 need depends on metabolism; flow needs O2 need. HumMod's metabolic
    // need is independent of current O2 use, so derive need first with O2Use=0.
    const demand=myocardialMetabolism({
      side,
      myocardialMassG,
      initialMyocardialMassG,
      calMultiplier,
      thyroidEffect,
      heatMetabolismCore,
      structureEffect,
      o2UseMlPerMin:0,
    });

    const flow=solveMyocardialFlow({
      side,
      arterialPo2MmHg,
      pressureGradientMmHg,
      alphaReceptorActivity,
      adhPoolLog10Conc,
      o2NeedMlPerMin:demand.o2NeedMlPerMin,
      viscosityConductanceEffect,
      anesthesiaVascularConductance,
      vasculatureEffect,
      infarctionEffect,
      arterialO2ContentMlPerMl,
      o2MaxMlPerMl,
      hgbP50,
      hgbScaleForSat,
      plasmaVolumeFraction,
    });

    const metabolism=myocardialMetabolism({
      side,
      myocardialMassG,
      initialMyocardialMassG,
      calMultiplier,
      thyroidEffect,
      heatMetabolismCore,
      structureEffect,
      o2UseMlPerMin:flow.o2UseMlPerMin,
    });

    const fuel=myocardialFuelSelection({
      fattyAcidConcentrationMgPerMl,
      fattyAcidConcentrationMgDl,
      glucoseConcentrationMgPerMl,
      glucoseConcentrationMgDl,
      plasmaFlowMlPerMin:flow.plasmaFlowMlPerMin,
      myocardialLactateMgDl:myocardialLactateMgDlForFuel,
      aerobicCals:metabolism.aerobicCals,
      anaerobicCals:metabolism.anaerobicCals,
    });

    const acid=acidBase.step({
      dtSec,
      intracellularPotassium,
      liquidVolumeMl,
      bloodFlowMlPerMin:flow.bloodFlowMlPerMin,
      o2UseMlPerMin:flow.o2UseMlPerMin,
      bloodSid,
      arterialHco3,
      anaerobicGlucoseUsedMgPerMin:fuel.anaerobicGlucoseUsedMgPerMin,
      lactateUsedMgPerMin:fuel.lacUsedMgPerMin,
      lactatePoolConcentration,
      ...(respiratoryQuotient==null?{}:{respiratoryQuotient}),
    });

    const cellular=candidateSnapshot({
      intracellularPh:acid.intracellularPh,
      intracellularO2Mm,
      atpMgMm,
      phosphocreatineMm,
      phosphateMm,
    });

    const o2DeliveryMlPerMin=
      flow.bloodFlowMlPerMin*arterialO2ContentMlPerMl;
    const o2DeliveryToNeedRatio=
      metabolism.o2NeedMlPerMin>0
        ?o2DeliveryMlPerMin/metabolism.o2NeedMlPerMin
        :null;

    last=Object.freeze({
      schema:'hummod-myocardial-decompensation-observer/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      side,
      coronary:flow,
      metabolism,
      fuel,
      acidBase:acid,
      cellular,
      derived:Object.freeze({
        o2DeliveryMlPerMin,
        o2DeliveryToNeedRatio,
      }),
      wholeHeart:Object.freeze({
        contractilityMultiplier:null,
        emax:null,
        strokeVolumeEffect:null,
        cardiacOutputEffect:null,
      }),
      blockers:Object.freeze({
        cellToWholeHeartMechanics:
          'No source-valid cellular-force -> whole-heart Emax mapping is established.',
        intracellularEnergetics:
          intracellularO2Mm==null||atpMgMm==null||phosphocreatineMm==null
            ?'Intracellular O2/ATP/PCr not supplied; cellular energetic fields remain incomplete.'
            :null,
      }),
      controlAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  return Object.freeze({
    step,
    snapshot:()=>last||Object.freeze({
      schema:'hummod-myocardial-decompensation-observer/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      wholeHeart:Object.freeze({
        contractilityMultiplier:null,
        emax:null,
        strokeVolumeEffect:null,
        cardiacOutputEffect:null,
      }),
      controlAuthority:false,
      provenance:SOURCE,
    }),
  });
}

module.exports=Object.freeze({
  SOURCE,
  createHumModMyocardialDecompensationObserver,
});
