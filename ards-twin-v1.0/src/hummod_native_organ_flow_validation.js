'use strict';

function finiteSeries(v,label){
  if(!Array.isArray(v)||v.length===0) throw new Error(label+' must be a non-empty array');
  v.forEach((x,i)=>{if(typeof x!=='number'||!Number.isFinite(x))throw new Error(label+'['+i+'] must be finite');});
  return v;
}

function compareNativeOrganFlowSeries({
  nativeSeries,
  candidateSeries,
  absoluteToleranceMlPerMin=1,
  relativeTolerance=0.01,
}={}){
  if(!nativeSeries||typeof nativeSeries!=='object'||!candidateSeries||typeof candidateSeries!=='object'){
    throw new Error('nativeSeries and candidateSeries objects are required');
  }
  const rows={};
  let passed=true;
  for(const [organ,native] of Object.entries(nativeSeries)){
    finiteSeries(native,'nativeSeries.'+organ);
    const candidate=candidateSeries[organ];
    if(!Array.isArray(candidate)){
      rows[organ]={status:'not-ported',passed:false};
      passed=false;
      continue;
    }
    finiteSeries(candidate,'candidateSeries.'+organ);
    if(candidate.length!==native.length) throw new Error('series length mismatch for '+organ);
    let maxAbs=0,maxRel=0,maxIndex=0;
    for(let i=0;i<native.length;i++){
      const abs=Math.abs(candidate[i]-native[i]);
      const rel=abs/Math.max(Math.abs(native[i]),1e-12);
      if(abs>maxAbs){maxAbs=abs;maxIndex=i;}
      if(rel>maxRel)maxRel=rel;
    }
    const ok=maxAbs<=absoluteToleranceMlPerMin||maxRel<=relativeTolerance;
    rows[organ]={status:'compared',passed:ok,maxAbsoluteErrorMlPerMin:maxAbs,maxRelativeError:maxRel,maxErrorSampleIndex:maxIndex};
    if(!ok)passed=false;
  }
  return Object.freeze({
    passed,
    absoluteToleranceMlPerMin,
    relativeTolerance,
    organs:Object.freeze(rows),
    rule:'No unported organ is treated as validated.',
  });
}

module.exports={compareNativeOrganFlowSeries};
