'use strict';

/**
 * Magosso/Ursino 2001 venous sympathetic downstream-effector contract.
 *
 * Current state:
 * - primary Eq. 1 O2-CO2 chemoreceptor transcription is available in
 *   magosso_ursino_2001_gas_autonomic_candidate.js;
 * - that candidate can emit source-structured f_sv in spikes/s;
 * - this file still fails closed at the conversion from f_sv to regional
 *   venous unstressed volumes because downstream parameter provenance and
 *   ownership must be verified independently.
 *
 * No live patient-state authority.
 */

const SOURCE=Object.freeze({
  primary:Object.freeze({
    citation:'Magosso E, Ursino M. A mathematical model of CO2 effect on cardiovascular regulation. Am J Physiol Heart Circ Physiol. 2001;281:H2036-H2052.',
    doi:'10.1152/ajpheart.2001.281.5.H2036',
    pmid:'11668065',
  }),
  sourceFamily:Object.freeze({
    hypoxiaCitation:'Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
    hypoxiaDoi:'10.1152/ajpheart.2000.279.1.H149',
  }),
  integrationReference:Object.freeze({
    repository:'Sheng-Ya/OpenCRS',
    revision:'86085d6e64ad0e82232a9f2c9aaa303a0296cc34',
    note:'Integration reference only. OpenCRS contains edited/tuned parameters and is not primary-source parameter authority.',
  }),
  blocker:'Regional f_sv-to-venous-unstressed-volume parameters and baseline ownership require primary-source verification before volume output is activated.',
  controlAuthority:false,
});

const EFFECTOR_REFERENCE=Object.freeze({
  thresholdSpikesPerSec:2.66,
  delaySec:5,
  tauSec:20,
  // These values are retained only as a transcription/reference inventory.
  // Do not use them to alter canonical patient state until each value and
  // baseline definition is reconciled to the primary source and selected
  // cardiovascular plant.
  beds:Object.freeze({
    activeMuscle:Object.freeze({
      baselineMl:286.4,gainMl:-28.29,
      provenance:'OpenCRS/source-family transcription; edited status requires audit',
    }),
    extrasplanchnic:Object.freeze({
      baselineMl:607.8,gainMl:-74.21,
      provenance:'OpenCRS/source-family transcription; primary verification required',
    }),
    restingMuscle:Object.freeze({
      baselineMl:190.95,gainMl:-28.29,
      provenance:'OpenCRS/source-family transcription; primary verification required',
    }),
    splanchnic:Object.freeze({
      baselineMl:1361.6,gainMl:-265.4,
      provenance:'OpenCRS manuscript snapshot/source-family transcription; primary baseline reconciliation required',
    }),
  }),
});

function venousSympatheticContract({
  fSvSpikesPerSec=null,
}={}){
  if(fSvSpikesPerSec!=null &&
     (typeof fSvSpikesPerSec!=='number'||!Number.isFinite(fSvSpikesPerSec)||
      fSvSpikesPerSec<0)){
    throw new Error('fSvSpikesPerSec must be null or finite and >= 0');
  }

  return Object.freeze({
    fSvSpikesPerSec,
    regionalUnstressedVolumeMl:null,
    neuralChannelStatus:fSvSpikesPerSec==null
      ? 'awaiting-source-candidate-f_sv'
      : 'source-candidate-f_sv-available',
    downstreamStatus:'blocked-pending-primary-effector-parameter-and-ownership-audit',
    source:SOURCE,
    effectorReference:EFFECTOR_REFERENCE,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  SOURCE,
  EFFECTOR_REFERENCE,
  venousSympatheticContract,
});
