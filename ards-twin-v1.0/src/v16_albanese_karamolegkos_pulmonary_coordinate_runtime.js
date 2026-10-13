'use strict';

/**
 * v1.6 Albanese/Karamolegkos pulmonary mechanics coordinate runtime.
 *
 * Purpose:
 * Translate airway-opening pressure into the source-native pulmonary
 * coordinates required by the Karamolegkos pulmonary vascular candidate:
 *   P_A, P_pl, V_A.
 *
 * This runtime does NOT own Vent mechanics, tidal volume, recruitment, PEEP,
 * or airway flow. Vent remains authoritative for those. The runtime is a
 * source-coordinate translator driven by Vent airway-opening pressure.
 *
 * Source equations:
 * Albanese et al. 2016, A30-A36.
 * Karamolegkos et al. 2021 nominal FRC = 2.25 L.
 *
 * Mechanical-ventilation validation in Karamolegkos 2021 used passively
 * breathing subjects, so dP_mus/dt = 0 in this translator.
 *
 * Absolute alveolar volume is initialized at the published Karamolegkos
 * nominal FRC and then evolved with source Eq. A36. This intentionally avoids
 * relying on the ambiguous V_u,A unit representation in public code.
 *
 * Candidate only.
 */

const SOURCE=Object.freeze({
  respiratoryMechanics:
    'Albanese A et al. Am J Physiol Heart Circ Physiol. 2016;310:H899-H921. doi:10.1152/ajpheart.00230.2014, Eqs. A30-A36.',
  pulmonaryCoordinate:
    'Karamolegkos N et al. IEEE OJEMB. 2021;2:324-341. doi:10.1109/OJEMB.2021.3128629.',
  passiveVentilation:
    'Karamolegkos 2021 validation scenarios pertain to passively breathing subjects.',
  authority:'candidate-coordinate-translator-not-mechanics-owner',
});

const P=Object.freeze({
  ClLPerCmH2O:0.00127,
  CtrLPerCmH2O:0.00238,
  CbLPerCmH2O:0.0131,
  CaLPerCmH2O:0.2,
  CcwLPerCmH2O:0.2445,
  RmlCmH2OSecPerL:1.021,
  RltCmH2OSecPerL:0.3369,
  RtbCmH2OSecPerL:0.3063,
  RbACmH2OSecPerL:0.0817,
  initialPleuralPressureCmH2O:-5,
  nominalAlveolarVolumeL:2.25,
});

const MMHG_PER_CMH2O=0.7355592401;

const STATE_KEYS=Object.freeze([
  'Pl',
  'PtrTm',
  'PbTm',
  'PATm',
  'Ppl',
  'VA',
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

function defaultState(){
  const ppl=P.initialPleuralPressureCmH2O;
  return Object.freeze({
    Pl:0,
    PtrTm:-ppl,
    PbTm:-ppl,
    PATm:-ppl,
    Ppl:ppl,
    VA:P.nominalAlveolarVolumeL,
  });
}

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

function createV16PulmonaryCoordinateRuntime({
  dtSec=0.0005,
  airwayOpeningPressureProvider,
  initialState=null,
}={}){
  positive(dtSec,'dtSec');
  if(typeof airwayOpeningPressureProvider!=='function'){
    throw new Error('airwayOpeningPressureProvider is required');
  }

  let state={...(initialState||defaultState())};
  for(const k of STATE_KEYS) finite(state[k],k);
  positive(state.VA,'VA');
  let timeSec=0;
  let last=null;

  function pressures(s){
    return Object.freeze({
      Pl:s.Pl,
      Ptr:s.PtrTm+s.Ppl,
      Pb:s.PbTm+s.Ppl,
      PA:s.PATm+s.Ppl,
      Ppl:s.Ppl,
    });
  }

  function derivatives(s,pao){
    const p=pressures(s);
    const qMl=(pao-p.Pl)/P.RmlCmH2OSecPerL;
    const qLt=(p.Pl-p.Ptr)/P.RltCmH2OSecPerL;
    const qTb=(p.Ptr-p.Pb)/P.RtbCmH2OSecPerL;
    const qBa=(p.Pb-p.PA)/P.RbACmH2OSecPerL;

    return {
      Pl:(qMl-qLt)/P.ClLPerCmH2O,
      PtrTm:(qLt-qTb)/P.CtrLPerCmH2O,
      PbTm:(qTb-qBa)/P.CbLPerCmH2O,
      PATm:qBa/P.CaLPerCmH2O,
      Ppl:qLt/P.CcwLPerCmH2O,
      VA:qBa,
    };
  }

  function step(){
    const pao=finite(
      airwayOpeningPressureProvider({timeSec,previous:last}),
      'airwayOpeningPressureCmH2O'
    );
    const h=dtSec;
    const k1=derivatives(state,pao);
    const k2=derivatives(addState(state,k1,h/2),pao);
    const k3=derivatives(addState(state,k2,h/2),pao);
    const k4=derivatives(addState(state,k3,h),pao);
    state=combineRk4(state,k1,k2,k3,k4,h);
    positive(state.VA,'alveolarVolumeL');
    timeSec+=h;

    const p=pressures(state);
    last=Object.freeze({
      schema:'v16-albanese-karamolegkos-pulmonary-coordinate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalMechanicsAuthority:false,
      airwayOpeningPressureCmH2O:pao,
      sourcePressureStateCmH2O:p,
      alveolarVolumeL:state.VA,
      pulmonaryVascularBoundary:Object.freeze({
        sourceQualified:true,
        alveolarVolumeL:state.VA,
        alveolarPressureMmHg:p.PA*MMHG_PER_CMH2O,
        pleuralPressureMmHg:p.Ppl*MMHG_PER_CMH2O,
        provenance:Object.freeze({
          airwayOpeningPressure:'Vent-owned external input',
          pressureCoordinates:'Albanese 2016 A30-A34',
          alveolarVolume:'Karamolegkos nominal FRC + Albanese A36',
          musclePressure:'passive ventilation; dPmus/dt=0',
        }),
      }),
      provenance:SOURCE,
    });
    return last;
  }

  function runFor(seconds){
    finite(seconds,'seconds');
    if(seconds<0) throw new Error('seconds must be >= 0');
    const n=Math.floor(seconds/dtSec+1e-9);
    for(let i=0;i<n;i++) step();
    const rem=seconds-n*dtSec;
    if(rem>1e-9) throw new Error('seconds must be an integer multiple of dtSec');
    return snapshot();
  }

  function snapshot(){
    if(last) return last;
    const p=pressures(state);
    return Object.freeze({
      schema:'v16-albanese-karamolegkos-pulmonary-coordinate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalMechanicsAuthority:false,
      status:'awaiting-first-step',
      sourcePressureStateCmH2O:p,
      alveolarVolumeL:state.VA,
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
  P,
  MMHG_PER_CMH2O,
  defaultState,
  createV16PulmonaryCoordinateRuntime,
});
