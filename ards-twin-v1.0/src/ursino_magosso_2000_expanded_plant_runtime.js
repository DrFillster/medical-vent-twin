'use strict';

/**
 * Ursino-Magosso 2000 expanded cardiovascular plant runtime.
 *
 * Purpose:
 * - reproduce the source vascular/heart plant independently from autonomic
 *   and local-gas controllers;
 * - five systemic beds: splanchnic, remaining extrasplanchnic, skeletal
 *   muscle, brain, coronary;
 * - Pev is algebraic from total blood-volume closure (source Eq. 12).
 *
 * Candidate only. No canonical patient-state authority.
 */

const {
  HEART,
  ventricularFlows,
}=require('./ursino_1998_closed_loop_candidate.js');

const {
  SOURCE:VASCULAR_SOURCE,
  VASCULAR,
  systemicPeripheralPressureDerivative,
  venousPressureDerivatives,
  extrasplanchnicVenousPressureMmHg,
  reconstructedTotalBloodVolumeMl,
}=require('./ursino_magosso_2000_expanded_vascular_candidate.js');

const SOURCE=Object.freeze({
  vascular:VASCULAR_SOURCE,
  heart:'Ursino 1998, doi:10.1152/ajpheart.1998.275.5.H1733',
  role:'source-plant-reproduction-before-controller-integration',
  authority:'candidate-not-canonical',
});

