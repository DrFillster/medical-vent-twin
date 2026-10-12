'use strict';

/**
 * Ursino & Magosso 2000 expanded systemic vascular candidate primitives.
 *
 * Primary source:
 * Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia.
 * I. A mathematical model. Am J Physiol Heart Circ Physiol.
 * 2000;279:H149-H165. doi:10.1152/ajpheart.2000.279.1.H149.
 *
 * Candidate only. No canonical patient-state authority.
 */

const {
  HEART,
}=require('./ursino_1998_closed_loop_candidate.js');

const SOURCE=Object.freeze({
  citation:
    'Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
  doi:'10.1152/ajpheart.2000.279.1.H149',
  equations:'1-13 vascular system',
  parameterTable:1,
  authority:'candidate-not-canonical',
});

const VASCULAR=Object.freeze({
  sa:Object.freeze({C:0.28,Vu:0,R:0.06,L:0.22e-3}),
  sp:Object.freeze({C:2.05,Vu:274.4,R:3.307}),
  ep:Object.freeze({C:0.668,Vu:134.64,R:3.52}),
  mp:Object.freeze({C:0.525,Vu:105.8,R:4.48}),
  bp:Object.freeze({C:0.358,Vu:72.13,R:6.57}),
  hp:Object.freeze({C:0.119,Vu:24,R:19.71}),
  sv:Object.freeze({C:61.11,Vu:1121,R:0.038}),
  ev:Object.freeze({C:20,Vu:550,R:0.04}),
  mv:Object.freeze({C:15.71,Vu:432.14,R:0.05}),
  bv:Object.freeze({C:10.71,Vu:294.64,R:0.075}),
  hv:Object.freeze({C:3.57,Vu:98.21,R:0.224}),
  pa:Object.freeze({C:0.76,Vu:0,R:0.023,L:0.18e-3}),
  pp:Object.freeze({C:5.80,Vu:123,R:0.0894}),
  pv:Object.freeze({C:25.37,Vu:120,R:0.0056}),
  totalBloodVolumeMl:5300,
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

function totalPeripheralComplianceMlPerMmHg(){
  return VASCULAR.sp.C+VASCULAR.ep.C+VASCULAR.mp.C+
    VASCULAR.bp.C+VASCULAR.hp.C;
}

function parallelResistanceMmHgSecPerMl(resistances){
  if(!Array.isArray(resistances)||resistances.length===0){
    throw new Error('resistances must be a non-empty array');
  }
  let conductance=0;
  for(const r of resistances){
    positive(r,'resistance');
    conductance+=1/r;
  }
  return 1/conductance;
}

function aggregateExtrasplanchnicBasal(){
  return Object.freeze({
    peripheralComplianceMlPerMmHg:
      VASCULAR.ep.C+VASCULAR.mp.C+VASCULAR.bp.C+VASCULAR.hp.C,
    peripheralUnstressedVolumeMl:
      VASCULAR.ep.Vu+VASCULAR.mp.Vu+VASCULAR.bp.Vu+VASCULAR.hp.Vu,
    peripheralResistanceMmHgSecPerMl:parallelResistanceMmHgSecPerMl([
      VASCULAR.ep.R,VASCULAR.mp.R,VASCULAR.bp.R,VASCULAR.hp.R,
    ]),
    venousComplianceMlPerMmHg:
      VASCULAR.ev.C+VASCULAR.mv.C+VASCULAR.bv.C+VASCULAR.hv.C,
    venousUnstressedVolumeMl:
      VASCULAR.ev.Vu+VASCULAR.mv.Vu+VASCULAR.bv.Vu+VASCULAR.hv.Vu,
    venousResistanceMmHgSecPerMl:parallelResistanceMmHgSecPerMl([
      VASCULAR.ev.R,VASCULAR.mv.R,VASCULAR.bv.R,VASCULAR.hv.R,
    ]),
  });
}

// Source Eq. 7.
function systemicPeripheralPressureDerivative({
  Fsa,Psp,Psv,Pev,Pmv,Pbv,Phv,
  Rsp=VASCULAR.sp.R,
  Rep=VASCULAR.ep.R,
  Rmp=VASCULAR.mp.R,
  Rbp=VASCULAR.bp.R,
  Rhp=VASCULAR.hp.R,
}={}){
  for(const [k,v] of Object.entries({
    Fsa,Psp,Psv,Pev,Pmv,Pbv,Phv,Rsp,Rep,Rmp,Rbp,Rhp,
  })) finite(v,k);
  return (
    Fsa
    -(Psp-Psv)/Rsp
    -(Psp-Pev)/Rep
    -(Psp-Pmv)/Rmp
    -(Psp-Pbv)/Rbp
    -(Psp-Phv)/Rhp
  )/totalPeripheralComplianceMlPerMmHg();
}

// Source Eqs. 8-11.
function venousPressureDerivatives({
  Psp,Psv,Pmv,Pbv,Phv,Pra,
  Rsp=VASCULAR.sp.R,
  Rmp=VASCULAR.mp.R,
  Rbp=VASCULAR.bp.R,
  Rhp=VASCULAR.hp.R,
  dVusvDtMlPerSec=0,
  dVumvDtMlPerSec=0,
}={}){
  for(const [k,v] of Object.entries({
    Psp,Psv,Pmv,Pbv,Phv,Pra,
    Rsp,Rmp,Rbp,Rhp,dVusvDtMlPerSec,dVumvDtMlPerSec,
  })) finite(v,k);

  return Object.freeze({
    Psv:(
      (Psp-Psv)/Rsp
      -(Psv-Pra)/VASCULAR.sv.R
      -dVusvDtMlPerSec
    )/VASCULAR.sv.C,
    Pmv:(
      (Psp-Pmv)/Rmp
      -(Pmv-Pra)/VASCULAR.mv.R
      -dVumvDtMlPerSec
    )/VASCULAR.mv.C,
    Pbv:(
      (Psp-Pbv)/Rbp
      -(Pbv-Pra)/VASCULAR.bv.R
    )/VASCULAR.bv.C,
    Phv:(
      (Psp-Phv)/Rhp
      -(Phv-Pra)/VASCULAR.hv.R
    )/VASCULAR.hv.C,
  });
}

// Source Eq. 13.
function totalUnstressedVolumeMl({
  VusvMl=VASCULAR.sv.Vu,
  VuevMl=VASCULAR.ev.Vu,
  VumvMl=VASCULAR.mv.Vu,
}={}){
  for(const [k,v] of Object.entries({VusvMl,VuevMl,VumvMl})) finite(v,k);
  return (
    VASCULAR.sa.Vu+
    VASCULAR.sp.Vu+VASCULAR.ep.Vu+VASCULAR.mp.Vu+
    VASCULAR.bp.Vu+VASCULAR.hp.Vu+
    VusvMl+VuevMl+VumvMl+VASCULAR.bv.Vu+VASCULAR.hv.Vu+
    HEART.ra.Vu+
    VASCULAR.pa.Vu+VASCULAR.pp.Vu+VASCULAR.pv.Vu+
    HEART.la.Vu
  );
}

// Source Eq. 12.
function extrasplanchnicVenousPressureMmHg({
  totalBloodVolumeMl=VASCULAR.totalBloodVolumeMl,
  Psa,Psp,Psv,Pmv,Pbv,Phv,Pra,Vrv,Ppa,Ppp,Ppv,Pla,Vlv,
  VusvMl=VASCULAR.sv.Vu,
  VuevMl=VASCULAR.ev.Vu,
  VumvMl=VASCULAR.mv.Vu,
}={}){
  for(const [k,v] of Object.entries({
    totalBloodVolumeMl,Psa,Psp,Psv,Pmv,Pbv,Phv,Pra,Vrv,
    Ppa,Ppp,Ppv,Pla,Vlv,VusvMl,VuevMl,VumvMl,
  })) finite(v,k);

  const Vu=totalUnstressedVolumeMl({VusvMl,VuevMl,VumvMl});
  return (
    totalBloodVolumeMl
    -VASCULAR.sa.C*Psa
    -totalPeripheralComplianceMlPerMmHg()*Psp
    -VASCULAR.sv.C*Psv
    -VASCULAR.mv.C*Pmv
    -VASCULAR.bv.C*Pbv
    -VASCULAR.hv.C*Phv
    -HEART.ra.C*Pra
    -Vrv
    -VASCULAR.pa.C*Ppa
    -VASCULAR.pp.C*Ppp
    -VASCULAR.pv.C*Ppv
    -HEART.la.C*Pla
    -Vlv
    -Vu
  )/VASCULAR.ev.C;
}

function reconstructedTotalBloodVolumeMl({
  Psa,Psp,Psv,Pev,Pmv,Pbv,Phv,Pra,Vrv,Ppa,Ppp,Ppv,Pla,Vlv,
  VusvMl=VASCULAR.sv.Vu,
  VuevMl=VASCULAR.ev.Vu,
  VumvMl=VASCULAR.mv.Vu,
}={}){
  for(const [k,v] of Object.entries({
    Psa,Psp,Psv,Pev,Pmv,Pbv,Phv,Pra,Vrv,Ppa,Ppp,Ppv,Pla,Vlv,
    VusvMl,VuevMl,VumvMl,
  })) finite(v,k);

  return (
    VASCULAR.sa.C*Psa
    +totalPeripheralComplianceMlPerMmHg()*Psp
    +VASCULAR.sv.C*Psv
    +VASCULAR.ev.C*Pev
    +VASCULAR.mv.C*Pmv
    +VASCULAR.bv.C*Pbv
    +VASCULAR.hv.C*Phv
    +HEART.ra.C*Pra
    +Vrv
    +VASCULAR.pa.C*Ppa
    +VASCULAR.pp.C*Ppp
    +VASCULAR.pv.C*Ppv
    +HEART.la.C*Pla
    +Vlv
    +totalUnstressedVolumeMl({VusvMl,VuevMl,VumvMl})
  );
}

module.exports=Object.freeze({
  SOURCE,VASCULAR,
  totalPeripheralComplianceMlPerMmHg,
  parallelResistanceMmHgSecPerMl,
  aggregateExtrasplanchnicBasal,
  systemicPeripheralPressureDerivative,
  venousPressureDerivatives,
  totalUnstressedVolumeMl,
  extrasplanchnicVenousPressureMmHg,
  reconstructedTotalBloodVolumeMl,
});
