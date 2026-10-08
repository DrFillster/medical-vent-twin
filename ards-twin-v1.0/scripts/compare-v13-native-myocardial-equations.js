#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const { myocardialSid }=require('../src/hummod_myocardial_sid_source_aligned.js');
const { phCells, tissueBaseToGas }=require('../src/hummod_acid_base_source_aligned.js');
const { myocardialMetabolism }=require('../src/hummod_myocardial_metabolism_source_aligned.js');
const { myocardialFuelSelection }=require('../src/hummod_myocardial_fuel_source_aligned.js');
const { stableDelayDerivative }=require('../src/hummod_stable_delay_source_aligned.js');
const { setupHgbProps }=require('../src/hummod_hgb_tissue_source_aligned.js');
const { solveMyocardialFlow }=require('../src/hummod_myocardial_flow_source_aligned.js');
const { calculateSide }=require('../src/hummod_ards_heart_function_source_aligned.js');

function relErr(a,b){
  const den=Math.max(Math.abs(b),1e-12);
  return Math.abs(a-b)/den;
}
function maxMetric(rows,key){
  return rows.reduce((best,r)=>r[key]>best[key]?r:best,rows[0]);
}
function value(v,key,i){
  if(!v[key]) throw new Error('missing native variable: '+key);
  return v[key][i];
}

function sidePrefix(side){return side==='left'?'LeftHeart':'RightHeart';}

