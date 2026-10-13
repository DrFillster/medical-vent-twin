'use strict';

/**
 * v1.6 Karamolegkos pulmonary vascular runtime.
 *
 * Source:
 * Karamolegkos N, Albanese A, Chbat NW.
 * Heart-Lung Interactions During Mechanical Ventilation.
 * IEEE OJEMB. 2021;2:324-341.
 * DOI: 10.1109/OJEMB.2021.3128629.
 *
 * State coordinates are the source transmural pressures plus pulmonary
 * arterial flow. External pleural/alveolar pressures and source-native
 * absolute alveolar volume remain caller-owned, source-qualified inputs.
 *
 * No Vent elastic-volume -> absolute V_A transform is performed here.
 * Candidate only.
 */

const K=require('./karamolegkos_pulmonary_circulation_candidate.js');

const SOURCE=Object.freeze({
  ...K.SOURCE,
  role:'dynamic-source-native-pulmonary-vascular-runtime',
  authority:'candidate-not-canonical',
});

const STATE_KEYS=Object.freeze([
  'PpaTm',
  'Fpa',
  'PpalTm',
  'PpcTm',
  'PpvTm',
]);

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
function sourceQualified(obj,label){
  if(!obj||typeof obj!=='object') throw new Error(label+' is required');
  if(obj.sourceQualified!==true){
    throw new Error(label+' must be source-qualified');
  }
  return obj;
}
function clone(x){return {...x};}
function addState(a,b,scale){
  const out={};
  for(const k of STATE_KEYS) out[k]=a[k]+scale*b[k];
  return out;
}
function combineRk4(s,k1,k2,k3,k4,h){
  const out={};
  for(const k of STATE_KEYS){
    out[k]=s[k]+h*(k1[k]+2*k2[k]+2*k3[k]+k4[k])/6;
  }
  return out;
}

function validateInitialState(s){
  if(!s||typeof s!=='object') throw new Error('initialState is required');
  for(const k of STATE_KEYS) finite(s[k],k);
  return s;
}

function validateBoundary(b){
  sourceQualified(b,'boundary');
  positive(b.alveolarVolumeL,'alveolarVolumeL');
  finite(b.alveolarPressureMmHg,'alveolarPressureMmHg');
  finite(b.pleuralPressureMmHg,'pleuralPressureMmHg');
  finite(b.rvOutflowMlPerSec,'rvOutflowMlPerSec');
  finite(b.leftAtrialPressureMmHg,'leftAtrialPressureMmHg');
  nonNegative(b.shuntFraction,'shuntFraction');
  if(!(b.shuntFraction<1)) throw new Error('shuntFraction must be < 1');
  positive(
    b.capillaryResistanceMmHgSecPerMl,
    'capillaryResistanceMmHgSecPerMl'
  );
  return b;
}

