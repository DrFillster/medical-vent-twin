'use strict';

const {
  SOURCE,VASCULAR,HEART,CONTROL,
  baroreceptorStatic,sympatheticEfferent,vagalEfferent,
  sympatheticEffectorStatic,vagalHeartPeriodStatic,heartPeriodSec,
  ventricularFlows,splanchnicVenousPressureMmHg,
} = require('./ursino_1998_closed_loop_candidate.js');

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label); if(!(v>0)) throw new Error(label+' must be > 0'); return v;
}
function clone(x){ return {...x}; }
function unitInterval(v,label){
  finite(v,label);
  if(v<0||v>1) throw new Error(label+' must be between 0 and 1');
  return v;
}

const STATE_KEYS=Object.freeze([
  'Ppa','Fpa','Ppp','Ppv','Psa','Fsa','Psp','Pev','Vt',
  'Pla','Vlv','phase','Pra','Vrv','Ptilde',
  'dEmaxLv','dEmaxRv','dRsp','dRep','dVusv','dVuev','dTs','dTv',
]);

function derivedRestingControlState(){
  // At source central pressure Pn, Eq.31 gives the midpoint baroreceptor firing.
  const fCs=baroreceptorStatic(CONTROL.afferent.PnMmHg);
  const fEs=sympatheticEfferent(fCs);
  const fEv=vagalEfferent(fCs);

  function eff(name){
    const e=CONTROL.effectors[name];
    return sympatheticEffectorStatic(fEs,e);
  }

  const dTs=eff('Ts');
  const dTv=vagalHeartPeriodStatic(fEv);

  return Object.freeze({
    fCs,fEs,fEv,
    dEmaxLv:eff('EmaxLv'),
    dEmaxRv:eff('EmaxRv'),
    dRsp:eff('Rsp'),
    dRep:eff('Rep'),
    dVusv:eff('Vusv'),
    dVuev:eff('Vuev'),
    dTs,dTv,
    heartPeriodSec:heartPeriodSec(dTs,dTv),
  });
}

function defaultSeed(){
  const rest=derivedRestingControlState();
  return Object.freeze({
    // Hemodynamic seed is a numerical starting point only. Pressures/volumes
    // are allowed to settle under the source equations before assessment.
    Ppa:15,
    Fpa:80,
    Ppp:10,
    Ppv:7,
    Psa:CONTROL.afferent.PnMmHg,
    Fsa:80,
    Psp:80,
    Pev:8,
    Vt:VASCULAR.totalBloodVolumeMl,
    Pla:5,
    Vlv:120,
    phase:0,
    Pra:3,
    Vrv:80,
    Ptilde:CONTROL.afferent.PnMmHg,
    dEmaxLv:rest.dEmaxLv,
    dEmaxRv:rest.dEmaxRv,
    dRsp:rest.dRsp,
    dRep:rest.dRep,
    dVusv:rest.dVusv,
    dVuev:rest.dVuev,
    dTs:rest.dTs,
    dTv:rest.dTv,
  });
}

