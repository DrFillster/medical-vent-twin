'use strict';

/**
 * Source-exact equations and parameters for the Ursino 1998 closed-loop
 * cardiovascular candidate.
 *
 * This file intentionally separates source equations from numerical integration.
 * It is candidate-only until source experiments are reproduced.
 *
 * Primary: DOI 10.1152/ajpheart.1998.275.5.H1733
 */

const SOURCE=Object.freeze({
  citation:'Ursino M. Interaction between carotid baroregulation and the pulsating heart: a mathematical model. Am J Physiol Heart Circ Physiol. 1998;275:H1733-H1747.',
  doi:'10.1152/ajpheart.1998.275.5.H1733',
  equations:'1-42',
  authority:'candidate-not-canonical',
});

const VASCULAR=Object.freeze({
  sa:Object.freeze({C:0.28,Vu:0,R:0.06,L:0.22e-3}),
  sp:Object.freeze({C:2.05,Vu:274.4,R:3.307}),
  ep:Object.freeze({C:1.67,Vu:336.6,R:1.407}),
  sv:Object.freeze({C:61.11,Vu:1121,R:0.038}),
  ev:Object.freeze({C:50.0,Vu:1375,R:0.016}),
  pa:Object.freeze({C:0.76,Vu:0,R:0.023,L:0.18e-3}),
  pp:Object.freeze({C:5.80,Vu:123,R:0.0894}),
  pv:Object.freeze({C:25.37,Vu:120,R:0.0056}),
  totalBloodVolumeMl:5300,
});

const HEART=Object.freeze({
  la:Object.freeze({C:19.23,Vu:25,R:2.5e-3}),
  ra:Object.freeze({C:31.25,Vu:25,R:2.5e-3}),
  lv:Object.freeze({P0:1.5,kE:0.014,Vu:16.77,EmaxPhysicalBasal:2.95,kR:3.75e-4}),
  rv:Object.freeze({P0:1.5,kE:0.011,Vu:40.8,EmaxPhysicalBasal:1.75,kR:1.4e-3}),
  physicalBasalPeriodSec:0.833,
  Tsys0Sec:0.5,
  ksysSec2:0.075,
});

const CONTROL=Object.freeze({
  afferent:Object.freeze({
    PnMmHg:92,fMin:2.52,fMax:47.78,kAMmHg:11.758,
    tauZSec:6.37,tauPSec:2.076,
  }),
  sympathetic:Object.freeze({
    fInfinity:2.10,f0:16.11,kSec:0.0675,fMin:2.66,
  }),
  vagal:Object.freeze({
    f0:3.2,fInfinity:6.3,k:7.06,fCs0:25,
  }),
  effectors:Object.freeze({
    EmaxLv:Object.freeze({G:0.475,tau:8,D:2,offset:2.392}),
    EmaxRv:Object.freeze({G:0.282,tau:8,D:2,offset:1.412}),
    Rsp:Object.freeze({G:0.695,tau:6,D:2,offset:2.49}),
    Rep:Object.freeze({G:0.53,tau:6,D:2,offset:0.78}),
    Vusv:Object.freeze({G:-265.4,tau:20,D:5,offset:1435.4}),
    Vuev:Object.freeze({G:-132.5,tau:20,D:5,offset:1537}),
    Ts:Object.freeze({G:-0.13,tau:2,D:2,offset:0}),
    Tv:Object.freeze({G:0.09,tau:1.5,D:0.2,offset:0}),
    T0Sec:0.58,
  }),
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label); if(!(v>0)) throw new Error(label+' must be > 0'); return v;
}

// Eq. 31
function baroreceptorStatic(filteredPressureMmHg){
  finite(filteredPressureMmHg,'filteredPressureMmHg');
  const p=CONTROL.afferent;
  const e=Math.exp((filteredPressureMmHg-p.PnMmHg)/p.kAMmHg);
  return (p.fMin+p.fMax*e)/(1+e);
}

// Eq. 33
function sympatheticEfferent(fCs){
  finite(fCs,'fCs');
  const p=CONTROL.sympathetic;
  return p.fInfinity+(p.f0-p.fInfinity)*Math.exp(-p.kSec*fCs);
}

// Eq. 34
function vagalEfferent(fCs){
  finite(fCs,'fCs');
  const p=CONTROL.vagal;
  const e=Math.exp((fCs-p.fCs0)/p.k);
  return (p.f0+p.fInfinity*e)/(1+e);
}

// Eq. 35 / Eq. 38 static sympathetic effect.
function sympatheticEffectorStatic(delayedFes,effector){
  finite(delayedFes,'delayedFes');
  if(!effector||typeof effector.G!=='number') throw new Error('effector required');
  if(delayedFes<CONTROL.sympathetic.fMin) return 0;
  return effector.G*Math.log(delayedFes-CONTROL.sympathetic.fMin+1);
}

// Eq. 40
function vagalHeartPeriodStatic(delayedFev){
  finite(delayedFev,'delayedFev');
  return CONTROL.effectors.Tv.G*delayedFev;
}

