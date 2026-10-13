'use strict';

/**
 * v1.6 regional ARDS oxygen/perfusion fixed-point candidate.
 *
 * Composition only; no new physiologic gain:
 * - regional alveolar ventilation is caller-owned (Vent-derived);
 * - bronchi inspired O2 conditioning uses HumMod source equations upstream;
 * - alveolar-capillary O2 is assumed equilibrated as in Das et al. 2015;
 * - blood O2 content vs PO2 uses the existing HumMod source-aligned function;
 * - regional HPV/perfusion uses Marshall 1994 + Das 2015.
 *
 * For each region at a fixed point:
 *
 *   VA_i * (FIO2_bronchi - FAO2_i)
 *     = Q_i * (CcapO2(PAO2_i) - CvO2)
 *
 * with:
 *   PAO2_i = FAO2_i * PB
 *
 * Regional Q_i is simultaneously determined from the Das/Marshall pulmonary
 * vascular resistance allocation. The coupled algebraic state is solved by
 * fixed-point iteration. This numerical iteration is not a physiologic gain.
 *
 * Candidate only. No canonical bedside authority.
 */

const {
  hemoglobinProperties,
}=require('./hummod_ards_core_chemistry.js');
const {
  o2ContentFromPo2,
  po2FromO2Content,
  solveRootBisection,
}=require('./hummod_ards_core_gas_exchange.js');
const {
  regionalHpvPerfusionDasMarshall,
}=require('./v16_das_marshall_regional_hpv_perfusion.js');

