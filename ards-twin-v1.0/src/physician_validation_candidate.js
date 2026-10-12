'use strict';

const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('./ursino_magosso_2000_expanded_hypoxia_closed_loop.js');

const SOURCE=Object.freeze({
  model:'Ursino-Magosso 2000 expanded hypoxia candidate',
  doi:'10.1152/ajpheart.2000.279.1.H149',
  authority:'candidate-not-canonical',
  role:'physician-validation-parallel-view',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
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

function createPhysicianValidationCandidate({
  dtSec=0.002,
  pao2MmHg=95,
  paco2MmHg=40,
  tidalVolumeL=0.5,
  averagingWindowSec=1,
}={}){
  positive(dtSec,'dtSec');
  positive(paco2MmHg,'paco2MmHg');
  nonNegative(pao2MmHg,'pao2MmHg');
  nonNegative(tidalVolumeL,'tidalVolumeL');
  positive(averagingWindowSec,'averagingWindowSec');

  const runtime=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
    dtSec,
    pao2MmHg,
    paco2MmHg,
    tidalVolumeL,
    ventilationMode:'external-delivered-vt',
    diagnosticLocalO2Mode:'source',
  });

  let environment=Object.freeze({pao2MmHg,paco2MmHg,tidalVolumeL});
  let accumulator={seconds:0,mapIntegral:0,coIntegral:0};
  let averaged=Object.freeze({
    windowSec:0,
    meanArterialPressureMmHg:null,
    cardiacOutputMlPerSec:null,
  });

  function resetAccumulator(){
    accumulator={seconds:0,mapIntegral:0,coIntegral:0};
  }

  function setEnvironment(next={}){
    const x={...environment,...next};
    nonNegative(x.pao2MmHg,'pao2MmHg');
    positive(x.paco2MmHg,'paco2MmHg');
    nonNegative(x.tidalVolumeL,'tidalVolumeL');
    environment=Object.freeze(x);
    runtime.setEnvironment(x);
    return snapshot();
  }

  function integrateCurrent(h){
    const s=runtime.snapshot();
    accumulator.seconds+=h;
    accumulator.mapIntegral+=
      s.hemodynamics.systemicArterialPressureMmHg*h;
    accumulator.coIntegral+=
      s.hemodynamics.leftVentricleOutflowMlPerSec*h;
    if(accumulator.seconds+1e-12>=averagingWindowSec){
      averaged=Object.freeze({
        windowSec:accumulator.seconds,
        meanArterialPressureMmHg:
          accumulator.mapIntegral/accumulator.seconds,
        cardiacOutputMlPerSec:
          accumulator.coIntegral/accumulator.seconds,
      });
      resetAccumulator();
    }
  }

  function runFor(seconds){
    nonNegative(seconds,'seconds');
    const n=Math.floor(seconds/dtSec+1e-9);
    for(let i=0;i<n;i++){
      integrateCurrent(dtSec);
      runtime.step();
    }
    const rem=seconds-n*dtSec;
    if(rem>1e-9) throw new Error('seconds must be an integer multiple of dtSec');
    return snapshot();
  }

  function snapshot(){
    const s=runtime.snapshot();
    const hr=s.hemodynamics.heartRatePerMin;
    const co=averaged.cardiacOutputMlPerSec;
    const map=averaged.meanArterialPressureMmHg;
    const sv=Number.isFinite(co)&&Number.isFinite(hr)&&hr>0
      ?co*60/hr
      :null;

    // Candidate systemic peripheral resistance from the five parallel beds.
    const e=s.vascularEffectors;
    const conductance=
      1/e.Rsp+1/e.Rep+1/e.Rmp+1/e.Rbp+1/e.Rhp;
    const peripheralResistance=conductance>0?1/conductance:null;

    return Object.freeze({
      timeSec:s.timeSec,
      inputs:environment,
      heartRatePerMin:hr,
      meanArterialPressureMmHg:map,
      cardiacOutputMlPerMin:Number.isFinite(co)?co*60:null,
      strokeVolumeMl:sv,
      systemicPeripheralResistanceMmHgMinPerL:
        Number.isFinite(peripheralResistance)
          ?peripheralResistance*60
          :null,
      autonomic:s.autonomic,
      vascularEffectors:s.vascularEffectors,
      localO2:s.localO2,
      conservation:s.conservation,
      averaging:Object.freeze({
        method:'time-average-of-pulsatile-candidate-output',
        requestedWindowSec:averagingWindowSec,
        latestCompletedWindowSec:averaged.windowSec,
      }),
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      candidatePlantControlAuthority:true,
      knownLimitations:Object.freeze([
        'Basal regional flow allocation accepted by physician as candidate-layer tolerance, not exact source reproduction.',
        'Early Fig. 11 beat-averaged SAP rise remains smaller than source description.',
        'Human hypoxia/hypercapnia quantitative validation remains incomplete.',
      ]),
      provenance:SOURCE,
    });
  }

  return Object.freeze({runFor,setEnvironment,snapshot,source:SOURCE});
}

module.exports=Object.freeze({
  SOURCE,
  createPhysicianValidationCandidate,
});