// Eq. 42
function heartPeriodSec(deltaTsSec,deltaTvSec){
  finite(deltaTsSec,'deltaTsSec'); finite(deltaTvSec,'deltaTvSec');
  return CONTROL.effectors.T0Sec+deltaTsSec+deltaTvSec;
}

// Eq. 22
function systolicDurationSec(Tsec){
  positive(Tsec,'Tsec');
  return HEART.Tsys0Sec-HEART.ksysSec2/Tsec;
}

// Eq. 19
function ventricularActivation({phaseFraction,Tsec}={}){
  finite(phaseFraction,'phaseFraction');
  positive(Tsec,'Tsec');
  const u=((phaseFraction%1)+1)%1;
  const Tsys=systolicDurationSec(Tsec);
  if(u>Tsys/Tsec) return 0;
  const x=Math.PI*Tsec/Tsys*u;
  return Math.sin(x)**2;
}

// Eq. 18 / 29
function isometricVentricularPressure({
  side,volumeMl,phaseFraction,Tsec,EmaxMmHgPerMl,
}={}){
  finite(volumeMl,'volumeMl');
  finite(EmaxMmHgPerMl,'EmaxMmHgPerMl');
  const p=HEART[side];
  if(side!=='lv'&&side!=='rv') throw new Error('side must be lv or rv');
  const phi=ventricularActivation({phaseFraction,Tsec});
  return phi*EmaxMmHgPerMl*(volumeMl-p.Vu)+
    (1-phi)*p.P0*(Math.exp(p.kE*volumeMl)-1);
}

// Eqs. 15-17 / 26-28
function ventricularFlows({
  side,atrialPressureMmHg,arterialPressureMmHg,volumeMl,
  phaseFraction,Tsec,EmaxMmHgPerMl,
}={}){
  finite(atrialPressureMmHg,'atrialPressureMmHg');
  finite(arterialPressureMmHg,'arterialPressureMmHg');
  const vent=HEART[side], atrium=HEART[side==='lv'?'la':'ra'];
  if(!vent||!atrium) throw new Error('side must be lv or rv');
  const pMax=isometricVentricularPressure({
    side,volumeMl,phaseFraction,Tsec,EmaxMmHgPerMl,
  });
  const Rv=vent.kR*pMax;
  const outflow=(pMax>arterialPressureMmHg&&Rv>0)
    ?(pMax-arterialPressureMmHg)/Rv:0;
  const pV=pMax-Rv*outflow;
  const inflow=atrialPressureMmHg>pV
    ?(atrialPressureMmHg-pV)/atrium.R:0;
  return Object.freeze({
    pMaxMmHg:pMax,ventricularResistanceMmHgSecPerMl:Rv,
    ventricularPressureMmHg:pV,inflowMlPerSec:inflow,outflowMlPerSec:outflow,
  });
}

// Eqs. 9-10: source blood-volume closure.
function totalUnstressedVolumeMl({VusvMl,VuevMl}={}){
  finite(VusvMl,'VusvMl'); finite(VuevMl,'VuevMl');
  return VASCULAR.sa.Vu+VASCULAR.sp.Vu+VASCULAR.ep.Vu+VusvMl+VuevMl+
    HEART.ra.Vu+VASCULAR.pa.Vu+VASCULAR.pp.Vu+VASCULAR.pv.Vu+HEART.la.Vu;
}

function splanchnicVenousPressureMmHg({
  totalBloodVolumeMl,Psa,Psp,Pev,Pra,Vrv,Ppa,Ppp,Ppv,Pla,Vlv,VusvMl,VuevMl,
}={}){
  for(const [k,v] of Object.entries({totalBloodVolumeMl,Psa,Psp,Pev,Pra,Vrv,Ppa,Ppp,Ppv,Pla,Vlv,VusvMl,VuevMl})){
    finite(v,k);
  }
  const Vu=totalUnstressedVolumeMl({VusvMl,VuevMl});
  return (
    totalBloodVolumeMl-
    VASCULAR.sa.C*Psa-
    (VASCULAR.sp.C+VASCULAR.ep.C)*Psp-
    VASCULAR.ev.C*Pev-
    HEART.ra.C*Pra-
    Vrv-
    VASCULAR.pa.C*Ppa-
    VASCULAR.pp.C*Ppp-
    VASCULAR.pv.C*Ppv-
    HEART.la.C*Pla-
    Vlv-
    Vu
  )/VASCULAR.sv.C;
}

module.exports=Object.freeze({
  SOURCE,VASCULAR,HEART,CONTROL,
  baroreceptorStatic,sympatheticEfferent,vagalEfferent,
  sympatheticEffectorStatic,vagalHeartPeriodStatic,heartPeriodSec,
  systolicDurationSec,ventricularActivation,isometricVentricularPressure,
  ventricularFlows,totalUnstressedVolumeMl,splanchnicVenousPressureMmHg,
});