const SOURCE=Object.freeze({
  regionalLung:
    'Das A et al. Crit Care. 2015;19:8. doi:10.1186/s13054-014-0723-6',
  hpv:
    'Marshall BE et al. Respir Physiol. 1994;96:231-247. doi:10.1016/0034-5687(94)90129-5',
  bloodO2:
    'HumMod source-aligned Hgb/O2 content relations',
  numericalCoupling:
    'fixed-point iteration of source/composition equations; no physiologic gain',
  authority:'candidate-not-canonical',
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
function fraction(v,label){
  finite(v,label);
  if(v<0||v>1) throw new Error(label+' must be in [0,1]');
  return v;
}

function solveRegionalAlveolarO2({
  alveolarVentilationStpdMlPerMin,
  pulmonaryBloodFlowMlPerMin,
  bronchiO2Fraction,
  barometricPressureMmHg,
  mixedVenousO2ContentMlPerMl,
  o2MaxMlPerMl,
  p50MmHg,
  scaleForSat,
}={}){
  nonNegative(
    alveolarVentilationStpdMlPerMin,
    'alveolarVentilationStpdMlPerMin'
  );
  positive(pulmonaryBloodFlowMlPerMin,'pulmonaryBloodFlowMlPerMin');
  fraction(bronchiO2Fraction,'bronchiO2Fraction');
  positive(barometricPressureMmHg,'barometricPressureMmHg');
  nonNegative(mixedVenousO2ContentMlPerMl,'mixedVenousO2ContentMlPerMl');
  positive(o2MaxMlPerMl,'o2MaxMlPerMl');
  positive(p50MmHg,'p50MmHg');
  positive(scaleForSat,'scaleForSat');

  function residual(fAlveolarO2){
    const pAlveolarO2MmHg=fAlveolarO2*barometricPressureMmHg;
    const capillaryO2ContentMlPerMl=o2ContentFromPo2({
      po2MmHg:pAlveolarO2MmHg,
      o2MaxMlPerMl,
      p50MmHg,
      scaleForSat,
    });
    const ventilationO2MlPerMin=
      alveolarVentilationStpdMlPerMin*
      (bronchiO2Fraction-fAlveolarO2);
    const perfusionO2MlPerMin=
      pulmonaryBloodFlowMlPerMin*
      (capillaryO2ContentMlPerMl-mixedVenousO2ContentMlPerMl);
    return ventilationO2MlPerMin-perfusionO2MlPerMin;
  }

  const fAlveolarO2=solveRootBisection({
    fn:residual,
    low:1e-9,
    high:Math.max(1e-8,bronchiO2Fraction),
    tolerance:1e-8,
    label:'regional alveolar O2 balance',
  });

  const pAlveolarO2MmHg=fAlveolarO2*barometricPressureMmHg;
  const capillaryO2ContentMlPerMl=o2ContentFromPo2({
    po2MmHg:pAlveolarO2MmHg,
    o2MaxMlPerMl,
    p50MmHg,
    scaleForSat,
  });
  const oxygenTransferMlPerMin=
    pulmonaryBloodFlowMlPerMin*
    (capillaryO2ContentMlPerMl-mixedVenousO2ContentMlPerMl);

  return Object.freeze({
    alveolarO2Fraction:fAlveolarO2,
    pAlveolarO2MmHg,
    capillaryO2ContentMlPerMl,
    oxygenTransferMlPerMin,
  });
}

function solveRegionalArdsO2PerfusionFixedPoint({
  totalPulmonaryBloodFlowMlPerMin,
  regionalAlveolarVentilationStpdMlPerMin,
  bronchiO2Fraction,
  barometricPressureMmHg,
  mixedVenousO2ContentMlPerMl,
  mixedVenousPo2MmHg=null,
  o2MaxMlPerMl,
  tempC,
  arterialPhEstimate,
  arterialPco2EstimateMmHg,
  carboxyPercent=0,
  regionalIds=null,
  initialRegionalAlveolarPo2MmHg=null,
  toleranceMmHg=0.01,
  maxIterations=100,
}={}){
  positive(totalPulmonaryBloodFlowMlPerMin,'totalPulmonaryBloodFlowMlPerMin');
  if(!Array.isArray(regionalAlveolarVentilationStpdMlPerMin)||
     regionalAlveolarVentilationStpdMlPerMin.length<1){
    throw new Error(
      'regionalAlveolarVentilationStpdMlPerMin must be a non-empty array'
    );
  }
  for(let i=0;i<regionalAlveolarVentilationStpdMlPerMin.length;i++){
    nonNegative(
      regionalAlveolarVentilationStpdMlPerMin[i],
      'regionalAlveolarVentilationStpdMlPerMin['+i+']'
    );
  }
  fraction(bronchiO2Fraction,'bronchiO2Fraction');
  positive(barometricPressureMmHg,'barometricPressureMmHg');
  nonNegative(mixedVenousO2ContentMlPerMl,'mixedVenousO2ContentMlPerMl');
  positive(o2MaxMlPerMl,'o2MaxMlPerMl');
  positive(toleranceMmHg,'toleranceMmHg');
  if(!Number.isInteger(maxIterations)||maxIterations<1){
    throw new Error('maxIterations must be a positive integer');
  }

  const props=hemoglobinProperties({
    tempC,
    pH:arterialPhEstimate,
    pco2MmHg:arterialPco2EstimateMmHg,
    carboxyPercent,
  });

  const resolvedMixedVenousPo2MmHg=
    mixedVenousPo2MmHg==null
      ?po2FromO2Content({
        o2ContentMlPerMl:mixedVenousO2ContentMlPerMl,
        o2MaxMlPerMl,
        p50MmHg:props.p50MmHg,
        scaleForSat:props.scaleForSat,
      })
      :mixedVenousPo2MmHg;
  positive(resolvedMixedVenousPo2MmHg,'mixedVenousPo2MmHg');

  const n=regionalAlveolarVentilationStpdMlPerMin.length;
  if(regionalIds!=null &&
     (!Array.isArray(regionalIds)||regionalIds.length!==n)){
    throw new Error('regionalIds must match regional ventilation length');
  }

  let regionalPo2=initialRegionalAlveolarPo2MmHg==null
    ?Array(n).fill(bronchiO2Fraction*barometricPressureMmHg)
    :[...initialRegionalAlveolarPo2MmHg];
  if(regionalPo2.length!==n){
    throw new Error(
      'initialRegionalAlveolarPo2MmHg must match regional ventilation length'
    );
  }
  for(let i=0;i<n;i++) positive(regionalPo2[i],'initialRegionalAlveolarPo2MmHg['+i+']');

  let perfusion=null;
  let regionalGas=null;
  let converged=false;
  let iteration=0;
  let maxDeltaMmHg=Infinity;

  for(iteration=1;iteration<=maxIterations;iteration++){
    perfusion=regionalHpvPerfusionDasMarshall({
      totalPulmonaryBloodFlowMlPerMin,
      regionalAlveolarPo2MmHg:regionalPo2,
      mixedVenousPo2MmHg:resolvedMixedVenousPo2MmHg,
      regionalIds,
    });

    regionalGas=perfusion.regions.map((r,i)=>
      solveRegionalAlveolarO2({
        alveolarVentilationStpdMlPerMin:
          regionalAlveolarVentilationStpdMlPerMin[i],
        pulmonaryBloodFlowMlPerMin:r.pulmonaryBloodFlowMlPerMin,
        bronchiO2Fraction,
        barometricPressureMmHg,
        mixedVenousO2ContentMlPerMl,
        o2MaxMlPerMl,
        p50MmHg:props.p50MmHg,
        scaleForSat:props.scaleForSat,
      })
    );

    const nextPo2=regionalGas.map(x=>x.pAlveolarO2MmHg);
    maxDeltaMmHg=Math.max(
      ...nextPo2.map((v,i)=>Math.abs(v-regionalPo2[i]))
    );
    regionalPo2=nextPo2;
    if(maxDeltaMmHg<=toleranceMmHg){
      converged=true;
      break;
    }
  }

  if(!converged){
    throw new Error(
      'regional ARDS O2/perfusion fixed point did not converge; maxDeltaMmHg='+
      maxDeltaMmHg
    );
  }

  // Re-evaluate perfusion at the converged regional gas state so returned
  // flow and oxygen coordinates are internally aligned.
  perfusion=regionalHpvPerfusionDasMarshall({
    totalPulmonaryBloodFlowMlPerMin,
    regionalAlveolarPo2MmHg:regionalPo2,
    mixedVenousPo2MmHg:resolvedMixedVenousPo2MmHg,
    regionalIds,
  });

  const regions=regionalGas.map((g,i)=>Object.freeze({
    id:regionalIds?regionalIds[i]:String(i),
    alveolarVentilationStpdMlPerMin:
      regionalAlveolarVentilationStpdMlPerMin[i],
    pAlveolarO2MmHg:regionalPo2[i],
    alveolarO2Fraction:g.alveolarO2Fraction,
    capillaryO2ContentMlPerMl:g.capillaryO2ContentMlPerMl,
    oxygenTransferMlPerMin:g.oxygenTransferMlPerMin,
    hpvResistanceCoefficient:
      perfusion.regions[i].hpvResistanceCoefficient,
    perfusionFraction:perfusion.regions[i].perfusionFraction,
    pulmonaryBloodFlowMlPerMin:
      perfusion.regions[i].pulmonaryBloodFlowMlPerMin,
  }));

  const mixedNonShuntCapillaryO2ContentMlPerMl=
    regions.reduce(
      (sum,r)=>sum+
        (r.pulmonaryBloodFlowMlPerMin*r.capillaryO2ContentMlPerMl),
      0
    )/totalPulmonaryBloodFlowMlPerMin;

  return Object.freeze({
    schema:'v16-regional-ards-o2-perfusion-fixed-point/v1',
    authority:SOURCE.authority,
    canonicalControlAuthority:false,
    converged,
    iterations:iteration,
    toleranceMmHg,
    maxDeltaMmHg,
    mixedVenousPo2MmHg:resolvedMixedVenousPo2MmHg,
    totalPulmonaryBloodFlowMlPerMin,
    regions:Object.freeze(regions),
    totalOxygenTransferMlPerMin:
      regions.reduce((s,r)=>s+r.oxygenTransferMlPerMin,0),
    mixedNonShuntCapillaryO2ContentMlPerMl,
    flowClosureMlPerMin:perfusion.flowClosureMlPerMin,
    numericalCoupling:Object.freeze({
      method:'fixed-point',
      physiologicGainAdded:false,
    }),
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  solveRegionalAlveolarO2,
  solveRegionalArdsO2PerfusionFixedPoint,
});
