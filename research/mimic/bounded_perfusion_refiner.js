'use strict';
// Pure development search. Caller owns simulation, provenance and persistence.
const fields=['baselineCO2','baselineO2','driftCO2','driftO2','finalO2','phResidual'];
function validate(c){
 if(!c || !Number.isFinite(c.vpf) || c.vpf<0 || c.vpf>1 || !fields.every(k=>Number.isFinite(c[k])))throw Error('invalid candidate');
 return {...c};
}
function gate(c){
 validate(c);
 const failures=[];
 for(const [k,limit] of [['baselineCO2',8],['baselineO2',20],['driftCO2',8],['driftO2',20]])if(Math.abs(c[k])>limit)failures.push(k);
 return {pass:failures.length===0,failures};
}
function refine({seeds,evaluate,maxEvaluations=4}){
 if(!Array.isArray(seeds)||seeds.length<2||typeof evaluate!=='function'||!Number.isInteger(maxEvaluations)||maxEvaluations<0||maxEvaluations>32)throw Error('invalid search configuration');
 const initial=seeds.map(validate).sort((a,b)=>a.vpf-b.vpf);
 if(new Set(initial.map(x=>x.vpf)).size!==initial.length)throw Error('duplicate seeds');
 const bounds=[initial[0].vpf,initial[initial.length-1].vpf];
 const attempts=initial.map(candidate=>({source:'seed',candidate,gate:gate(candidate)}));
 let evaluations=0,status='';
 const valid=()=>attempts.filter(x=>x.candidate);
 while(true){
  if(valid().some(x=>x.gate.pass)){status='pass';break;}
  const ordered=valid().map(x=>x.candidate).sort((a,b)=>a.vpf-b.vpf);
  const brackets=ordered.slice(0,-1).map((a,i)=>[a,ordered[i+1]]).filter(([a,b])=>a.finalO2*b.finalO2<0);
  if(!brackets.length){status='no_bracket';break;}
  if(evaluations>=maxEvaluations){status='budget_exhausted';break;}
  const [lo,hi]=brackets.sort((a,b)=>(a[1].vpf-a[0].vpf)-(b[1].vpf-b[0].vpf)||a[0].vpf-b[0].vpf)[0];
  const vpf=(lo.vpf+hi.vpf)/2;
  if(vpf===lo.vpf||vpf===hi.vpf){status='resolution_limit';break;}
  evaluations++;
  try{
   const candidate=validate(evaluate(vpf));
   if(candidate.vpf!==vpf)throw Error('evaluator parameter mismatch');
   attempts.push({source:'evaluation',requestedVpf:vpf,bracket:[lo.vpf,hi.vpf],candidate,gate:gate(candidate)});
  }catch(error){
   attempts.push({source:'evaluation',requestedVpf:vpf,bracket:[lo.vpf,hi.vpf],error:String(error.message||error)});
   status='evaluation_failed';break;
  }
 }
 const passing=valid().filter(x=>x.gate.pass).sort((a,b)=>Math.abs(a.candidate.finalO2)-Math.abs(b.candidate.finalO2)||a.candidate.vpf-b.candidate.vpf);
 return {version:'development-bounded-perfusion-v1',status,bounds,evaluations,maxEvaluations,
  selected:passing.length?passing[0].candidate:null,attempts};
}
module.exports={refine,gate};
