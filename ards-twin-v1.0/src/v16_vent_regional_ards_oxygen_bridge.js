'use strict';

/**
 * v1.6 Vent -> regional ARDS oxygenation bridge.
 *
 * Ownership:
 * - Vent: regional alveolar ventilation and FiO2
 * - Das/Marshall: regional HPV/perfusion allocation of NON-SHUNT flow
 * - Karamolegkos: total pulmonary peripheral flow + anatomical shunt fraction
 * - HumMod: humidified inspired gas and blood O2 content/PO2 relation
 *
 * This bridge produces an arterial O2 target that reflects regional V/Q and
 * anatomic shunt without using Vent's legacy perfusionFraction metadata.
 *
 * Candidate only. No canonical bedside authority.
 */

const {
  ventRegionalAlveolarVentilationStpd,
}=require('./v16_vent_regional_alveolar_ventilation_adapter.js');
const {
  bronchiGasFractions,
}=require('./hummod_ards_core_breathing.js');
const {
  hemoglobinProperties,
}=require('./hummod_ards_core_chemistry.js');
const {
  mixOxygenAcrossShunt,
  po2FromO2Content,
}=require('./hummod_ards_core_gas_exchange.js');
const {
  solveRegionalArdsO2PerfusionFixedPoint,
}=require('./v16_regional_ards_o2_perfusion_candidate.js');

const SOURCE=Object.freeze({
  mechanics:'Vent',
  regionalPerfusion:'Das 2015 + Marshall 1994 candidate',
  anatomicalShunt:'Karamolegkos pulmonary vascular candidate',
  bloodO2:'HumMod source-aligned blood O2 relations',
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
function fraction(v,label){
  finite(v,label);
  if(v<0||v>1) throw new Error(label+' must be in [0,1]');
  return v;
}

function createVentRegionalArdsOxygenState({
  simulation,
  pulmonaryVascularSnapshot,
  gasSnapshot,
  blood,
  environment,
  toleranceMmHg=0.05,
  maxIterations=100,
}={}){
  if(!simulation) throw new Error('simulation is required');
  if(!pulmonaryVascularSnapshot?.pulmonaryPerfusionState){
    throw new Error('pulmonaryVascularSnapshot.pulmonaryPerfusionState is required');
  }
  if(!gasSnapshot?.gas?.gases){
    throw new Error('gasSnapshot.gas.gases is required');
  }
  if(!blood||!environment){
    throw new Error('blood and environment are required');
  }

  const totalFlow=positive(
    pulmonaryVascularSnapshot.pulmonaryPerfusionState
      .totalPulmonaryBloodFlowMlPerMin,
    'totalPulmonaryBloodFlowMlPerMin'
  );
  const nonShuntFlow=positive(
    pulmonaryVascularSnapshot.pulmonaryPerfusionState
      .ventilatedPulmonaryBloodFlowMlPerMin,
    'nonShuntPulmonaryBloodFlowMlPerMin'
  );
  if(nonShuntFlow>totalFlow){
    throw new Error('non-shunt pulmonary flow cannot exceed total flow');
  }
  const shuntFraction=fraction(
    pulmonaryVascularSnapshot.pulmonaryPerfusionState.shuntFraction,
    'shuntFraction'
  );

  const regionalVent=ventRegionalAlveolarVentilationStpd({
    simulation,
    barometricPressureMmHg:environment.barometricPressureMmHg,
    bodyTempC:blood.tempC,
  });
  if(regionalVent.status!=='ready'){
    return Object.freeze({
      schema:'v16-vent-regional-ards-oxygen-state/v1',
      status:regionalVent.status,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      regionalVentilation:regionalVent,
      provenance:SOURCE,
    });
  }

  const fio2=simulation.controller?.settings?.fio2;
  fraction(fio2,'simulation FiO2');
  const bronchi=bronchiGasFractions({
    inspiredPressureMmHg:environment.barometricPressureMmHg,
    inspiredO2Fraction:fio2,
    inspiredCo2Fraction:environment.inspiredCo2Fraction||0,
  });

  const venous=gasSnapshot.gas.gases.venous;
  const arterial=gasSnapshot.gas.gases.arterial;
  positive(venous.po2MmHg,'venous.po2MmHg');

  const regional=solveRegionalArdsO2PerfusionFixedPoint({
    totalPulmonaryBloodFlowMlPerMin:nonShuntFlow,
    regionalAlveolarVentilationStpdMlPerMin:
      regionalVent.regions.map(r=>r.alveolarVentilationStpdMlPerMin),
    bronchiO2Fraction:bronchi.o2Fraction,
    barometricPressureMmHg:environment.barometricPressureMmHg,
    mixedVenousO2ContentMlPerMl:venous.o2ContentMlPerMl,
    mixedVenousPo2MmHg:venous.po2MmHg,
    o2MaxMlPerMl:blood.o2MaxMlPerMl,
    tempC:blood.tempC,
    arterialPhEstimate:arterial.pH,
    arterialPco2EstimateMmHg:arterial.pco2MmHg,
    carboxyPercent:blood.carboxyPercent||0,
    regionalIds:regionalVent.regions.map(r=>r.id),
    toleranceMmHg,
    maxIterations,
  });

  const arterialO2ContentMlPerMl=mixOxygenAcrossShunt({
    totalPulmonaryBloodFlowMlPerMin:totalFlow,
    ventilatedPulmonaryBloodFlowMlPerMin:nonShuntFlow,
    capillaryO2ContentMlPerMl:
      regional.mixedNonShuntCapillaryO2ContentMlPerMl,
    mixedVenousO2ContentMlPerMl:venous.o2ContentMlPerMl,
  });

  const props=hemoglobinProperties({
    tempC:blood.tempC,
    pH:arterial.pH,
    pco2MmHg:arterial.pco2MmHg,
    carboxyPercent:blood.carboxyPercent||0,
  });
  const arterialPo2MmHg=po2FromO2Content({
    o2ContentMlPerMl:arterialO2ContentMlPerMl,
    o2MaxMlPerMl:blood.o2MaxMlPerMl,
    p50MmHg:props.p50MmHg,
    scaleForSat:props.scaleForSat,
  });

  return Object.freeze({
    schema:'v16-vent-regional-ards-oxygen-state/v1',
    status:'ready',
    authority:SOURCE.authority,
    canonicalControlAuthority:false,
    arterialPo2MmHg,
    arterialO2ContentMlPerMl,
    anatomicalShuntFraction:shuntFraction,
    totalPulmonaryBloodFlowMlPerMin:totalFlow,
    nonShuntPulmonaryBloodFlowMlPerMin:nonShuntFlow,
    regionalVentilation:regionalVent,
    regionalO2Perfusion:regional,
    ownership:Object.freeze({
      regionalVentilation:'Vent',
      regionalPerfusion:'Das-Marshall-candidate',
      anatomicalShunt:'Karamolegkos-candidate',
      bloodO2Relation:'HumMod-source-aligned',
    }),
    legacyVentPerfusionMetadataUsed:false,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  createVentRegionalArdsOxygenState,
});
