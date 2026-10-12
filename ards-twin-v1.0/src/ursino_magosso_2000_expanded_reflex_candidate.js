'use strict';

/**
 * Ursino-Magosso 2000 expanded reflex cardiovascular candidate.
 *
 * Composition:
 * - 2000 five-bed cardiovascular plant;
 * - Ursino 1998 baroreceptor afferent;
 * - Ursino/Magosso 2000-2001 gas-autonomic firing;
 * - 2000 split systemic effector runtime.
 *
 * Local O2 vascular regulation is intentionally disabled in this layer.
 * Candidate only; no canonical bedside authority.
 */

const {
  createUrsinoMagosso2000ExpandedPlantRuntime,
}=require('./ursino_magosso_2000_expanded_plant_runtime.js');
const {
  createUrsinoBaroreceptorShadow,
}=require('./ursino_baroreceptor_shadow.js');
const {
  P:O2_2000_P,
  firstOrderExact,
  pulmonaryStretchStatic,
}=require('./ursino_magosso_autonomic_shadow.js');
const {
  createMagossoUrsinoGasAutonomicCandidate,
}=require('./magosso_ursino_2001_gas_autonomic_candidate.js');
const {
  createUrsinoMagosso2000SplitEffectorsRuntime,
}=require('./ursino_magosso_2000_split_effectors_runtime.js');

const SOURCE=Object.freeze({
  plant:'Ursino & Magosso 2000, doi:10.1152/ajpheart.2000.279.1.H149',
  baroreceptor:'Ursino 1998, doi:10.1152/ajpheart.1998.275.5.H1733',
  gasAutonomic:'Magosso & Ursino 2001, doi:10.1152/ajpheart.2001.281.5.H2036',
  localO2:'disabled-in-this-layer',
  authority:'candidate-not-canonical',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label); if(!(v>0)) throw new Error(label+' must be > 0'); return v;
}
function nonNegative(v,label){
  finite(v,label); if(v<0) throw new Error(label+' must be >= 0'); return v;
}

function createUrsinoMagosso2000ExpandedReflexCandidate({
  dtSec=0.002,
  pao2MmHg=95,
  paco2MmHg=40,
  tidalVolumeL=0.5,
  ventilationContext='controlled-fixed-vt',
}={}){
  positive(dtSec,'dtSec');
  nonNegative(pao2MmHg,'pao2MmHg');
  positive(paco2MmHg,'paco2MmHg');
  nonNegative(tidalVolumeL,'tidalVolumeL');

  const plant=createUrsinoMagosso2000ExpandedPlantRuntime({dtSec});
  const baro=createUrsinoBaroreceptorShadow();
  const gas=createMagossoUrsinoGasAutonomicCandidate();

  let environment=Object.freeze({
    pao2MmHg,paco2MmHg,tidalVolumeL,ventilationContext,
  });
  let fAp=null;
  let effectors=null;
  let controllerState=null;

  function setEnvironment(next={}){
    const merged={...environment,...next};
    nonNegative(merged.pao2MmHg,'pao2MmHg');
    positive(merged.paco2MmHg,'paco2MmHg');
    nonNegative(merged.tidalVolumeL,'tidalVolumeL');
    if(typeof merged.ventilationContext!=='string'||!merged.ventilationContext){
      throw new Error('ventilationContext must be a non-empty string');
    }
    environment=Object.freeze(merged);
    return snapshot();
  }

  function step(){
    const before=plant.snapshot();

    const b=baro.step({
      dtSec,
      arterialPressureMmHg:before.hemodynamics.systemicArterialPressureMmHg,
    });

    const phiAp=pulmonaryStretchStatic(environment.tidalVolumeL);
    fAp=firstOrderExact(
      fAp,phiAp,dtSec,O2_2000_P.pulmonaryStretch.tauSec
    );

    const a=gas.step({
      dtSec,
      pao2MmHg:environment.pao2MmHg,
      paco2MmHg:environment.paco2MmHg,
      fAbSpikesPerSec:b.fAbSpikesPerSec,
      fApSpikesPerSec:fAp,
    });

    if(effectors==null){
      effectors=createUrsinoMagosso2000SplitEffectorsRuntime({
        initialVascularSympatheticSpikesPerSec:a.fSpSpikesPerSec,
        initialCardiacSympatheticSpikesPerSec:a.fShSpikesPerSec,
        initialCardiacVagalSpikesPerSec:a.fVSpikesPerSec,
      });
    }

    const e=effectors.step({
      dtSec,
      vascularSympatheticSpikesPerSec:a.fSpSpikesPerSec,
      cardiacSympatheticSpikesPerSec:a.fShSpikesPerSec,
      cardiacVagalSpikesPerSec:a.fVSpikesPerSec,
    });

    plant.setEffectors({
      EmaxLv:e.absolute.EmaxLv,
      EmaxRv:e.absolute.EmaxRv,
      Rsp:e.absolute.Rsp,
      Rep:e.absolute.Rep,
      Rmp:e.absolute.RmpNormal,
      Rbp:6.57,
      Rhp:19.71,
      Vusv:e.absolute.Vusv,
      Vuev:e.absolute.Vuev,
      Vumv:e.absolute.Vumv,
      heartPeriodSec:e.absolute.heartPeriodSec,
      dVusvDtMlPerSec:e.rate.Vusv,
      dVumvDtMlPerSec:e.rate.Vumv,
    });

    plant.step();

    controllerState=Object.freeze({
      afferents:Object.freeze({
        fAbSpikesPerSec:b.fAbSpikesPerSec,
        fAcSpikesPerSec:a.fAcSpikesPerSec,
        fApSpikesPerSec:fAp,
      }),
      autonomic:Object.freeze({
        fSpSpikesPerSec:a.fSpSpikesPerSec,
        fSvSpikesPerSec:a.fSvSpikesPerSec,
        fShSpikesPerSec:a.fShSpikesPerSec,
        fVSpikesPerSec:a.fVSpikesPerSec,
      }),
      effectors:e,
    });

    return snapshot();
  }

  function runFor(seconds){
    nonNegative(seconds,'seconds');
    const n=Math.floor(seconds/dtSec+1e-9);
    for(let i=0;i<n;i++) step();
    const rem=seconds-n*dtSec;
    if(rem>1e-9) throw new Error('seconds must be an integer multiple of dtSec');
    return snapshot();
  }

  function snapshot(){
    const p=plant.snapshot();
    return Object.freeze({
      timeSec:p.timeSec,
      environment,
      hemodynamics:p.hemodynamics,
      conservation:p.conservation,
      controller:controllerState,
      localO2ControlActive:false,
      localO2Ownership:'disabled-in-this-layer',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      candidatePlantControlAuthority:true,
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,runFor,snapshot,setEnvironment,source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  createUrsinoMagosso2000ExpandedReflexCandidate,
});