function analyze(input){
  if(!input||input.format!=='lossless-numeric-extraction-of-native-SOLN'){
    throw new Error('lossless native HumMod variable extraction required');
  }
  const v=input.variables;
  const n=value(v,'System.X',0)==null?0:v['System.X'].length;
  const rows=[];

  for(let i=0;i<n;i++){
    const hgb=setupHgbProps({
      tempC:value(v,'HeatCore.Temp(C)',i),
      pH:value(v,'BloodPh.VeinsPh',i),
      pCO2MmHg:value(v,'CO2Veins.Pressure',i),
      carboxyPercent:value(v,'HgbConc.CarboxyPercent',i),
    });

    for(const side of ['left','right']){
      const p=sidePrefix(side);
      const sid=myocardialSid({
        intracellularPotassium:value(v,'KCell.[K+]',i),
        myocardialLactate:value(v,p+'-Lactate.[Lac-]',i),
        otherCations:value(v,'CellSID.OtherCations',i),
        strongAnions:value(v,'CellSID.StrongAnions',i),
      });
      const pH=phCells({
        pCO2:value(v,p+'-CO2.PCO2',i),
        SID:sid.sidMeqPerL,
      }).pH;
      const metabolism=myocardialMetabolism({
        side,
        myocardialMassG:value(v,p+'-Size.Mass',i),
        initialMyocardialMassG:value(v,p+'-Size.InitialMass',i),
        calMultiplier:value(v,p+'-Metabolism.CalMultiplier',i),
        thyroidEffect:value(v,'Thyroid.Effect',i),
        heatMetabolismCore:value(v,'HeatMetabolism.Core',i),
        structureEffect:value(v,p+'-Structure.Effect',i),
        o2UseMlPerMin:value(v,p+'-Flow.O2Use',i),
      });
      const fuel=myocardialFuelSelection({
        fattyAcidConcentrationMgPerMl:value(v,'FAPool.[FA]',i),
        fattyAcidConcentrationMgDl:value(v,'FAPool.[FA(mG/dL)]',i),
        glucoseConcentrationMgPerMl:value(v,'GlucosePool.[Glucose]',i),
        glucoseConcentrationMgDl:value(v,'GlucosePool.[Glucose(mG/dL)]',i),
        plasmaFlowMlPerMin:value(v,p+'-Flow.PlasmaFlow',i),
        myocardialLactateMgDl:value(v,p+'-Lactate.[Lac-(mG/dL)]',i),
        aerobicCals:value(v,p+'-Metabolism.AerobicCals',i),
        anaerobicCals:value(v,p+'-Metabolism.AnaerobicCals',i),
      });
      const flow=solveMyocardialFlow({
        side,
        arterialPo2MmHg:value(v,'PO2Artys.Pressure',i),
        pressureGradientMmHg:value(v,p+'-Pressure.PressureGradient',i),
        alphaReceptorActivity:value(v,p+'-AlphaReceptors.Activity',i),
        adhPoolLog10Conc:value(v,'ADHPool.Log10Conc',i),
        o2NeedMlPerMin:value(v,p+'-Metabolism.O2Need',i),
        viscosityConductanceEffect:value(v,'Viscosity.ConductanceEffect',i),
        anesthesiaVascularConductance:value(v,'Anesthesia.VascularConductance',i),
        vasculatureEffect:value(v,p+'-Vasculature.Effect',i),
        infarctionEffect:value(v,p+'-Infarction.Effect',i),
        arterialO2ContentMlPerMl:value(v,'O2Artys.[O2]',i),
        o2MaxMlPerMl:value(v,'HgbConc.[O2Max]',i),
        hgbP50:hgb.p50,
        hgbScaleForSat:hgb.scaleForSat,
        plasmaVolumeFraction:value(v,'BloodVol.PVCrit',i),
      });
      const functionState=calculateSide({
        myocardialPh:pH,
        cellProteinMassG:value(v,'CellProtein.Mass(G)',i),
        fuelFractUseDelay:value(v,p+'-Fuel.FractUseDelay',i),
        coreTempC:value(v,'HeatCore.Temp(C)',i),
        structureEffect:value(v,p+'-Structure.Effect',i),
      });
      const hco3=value(v,p+'-CO2.Mass',i)/value(v,p+'-Size.LiquidVol',i);
      const co2Pco2=tissueBaseToGas({hco3,SID:sid.sid}).pCO2;
      const delayChange=stableDelayDerivative({
        input:value(v,p+'-Fuel.FractUse',i),
        output:value(v,p+'-Fuel.FractUseDelay',i),
        rateConstantPerMin:value(v,p+'-Fuel.K',i),
      });

      rows.push({
        sampleIndex:i,
        timestampSec:value(v,'System.X',i)*60,
        side,
        sidAbsError:Math.abs(sid.sid-value(v,p+'-Ph.[SID]',i)),
        phAbsError:Math.abs(pH-value(v,p+'-Ph.Ph',i)),
        co2Pco2AbsError:Math.abs(co2Pco2-value(v,p+'-CO2.PCO2',i)),
        o2NeedRelError:relErr(metabolism.o2NeedMlPerMin,value(v,p+'-Metabolism.O2Need',i)),
        o2LackRelError:relErr(metabolism.o2LackMlPerMin,value(v,p+'-Metabolism.O2Lack',i)),
        aerobicCalsRelError:relErr(metabolism.aerobicCals,value(v,p+'-Metabolism.AerobicCals',i)),
        anaerobicCalsRelError:relErr(metabolism.anaerobicCals,value(v,p+'-Metabolism.AnaerobicCals',i)),
        fuelMinDeliveryAbsError:Math.abs(fuel.minimumFractionalDelivery-value(v,p+'-Fuel.MinimumFractionalDelivery',i)),
        anaerobicGlucoseUseRelError:relErr(fuel.anaerobicGlucoseUsedMgPerMin,value(v,p+'-Fuel.AnaerobicGlucoseUsed(mG/Min)',i)),
        lactateUseRelError:relErr(fuel.lacUsedMgPerMin,value(v,p+'-Fuel.LacUsed(mG/Min)',i)),
        delayDerivativeAbsError:Math.abs(delayChange-value(v,p+'-Fuel.Change',i)),
        flowPo2AbsError:Math.abs(flow.po2MmHg-value(v,p+'-Flow.PO2',i)),
        flowBloodRelError:relErr(flow.bloodFlowMlPerMin,value(v,p+'-Flow.BloodFlow',i)),
        flowO2UseRelError:relErr(flow.o2UseMlPerMin,value(v,p+'-Flow.O2Use',i)),
        functionEffectAbsError:Math.abs(functionState.effect-value(v,p+'-Function.Effect',i)),
      });
    }
  }

  const metricKeys=[
    'sidAbsError','phAbsError','co2Pco2AbsError',
    'o2NeedRelError','o2LackRelError','aerobicCalsRelError','anaerobicCalsRelError',
    'fuelMinDeliveryAbsError','anaerobicGlucoseUseRelError','lactateUseRelError',
    'delayDerivativeAbsError','flowPo2AbsError','flowBloodRelError','flowO2UseRelError',
    'functionEffectAbsError',
  ];
  const maxima={};
  for(const key of metricKeys){
    const r=maxMetric(rows,key);
    maxima[key]={value:r[key],sampleIndex:r.sampleIndex,timestampSec:r.timestampSec,side:r.side};
  }

  return {
    schema:'vent-v1.3-native-myocardial-equation-replay/v1',
    sampleCount:n,
    comparedRows:rows.length,
    maxima,
    notes:[
      'This is an equation replay against native upstream state, not a dynamic reduced-model validation.',
      'Fuel FractUseDelay is supplied from native HumMod here because DES StableDelay time-integration identity is not yet established.',
      'Myocardial flow uses the exact source relation with a bounded-bisection root solver; DES 2005 solver identity is not claimed.',
    ],
    rows,
  };
}

if(require.main===module){
  const inputPath=process.argv[2], outputPath=process.argv[3];
  if(!inputPath) throw new Error('usage: node scripts/compare-v13-native-myocardial-equations.js <native-all-variables.json> [output.json]');
  const report=analyze(JSON.parse(fs.readFileSync(inputPath,'utf8')));
  const text=JSON.stringify(report,null,2)+'\n';
  if(outputPath) fs.writeFileSync(outputPath,text);
  else process.stdout.write(text);
}

module.exports={analyze};
