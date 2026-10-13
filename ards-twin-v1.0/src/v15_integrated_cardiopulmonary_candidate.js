'use strict';

/**
 * v1.5 integrated cardiopulmonary candidate spine.
 *
 * This is the first physician-candidate composition layer for the source-family
 * Ursino/Magosso cardiovascular plant. It does not replace Vent mechanics and
 * it does not activate the Karamolegkos lung-volume/pressure coupling until the
 * Vent -> absolute alveolar-volume coordinate is source-verified.
 *
 * Candidate only. No canonical bedside authority.
 */

const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('./ursino_magosso_2000_expanded_hypoxia_closed_loop.js');

const SOURCE=Object.freeze({
  cardiovascularPlant:
    'Ursino & Magosso 2000, doi:10.1152/ajpheart.2000.279.1.H149',
  heartBaroreflex:
    'Ursino 1998, doi:10.1152/ajpheart.1998.275.5.H1733',
  gasAutonomic:
    'Ursino & Magosso 2000 hypoxia pathways; Magosso & Ursino 2001 CO2 extension is retained as a separate candidate track',
  localO2:
    'Ursino & Magosso 2000 Eqs. 41-48',
  pulmonaryMechanicalCandidate:
    'Karamolegkos/Albanese/Chbat 2021, doi:10.1109/OJEMB.2021.3128629',
  authority:'candidate-not-canonical',
});

const BLOCKED_BRIDGES=Object.freeze({
  ventAbsoluteAlveolarVolume:
    'No source-verified mapping from Vent elastic volume to Karamolegkos absolute V_A.',
  ventPleuralAlveolarPressure:
    'Karamolegkos pressure-coupled pulmonary vascular runtime is not active in this spine.',
  myocardialEnergeticsToChamber:
    'Source-valid myocardial energetic/acid-base to chamber-mechanics ownership is not yet integrated.',
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
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function createV15IntegratedCardiopulmonaryCandidate({
  dtSec=0.002,
  pao2MmHg=95,
  paco2MmHg=40,
  deliveredTidalVolumeL=0.5,
}={}){
  positive(dtSec,'dtSec');
  nonNegative(pao2MmHg,'pao2MmHg');
  positive(paco2MmHg,'paco2MmHg');
  nonNegative(deliveredTidalVolumeL,'deliveredTidalVolumeL');

  const loop=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
    dtSec,
    pao2MmHg,
    paco2MmHg,
    tidalVolumeL:deliveredTidalVolumeL,
    ventilationMode:'external-delivered-vt',
    diagnosticLocalO2Mode:'source',
  });

  let inputs=Object.freeze({
    pao2MmHg,
    paco2MmHg,
    deliveredTidalVolumeL,
  });

  function setCanonicalInputs(next={}){
    const merged={...inputs,...next};
    nonNegative(merged.pao2MmHg,'pao2MmHg');
    positive(merged.paco2MmHg,'paco2MmHg');
    nonNegative(merged.deliveredTidalVolumeL,'deliveredTidalVolumeL');

    const forbidden=[
      'absoluteAlveolarVolumeL',
      'alveolarPressureMmHg',
      'pleuralPressureMmHg',
    ];
    for(const key of forbidden){
      if(Object.prototype.hasOwnProperty.call(next,key)){
        throw new Error(
          key+' is blocked until the Vent-to-Karamolegkos coordinate bridge is source-verified'
        );
      }
    }

    inputs=Object.freeze(merged);
    loop.setEnvironment({
      pao2MmHg:inputs.pao2MmHg,
      paco2MmHg:inputs.paco2MmHg,
      tidalVolumeL:inputs.deliveredTidalVolumeL,
    });
    return snapshot();
  }

  function step(){
    loop.step();
    return snapshot();
  }

  function runFor(seconds){
    nonNegative(seconds,'seconds');
    loop.runFor(seconds);
    return snapshot();
  }

  function snapshot(){
    const s=loop.snapshot();
    const h=s.hemodynamics;
    return Object.freeze({
      schema:'v15-integrated-cardiopulmonary-candidate/v1',
      timeSec:s.timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      candidatePlantControlAuthority:true,
      inputs,
      physicianState:Object.freeze({
        heartRatePerMin:h.heartRatePerMin,
        systemicArterialPressureMmHg:h.systemicArterialPressureMmHg,
        pulmonaryArteryPressureMmHg:h.pulmonaryArteryPressureMmHg,
        rightAtrialPressureMmHg:h.rightAtrialPressureMmHg,
        leftAtrialPressureMmHg:h.leftAtrialPressureMmHg,
        pao2MmHg:inputs.pao2MmHg,
        paco2MmHg:inputs.paco2MmHg,
        deliveredTidalVolumeL:inputs.deliveredTidalVolumeL,
      }),
      cardiovascular:Object.freeze({
        hemodynamics:h,
        vascularState:s.vascularState,
        vascularEffectors:s.vascularEffectors,
        autonomic:s.autonomic,
        localO2:s.localO2,
        conservation:s.conservation,
      }),
      ownership:Object.freeze({
        ventMechanics:'external-canonical-owner',
        arterialGas:'external-canonical-input',
        cardiovascularPlant:'candidate-source-family-owner',
        autonomicController:'candidate-source-family-owner',
        regionalSystemicO2Control:'candidate-source-family-owner',
        pulmonaryMechanicalCoupling:'blocked-not-active',
        myocardialEnergeticContractility:'blocked-not-active',
      }),
      blockedBridges:BLOCKED_BRIDGES,
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,
    runFor,
    snapshot,
    setCanonicalInputs,
    source:SOURCE,
    blockedBridges:BLOCKED_BRIDGES,
  });
}

module.exports=Object.freeze({
  SOURCE,
  BLOCKED_BRIDGES,
  createV15IntegratedCardiopulmonaryCandidate,
});
