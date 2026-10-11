'use strict';

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}

function sourceChallengeCo2Percent(run){
  if(!run||
     run.status!=='shimayoshi-source-stress-trajectory-validated'||
     run.provenance?.protocolName!=='acidosis'||
     !Array.isArray(run.trajectory)||
     !run.trajectory.length){
    throw new Error('validated Shimayoshi acidosis source run is required');
  }
  const c=run.provenance.sourceChallengeCo2Percent;
  finite(c,'sourceChallengeCo2Percent');
  if(!(c>0)) throw new Error('sourceChallengeCo2Percent must be > 0');
  return c;
}

function bracket(sorted,value,label){
  if(value<sorted[0]||value>sorted[sorted.length-1]){
    throw new Error(label+' is outside validated source grid');
  }
  for(let i=0;i<sorted.length;i++){
    if(value===sorted[i]) return Object.freeze({lo:sorted[i],hi:sorted[i],fraction:0});
    if(value<sorted[i]){
      const lo=sorted[i-1],hi=sorted[i];
      return Object.freeze({lo,hi,fraction:(value-lo)/(hi-lo)});
    }
  }
  return Object.freeze({lo:sorted[sorted.length-1],hi:sorted[sorted.length-1],fraction:0});
}

function interpolateRowsAtTime(rows,timeS){
  finite(timeS,'sourceTimeS');
  if(timeS<rows[0].time_s||timeS>rows[rows.length-1].time_s){
    throw new Error('sourceTimeS is outside validated source trajectory');
  }
  let lo=rows[0],hi=rows[rows.length-1];
  for(let i=0;i<rows.length;i++){
    if(rows[i].time_s===timeS){
      return Object.freeze({...rows[i],interpolated:false});
    }
    if(rows[i].time_s>timeS){
      lo=rows[i-1];
      hi=rows[i];
      break;
    }
  }
  const f=(timeS-lo.time_s)/(hi.time_s-lo.time_s);
  const lerp=(a,b)=>a+(b-a)*f;
  const pHiAvailable=
    typeof lo.end_cycle_pHi==='number'&&Number.isFinite(lo.end_cycle_pHi)&&
    typeof hi.end_cycle_pHi==='number'&&Number.isFinite(hi.end_cycle_pHi);
  return Object.freeze({
    time_s:timeS,
    protocol:lo.protocol===hi.protocol?lo.protocol:'transition',
    peak_Fb_mN_per_mm2:lerp(lo.peak_Fb_mN_per_mm2,hi.peak_Fb_mN_per_mm2),
    stress_ratio:lerp(lo.stress_ratio,hi.stress_ratio),
    end_cycle_pHi:pHiAvailable
      ? lerp(lo.end_cycle_pHi,hi.end_cycle_pHi)
      : null,
    interpolated:true,
  });
}

