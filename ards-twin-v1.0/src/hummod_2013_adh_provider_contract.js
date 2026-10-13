'use strict';

/**
 * HumMod initial-import ADH dependency contract.
 *
 * Purpose: document why ADHPool.Log10Conc is not yet a compact live provider
 * for the 2013 coronary-flow candidate. This file does not approximate ADH.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  authority:'diagnostic-only',
});

const REQUIRED_SUBSYSTEMS=Object.freeze([
  'ECFV volume',
  'OsmBody osmoreceptors and osmoreceptor damage',
  'Nucleus-ADH neural activity',
  'Cortisol concentration',
  'GI water intake/adapted intake',
  'Hypothalamic magnocellular-neuron integrity/damage',
  'ADH synthesis Signal/mRNA state',
  'ADH slow storage mass',
  'ADH fast storage mass',
  'ADH secretion',
  'ADH pump/exogenous infusion state',
  'GI/liver plasma flow and liver function',
  'left and right kidney plasma flow',
  'left and right GFR',
  'left and right kidney function',
  'other-tissue blood flow',
]);

const SOURCE_FILES=Object.freeze([
  'Structure/ADH/ADHPool.DES',
  'Structure/ADH/ADHSecretion.DES',
  'Structure/ADH/ADHClearance.DES',
  'Structure/ADH/ADHFastMass.DES',
  'Structure/ADH/ADHSlowMass.DES',
  'Structure/ADH/ADHSynthesis.DES',
  'Structure/ADH/ADHPump.DES',
  'Structure/Nerves/Nucleus-ADH.DES',
]);

function readiness(){
  return Object.freeze({
    schema:'hummod-2013-adh-provider-readiness/v1',
    authority:SOURCE.authority,
    source:SOURCE,
    sourceFiles:SOURCE_FILES,
    requiredSubsystems:REQUIRED_SUBSYSTEMS,
    readyForLiveADHLog10Conc:false,
    fixedNormalSubstitutionAllowed:false,
    rationale:
      'ADHPool.Log10Conc is the output of a multi-compartment endocrine/osmoregulatory/renal subsystem; replacing it with a fixed normal value would bypass source physiology.',
  });
}

module.exports=Object.freeze({
  SOURCE,
  SOURCE_FILES,
  REQUIRED_SUBSYSTEMS,
  readiness,
});