const STATE_KEYS=Object.freeze([
  'Ppa','Fpa','Ppp','Ppv',
  'Psa','Fsa','Psp','Psv','Pmv','Pbv','Phv',
  'Vt','Pla','Vlv','phase','Pra','Vrv',
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
function clone(x){return {...x};}

function defaultEffectors(){
  return Object.freeze({
    EmaxLv:HEART.lv.EmaxPhysicalBasal,
    EmaxRv:HEART.rv.EmaxPhysicalBasal,
    Rsp:VASCULAR.sp.R,
    Rep:VASCULAR.ep.R,
    Rmp:VASCULAR.mp.R,
    Rbp:VASCULAR.bp.R,
    Rhp:VASCULAR.hp.R,
    Vusv:VASCULAR.sv.Vu,
    Vuev:VASCULAR.ev.Vu,
    Vumv:VASCULAR.mv.Vu,
    heartPeriodSec:HEART.physicalBasalPeriodSec,
    dVusvDtMlPerSec:0,
    dVumvDtMlPerSec:0,
  });
}

function validateEffectors(e){
  for(const key of [
    'EmaxLv','EmaxRv','Rsp','Rep','Rmp','Rbp','Rhp',
    'Vusv','Vuev','Vumv','heartPeriodSec',
    'dVusvDtMlPerSec','dVumvDtMlPerSec',
  ]) finite(e[key],key);
  for(const key of [
    'EmaxLv','EmaxRv','Rsp','Rep','Rmp','Rbp','Rhp','heartPeriodSec',
  ]) positive(e[key],key);
  if(e.Vusv<0||e.Vuev<0||e.Vumv<0){
    throw new Error('venous unstressed volumes must be >= 0');
  }
  return e;
}

function defaultSeed(){
  return Object.freeze({
    Ppa:15,Fpa:80,Ppp:10,Ppv:7,
    Psa:92,Fsa:80,Psp:80,
    Psv:8,Pmv:8,Pbv:8,Phv:8,
    Vt:VASCULAR.totalBloodVolumeMl,
    Pla:5,Vlv:120,phase:0,
    Pra:3,Vrv:80,
  });
}

function addState(a,b,scale){
  const out={};
  for(const k of STATE_KEYS) out[k]=a[k]+scale*b[k];
  return out;
}

function combineRk4(s,k1,k2,k3,k4,h){
  const out={};
  for(const key of STATE_KEYS){
    out[key]=s[key]+h*(k1[key]+2*k2[key]+2*k3[key]+k4[key])/6;
  }
  out.phase=((out.phase%1)+1)%1;
  return out;
}

function createUrsinoMagosso2000ExpandedPlantRuntime({
  dtSec=0.002,
  initialState=null,
  initialEffectors=null,
}={}){
  positive(dtSec,'dtSec');
  let t=0;
  let state=clone(initialState||defaultSeed());
  for(const k of STATE_KEYS) finite(state[k],k);
  let effectors=Object.freeze({
    ...defaultEffectors(),
    ...(initialEffectors||{}),
  });
  validateEffectors(effectors);

  function algebraicPev(s,e){
    return extrasplanchnicVenousPressureMmHg({
      totalBloodVolumeMl:s.Vt,
      Psa:s.Psa,Psp:s.Psp,Psv:s.Psv,Pmv:s.Pmv,Pbv:s.Pbv,Phv:s.Phv,
      Pra:s.Pra,Vrv:s.Vrv,Ppa:s.Ppa,Ppp:s.Ppp,Ppv:s.Ppv,
      Pla:s.Pla,Vlv:s.Vlv,
      VusvMl:e.Vusv,VuevMl:e.Vuev,VumvMl:e.Vumv,
    });
  }

  function derivatives(s){
    const e=effectors;
    const Pev=algebraicPev(s,e);

    const lv=ventricularFlows({
      side:'lv',
      atrialPressureMmHg:s.Pla,
      arterialPressureMmHg:s.Psa,
      volumeMl:s.Vlv,
      phaseFraction:s.phase,
      Tsec:e.heartPeriodSec,
      EmaxMmHgPerMl:e.EmaxLv,
    });
    const rv=ventricularFlows({
      side:'rv',
      atrialPressureMmHg:s.Pra,
      arterialPressureMmHg:s.Ppa,
      volumeMl:s.Vrv,
      phaseFraction:s.phase,
      Tsec:e.heartPeriodSec,
      EmaxMmHgPerMl:e.EmaxRv,
    });

    const dPpa=(rv.outflowMlPerSec-s.Fpa)/VASCULAR.pa.C;
    const dFpa=(s.Ppa-s.Ppp-VASCULAR.pa.R*s.Fpa)/VASCULAR.pa.L;
    const dPpp=(
      s.Fpa-(s.Ppp-s.Ppv)/VASCULAR.pp.R
    )/VASCULAR.pp.C;
    const dPpv=(
      (s.Ppp-s.Ppv)/VASCULAR.pp.R-
      (s.Ppv-s.Pla)/VASCULAR.pv.R
    )/VASCULAR.pv.C;

    const dPsa=(lv.outflowMlPerSec-s.Fsa)/VASCULAR.sa.C;
    const dFsa=(
      s.Psa-s.Psp-VASCULAR.sa.R*s.Fsa
    )/VASCULAR.sa.L;

    const dPsp=systemicPeripheralPressureDerivative({
      Fsa:s.Fsa,Psp:s.Psp,
      Psv:s.Psv,Pev,Pmv:s.Pmv,Pbv:s.Pbv,Phv:s.Phv,
      Rsp:e.Rsp,Rep:e.Rep,Rmp:e.Rmp,Rbp:e.Rbp,Rhp:e.Rhp,
    });

    const dv=venousPressureDerivatives({
      Psp:s.Psp,Psv:s.Psv,Pmv:s.Pmv,Pbv:s.Pbv,Phv:s.Phv,Pra:s.Pra,
      Rsp:e.Rsp,Rmp:e.Rmp,Rbp:e.Rbp,Rhp:e.Rhp,
      dVusvDtMlPerSec:e.dVusvDtMlPerSec,
      dVumvDtMlPerSec:e.dVumvDtMlPerSec,
    });

    const dPla=(
      (s.Ppv-s.Pla)/VASCULAR.pv.R-lv.inflowMlPerSec
    )/HEART.la.C;
    const dVlv=lv.inflowMlPerSec-lv.outflowMlPerSec;

    const systemicVenousInflow=
      (s.Psv-s.Pra)/VASCULAR.sv.R+
      (Pev-s.Pra)/VASCULAR.ev.R+
      (s.Pmv-s.Pra)/VASCULAR.mv.R+
      (s.Pbv-s.Pra)/VASCULAR.bv.R+
      (s.Phv-s.Pra)/VASCULAR.hv.R;
    const dPra=(systemicVenousInflow-rv.inflowMlPerSec)/HEART.ra.C;
    const dVrv=rv.inflowMlPerSec-rv.outflowMlPerSec;

    return {
      Ppa:dPpa,Fpa:dFpa,Ppp:dPpp,Ppv:dPpv,
      Psa:dPsa,Fsa:dFsa,Psp:dPsp,
      Psv:dv.Psv,Pmv:dv.Pmv,Pbv:dv.Pbv,Phv:dv.Phv,
      Vt:0,
      Pla:dPla,Vlv:dVlv,phase:1/e.heartPeriodSec,
      Pra:dPra,Vrv:dVrv,
    };
  }

  function step(){
    const h=dtSec;
    const k1=derivatives(state);
    const k2=derivatives(addState(state,k1,h/2));
    const k3=derivatives(addState(state,k2,h/2));
    const k4=derivatives(addState(state,k3,h));
    state=combineRk4(state,k1,k2,k3,k4,h);
    t+=h;
    return snapshot();
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

  function setEffectors(next={}){
    effectors=Object.freeze({...effectors,...next});
    validateEffectors(effectors);
    return snapshot();
  }

  function withdrawBloodMl(ml){
    finite(ml,'ml');
    if(ml<0) throw new Error('ml must be >= 0');
    state.Vt-=ml;
    if(!(state.Vt>0)) throw new Error('total blood volume became non-positive');
    return snapshot();
  }

  function snapshot(){
    const e=effectors;
    const Pev=algebraicPev(state,e);
    const lv=ventricularFlows({
      side:'lv',atrialPressureMmHg:state.Pla,
      arterialPressureMmHg:state.Psa,volumeMl:state.Vlv,
      phaseFraction:state.phase,Tsec:e.heartPeriodSec,
      EmaxMmHgPerMl:e.EmaxLv,
    });
    const rv=ventricularFlows({
      side:'rv',atrialPressureMmHg:state.Pra,
      arterialPressureMmHg:state.Ppa,volumeMl:state.Vrv,
      phaseFraction:state.phase,Tsec:e.heartPeriodSec,
      EmaxMmHgPerMl:e.EmaxRv,
    });
    const reconstructedVolumeMl=reconstructedTotalBloodVolumeMl({
      Psa:state.Psa,Psp:state.Psp,
      Psv:state.Psv,Pev,Pmv:state.Pmv,Pbv:state.Pbv,Phv:state.Phv,
      Pra:state.Pra,Vrv:state.Vrv,
      Ppa:state.Ppa,Ppp:state.Ppp,Ppv:state.Ppv,
      Pla:state.Pla,Vlv:state.Vlv,
      VusvMl:e.Vusv,VuevMl:e.Vuev,VumvMl:e.Vumv,
    });

    return Object.freeze({
      timeSec:t,
      state:Object.freeze({...state,Pev}),
      effectors,
      hemodynamics:Object.freeze({
        systemicArterialPressureMmHg:state.Psa,
        systemicPeripheralPressureMmHg:state.Psp,
        splanchnicVenousPressureMmHg:state.Psv,
        extrasplanchnicVenousPressureMmHg:Pev,
        muscleVenousPressureMmHg:state.Pmv,
        cerebralVenousPressureMmHg:state.Pbv,
        coronaryVenousPressureMmHg:state.Phv,
        pulmonaryArteryPressureMmHg:state.Ppa,
        rightAtrialPressureMmHg:state.Pra,
        leftAtrialPressureMmHg:state.Pla,
        heartPeriodSec:e.heartPeriodSec,
        heartRatePerMin:60/e.heartPeriodSec,
        leftVentricleOutflowMlPerSec:lv.outflowMlPerSec,
        rightVentricleOutflowMlPerSec:rv.outflowMlPerSec,
      }),
      conservation:Object.freeze({
        sourceTotalBloodVolumeMl:state.Vt,
        reconstructedTotalBloodVolumeMl:reconstructedVolumeMl,
        errorMl:reconstructedVolumeMl-state.Vt,
      }),
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      controllerIntegration:'none-plant-only',
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,runFor,snapshot,setEffectors,withdrawBloodMl,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,STATE_KEYS,defaultEffectors,defaultSeed,
  createUrsinoMagosso2000ExpandedPlantRuntime,
});