function tableToRuns(table){
  if(!table||
     !['shimayoshi-acidosis-grid-table/v1','shimayoshi-acidosis-grid-table/v2','shimayoshi-acidosis-grid-table/v3'].includes(table.schema)||
     !Array.isArray(table.levels)||
     table.levels.length<2){
    throw new Error('validated Shimayoshi acidosis grid table is required');
  }
  if(table.closedLoopAuthority!==false){
    throw new Error('source grid table must not claim closed-loop authority');
  }

  if(table.schema==='shimayoshi-acidosis-grid-table/v1'){
    return table.levels.map(level=>Object.freeze({
      status:'shimayoshi-source-stress-trajectory-validated',
      provenance:Object.freeze({
        protocolName:'acidosis',
        sourceChallengeCo2Percent:level.sourceChallengeCo2Percent,
        upstreamGitSha:table.upstreamGitSha,
        cvodeTargetCadenceMs:level.cvodeTargetCadenceMs,
      }),
      referencePeakStressMnPerMm2:table.referencePeakFbMnPerMm2,
      trajectory:Object.freeze(level.rows.map(row=>Object.freeze({...row}))),
    }));
  }

  if(table.schema==='shimayoshi-acidosis-grid-table/v3'){
    const timing=table.protocolTimingS||{};
    if(typeof timing.acidosisOn!=='number'||typeof timing.recoveryOn!=='number'){
      throw new Error('v3 source grid table requires protocol timing');
    }
    return table.levels.map(level=>{
      if(!Array.isArray(level.keyframes)||level.keyframes.length<2){
        throw new Error('v3 source grid level requires at least two keyframes');
      }
      const trajectory=level.keyframes.map(pair=>{
        if(!Array.isArray(pair)||pair.length!==2){
          throw new Error('v3 source grid keyframe must be [time_s, stress_ratio]');
        }
        const [time_s,stress_ratio]=pair;
        if(typeof time_s!=='number'||!Number.isFinite(time_s)||time_s<0){
          throw new Error('v3 keyframe time must be finite and >= 0');
        }
        if(typeof stress_ratio!=='number'||!Number.isFinite(stress_ratio)||stress_ratio<0){
          throw new Error('v3 keyframe stress ratio must be finite and >= 0');
        }
        const protocol=time_s>=timing.acidosisOn&&time_s<timing.recoveryOn
          ? 'acidosis'
          : 'control';
        return Object.freeze({
          time_s,
          protocol,
          stress_ratio,
          peak_Fb_mN_per_mm2:stress_ratio*table.referencePeakFbMnPerMm2,
        });
      });
      for(let i=1;i<trajectory.length;i++){
        if(!(trajectory[i].time_s>trajectory[i-1].time_s)){
          throw new Error('v3 source grid keyframe times must increase strictly');
        }
      }
      return Object.freeze({
        status:'shimayoshi-source-stress-trajectory-validated',
        provenance:Object.freeze({
          protocolName:'acidosis',
          sourceChallengeCo2Percent:level.sourceChallengeCo2Percent,
          upstreamGitSha:table.upstreamGitSha,
          cvodeTargetCadenceMs:level.cvodeTargetCadenceMs,
        }),
        referencePeakStressMnPerMm2:table.referencePeakFbMnPerMm2,
        trajectory:Object.freeze(trajectory),
      });
    });
  }

  const g=table.timeGrid;
  if(!g||
     typeof g.startTimeS!=='number'||
     typeof g.timeStepS!=='number'||
     typeof g.count!=='number'||
     !(g.timeStepS>0)||
     !(g.count>=2)){
    throw new Error('v2 source grid table requires a valid timeGrid');
  }
  const timing=table.protocolTimingS||{};
  if(typeof timing.acidosisOn!=='number'||typeof timing.recoveryOn!=='number'){
    throw new Error('v2 source grid table requires protocol timing');
  }

  return table.levels.map(level=>{
    if(!Array.isArray(level.stressRatios)||level.stressRatios.length!==g.count){
      throw new Error('v2 source grid stressRatios must match timeGrid count');
    }
    const trajectory=level.stressRatios.map((stressRatio,i)=>{
      if(typeof stressRatio!=='number'||!Number.isFinite(stressRatio)||stressRatio<0){
        throw new Error('v2 source grid stress ratio must be finite and >= 0');
      }
      const time_s=g.startTimeS+i*g.timeStepS;
      const protocol=time_s>=timing.acidosisOn&&time_s<timing.recoveryOn
        ? 'acidosis'
        : 'control';
      return Object.freeze({
        time_s,
        protocol,
        stress_ratio:stressRatio,
        peak_Fb_mN_per_mm2:stressRatio*table.referencePeakFbMnPerMm2,
      });
    });
    return Object.freeze({
      status:'shimayoshi-source-stress-trajectory-validated',
      provenance:Object.freeze({
        protocolName:'acidosis',
        sourceChallengeCo2Percent:level.sourceChallengeCo2Percent,
        upstreamGitSha:table.upstreamGitSha,
        cvodeTargetCadenceMs:level.cvodeTargetCadenceMs,
      }),
      referencePeakStressMnPerMm2:table.referencePeakFbMnPerMm2,
      trajectory:Object.freeze(trajectory),
    });
  });
}

function createAcidosisGridSurrogateFromTable(table){
  return createAcidosisGridSurrogate(tableToRuns(table));
}

function createAcidosisGridSurrogate(runs){
  if(!Array.isArray(runs)||runs.length<2){
    throw new Error('at least two validated source challenge runs are required');
  }
  const map=new Map();
  for(const run of runs){
    const c=sourceChallengeCo2Percent(run);
    if(map.has(c)) throw new Error('duplicate sourceChallengeCo2Percent');
    map.set(c,run);
  }
  const levels=Object.freeze([...map.keys()].sort((a,b)=>a-b));

  function evaluate({sourceChallengeCo2Percent:co2,sourceTimeS}={}){
    finite(co2,'sourceChallengeCo2Percent');
    finite(sourceTimeS,'sourceTimeS');
    const cb=bracket(levels,co2,'sourceChallengeCo2Percent');
    const a=interpolateRowsAtTime(map.get(cb.lo).trajectory,sourceTimeS);
    if(cb.lo===cb.hi){
      return Object.freeze({
        sourceChallengeCo2Percent:co2,
        sourceTimeS,
        peakFbMnPerMm2:a.peak_Fb_mN_per_mm2,
        stressRatio:a.stress_ratio,
        sourcePhase:a.protocol,
        interpolatedChallenge:false,
        interpolatedTime:a.interpolated,
        closedLoopAuthority:false,
      });
    }
    const b=interpolateRowsAtTime(map.get(cb.hi).trajectory,sourceTimeS);
    const lerp=(x,y)=>x+(y-x)*cb.fraction;
    return Object.freeze({
      sourceChallengeCo2Percent:co2,
      sourceTimeS,
      peakFbMnPerMm2:lerp(a.peak_Fb_mN_per_mm2,b.peak_Fb_mN_per_mm2),
      stressRatio:lerp(a.stress_ratio,b.stress_ratio),
      sourcePhase:a.protocol===b.protocol?a.protocol:'transition',
      interpolatedChallenge:true,
      interpolatedTime:a.interpolated||b.interpolated,
      sourceBracket:Object.freeze({lo:cb.lo,hi:cb.hi,fraction:cb.fraction}),
      closedLoopAuthority:false,
    });
  }

  return Object.freeze({
    status:'shimayoshi-acidosis-grid-surrogate-shadow',
    sourceChallengeLevels:Object.freeze([...levels]),
    closedLoopAuthority:false,
    evaluate,
  });
}

module.exports=Object.freeze({
  sourceChallengeCo2Percent,
  bracket,
  interpolateRowsAtTime,
  createAcidosisGridSurrogate,
  tableToRuns,
  createAcidosisGridSurrogateFromTable,
});
