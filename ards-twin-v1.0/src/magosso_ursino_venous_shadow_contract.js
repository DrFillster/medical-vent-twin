'use strict';

/**
 * Magosso/Ursino 2001 venous sympathetic + venous-capacitance contract.
 *
 * This module intentionally fails closed.
 *
 * Reason:
 * - the 2001 model introduces a distinct venous sympathetic channel f_sv;
 * - the downstream venous unstressed-volume effectors are source-structured;
 * - however peripheral chemoreceptor Eq. 1 contains a PaO2-dependent CO2
 *   interaction whose printed piecewise definition has not yet been
 *   primary-source verified.
 *
 * Therefore no live f_sv or venous volume is emitted from incomplete inputs.
 */

const SOURCE=Object.freeze({
  primary:Object.freeze({
    citation:'Magosso E, Ursino M. A mathematical model of CO2 effect on cardiovascular regulation. Am J Physiol Heart Circ Physiol. 2001;281:H2036-H2052.',
    doi:'10.1152/ajpheart.2001.281.5.H2036',
    pmid:'11668065',
  }),
  blocker:'Primary visual verification of Eq. 1 O2-CO2 peripheral chemoreceptor interaction is incomplete.',
  controlAuthority:false,
});

const EFFECTOR=Object.freeze({
  thresholdSpikesPerSec:2.66,
  delaySec:5,
  tauSec:20,
  beds:Object.freeze({
    activeMuscle:Object.freeze({baselineMl:286.4,gainMl:-28.29,secondaryEdited:true}),
    extrasplanchnic:Object.freeze({baselineMl:607.8,gainMl:-74.21,secondaryEdited:false}),
    restingMuscle:Object.freeze({baselineMl:190.95,gainMl:-28.29,secondaryEdited:false}),
    splanchnic:Object.freeze({baselineMl:961.6,gainMl:-265.4,secondaryEdited:false}),
  }),
});

function venousSympatheticContract(){
  return Object.freeze({
    fSvSpikesPerSec:null,
    regionalUnstressedVolumeMl:null,
    status:'blocked-pending-primary-source-eq1-transcription',
    source:SOURCE,
    effector:EFFECTOR,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  SOURCE,
  EFFECTOR,
  venousSympatheticContract,
});