function createV16KaramolegkosPulmonaryVascularRuntime({
  dtSec=0.002,
  initialState,
  boundaryProvider,
}={}){
  positive(dtSec,'dtSec');
  validateInitialState(initialState);
  if(typeof boundaryProvider!=='function'){
    throw new Error('boundaryProvider is required');
  }

  let state=clone(initialState);
  let timeSec=0;
  let last=null;

  function algebraic(s,b){
    const Ppa=s.PpaTm+b.pleuralPressureMmHg;
    const Ppal=s.PpalTm+b.pleuralPressureMmHg;
    const Ppc=s.PpcTm+b.alveolarPressureMmHg;
    const Ppv=s.PpvTm+b.pleuralPressureMmHg;

    const Qpal=K.nonShuntArteriolarFlow({
      pulmonaryArteriolarPressureMmHg:Ppal,
      pulmonaryCapillaryPressureMmHg:Ppc,
      alveolarVolumeL:b.alveolarVolumeL,
      shuntFraction:b.shuntFraction,
    });
    const Qps=K.pulmonaryShuntFlow({
      nonShuntArteriolarFlowMlPerSec:Qpal,
      shuntFraction:b.shuntFraction,
    });
    const Qpc=K.pulmonaryCapillaryFlow({
      pulmonaryCapillaryPressureMmHg:Ppc,
      pulmonaryVenousPressureMmHg:Ppv,
      capillaryResistanceMmHgSecPerMl:
        b.capillaryResistanceMmHgSecPerMl,
    });
    const Qpv=K.pulmonaryVenousFlow({
      pulmonaryVenousPressureMmHg:Ppv,
      leftAtrialPressureMmHg:b.leftAtrialPressureMmHg,
    });
    const Rpal=K.pulmonaryArteriolarResistance({
      alveolarVolumeL:b.alveolarVolumeL,
      shuntFraction:b.shuntFraction,
    });

    return Object.freeze({
      Ppa,Ppal,Ppc,Ppv,
      Fpa:s.Fpa,
      Qpal,Qps,Qpc,Qpv,Rpal,
      totalPeripheralFlowMlPerSec:Qpal+Qps,
      ventilatedPulmonaryBloodFlowMlPerSec:Qpal,
      totalPulmonaryBloodFlowMlPerSec:b.rvOutflowMlPerSec,
    });
  }

  function derivatives(s,b){
    const a=algebraic(s,b);
    return {
      PpaTm:K.dPulmonaryArteryTransmuralPressureDt({
        rvOutflowMlPerSec:b.rvOutflowMlPerSec,
        pulmonaryArterialFlowMlPerSec:s.Fpa,
      }),
      Fpa:K.dPulmonaryArterialFlowDt({
        pulmonaryArteryPressureMmHg:a.Ppa,
        pulmonaryArteriolarPressureMmHg:a.Ppal,
        pulmonaryArterialFlowMlPerSec:s.Fpa,
      }),
      PpalTm:K.dPulmonaryArteriolarTransmuralPressureDt({
        pulmonaryArterialFlowMlPerSec:s.Fpa,
        nonShuntArteriolarFlowMlPerSec:a.Qpal,
        shuntFlowMlPerSec:a.Qps,
      }),
      PpcTm:K.dPulmonaryCapillaryTransmuralPressureDt({
        nonShuntArteriolarFlowMlPerSec:a.Qpal,
        pulmonaryCapillaryFlowMlPerSec:a.Qpc,
      }),
      PpvTm:K.dPulmonaryVenousTransmuralPressureDt({
        shuntFlowMlPerSec:a.Qps,
        pulmonaryCapillaryFlowMlPerSec:a.Qpc,
        pulmonaryVenousFlowMlPerSec:a.Qpv,
      }),
    };
  }

  function currentBoundary(previous=last){
    return validateBoundary(
      boundaryProvider({
        timeSec,
        previous,
      })
    );
  }

  function step(){
    const b=currentBoundary();
    const h=dtSec;
    const k1=derivatives(state,b);
    const k2=derivatives(addState(state,k1,h/2),b);
    const k3=derivatives(addState(state,k2,h/2),b);
    const k4=derivatives(addState(state,k3,h),b);
    state=combineRk4(state,k1,k2,k3,k4,h);
    timeSec+=h;

    const a=algebraic(state,b);
    positive(a.totalPeripheralFlowMlPerSec,'totalPeripheralFlowMlPerSec');
    positive(a.ventilatedPulmonaryBloodFlowMlPerSec,'ventilatedPulmonaryBloodFlowMlPerSec');
    last=Object.freeze({
      schema:'v16-karamolegkos-pulmonary-vascular-runtime/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      sourceQualifiedBoundary:true,
      state:Object.freeze({...state}),
      boundary:Object.freeze({...b}),
      pressuresMmHg:Object.freeze({
        pulmonaryArtery:a.Ppa,
        pulmonaryArteriole:a.Ppal,
        pulmonaryCapillary:a.Ppc,
        pulmonaryVein:a.Ppv,
        leftAtrium:b.leftAtrialPressureMmHg,
        pleural:b.pleuralPressureMmHg,
        alveolar:b.alveolarPressureMmHg,
      }),
      flowsMlPerSec:Object.freeze({
        rvOutflow:b.rvOutflowMlPerSec,
        pulmonaryArtery:a.Fpa,
        nonShuntArteriolar:a.Qpal,
        shunt:a.Qps,
        capillary:a.Qpc,
        pulmonaryVein:a.Qpv,
        totalPeripheral:a.totalPeripheralFlowMlPerSec,
      }),
      pulmonaryArteriolarResistanceMmHgSecPerMl:a.Rpal,
      pulmonaryPerfusionState:Object.freeze({
        sourceQualified:true,
        totalPulmonaryBloodFlowMlPerMin:
          a.totalPeripheralFlowMlPerSec*60,
        ventilatedPulmonaryBloodFlowMlPerMin:
          a.ventilatedPulmonaryBloodFlowMlPerSec*60,
        shuntFraction:b.shuntFraction,
        provenance:Object.freeze({
          source:'Karamolegkos 2021 pulmonary vascular runtime',
          absoluteAlveolarVolume:'caller-supplied source-qualified coordinate',
          pressureCoordinates:'caller-supplied source-qualified P_A/P_pl',
        }),
      }),
      ownership:Object.freeze({
        pulmonaryVascular:'candidate-source-family-owner',
        absoluteAlveolarVolume:'external-source-qualified-boundary',
        alveolarPressure:'external-source-qualified-boundary',
        pleuralPressure:'external-source-qualified-boundary',
        rvOutflow:'external-cardiovascular-candidate-boundary (pulsatile inflow; not gas-flow export)',
        leftAtrialPressure:'external-cardiovascular-candidate-boundary',
      }),
      provenance:SOURCE,
    });
    return last;
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
    return last||Object.freeze({
      schema:'v16-karamolegkos-pulmonary-vascular-runtime/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      status:'awaiting-first-step',
      state:Object.freeze({...state}),
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,
    runFor,
    snapshot,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  STATE_KEYS,
  validateInitialState,
  validateBoundary,
  createV16KaramolegkosPulmonaryVascularRuntime,
});
