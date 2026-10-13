'use strict';

/**
 * v1.6 Das/Hardman human-ARDS regional pulmonary perfusion candidate.
 *
 * Primary source:
 * Das A, Chikhani M, Cole O, et al.
 * Evaluation of lung recruitment maneuvers in ARDS using computer simulation.
 * Crit Care. 2015;19:8. doi:10.1186/s13054-014-0723-6.
 * Online supplement, Eqs. 23-24.
 *
 * Source equations:
 *   1/PVR = sum_i (1/RV_i)
 *   RV_i = deltaV_i * RV0
 *   RV0 = 160 * N_A dyn s cm^-5 min^-1
 *
 * deltaV_i is the source HPV vascular-resistance coefficient. The supplement
 * states that it implements the Marshall human HPV response, but this module
 * does not invent that missing mapping. deltaV_i must be supplied by a
 * source-qualified provider.
 *
 * Candidate only; no canonical bedside authority.
 */

const SOURCE=Object.freeze({
  citation:'Das A et al. Crit Care. 2015;19:8.',
  doi:'10.1186/s13054-014-0723-6',
  supplement:'Additional File 1, Eqs. 23-24',
  hpvReference:'Marshall BE et al. Respir Physiol. 1994;96(2-3):231-247.',
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
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function defaultRegionalResistanceDas2015({regionCount}={}){
  if(!Number.isInteger(regionCount)||regionCount<1){
    throw new Error('regionCount must be a positive integer');
  }
  return 160*regionCount;
}

function regionalPerfusionWeightsDas2015({
  hpvCoefficients,
  sourceQualified=false,
}={}){
  if(sourceQualified!==true){
    throw new Error('HPV coefficients must be source-qualified');
  }
  if(!Array.isArray(hpvCoefficients)||hpvCoefficients.length<1){
    throw new Error('hpvCoefficients must be a non-empty array');
  }

  const regionCount=hpvCoefficients.length;
  const rv0=defaultRegionalResistanceDas2015({regionCount});
  const resistances=hpvCoefficients.map((deltaV,i)=>{
    positive(deltaV,'hpvCoefficients['+i+']');
    return deltaV*rv0;
  });
  const conductances=resistances.map(r=>1/r);
  const totalConductance=conductances.reduce((a,b)=>a+b,0);
  positive(totalConductance,'total pulmonary conductance');
  const pvr=1/totalConductance;
  const perfusionFractions=conductances.map(g=>g/totalConductance);

  return Object.freeze({
    schema:'v16-das-ards-regional-perfusion/v1',
    authority:SOURCE.authority,
    sourceQualified:true,
    regionCount,
    defaultRegionalResistanceDynSecCm5Min:rv0,
    hpvCoefficients:Object.freeze([...hpvCoefficients]),
    regionalResistancesDynSecCm5Min:Object.freeze(resistances),
    totalPvrDynSecCm5Min:pvr,
    perfusionFractions:Object.freeze(perfusionFractions),
    provenance:SOURCE,
  });
}

function allocateRegionalPulmonaryFlowDas2015({
  totalPulmonaryBloodFlowMlPerMin,
  hpvCoefficients,
  sourceQualified=false,
}={}){
  positive(totalPulmonaryBloodFlowMlPerMin,'totalPulmonaryBloodFlowMlPerMin');
  const w=regionalPerfusionWeightsDas2015({
    hpvCoefficients,
    sourceQualified,
  });
  const flows=w.perfusionFractions.map(
    f=>f*totalPulmonaryBloodFlowMlPerMin
  );
  return Object.freeze({
    ...w,
    totalPulmonaryBloodFlowMlPerMin,
    regionalFlowsMlPerMin:Object.freeze(flows),
    flowClosureMlPerMin:
      flows.reduce((a,b)=>a+b,0)-totalPulmonaryBloodFlowMlPerMin,
  });
}

module.exports=Object.freeze({
  SOURCE,
  defaultRegionalResistanceDas2015,
  regionalPerfusionWeightsDas2015,
  allocateRegionalPulmonaryFlowDas2015,
});
