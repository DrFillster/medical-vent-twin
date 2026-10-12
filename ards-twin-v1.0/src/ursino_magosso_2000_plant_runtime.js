'use strict';

/**
 * Ursino & Magosso 2000 five-bed cardiovascular plant runtime.
 *
 * Source-complete here:
 * - vascular Appendix Eqs. 1-13;
 * - heart mechanics reused unchanged from Ursino 1998 as stated by the
 *   2000 paper.
 *
 * Deliberately incomplete here:
 * - local O2 regulation of Rmp/Rbp/Rhp is not active;
 * - autonomic reflex generation is external.
 *
 * Candidate only. No canonical patient authority.
 */

const {
  HEART,ventricularFlows,
}=require('./ursino_1998_closed_loop_candidate.js');
const {
  VASCULAR_2000:V,
}=require('./ursino_magosso_2000_hypoxia_plant_parameters.js');
const {
  vascularDerivatives,
}=require('./ursino_magosso_2000_vascular_candidate.js');

const SOURCE=Object.freeze({
  vascular:'Ursino & Magosso 2000 Appendix Eqs. 1-13',
  heart:'Ursino 1998 heart equations, explicitly unchanged in 2000 source',
  authority:'candidate-not-canonical',
  localO2Status:'not-active',
});

const STATE_KEYS=Object.freeze([
  'Ppa','Fpa','Ppp','Ppv','Psa','Fsa','Psp',
  'Psv','Pmv','Pbv','Phv','Pra','Vrv','Pla','Vlv','phase','Vt',
]);

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label); if(!(v>0)) throw new Error(label+' must be > 0'); return v;
}
function clone(x){return {...x};}

function defaultSeed(){
  return Object.freeze({
    Ppa:15,Fpa:80,Ppp:10,Ppv:7,
    Psa:92,Fsa:80,Psp:80,
    Psv:8,Pmv:8,Pbv:8,Phv:8,
    Pra:3,Vrv:80,Pla:5,Vlv:120,
    phase:0,Vt:V.totalBloodVolumeMl,
  });
}

