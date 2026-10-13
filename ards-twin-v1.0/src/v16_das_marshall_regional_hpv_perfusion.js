'use strict';

/**
 * v1.6 human-ARDS regional HPV/perfusion composition.
 *
 * Composition:
 *   regional PAO2 + mixed-venous PO2
 *     -> Marshall 1994 HPV response
 *     -> Das deltaV_i vascular coefficient
 *     -> Das 2015 parallel regional vascular resistances/perfusion fractions
 *
 * Das is a human-ARDS simulator, but the cited Marshall dose-response source
 * was measured in canine lungs. Preserve that limitation explicitly.
 *
 * Candidate only. No canonical bedside authority.
 */

const {
  dasHpvResistanceCoefficientFromMarshall,
}=require('./v16_marshall_hpv_candidate.js');
const {
  allocateRegionalPulmonaryFlowDas2015,
}=require('./v16_das_ards_regional_perfusion_candidate.js');

const SOURCE=Object.freeze({
  regionalPerfusion:'Das et al. 2015, doi:10.1186/s13054-014-0723-6',
  hpvDoseResponse:'Marshall et al. 1994, doi:10.1016/0034-5687(94)90129-5',
  hpvSpecies:'canine source used by human-ARDS simulator family',
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

function regionalHpvPerfusionDasMarshall({
  totalPulmonaryBloodFlowMlPerMin,
  regionalAlveolarPo2MmHg,
  mixedVenousPo2MmHg,
  regionalIds=null,
}={}){
  positive(totalPulmonaryBloodFlowMlPerMin,'totalPulmonaryBloodFlowMlPerMin');
  positive(mixedVenousPo2MmHg,'mixedVenousPo2MmHg');

  if(!Array.isArray(regionalAlveolarPo2MmHg)||
     regionalAlveolarPo2MmHg.length<1){
    throw new Error('regionalAlveolarPo2MmHg must be a non-empty array');
  }
  if(regionalIds!=null &&
     (!Array.isArray(regionalIds)||
      regionalIds.length!==regionalAlveolarPo2MmHg.length)){
    throw new Error('regionalIds must match regionalAlveolarPo2MmHg length');
  }

  const hpv=regionalAlveolarPo2MmHg.map((pao2,i)=>{
    positive(pao2,'regionalAlveolarPo2MmHg['+i+']');
    return dasHpvResistanceCoefficientFromMarshall({
      alveolarPo2MmHg:pao2,
      mixedVenousPo2MmHg,
    });
  });

  const perfusion=allocateRegionalPulmonaryFlowDas2015({
    totalPulmonaryBloodFlowMlPerMin,
    hpvCoefficients:hpv.map(x=>x.hpvCoefficient),
    sourceQualified:true,
  });

  const regions=regionalAlveolarPo2MmHg.map((pao2,i)=>Object.freeze({
    id:regionalIds?regionalIds[i]:String(i),
    alveolarPo2MmHg:pao2,
    mixedVenousPo2MmHg,
    hpvStimulusPo2MmHg:hpv[i].stimulusPo2MmHg,
    hpvResponseFraction:hpv[i].responseFraction,
    hpvResistanceCoefficient:hpv[i].hpvCoefficient,
    perfusionFraction:perfusion.perfusionFractions[i],
    pulmonaryBloodFlowMlPerMin:perfusion.regionalFlowsMlPerMin[i],
  }));

  return Object.freeze({
    schema:'v16-das-marshall-regional-hpv-perfusion/v1',
    authority:SOURCE.authority,
    canonicalControlAuthority:false,
    totalPulmonaryBloodFlowMlPerMin,
    mixedVenousPo2MmHg,
    regions:Object.freeze(regions),
    totalPvrDynSecCm5Min:perfusion.totalPvrDynSecCm5Min,
    flowClosureMlPerMin:perfusion.flowClosureMlPerMin,
    unresolvedUpstream:Object.freeze({
      regionalAlveolarPo2:
        'must come from a source-valid regional alveolar gas state; global PaO2 is not accepted',
    }),
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  regionalHpvPerfusionDasMarshall,
});
