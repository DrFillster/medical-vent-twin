'use strict';

/**
 * Ursino & Magosso 2000 vascular-plant candidate, Appendix Eqs. 1-13.
 *
 * This module contains source equations only. It does not include reflex
 * effectors or local O2 regulation and has no canonical patient authority.
 */

const {
  VASCULAR_2000:V,
}=require('./ursino_magosso_2000_hypoxia_plant_parameters.js');
const {
  HEART,
}=require('./ursino_1998_closed_loop_candidate.js');

const SOURCE=Object.freeze({
  citation:'Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
  doi:'10.1152/ajpheart.2000.279.1.H149',
  equations:'Appendix Eqs. 1-13',
  authority:'candidate-not-canonical',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}

function totalUnstressedVolumeMl({
  VusvMl=V.sv.Vu,
  VuevMl=V.ev.Vu,
  VumvMl=V.mv.Vu,
}={}){
  for(const [k,x] of Object.entries({VusvMl,VuevMl,VumvMl})) finite(x,k);
  return (
    V.sa.Vu+V.sp.Vu+V.ep.Vu+V.mp.Vu+V.bp.Vu+V.hp.Vu+
    VusvMl+VuevMl+VumvMl+V.bv.Vu+V.hv.Vu+
    HEART.ra.Vu+V.pa.Vu+V.pp.Vu+V.pv.Vu+HEART.la.Vu
  );
}

// Primary Eq. 12. Pev is algebraic because Vtot is known.
function extrasplanchnicVenousPressureMmHg({
  totalBloodVolumeMl=V.totalBloodVolumeMl,
  Psa,Psp,Psv,Pmv,Pbv,Phv,Pra,Vrv,Ppa,Ppp,Ppv,Pla,Vlv,
  VusvMl=V.sv.Vu,
  VuevMl=V.ev.Vu,
  VumvMl=V.mv.Vu,
}={}){
  const args={
    totalBloodVolumeMl,Psa,Psp,Psv,Pmv,Pbv,Phv,Pra,Vrv,
    Ppa,Ppp,Ppv,Pla,Vlv,VusvMl,VuevMl,VumvMl,
  };
  for(const [k,x] of Object.entries(args)) finite(x,k);

  const peripheralC=V.sp.C+V.ep.C+V.mp.C+V.bp.C+V.hp.C;
  const Vu=totalUnstressedVolumeMl({VusvMl,VuevMl,VumvMl});

  return (
    totalBloodVolumeMl-
    V.sa.C*Psa-
    peripheralC*Psp-
    V.sv.C*Psv-
    V.mv.C*Pmv-
    V.bv.C*Pbv-
    V.hv.C*Phv-
    HEART.ra.C*Pra-
    Vrv-
    V.pa.C*Ppa-
    V.pp.C*Ppp-
    V.pv.C*Ppv-
    HEART.la.C*Pla-
    Vlv-
    Vu
  )/V.ev.C;
}

function vascularDerivatives({
  state,
  leftVentricleOutflowMlPerSec,
  rightVentricleOutflowMlPerSec,
  resistances={},
  venousUnstressedVolumeRates={},
  venousUnstressedVolumes={},
}={}){
  if(!state) throw new Error('state is required');
  const required=[
    'Ppa','Fpa','Ppp','Ppv','Psa','Fsa','Psp',
    'Psv','Pmv','Pbv','Phv','Pra','Vrv','Pla','Vlv','Vt',
  ];
  for(const key of required) finite(state[key],'state.'+key);
  finite(leftVentricleOutflowMlPerSec,'leftVentricleOutflowMlPerSec');
  finite(rightVentricleOutflowMlPerSec,'rightVentricleOutflowMlPerSec');

  const R=Object.freeze({
    sp:resistances.sp??V.sp.R,
    ep:resistances.ep??V.ep.R,
    mp:resistances.mp??V.mp.R,
    bp:resistances.bp??V.bp.R,
    hp:resistances.hp??V.hp.R,
  });
  for(const [k,x] of Object.entries(R)){
    finite(x,'resistances.'+k);
    if(!(x>0)) throw new Error('resistances.'+k+' must be > 0');
  }

  const dVu=Object.freeze({
    sv:venousUnstressedVolumeRates.sv??0,
    mv:venousUnstressedVolumeRates.mv??0,
  });
  finite(dVu.sv,'venousUnstressedVolumeRates.sv');
  finite(dVu.mv,'venousUnstressedVolumeRates.mv');

  const Vu=Object.freeze({
    sv:venousUnstressedVolumes.sv??V.sv.Vu,
    ev:venousUnstressedVolumes.ev??V.ev.Vu,
    mv:venousUnstressedVolumes.mv??V.mv.Vu,
  });

  const Pev=extrasplanchnicVenousPressureMmHg({
    totalBloodVolumeMl:state.Vt,
    Psa:state.Psa,Psp:state.Psp,Psv:state.Psv,
    Pmv:state.Pmv,Pbv:state.Pbv,Phv:state.Phv,
    Pra:state.Pra,Vrv:state.Vrv,
    Ppa:state.Ppa,Ppp:state.Ppp,Ppv:state.Ppv,
    Pla:state.Pla,Vlv:state.Vlv,
    VusvMl:Vu.sv,VuevMl:Vu.ev,VumvMl:Vu.mv,
  });

  // Eqs. 1-6.
  const dPpa=(rightVentricleOutflowMlPerSec-state.Fpa)/V.pa.C;
  const dFpa=(state.Ppa-state.Ppp-V.pa.R*state.Fpa)/V.pa.L;
  const dPpp=(
    state.Fpa-(state.Ppp-state.Ppv)/V.pp.R
  )/V.pp.C;
  const dPpv=(
    (state.Ppp-state.Ppv)/V.pp.R-
    (state.Ppv-state.Pla)/V.pv.R
  )/V.pv.C;
  const dPsa=(leftVentricleOutflowMlPerSec-state.Fsa)/V.sa.C;
  const dFsa=(state.Psa-state.Psp-V.sa.R*state.Fsa)/V.sa.L;

  // Eq. 7.
  const peripheralC=V.sp.C+V.ep.C+V.mp.C+V.bp.C+V.hp.C;
  const dPsp=(
    state.Fsa-
    (state.Psp-state.Psv)/R.sp-
    (state.Psp-Pev)/R.ep-
    (state.Psp-state.Pmv)/R.mp-
    (state.Psp-state.Pbv)/R.bp-
    (state.Psp-state.Phv)/R.hp
  )/peripheralC;

  // Eqs. 8-11.
  const dPsv=(
    (state.Psp-state.Psv)/R.sp-
    (state.Psv-state.Pra)/V.sv.R-
    dVu.sv
  )/V.sv.C;

  const dPmv=(
    (state.Psp-state.Pmv)/R.mp-
    (state.Pmv-state.Pra)/V.mv.R-
    dVu.mv
  )/V.mv.C;

  const dPbv=(
    (state.Psp-state.Pbv)/R.bp-
    (state.Pbv-state.Pra)/V.bv.R
  )/V.bv.C;

  const dPhv=(
    (state.Psp-state.Phv)/R.hp-
    (state.Phv-state.Pra)/V.hv.R
  )/V.hv.C;

  return Object.freeze({
    PevMmHg:Pev,
    derivative:Object.freeze({
      Ppa:dPpa,Fpa:dFpa,Ppp:dPpp,Ppv:dPpv,
      Psa:dPsa,Fsa:dFsa,Psp:dPsp,
      Psv:dPsv,Pmv:dPmv,Pbv:dPbv,Phv:dPhv,
    }),
    flows:Object.freeze({
      splanchnicPeripheralMlPerSec:(state.Psp-state.Psv)/R.sp,
      extrasplanchnicPeripheralMlPerSec:(state.Psp-Pev)/R.ep,
      musclePeripheralMlPerSec:(state.Psp-state.Pmv)/R.mp,
      brainPeripheralMlPerSec:(state.Psp-state.Pbv)/R.bp,
      coronaryPeripheralMlPerSec:(state.Psp-state.Phv)/R.hp,
      splanchnicVenousMlPerSec:(state.Psv-state.Pra)/V.sv.R,
      extrasplanchnicVenousMlPerSec:(Pev-state.Pra)/V.ev.R,
      muscleVenousMlPerSec:(state.Pmv-state.Pra)/V.mv.R,
      brainVenousMlPerSec:(state.Pbv-state.Pra)/V.bv.R,
      coronaryVenousMlPerSec:(state.Phv-state.Pra)/V.hv.R,
    }),
    authority:SOURCE.authority,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  totalUnstressedVolumeMl,
  extrasplanchnicVenousPressureMmHg,
  vascularDerivatives,
});
