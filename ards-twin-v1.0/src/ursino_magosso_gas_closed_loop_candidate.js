'use strict';

/**
 * Non-canonical source-family gas/autonomic cardiovascular closed-loop candidate.
 *
 * This is the first promoted candidate layer allowed to control the candidate
 * cardiovascular plant. It has NO canonical bedside-patient authority.
 */

const {
  createUrsino1998ClosedLoopRuntime,
}=require('./ursino_1998_closed_loop_runtime.js');

const {
  createUrsinoMagossoGasCardiovascularCandidate,
}=require('./ursino_magosso_gas_cardiovascular_candidate.js');

const SOURCE=Object.freeze({
  plant:'Ursino 1998, doi:10.1152/ajpheart.1998.275.5.H1733',
  hypoxia:'Ursino & Magosso 2000, doi:10.1152/ajpheart.2000.279.1.H149',
  co2:'Magosso & Ursino 2001, doi:10.1152/ajpheart.2001.281.5.H2036',
  authority:'candidate-not-canonical',
  coupling:'explicit-operator-split-fixed-step',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

function createGasCardiovascularClosedLoopCandidate({
  dtSec=0.002,
  initialState=null,
  pao2MmHg=100,
  paco2MmHg=40,
  tidalVolumeL=0.5,
}={}){
  positive(dtSec,'dtSec');
  nonNegative(pao2MmHg,'pao2MmHg');
  positive(paco2MmHg,'paco2MmHg');
  nonNegative(tidalVolumeL,'tidalVolumeL');

  const plant=createUrsino1998ClosedLoopRuntime({dtSec,initialState});
  const controller=createUrsinoMagossoGasCardiovascularCandidate();

  let environment=Object.freeze({pao2MmHg,paco2MmHg,tidalVolumeL});
  let controllerState=null;

  function setEnvironment(next={}){
    const merged={...environment,...next};
    nonNegative(merged.pao2MmHg,'pao2MmHg');
    positive(merged.paco2MmHg,'paco2MmHg');
    nonNegative(merged.tidalVolumeL,'tidalVolumeL');
    environment=Object.freeze(merged);
    return snapshot();
  }

  function controllerToExternalEffectors(c){
    if(!c||!c.effectors||!c.effectorRate){
      throw new Error('candidate controller effectors and rates are required');
    }
    return Object.freeze({
      EmaxLv:c.effectors.EmaxLv,
      EmaxRv:c.effectors.EmaxRv,
      Rsp:c.effectors.Rsp,
      Rep:c.effectors.Rep,
      Vusv:c.effectors.Vusv,
      Vuev:c.effectors.Vuev,
      heartPeriodSec:c.effectors.heartPeriodSec,
      dVuevDtMlPerSec:c.effectorRate.Vuev,
    });
  }

  function step(){
    const before=plant.snapshot();
    controllerState=controller.step({
      dtSec,
      systemicArterialPressureMmHg:
        before.hemodynamics.systemicArterialPressureMmHg,
      pao2MmHg:environment.pao2MmHg,
      paco2MmHg:environment.paco2MmHg,
      tidalVolumeL:environment.tidalVolumeL,
    });

    plant.setExternalEffectors(
      controllerToExternalEffectors(controllerState)
    );
    plant.step();
    return snapshot();
  }

  function runFor(seconds){
    nonNegative(seconds,'seconds');
    const n=Math.floor(seconds/dtSec+1e-9);
    for(let i=0;i<n;i++) step();
    const rem=seconds-n*dtSec;
    if(rem>1e-9){
      throw new Error('seconds must be an integer multiple of dtSec');
    }
    return snapshot();
  }

  function snapshot(){
    const p=plant.snapshot();
    return Object.freeze({
      timeSec:p.timeSec,
      environment,
      hemodynamics:p.hemodynamics,
      plantState:p.state,
      plantControl:p.control,
      gasAutonomic:controllerState,
      effectorOwnership:p.effectorOwnership,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      candidatePlantControlAuthority:true,
      provenance:SOURCE,
      ventilationContext:'controlled-fixed-vt',
      protocolScope:Object.freeze({
        spontaneousBreathing:false,
        deliveredTidalVolumeOwnedByVent:true,
        note:'Current gas-autonomic validation fixes delivered VT. Do not compare this mode directly with spontaneous-breathing human hypoxia protocols.',
      }),
      numericalBoundary:Object.freeze({
        scheme:'controller-then-plant explicit operator split',
        dtSec,
        validationStatus:'candidate recovery and step-size convergence passed; clinical/source trajectory validation remains protocol-specific',
      }),
    });
  }

  return Object.freeze({
    step,runFor,snapshot,setEnvironment,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  createGasCardiovascularClosedLoopCandidate,
});