function interpHistory(history,target,fallback){
  if(!history.length) return fallback;
  if(target<=history[0].t) return history[0].v;
  for(let i=history.length-1;i>=1;i--){
    const a=history[i-1], b=history[i];
    if(a.t<=target&&target<=b.t){
      const dt=b.t-a.t;
      if(!(dt>0)) return a.v;
      const w=(target-a.t)/dt;
      return a.v+w*(b.v-a.v);
    }
  }
  return history[history.length-1].v;
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

function createUrsino1998ClosedLoopRuntime({
  dtSec=0.002,
  initialState=null,
  controlStrength=null,
}={}){
  positive(dtSec,'dtSec');
  const strength=Object.freeze({
    Emax:unitInterval(controlStrength?.Emax ?? 1,'controlStrength.Emax'),
    resistance:unitInterval(controlStrength?.resistance ?? 1,'controlStrength.resistance'),
    unstressedVolume:unitInterval(controlStrength?.unstressedVolume ?? 1,'controlStrength.unstressedVolume'),
    heartPeriod:unitInterval(controlStrength?.heartPeriod ?? 1,'controlStrength.heartPeriod'),
  });
  const basalControl=derivedRestingControlState();
  let t=0;
  let state=clone(initialState||defaultSeed());
  for(const k of STATE_KEYS) finite(state[k],k);

  const sympatheticHistory=[];
  const vagalHistory=[];
  let lastOutputs=null;
  let externalEffectors=null;

  function currentEffectors(s){
    if(externalEffectors){
      return Object.freeze({
        EmaxLv:externalEffectors.EmaxLv,
        EmaxRv:externalEffectors.EmaxRv,
        Rsp:externalEffectors.Rsp,
        Rep:externalEffectors.Rep,
        Vusv:externalEffectors.Vusv,
        Vuev:externalEffectors.Vuev,
        T:externalEffectors.heartPeriodSec,
      });
    }
    return Object.freeze({
      EmaxLv:CONTROL.effectors.EmaxLv.offset+s.dEmaxLv,
      EmaxRv:CONTROL.effectors.EmaxRv.offset+s.dEmaxRv,
      Rsp:CONTROL.effectors.Rsp.offset+s.dRsp,
      Rep:CONTROL.effectors.Rep.offset+s.dRep,
      Vusv:CONTROL.effectors.Vusv.offset+s.dVusv,
      Vuev:CONTROL.effectors.Vuev.offset+s.dVuev,
      T:heartPeriodSec(s.dTs,s.dTv),
    });
  }

  function delayedNeural(name,delay,now,current){
    const h=name==='sympathetic'?sympatheticHistory:vagalHistory;
    return interpHistory(h,now-delay,current);
  }

  function groupForEffector(name){
    if(name==='EmaxLv'||name==='EmaxRv') return 'Emax';
    if(name==='Rsp'||name==='Rep') return 'resistance';
    if(name==='Vusv'||name==='Vuev') return 'unstressedVolume';
    if(name==='Ts') return 'heartPeriod';
    throw new Error('unknown effector group: '+name);
  }

  function preserveBasalStrength(name,sourceTarget){
    const group=groupForEffector(name);
    const scale=strength[group];
    const basal=basalControl['d'+name];
    return basal+scale*(sourceTarget-basal);
  }

  function derivatives(s,now,delayed){
    const e=currentEffectors(s);
    if(!(e.T>0)) throw new Error('source heart period became non-positive');
    if(!(e.Rsp>0&&e.Rep>0&&e.EmaxLv>0&&e.EmaxRv>0)){
      throw new Error('source effector became non-physical');
    }

    const lv=ventricularFlows({
      side:'lv',atrialPressureMmHg:s.Pla,arterialPressureMmHg:s.Psa,
      volumeMl:s.Vlv,phaseFraction:s.phase,Tsec:e.T,
      EmaxMmHgPerMl:e.EmaxLv,
    });
    const rv=ventricularFlows({
      side:'rv',atrialPressureMmHg:s.Pra,arterialPressureMmHg:s.Ppa,
      volumeMl:s.Vrv,phaseFraction:s.phase,Tsec:e.T,
      EmaxMmHgPerMl:e.EmaxRv,
    });

    const Psv=splanchnicVenousPressureMmHg({
      totalBloodVolumeMl:s.Vt,Psa:s.Psa,Psp:s.Psp,Pev:s.Pev,
      Pra:s.Pra,Vrv:s.Vrv,Ppa:s.Ppa,Ppp:s.Ppp,Ppv:s.Ppv,
      Pla:s.Pla,Vlv:s.Vlv,VusvMl:e.Vusv,VuevMl:e.Vuev,
    });

    // Source plant Eqs.1-7,12,14,23,25.
    const dPpa=(rv.outflowMlPerSec-s.Fpa)/VASCULAR.pa.C;
    const dFpa=(s.Ppa-s.Ppp-VASCULAR.pa.R*s.Fpa)/VASCULAR.pa.L;
    const dPpp=(s.Fpa-(s.Ppp-s.Ppv)/VASCULAR.pp.R)/VASCULAR.pp.C;
    const dPpv=((s.Ppp-s.Ppv)/VASCULAR.pp.R-(s.Ppv-s.Pla)/VASCULAR.pv.R)/VASCULAR.pv.C;
    const dPsa=(lv.outflowMlPerSec-s.Fsa)/VASCULAR.sa.C;
    const dFsa=(s.Psa-s.Psp-VASCULAR.sa.R*s.Fsa)/VASCULAR.sa.L;
    const dPsp=(
      s.Fsa-(s.Psp-Psv)/e.Rsp-(s.Psp-s.Pev)/e.Rep
    )/(VASCULAR.sp.C+VASCULAR.ep.C);

    // Eq.30 MUST include the source rate-dependent tau_z*dPsa/dt term.
    const dPtilde=(
      s.Psa+CONTROL.afferent.tauZSec*dPsa-s.Ptilde
    )/CONTROL.afferent.tauPSec;
    const fCs=baroreceptorStatic(s.Ptilde);
    const fEs=sympatheticEfferent(fCs);
    const fEv=vagalEfferent(fCs);

    const sympatheticTargets={};
    for(const name of ['EmaxLv','EmaxRv','Rsp','Rep','Vusv','Vuev','Ts']){
      const cfg=CONTROL.effectors[name];
      const fd=delayed[name] == null
        ? delayedNeural('sympathetic',cfg.D,now,fEs)
        : delayed[name];
      const sourceTarget=sympatheticEffectorStatic(fd,cfg);
      sympatheticTargets[name]=preserveBasalStrength(name,sourceTarget);
    }
    const delayedFev=delayed.Tv == null
      ? delayedNeural('vagal',CONTROL.effectors.Tv.D,now,fEv)
      : delayed.Tv;
    const sourceTargetTv=vagalHeartPeriodStatic(delayedFev);
    const targetTv=basalControl.dTv+
      strength.heartPeriod*(sourceTargetTv-basalControl.dTv);

    const dDEmaxLv=externalEffectors ? 0 :
      (-s.dEmaxLv+sympatheticTargets.EmaxLv)/CONTROL.effectors.EmaxLv.tau;
    const dDEmaxRv=externalEffectors ? 0 :
      (-s.dEmaxRv+sympatheticTargets.EmaxRv)/CONTROL.effectors.EmaxRv.tau;
    const dDRsp=externalEffectors ? 0 :
      (-s.dRsp+sympatheticTargets.Rsp)/CONTROL.effectors.Rsp.tau;
    const dDRep=externalEffectors ? 0 :
      (-s.dRep+sympatheticTargets.Rep)/CONTROL.effectors.Rep.tau;
    const dDVusv=externalEffectors ? 0 :
      (-s.dVusv+sympatheticTargets.Vusv)/CONTROL.effectors.Vusv.tau;
    const dDVuev=externalEffectors ? 0 :
      (-s.dVuev+sympatheticTargets.Vuev)/CONTROL.effectors.Vuev.tau;
    const dDTs=externalEffectors ? 0 :
      (-s.dTs+sympatheticTargets.Ts)/CONTROL.effectors.Ts.tau;
    const dDTv=externalEffectors ? 0 :
      (-s.dTv+targetTv)/CONTROL.effectors.Tv.tau;

    // Eq.8 contains derivative of extrasplanchnic unstressed volume.
    // When an external source-family controller owns Vuev, carry its
    // derivative explicitly rather than silently treating capacitance as
    // static during the cardiovascular step.
    const vuevRate=externalEffectors
      ? externalEffectors.dVuevDtMlPerSec
      : dDVuev;
    const dPev=(
      (s.Psp-s.Pev)/e.Rep-(s.Pev-s.Pra)/VASCULAR.ev.R-vuevRate
    )/VASCULAR.ev.C;

    const dPla=((s.Ppv-s.Pla)/VASCULAR.pv.R-lv.inflowMlPerSec)/HEART.la.C;
    const dVlv=lv.inflowMlPerSec-lv.outflowMlPerSec;
    const dPra=((Psv-s.Pra)/VASCULAR.sv.R+
      (s.Pev-s.Pra)/VASCULAR.ev.R-rv.inflowMlPerSec)/HEART.ra.C;
    const dVrv=rv.inflowMlPerSec-rv.outflowMlPerSec;

    lastOutputs=Object.freeze({
      PsvMmHg:Psv,
      lv,rv,
      fCsSpikesPerSec:fCs,
      fEsSpikesPerSec:fEs,
      fEvSpikesPerSec:fEv,
      effectors:e,
    });

    return {
      Ppa:dPpa,Fpa:dFpa,Ppp:dPpp,Ppv:dPpv,
      Psa:dPsa,Fsa:dFsa,Psp:dPsp,Pev:dPev,Vt:0,
      Pla:dPla,Vlv:dVlv,phase:1/e.T,Pra:dPra,Vrv:dVrv,
      Ptilde:dPtilde,
      dEmaxLv:dDEmaxLv,dEmaxRv:dDEmaxRv,
      dRsp:dDRsp,dRep:dDRep,dVusv:dDVusv,dVuev:dDVuev,
      dTs:dDTs,dTv:dDTv,
    };
  }

  function stepOne(){
    // Evaluate current neural signals before storing history for future delays.
    const e=currentEffectors(state);
    const lv=ventricularFlows({
      side:'lv',atrialPressureMmHg:state.Pla,arterialPressureMmHg:state.Psa,
      volumeMl:state.Vlv,phaseFraction:state.phase,Tsec:e.T,EmaxMmHgPerMl:e.EmaxLv,
    });
    const dPsaEstimate=(lv.outflowMlPerSec-state.Fsa)/VASCULAR.sa.C;
    const dPt=(state.Psa+CONTROL.afferent.tauZSec*dPsaEstimate-state.Ptilde)/
      CONTROL.afferent.tauPSec;
    const fCs=baroreceptorStatic(state.Ptilde);
    const fEs=sympatheticEfferent(fCs);
    const fEv=vagalEfferent(fCs);

    const delayed={};
    for(const name of ['EmaxLv','EmaxRv','Rsp','Rep','Vusv','Vuev','Ts']){
      delayed[name]=delayedNeural('sympathetic',CONTROL.effectors[name].D,t,fEs);
    }
    delayed.Tv=delayedNeural('vagal',CONTROL.effectors.Tv.D,t,fEv);

    const h=dtSec;
    const k1=derivatives(state,t,delayed);
    const k2=derivatives(addState(state,k1,h/2),t+h/2,delayed);
    const k3=derivatives(addState(state,k2,h/2),t+h/2,delayed);
    const k4=derivatives(addState(state,k3,h),t+h,delayed);
    state=combineRk4(state,k1,k2,k3,k4,h);
    t+=h;

    sympatheticHistory.push({t,v:fEs});
    vagalHistory.push({t,v:fEv});
    const keepAfter=t-8;
    while(sympatheticHistory.length>2&&sympatheticHistory[1].t<keepAfter) sympatheticHistory.shift();
    while(vagalHistory.length>2&&vagalHistory[1].t<keepAfter) vagalHistory.shift();

    return snapshot();
  }

  function runFor(seconds){
    finite(seconds,'seconds');
    if(seconds<0) throw new Error('seconds must be >= 0');
    const n=Math.floor(seconds/dtSec+1e-9);
    for(let i=0;i<n;i++) stepOne();
    const rem=seconds-n*dtSec;
    if(rem>1e-9){
      // Preserve deterministic fixed-step candidate: caller must request exact multiples.
      throw new Error('seconds must be an integer multiple of dtSec');
    }
    return snapshot();
  }

  function snapshot(){
    // Refresh outputs at current state without advancing.
    const e=currentEffectors(state);
    const lv=ventricularFlows({
      side:'lv',atrialPressureMmHg:state.Pla,arterialPressureMmHg:state.Psa,
      volumeMl:state.Vlv,phaseFraction:state.phase,Tsec:e.T,EmaxMmHgPerMl:e.EmaxLv,
    });
    const rv=ventricularFlows({
      side:'rv',atrialPressureMmHg:state.Pra,arterialPressureMmHg:state.Ppa,
      volumeMl:state.Vrv,phaseFraction:state.phase,Tsec:e.T,EmaxMmHgPerMl:e.EmaxRv,
    });
    const Psv=splanchnicVenousPressureMmHg({
      totalBloodVolumeMl:state.Vt,Psa:state.Psa,Psp:state.Psp,Pev:state.Pev,
      Pra:state.Pra,Vrv:state.Vrv,Ppa:state.Ppa,Ppp:state.Ppp,Ppv:state.Ppv,
      Pla:state.Pla,Vlv:state.Vlv,VusvMl:e.Vusv,VuevMl:e.Vuev,
    });
    const fCs=baroreceptorStatic(state.Ptilde);
    const fEs=sympatheticEfferent(fCs);
    const fEv=vagalEfferent(fCs);
    return Object.freeze({
      timeSec:t,
      state:Object.freeze(clone(state)),
      hemodynamics:Object.freeze({
        systemicArterialPressureMmHg:state.Psa,
        pulmonaryArteryPressureMmHg:state.Ppa,
        rightAtrialPressureMmHg:state.Pra,
        leftAtrialPressureMmHg:state.Pla,
        splanchnicVenousPressureMmHg:Psv,
        leftVentriclePressureMmHg:lv.ventricularPressureMmHg,
        rightVentriclePressureMmHg:rv.ventricularPressureMmHg,
        leftVentricleOutflowMlPerSec:lv.outflowMlPerSec,
        rightVentricleOutflowMlPerSec:rv.outflowMlPerSec,
        heartPeriodSec:e.T,
        heartRatePerMin:60/e.T,
        EmaxLvMmHgPerMl:e.EmaxLv,
        EmaxRvMmHgPerMl:e.EmaxRv,
        splanchnicResistanceMmHgSecPerMl:e.Rsp,
        extrasplanchnicResistanceMmHgSecPerMl:e.Rep,
        splanchnicVenousUnstressedVolumeMl:e.Vusv,
        extrasplanchnicVenousUnstressedVolumeMl:e.Vuev,
      }),
      control:Object.freeze({
        filteredBaroreceptorPressureMmHg:state.Ptilde,
        fCsSpikesPerSec:fCs,fEsSpikesPerSec:fEs,fEvSpikesPerSec:fEv,
      }),
      provenance:SOURCE,
      authority:'candidate-not-canonical',
      sourceSensitivity:Object.freeze({
        controlStrength:strength,
        preservesBasalControlState:true,
      }),
      effectorOwnership:Object.freeze({
        mode:externalEffectors?'external-source-family':'ursino-1998-internal',
        external:externalEffectors,
      }),
    });
  }

  function setExternalEffectors(next=null){
    if(next==null){
      externalEffectors=null;
      return snapshot();
    }
    for(const key of ['EmaxLv','EmaxRv','Rsp','Rep','Vusv','Vuev','heartPeriodSec','dVuevDtMlPerSec']){
      finite(next[key],key);
    }
    if(!(next.EmaxLv>0&&next.EmaxRv>0&&next.Rsp>0&&next.Rep>0&&
         next.Vusv>=0&&next.Vuev>=0&&next.heartPeriodSec>0)){
      throw new Error('external effectors must remain physiologic/positive');
    }
    externalEffectors=Object.freeze({...next});
    return snapshot();
  }

  function withdrawBloodMl(ml){
    finite(ml,'ml'); if(ml<0) throw new Error('ml must be >= 0');
    state.Vt-=ml;
    if(!(state.Vt>0)) throw new Error('total blood volume became non-positive');
    return snapshot();
  }

  return Object.freeze({
    step:stepOne,runFor,snapshot,withdrawBloodMl,setExternalEffectors,
    defaultSeed,derivedRestingControlState,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  STATE_KEYS,derivedRestingControlState,defaultSeed,
  createUrsino1998ClosedLoopRuntime,
});
