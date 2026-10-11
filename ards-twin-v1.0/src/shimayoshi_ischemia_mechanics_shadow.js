'use strict';

// Source-mechanics container for validated Shimayoshi ischemia/reperfusion rows.
//
// Deliberately does not convert peak Fb into whole-heart pressure or a
// contractility multiplier. Severe ischemia can produce high Fb while cyclic
// shortening collapses, so force-only pumping authority is prohibited.

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}

function shimayoshiIschemiaMechanicsShadow(row){
  if(!row||typeof row!=='object'||Array.isArray(row)){
    throw new Error('validated Shimayoshi mechanics row is required');
  }
  if(!['control','ischemia','reperfusion'].includes(row.protocol)){
    throw new Error('row.protocol must be control, ischemia, or reperfusion');
  }

  const fields=[
    'time_s',
    'stress_ratio',
    'shortening_ratio',
    'peak_Fb_mN_per_mm2',
    'cycle_peak_shortening_um',
    'start_cycle_hsmL_um',
    'min_cycle_hsmL_um',
    'max_cycle_hsmL_um',
    'end_cycle_hsmL_um',
    'end_cycle_ATPTotal_mM',
    'end_cycle_PCr_mM',
    'end_cycle_Pi_mM',
    'end_cycle_pHi',
    'peak_Cyt_Cai_mM',
  ];
  for(const k of fields) finite(row[k],k);

  return Object.freeze({
    status:'Shimayoshi-ischemia-mechanics-shadow',
    phase:row.protocol,
    timeSec:row.time_s,
    activeForce:Object.freeze({
      peakFbMnPerMm2:row.peak_Fb_mN_per_mm2,
      stressRatio:row.stress_ratio,
    }),
    cyclicMechanics:Object.freeze({
      shorteningRatio:row.shortening_ratio,
      peakShorteningUm:row.cycle_peak_shortening_um,
      startHalfSarcomereLengthUm:row.start_cycle_hsmL_um,
      minHalfSarcomereLengthUm:row.min_cycle_hsmL_um,
      maxHalfSarcomereLengthUm:row.max_cycle_hsmL_um,
      endHalfSarcomereLengthUm:row.end_cycle_hsmL_um,
    }),
    energeticState:Object.freeze({
      atpTotalMm:row.end_cycle_ATPTotal_mM,
      phosphocreatineMm:row.end_cycle_PCr_mM,
      phosphateMm:row.end_cycle_Pi_mM,
      intracellularPh:row.end_cycle_pHi,
      peakCytosolicCalciumMm:row.peak_Cyt_Cai_mM,
    }),
    interpretation:
      'Force and mechanical state must be interpreted jointly; no numeric contracture threshold is imposed.',
    peakFbOnlyPumpMappingAllowed:false,
    closedLoopPressureAuthority:false,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  shimayoshiIschemiaMechanicsShadow,
});
