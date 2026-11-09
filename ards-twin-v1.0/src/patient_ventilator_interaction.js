'use strict';
function analyzePatientVentilatorInteraction(trace,{windowSec=30,effortThresholdCmH2O=0.05}={}){
 if(!Array.isArray(trace)||trace.length<2)return Object.freeze({status:'insufficient-data',ineffectiveEfforts:0,doubleTriggers:0,totalEfforts:0,totalVentilatorBreaths:0,asynchronyIndex:null});
 const end=trace[trace.length-1].t, rows=trace.filter(r=>r.t>=end-windowSec);
 const efforts=[];let active=null;const ventStarts=[];
 for(let i=1;i<rows.length;i++){
  const a=rows[i-1],b=rows[i], pa=Number(a.patientMusclePressureCmH2O)||0,pb=Number(b.patientMusclePressureCmH2O)||0;
  if(!active&&pa<=effortThresholdCmH2O&&pb>effortThresholdCmH2O)active={start:b.t,end:null};
  if(active&&pa>effortThresholdCmH2O&&pb<=effortThresholdCmH2O){active.end=b.t;efforts.push(active);active=null;}
  if(a.phase==='EXPIRATION'&&b.phase==='INSPIRATION')ventStarts.push(b.t);
 }
 if(active){active.end=end;efforts.push(active);}
 let ineffective=0,double=0;
 for(const e of efforts){const n=ventStarts.filter(t=>t>=e.start&&t<=e.end).length;if(n===0)ineffective++;if(n>1)double+=n-1;}
 const async=ineffective+double, denom=efforts.length+ventStarts.length;
 return Object.freeze({status:'measured-effort-breath-timing',windowSec,totalEfforts:efforts.length,totalVentilatorBreaths:ventStarts.length,ineffectiveEfforts:ineffective,doubleTriggers:double,asynchronyIndex:denom?async/denom:null,unsupportedDetectors:Object.freeze(['reverse-trigger','flow-starvation','premature-cycling','delayed-cycling'])});
}
module.exports=Object.freeze({analyzePatientVentilatorInteraction});
