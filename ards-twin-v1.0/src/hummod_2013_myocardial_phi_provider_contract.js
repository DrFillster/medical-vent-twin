'use strict';

/**
 * HumMod 2013 myocardial-pHi provider readiness contract.
 *
 * This contract distinguishes equation closure from live-provider closure.
 * No upstream state is silently defaulted.
 */

const STATUS=Object.freeze({
  EQUATION_CLOSED:'equation-closed',
  PARALLEL_DERIVABLE:'parallel-derivable',
  RUNTIME_BOUNDARY_DEPENDENT:'runtime-available-upstream-boundary-dependent',
  BLOCKED:'blocked-upstream-subsystem',
  SCENARIO_BOUNDARY:'explicit-scenario-boundary',
});

const FIELDS=Object.freeze([
  Object.freeze({
    field:'bloodFlowMlPerMin / o2UseMlPerMin',
    status:STATUS.PARALLEL_DERIVABLE,
    provider:'hummod_2013_left_heart_flow_candidate',
    blocker:
      'coronary flow equation is closed, but live-source-complete inputs still include ADH, metabolic demand, blood/Hct state, and explicit scenario modifiers',
  }),
  Object.freeze({
    field:'liquidVolumeMl',
    status:STATUS.BLOCKED,
    provider:'hummod_2013_left_heart_liquid_volume_provider',
    blocker:
      'current LV liquid volume requires TissueH2O/InterstitialWater/CellH2O whole-body water states',
  }),
  Object.freeze({
    field:'intracellularPotassium',
    status:STATUS.BLOCKED,
    provider:'hummod_2013_kcell_provider',
    blocker:
      'current KCell concentration requires dynamic KCell mass, CellH2O volume, KPool mass, aldosterone effect, and whole-body K balance',
  }),
  Object.freeze({
    field:'lactatePoolConcentration',
    status:STATUS.BLOCKED,
    provider:'hummod_2013_lactate_pool_provider',
    blocker:
      'current LacPool concentration requires whole-body organ lactate outflux network and ECFV',
  }),
  Object.freeze({
    field:'anaerobicGlucoseUsedMgPerMin',
    status:STATUS.EQUATION_CLOSED,
    provider:'hummod_2013_left_heart_fuel',
    blocker:null,
    note:
      '2013 source sets AnaerobicGlucoseUsed(Cals/Min)=0 in the normal Calc branch',
  }),
  Object.freeze({
    field:'lactateUsedMgPerMin',
    status:STATUS.PARALLEL_DERIVABLE,
    provider:'hummod_2013_left_heart_fuel',
    blocker:
      'requires insulin-receptor bound fraction, glucose pool, fatty-acid pool, systemic lactate pool, plasma flow, and local lactate state',
  }),
  Object.freeze({
    field:'local myocardial lactate',
    status:STATUS.PARALLEL_DERIVABLE,
    provider:'hummod_2013_left_heart_lactate',
    blocker:
      'requires current LV liquid volume, blood flow, fuel outputs, and systemic lactate pool',
  }),
  Object.freeze({
    field:'bloodSid',
    status:STATUS.RUNTIME_BOUNDARY_DEPENDENT,
    provider:'live gas/acid-base runtime',
    blocker:
      'runtime value exists but upstream electrolyte/body-fluid source completeness is not yet established',
  }),
  Object.freeze({
    field:'arterialHco3',
    status:STATUS.RUNTIME_BOUNDARY_DEPENDENT,
    provider:'live gas/acid-base runtime',
    blocker:
      'runtime value exists; upstream blood acid-base boundary ownership remains reduced',
  }),
  Object.freeze({
    field:'myocardial CO2/SID/pHi',
    status:STATUS.EQUATION_CLOSED,
    provider:'hummod_2013_left_heart_co2_ph',
    blocker:null,
    note:
      'CO2 mass uses fixed-step integration of the source derivative; DES adaptive solver identity is not claimed and convergence testing is required',
  }),
]);

function readiness(){
  const blocked=FIELDS.filter(x=>x.status===STATUS.BLOCKED);
  return Object.freeze({
    schema:'hummod-2013-myocardial-phi-provider-readiness/v1',
    authority:'diagnostic-only',
    physiologyChanged:false,
    fields:FIELDS,
    summary:Object.freeze({
      blockedCount:blocked.length,
      blockedFields:Object.freeze(blocked.map(x=>x.field)),
      readyToReplaceExplicitMyocardialPHiInLiveModel:blocked.length===0 &&
        FIELDS.every(x=>[
          STATUS.EQUATION_CLOSED,
          STATUS.PARALLEL_DERIVABLE,
        ].includes(x.status)),
      fixedInitialStateSubstitutionAllowed:false,
      olderGenerationFuelOrPotassiumSubstitutionAllowed:false,
    }),
  });
}

module.exports=Object.freeze({
  STATUS,
  FIELDS,
  readiness,
});