function defaultEffectors(){
  return Object.freeze({
    EmaxLv:HEART.lv.EmaxPhysicalBasal,
    EmaxRv:HEART.rv.EmaxPhysicalBasal,
    heartPeriodSec:HEART.physicalBasalPeriodSec,
    Rsp:V.sp.R,
    Rep:V.ep.R,
    Rmp:V.mp.R,
    Rbp:V.bp.R,
    Rhp:V.hp.R,
    Vusv:V.sv.Vu,
    Vuev:V.ev.Vu,
    Vumv:V.mv.Vu,
    dVusvDtMlPerSec:0,
    dVumvDtMlPerSec:0,
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
  out.phase=((out.phase%1)+1)%1;
  return out;
}

function validateEffectors(e){
  const positiveKeys=[
    'EmaxLv','EmaxRv','heartPeriodSec','Rsp','Rep','Rmp','Rbp','Rhp',
  ];
  for(const k of positiveKeys) positive(e[k],k);
  for(const k of ['Vusv','Vuev','Vumv']){
    finite(e[k],k);
    if(e[k]<0) throw new Error(k+' must be >= 0');
  }
  finite(e.dVusvDtMlPerSec,'dVusvDtMlPerSec');
  finite(e.dVumvDtMlPerSec,'dVumvDtMlPerSec');
}

function createUrsinoMagosso2000PlantRuntime({
  dtSec=0.002,
  initialState=null,
  initialEffectors=null,
}={}){
  positive(dtSec,'dtSec');
  let t=0;
  let state=clone(initialState||defaultSeed());
  for(const k of STATE_KEYS) finite(state[k],k);
  let effectors=Object.freeze({...defaultEffectors(),...(initialEffectors||{})});
  validateEffectors(effectors);

  function setEffectors(next={}){
    const merged=Object.freeze({...effectors,...next});
    validateEffectors(merged);
    effectors=merged;
    return snapshot();
  }

  function derivative(s){
    const lv=ventricularFlows({
      side:'lv',
      atrialPressureMmHg:s.Pla,
      arterialPressureMmHg:s.Psa,
      volumeMl:s.Vlv,
      phaseFraction:s.phase,
      Tsec:effectors.heartPeriodSec,
      EmaxMmHgPerMl:effectors.EmaxLv,
    });
    const rv=ventricularFlows({
      side:'rv',
      atrialPressureMmHg:s.Pra,
      arterialPressureMmHg:s.Ppa,
      volumeMl:s.Vrv,
      phaseFraction:s.phase,
      Tsec:effectors.heartPeriodSec,
      EmaxMmHgPerMl:effectors.EmaxRv,
    });

    const v=vascularDerivatives({
      state:s,
      leftVentricleOutflowMlPerSec:lv.outflowMlPerSec,
      rightVentricleOutflowMlPerSec:rv.outflowMlPerSec,
      resistances:{
        sp:effectors.Rsp,
        ep:effectors.Rep,
        mp:effectors.Rmp,
        bp:effectors.Rbp,
        hp:effectors.Rhp,
      },
      venousUnstressedVolumeRates:{
        sv:effectors.dVusvDtMlPerSec,
        mv:effectors.dVumvDtMlPerSec,
      },
      venousUnstressedVolumes:{
        sv:effectors.Vusv,
        ev:effectors.Vuev,
        mv:effectors.Vumv,
      },
    });

    const flow=v.flows;

    const dPla=(
      (s.Ppv-s.Pla)/V.pv.R-lv.inflowMlPerSec
    )/HEART.la.C;
    const dVlv=lv.inflowMlPerSec-lv.outflowMlPerSec;

    const totalVenousReturn=
      flow.splanchnicVenousMlPerSec+
      flow.extrasplanchnicVenousMlPerSec+
      flow.muscleVenousMlPerSec+
      flow.brainVenousMlPerSec+
      flow.coronaryVenousMlPerSec;
    const dPra=(totalVenousReturn-rv.inflowMlPerSec)/HEART.ra.C;
    const dVrv=rv.inflowMlPerSec-rv.outflowMlPerSec;

    return {
      Ppa:v.derivative.Ppa,
      Fpa:v.derivative.Fpa,
      Ppp:v.derivative.Ppp,
      Ppv:v.derivative.Ppv,
      Psa:v.derivative.Psa,
      Fsa:v.derivative.Fsa,
      Psp:v.derivative.Psp,
      Psv:v.derivative.Psv,
      Pmv:v.derivative.Pmv,
      Pbv:v.derivative.Pbv,
      Phv:v.derivative.Phv,
      Pra:dPra,Vrv:dVrv,Pla:dPla,Vlv:dVlv,
      phase:1/effectors.heartPeriodSec,
      Vt:0,
    };
  }

  function step(){
    const h=dtSec;
    const k1=derivative(state);
    const k2=derivative(addState(state,k1,h/2));
    const k3=derivative(addState(state,k2,h/2));
    const k4=derivative(addState(state,k3,h));
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

  function snapshot(){
    const lv=ventricularFlows({
      side:'lv',atrialPressureMmHg:state.Pla,arterialPressureMmHg:state.Psa,
      volumeMl:state.Vlv,phaseFraction:state.phase,
      Tsec:effectors.heartPeriodSec,EmaxMmHgPerMl:effectors.EmaxLv,
    });
    const rv=ventricularFlows({
      side:'rv',atrialPressureMmHg:state.Pra,arterialPressureMmHg:state.Ppa,
      volumeMl:state.Vrv,phaseFraction:state.phase,
      Tsec:effectors.heartPeriodSec,EmaxMmHgPerMl:effectors.EmaxRv,
    });
    const v=vascularDerivatives({
      state,
      leftVentricleOutflowMlPerSec:lv.outflowMlPerSec,
      rightVentricleOutflowMlPerSec:rv.outflowMlPerSec,
      resistances:{
        sp:effectors.Rsp,ep:effectors.Rep,mp:effectors.Rmp,
        bp:effectors.Rbp,hp:effectors.Rhp,
      },
      venousUnstressedVolumeRates:{
        sv:effectors.dVusvDtMlPerSec,
        mv:effectors.dVumvDtMlPerSec,
      },
      venousUnstressedVolumes:{
        sv:effectors.Vusv,ev:effectors.Vuev,mv:effectors.Vumv,
      },
    });
    return Object.freeze({
      timeSec:t,
      state:Object.freeze(clone(state)),
      hemodynamics:Object.freeze({
        systemicArterialPressureMmHg:state.Psa,
        systemicPeripheralPressureMmHg:state.Psp,
        pulmonaryArteryPressureMmHg:state.Ppa,
        rightAtrialPressureMmHg:state.Pra,
        leftAtrialPressureMmHg:state.Pla,
        extrasplanchnicVenousPressureMmHg:v.PevMmHg,
        heartPeriodSec:effectors.heartPeriodSec,
        heartRatePerMin:60/effectors.heartPeriodSec,
        leftVentricleOutflowMlPerSec:lv.outflowMlPerSec,
        rightVentricleOutflowMlPerSec:rv.outflowMlPerSec,
        regionalFlows:v.flows,
      }),
      effectors,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      localO2Authority:false,
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    step,runFor,snapshot,setEffectors,
    source:SOURCE,defaultSeed,defaultEffectors,
  });
}

module.exports=Object.freeze({
  SOURCE,STATE_KEYS,defaultSeed,defaultEffectors,
  createUrsinoMagosso2000PlantRuntime,
});
