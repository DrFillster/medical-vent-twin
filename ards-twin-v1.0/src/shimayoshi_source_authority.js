'use strict';

const MECHANICS_FIELDS=Object.freeze([
  'start_cycle_hsmL_um',
  'min_cycle_hsmL_um',
  'max_cycle_hsmL_um',
  'end_cycle_hsmL_um',
  'end_cycle_hsmX_um',
  'cycle_hsmL_excursion_um',
  'cycle_peak_shortening_um',
  'cycle_net_hsmL_change_um',
]);

function hasFiniteMechanics(cycle){
  return MECHANICS_FIELDS.every(
    key=>typeof cycle[key]==='number'&&Number.isFinite(cycle[key])
  );
}

function assessShimayoshiCycleAuthority({
  validatedSourceRun,
  cycleIndex,
}={}){
  if(!validatedSourceRun||
     validatedSourceRun.status!=='shimayoshi-source-stress-trajectory-validated'||
     !Array.isArray(validatedSourceRun.trajectory)){
    throw new Error('validated Shimayoshi source run is required');
  }
  if(!Number.isInteger(cycleIndex)||cycleIndex<0||
     cycleIndex>=validatedSourceRun.trajectory.length){
    throw new Error('cycleIndex must select an imported source cycle');
  }

  const cycle=validatedSourceRun.trajectory[cycleIndex];
  const sourceProtocolName=
    validatedSourceRun.provenance&&validatedSourceRun.provenance.protocolName;
  const mechanicsPresent=hasFiniteMechanics(cycle);

  if(sourceProtocolName==='ischemia'){
    return Object.freeze({
      sourceProtocolName,
      cyclePhase:cycle.protocol,
      mechanicsPresent,
      pressureShadowEligible:true,
      closedLoopPressureAuthority:false,
      status:mechanicsPresent
        ? 'ischemia-mechanics-observed-authority-blocked-contracture-dominant-source-phenotype'
        : 'ischemia-authority-blocked-pending-sarcomere-mechanics',
      reason:mechanicsPresent
        ? 'Validated source mechanics show late ischemia/reperfusion high Fb with severe energy failure, marked persistent hsmL shortening, and near-absent cyclic shortening. Peak Fb alone is not pumping authority.'
        : 'Ischemia source force cannot be mapped to pumping authority without cycle sarcomere mechanics.',
    });
  }

  if(sourceProtocolName==='acidosis'){
    return Object.freeze({
      sourceProtocolName,
      cyclePhase:cycle.protocol,
      mechanicsPresent,
      pressureShadowEligible:true,
      closedLoopPressureAuthority:false,
      status:'acidosis-source-force-shadow-candidate',
      reason:'Validated source myocardial depression is available, but browser surrogate and closed-loop validation remain pending.',
    });
  }

  if(sourceProtocolName==='control'){
    return Object.freeze({
      sourceProtocolName,
      cyclePhase:cycle.protocol,
      mechanicsPresent,
      pressureShadowEligible:true,
      closedLoopPressureAuthority:false,
      status:'control-source-force-shadow-reference',
      reason:'Control source force is a reference input only; closed-loop authority is not granted by this module.',
    });
  }

  throw new Error('unrecognized Shimayoshi source protocol');
}

module.exports=Object.freeze({
  MECHANICS_FIELDS,
  hasFiniteMechanics,
  assessShimayoshiCycleAuthority,
});
