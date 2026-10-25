'use strict';

/**
 * Lin, Ngwompo & Tilley 2012 steady-state baro-chemoreflex + HR candidate.
 *
 * Primary source:
 * Lin J, Ngwompo RF, Tilley DG.
 * Proc Inst Mech Eng H. 2012;226(10):787-803.
 * doi:10.1177/0954411912451823. PMID 23157080.
 *
 * Purpose:
 * Evaluate the exact PUBLISHED steady-state algebra of Eqs. 12-31 without
 * inventing the missing dynamic central-compartment time constant tau_c.
 * At steady state all first-order filters and pure delays have unit DC gain,
 * so tau_c is not required for the static MAP/gas -> HR relation.
 *
 * Source equations used:
 * 12-17: baroreflex afferent/central/efferent pathway
 * 18-28: nonlinear sympathetic/parasympathetic heart-rate effector
 * 30-31: peripheral baroreflex reset + central sympathetic-gain response
 *
 * Important sign convention:
 * Figure 3 shows the vagal branch entering the HR summation as inhibitory.
 * Therefore DeltaHR_v is negative for positive PNA.
 *
 * Important parameter-ratio convention:
 * Eqs. 22, 24 and 27 are implemented as k0/G0. This is the dimensionally
 * consistent reading of the typeset equations and preserves the finite
 * nonlinear gain shown in Fig. 3. The candidate exposes all intermediate
 * terms so this remains auditable.
 *
 * No fitting, HR target, or PaCO2->HR interpolation is present.
 */

const {
  peripheralChemoreflexOperatingPointTerm,
  centralChemoreflexSympatheticGainPercent,
}=require('./lin_2012_baro_chemoreflex_interaction_candidate.js');

const SOURCE=Object.freeze({
  citation:
    'Lin J, Ngwompo RF, Tilley DG. Proc Inst Mech Eng H. 2012;226(10):787-803.',
  doi:'10.1177/0954411912451823',
  pmid:'23157080',
  equations:Object.freeze([12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,30,31]),
  parameterTable:'Table A2 and Table A3',
  validation:
    'Published model reports predicted HR and MAP changes within 3% of measured changes during hypoxia and hypercapnia.',
  authority:'steady-state-primary-source-candidate-no-control-authority',
  clinicalValidation:false,
});

