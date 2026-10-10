'use strict';

/**
 * Interim downstream cardiovascular effector shadow.
 *
 * Model family:
 * Ursino 1998; Ursino & Magosso 2000/2003.
 *
 * Equation structure and parameters are cross-transcribed from OpenCRS
 * (revision 86085d6e64ad0e82232a9f2c9aaa303a0296cc34), which identifies
 * its Tables 17-18 as the Ursino/Magosso effector model. Some OpenCRS
 * parameters are explicitly edited/tuned, so this module is NOT primary-
 * source authoritative.
 *
 * This module exposes source-family regional resistance and ventricular
 * elastance states only. It does not derive lumped SVR, MAP, CO, or SV.
 */

const SOURCE=Object.freeze({
  primaryFamily:Object.freeze({
    ursino1998:'10.1152/ajpheart.1998.275.5.H1733',
    ursinoMagosso2000:'10.1152/ajpheart.2000.279.1.H149',
    ursinoMagosso2003:'10.1152/ajpheart.00850.2002',
  }),
  secondaryTranscription:Object.freeze({
    repository:'Sheng-Ya/OpenCRS',
    revision:'86085d6e64ad0e82232a9f2c9aaa303a0296cc34',
    sourceFile:'Reduced/Parameters.py',
    tables:'Table 17 effectors; derivative equations cross-checked in Reduced/Derivatives.py',
    caution:'Some OpenCRS parameters are marked edited/tuned; primary-paper verification is required before authority.',
  }),
  status:'interim-secondary-transcription-primary-verification-required',
  controlAuthority:false,
});

const P=Object.freeze({
  sympatheticThresholdSpikesPerSec:2.66,
  resistance:Object.freeze({
    delaySec:2,
    extrasplanchnic:Object.freeze({baseline:1.655,gain:1.94,tauSec:2,secondaryEdited:false}),
    splanchnic:Object.freeze({baseline:2.49,gain:0.695,tauSec:2,secondaryEdited:false}),
    restingMuscle:Object.freeze({baseline:5.270,gain:2.47,tauSec:2,secondaryEdited:false}),
    activeMuscle:Object.freeze({baseline:3.510,gain:4.47,tauSec:2,secondaryEdited:true}),
  }),
  elastance:Object.freeze({
    delaySec:2,
    left:Object.freeze({baseline:2.392,gain:0.475,tauSec:8,secondaryEdited:false}),
    right:Object.freeze({baseline:1.412,gain:0.282,tauSec:8,secondaryEdited:false}),
  }),
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}
function firstOrder(current,target,dtSec,tauSec){
  if(current==null) return target;
  if(dtSec===0) return current;
  const d=Math.exp(-dtSec/tauSec);
  return target+(current-target)*d;
}
function logEffector(firingSpikesPerSec,gain){
  finite(firingSpikesPerSec,'firingSpikesPerSec');
  finite(gain,'gain');
  const effective=Math.max(
    firingSpikesPerSec,
    P.sympatheticThresholdSpikesPerSec
  );
  return gain*Math.log(
    effective-P.sympatheticThresholdSpikesPerSec+1
  );
}

function createUrsinoDownstreamEffectorShadow(){
  let lastTimeSec=null;
  let rEpChange=null,rSpChange=null,rRmChange=null,rAmChange=null;
  let eLvChange=null,eRvChange=null;
  let state=Object.freeze({
    regionalResistance:null,
    ventricularElastance:null,
    lumpedSvr:null,
    meanArterialPressureMmHg:null,
    cardiacOutputMlPerMin:null,
    strokeVolumeMl:null,
    controlAuthority:false,
    status:'not-stepped',
    provenance:SOURCE,
  });

  function step({timeSec,fSpSpikesPerSec,fShSpikesPerSec}={}){
    nonNegative(timeSec,'timeSec');
    finite(fSpSpikesPerSec,'fSpSpikesPerSec');
    finite(fShSpikesPerSec,'fShSpikesPerSec');
    const dtSec=lastTimeSec==null?0:Math.max(0,timeSec-lastTimeSec);
    lastTimeSec=timeSec;

    const r=P.resistance;
    rEpChange=firstOrder(rEpChange,logEffector(fSpSpikesPerSec,r.extrasplanchnic.gain),dtSec,r.extrasplanchnic.tauSec);
    rSpChange=firstOrder(rSpChange,logEffector(fSpSpikesPerSec,r.splanchnic.gain),dtSec,r.splanchnic.tauSec);
    rRmChange=firstOrder(rRmChange,logEffector(fSpSpikesPerSec,r.restingMuscle.gain),dtSec,r.restingMuscle.tauSec);
    rAmChange=firstOrder(rAmChange,logEffector(fSpSpikesPerSec,r.activeMuscle.gain),dtSec,r.activeMuscle.tauSec);

    const e=P.elastance;
    eLvChange=firstOrder(eLvChange,logEffector(fShSpikesPerSec,e.left.gain),dtSec,e.left.tauSec);
    eRvChange=firstOrder(eRvChange,logEffector(fShSpikesPerSec,e.right.gain),dtSec,e.right.tauSec);

    state=Object.freeze({
      timeSec,
      regionalResistance:Object.freeze({
        extrasplanchnic:Object.freeze({
          baseline:r.extrasplanchnic.baseline,
          change:rEpChange,
          value:r.extrasplanchnic.baseline+rEpChange,
        }),
        splanchnic:Object.freeze({
          baseline:r.splanchnic.baseline,
          change:rSpChange,
          value:r.splanchnic.baseline+rSpChange,
        }),
        restingMuscle:Object.freeze({
          baseline:r.restingMuscle.baseline,
          change:rRmChange,
          value:r.restingMuscle.baseline+rRmChange,
        }),
        activeMuscle:Object.freeze({
          baseline:r.activeMuscle.baseline,
          change:rAmChange,
          value:r.activeMuscle.baseline+rAmChange,
          transcriptionWarning:'secondary source marks this gain edited',
        }),
      }),
      ventricularElastance:Object.freeze({
        left:Object.freeze({
          baseline:e.left.baseline,
          change:eLvChange,
          value:e.left.baseline+eLvChange,
        }),
        right:Object.freeze({
          baseline:e.right.baseline,
          change:eRvChange,
          value:e.right.baseline+eRvChange,
        }),
      }),
      lumpedSvr:null,
      meanArterialPressureMmHg:null,
      cardiacOutputMlPerMin:null,
      strokeVolumeMl:null,
      controlAuthority:false,
      status:
        'regional resistance and ventricular elastance available; lumped hemodynamics blocked pending source-complete topology and venous-capacitance path',
      provenance:SOURCE,
    });
    return state;
  }

  return Object.freeze({step,snapshot:()=>state,parameters:P,source:SOURCE});
}

module.exports=Object.freeze({
  SOURCE,
  P,
  logEffector,
  createUrsinoDownstreamEffectorShadow,
});