const P=Object.freeze({
  afferent:Object.freeze({
    gain:1,
    tauSec:0.001,
  }),
  central:Object.freeze({
    baseDemandPressureMmHg:90,
  }),
  sympathetic:Object.freeze({
    slopeAtOperatingPoint:-0.0138,
    maxHz:4,
    minHz:1.12,
  }),
  parasympathetic:Object.freeze({
    slopeAtOperatingPoint:0.0205,
    maxHz:6,
    minHz:0.6,
  }),
  heartRate:Object.freeze({
    intrinsicBpm:109,
    interaction:0.017,
    sympathetic:Object.freeze({
      gainAsymptoteBpmPerHz:90,
      gainShape0:0.28,
      tauAsymptote:10,
      tauShape0:0.2,
      delaySec:3,
    }),
    parasympathetic:Object.freeze({
      gainAsymptoteBpmPerHz:60,
      gainShape0:0.4,
      tauIncreaseSec:0.1,
      tauDecreaseSec:0.8,
      delaySec:0.5,
    }),
  }),
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

function sigmoidWidth({max,min,slopeAtOperatingPoint}={}){
  finite(max,'max');
  finite(min,'min');
  finite(slopeAtOperatingPoint,'slopeAtOperatingPoint');
  if(slopeAtOperatingPoint===0){
    throw new Error('slopeAtOperatingPoint must be non-zero');
  }
  return (max-min)/(4*slopeAtOperatingPoint);
}

function sympatheticOutflowBaseHz(pressureErrorMmHg){
  finite(pressureErrorMmHg,'pressureErrorMmHg');
  const p=P.sympathetic;
  const k=sigmoidWidth({
    max:p.maxHz,min:p.minHz,slopeAtOperatingPoint:p.slopeAtOperatingPoint,
  });
  const e=Math.exp(pressureErrorMmHg/k);
  return (p.maxHz+p.minHz*e)/(1+e);
}

function parasympatheticOutflowHz(pressureErrorMmHg){
  finite(pressureErrorMmHg,'pressureErrorMmHg');
  const p=P.parasympathetic;
  const k=sigmoidWidth({
    max:p.maxHz,min:p.minHz,slopeAtOperatingPoint:p.slopeAtOperatingPoint,
  });
  const e=Math.exp(pressureErrorMmHg/k);
  return (p.maxHz+p.minHz*e)/(1+e);
}

function sympatheticHeartRateGainBpmPerHz(sympatheticHz){
  positive(sympatheticHz,'sympatheticHz');
  const p=P.heartRate.sympathetic;
  const k=p.gainShape0/p.gainAsymptoteBpmPerHz;
  return p.gainAsymptoteBpmPerHz*(1-Math.exp(-k*sympatheticHz));
}

function parasympatheticHeartRateGainBpmPerHz(parasympatheticHz){
  positive(parasympatheticHz,'parasympatheticHz');
  const p=P.heartRate.parasympathetic;
  const k=p.gainShape0/p.gainAsymptoteBpmPerHz;
  return p.gainAsymptoteBpmPerHz*(1-Math.exp(-k*parasympatheticHz));
}

function evaluateLin2012SteadyState({
  meanArterialPressureMmHg,
  arterialPo2MmHg,
  arterialPco2MmHg,
}={}){
  finite(meanArterialPressureMmHg,'meanArterialPressureMmHg');
  positive(arterialPo2MmHg,'arterialPo2MmHg');
  positive(arterialPco2MmHg,'arterialPco2MmHg');

  // Eq. 12 at steady state: P_aff = G_aff * MAP, G_aff=1.
  const afferentPressureMmHg=
    P.afferent.gain*meanArterialPressureMmHg;

  // Eq. 30 resets the baroreflex operating point around the Table-A2
  // nominal P_demand=90 mmHg.
  const peripheralResetMmHg=peripheralChemoreflexOperatingPointTerm({
    arterialPo2MmHg,
    arterialPco2MmHg,
  });
  const demandPressureMmHg=
    P.central.baseDemandPressureMmHg+peripheralResetMmHg;

  // Eq. 13 at steady state.
  const pressureErrorMmHg=demandPressureMmHg-afferentPressureMmHg;

  // Eqs. 14-17.
  const sympatheticBaseHz=sympatheticOutflowBaseHz(pressureErrorMmHg);
  const sympatheticGainPercent=centralChemoreflexSympatheticGainPercent({
    arterialPco2MmHg,
  });
  const sympatheticHz=
    sympatheticBaseHz*(1+sympatheticGainPercent/100);
  const parasympatheticHz=
    parasympatheticOutflowHz(pressureErrorMmHg);

  // Eqs. 20-28 at steady state. Delays and first-order filters have unit
  // steady-state gain; variable time constants affect transients only.
  const sympatheticGainBpmPerHz=
    sympatheticHeartRateGainBpmPerHz(sympatheticHz);
  const parasympatheticGainBpmPerHz=
    parasympatheticHeartRateGainBpmPerHz(parasympatheticHz);

  const sympatheticDeltaHrBpm=
    sympatheticGainBpmPerHz*sympatheticHz;
  const parasympatheticDeltaHrBpm=
    -parasympatheticGainBpmPerHz*parasympatheticHz;

  // Eqs. 18-19.
  const interactionDeltaHrBpm=
    P.heartRate.interaction*
    sympatheticDeltaHrBpm*
    parasympatheticDeltaHrBpm;
  const totalDeltaHrBpm=
    sympatheticDeltaHrBpm+
    parasympatheticDeltaHrBpm+
    interactionDeltaHrBpm;
  const heartRatePerMin=
    P.heartRate.intrinsicBpm+totalDeltaHrBpm;

  return Object.freeze({
    inputs:Object.freeze({
      meanArterialPressureMmHg,
      arterialPo2MmHg,
      arterialPco2MmHg,
    }),
    afferentPressureMmHg,
    peripheralResetMmHg,
    demandPressureMmHg,
    pressureErrorMmHg,
    sympatheticBaseHz,
    sympatheticGainPercent,
    sympatheticHz,
    parasympatheticHz,
    sympatheticGainBpmPerHz,
    parasympatheticGainBpmPerHz,
    sympatheticDeltaHrBpm,
    parasympatheticDeltaHrBpm,
    interactionDeltaHrBpm,
    totalDeltaHrBpm,
    heartRatePerMin,
    controlAuthority:false,
    dynamicAuthority:false,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  P,
  sigmoidWidth,
  sympatheticOutflowBaseHz,
  parasympatheticOutflowHz,
  sympatheticHeartRateGainBpmPerHz,
  parasympatheticHeartRateGainBpmPerHz,
  evaluateLin2012SteadyState,
});
