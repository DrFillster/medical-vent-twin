#!/usr/bin/env node
'use strict';

const fs=require('node:fs');

const REQUIRED=[
  'System.X',
  'Heart-Rate.Rate',
  'CardiacOutput.Flow',
  'SANode-Rate.Rate',
  'SANode-Rate.Is_SinusRhythm',
  'Heart-Asystole.Is_Asystole',
  'LeftHeart-CO2.PCO2','RightHeart-CO2.PCO2',
  'LeftHeart-Lactate.[Lac-]','RightHeart-Lactate.[Lac-]',
  'LeftHeart-Ph.[SID]','RightHeart-Ph.[SID]',
  'LeftHeart-Ph.Ph','RightHeart-Ph.Ph',
  'LeftHeart-Function.PhEffect','RightHeart-Function.PhEffect',
  'LeftHeart-Function.Effect','RightHeart-Function.Effect',
  'LeftHeart-Function.Failed','RightHeart-Function.Failed',
];

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function firstIndex(values,predicate){
  for(let i=0;i<values.length;i++) if(predicate(values[i],i)) return i;
  return null;
}
function rowAt(v,i){
  const out={sampleIndex:i,timestampSec:v['System.X'][i]*60};
  for(const key of REQUIRED.slice(1)) out[key]=v[key][i];
  return out;
}
function delta(a,b){ return b-a; }
function relativeChange(a,b){ return a===0?null:(b-a)/Math.abs(a); }

function analyze(input){
  if(!input||input.format!=='lossless-numeric-extraction-of-native-SOLN'){
    throw new Error('lossless native HumMod variable extraction required');
  }
  const v=input.variables;
  if(!v||typeof v!=='object') throw new Error('variables object required');
  for(const key of REQUIRED){
    if(!Array.isArray(v[key])) throw new Error('missing required native variable: '+key);
  }
  const n=v['System.X'].length;
  for(const key of REQUIRED){
    if(v[key].length!==n) throw new Error(key+' sample count does not match System.X');
  }

  const idx={
    rightPhEffectBelow1:firstIndex(v['RightHeart-Function.PhEffect'],x=>x<0.999999),
    leftPhEffectBelow1:firstIndex(v['LeftHeart-Function.PhEffect'],x=>x<0.999999),
    rightFunctionBelowRecovery:firstIndex(v['RightHeart-Function.Effect'],x=>x<0.4),
    leftFunctionBelowRecovery:firstIndex(v['LeftHeart-Function.Effect'],x=>x<0.4),
    rightFunctionBelowFailure:firstIndex(v['RightHeart-Function.Effect'],x=>x<0.2),
    leftFunctionBelowFailure:firstIndex(v['LeftHeart-Function.Effect'],x=>x<0.2),
    rightFailed:firstIndex(v['RightHeart-Function.Failed'],x=>x!==0),
    leftFailed:firstIndex(v['LeftHeart-Function.Failed'],x=>x!==0),
    asystole:firstIndex(v['Heart-Asystole.Is_Asystole'],x=>x!==0),
    sinusLost:firstIndex(v['SANode-Rate.Is_SinusRhythm'],x=>x===0),
    actualHeartRateZero:firstIndex(v['Heart-Rate.Rate'],x=>x===0),
    cardiacOutputZero:firstIndex(v['CardiacOutput.Flow'],x=>x===0),
  };

  const events={};
  for(const [name,i] of Object.entries(idx)) events[name]=i==null?null:rowAt(v,i);

  const terminalIndex=idx.asystole==null?n-1:idx.asystole;
  const priorIndex=Math.max(0,terminalIndex-1);
  const baselineIndex=0;
  const summarizeSide=side=>{
    const pco2=side+'Heart-CO2.PCO2';
    const lac=side+'Heart-Lactate.[Lac-]';
    const sid=side+'Heart-Ph.[SID]';
    const ph=side+'Heart-Ph.Ph';
    const eff=side+'Heart-Function.Effect';
    return {
      baseline:{pco2:v[pco2][baselineIndex],lactate:v[lac][baselineIndex],sid:v[sid][baselineIndex],pH:v[ph][baselineIndex],functionEffect:v[eff][baselineIndex]},
      preterminal:{timestampSec:v['System.X'][priorIndex]*60,pco2:v[pco2][priorIndex],lactate:v[lac][priorIndex],sid:v[sid][priorIndex],pH:v[ph][priorIndex],functionEffect:v[eff][priorIndex]},
      terminal:{timestampSec:v['System.X'][terminalIndex]*60,pco2:v[pco2][terminalIndex],lactate:v[lac][terminalIndex],sid:v[sid][terminalIndex],pH:v[ph][terminalIndex],functionEffect:v[eff][terminalIndex]},
      baselineToPreterminal:{
        pco2Absolute:delta(v[pco2][baselineIndex],v[pco2][priorIndex]),
        lactateAbsolute:delta(v[lac][baselineIndex],v[lac][priorIndex]),
        sidAbsolute:delta(v[sid][baselineIndex],v[sid][priorIndex]),
        pHAbsolute:delta(v[ph][baselineIndex],v[ph][priorIndex]),
        pco2Relative:relativeChange(v[pco2][baselineIndex],v[pco2][priorIndex]),
        lactateRelative:relativeChange(v[lac][baselineIndex],v[lac][priorIndex]),
        sidRelative:relativeChange(v[sid][baselineIndex],v[sid][priorIndex]),
      },
    };
  };

  const sameTerminalSample=[idx.rightFailed,idx.leftFailed,idx.asystole,idx.sinusLost,idx.actualHeartRateZero,idx.cardiacOutputZero]
    .every(i=>i!=null&&i===terminalIndex);

  return {
    schema:'vent-v1.3-native-myocardial-collapse-analysis/v1',
    sampleCount:n,
    terminalIndex,
    terminalTimestampSec:v['System.X'][terminalIndex]*60,
    eventOrder:events,
    sourceMechanismChecks:{
      leftFailureAndAsystoleSameSample:idx.leftFailed!=null&&idx.leftFailed===idx.asystole,
      leftRightFailureSameSample:idx.leftFailed!=null&&idx.leftFailed===idx.rightFailed,
      rhythmAndPumpLossSameTerminalSample:sameTerminalSample,
      saNodeRateAtTerminal:finite(v['SANode-Rate.Rate'][terminalIndex],'terminal SA-node rate'),
      actualHeartRateAtTerminal:finite(v['Heart-Rate.Rate'][terminalIndex],'terminal actual HR'),
    },
    myocardialTrajectory:{left:summarizeSide('Left'),right:summarizeSide('Right')},
    interpretation:{
      observedOrdering:'progressive myocardial lactate increase and SID decrease precede local pH/function collapse in this native trajectory',
      causalityEstablished:false,
      reason:'native samples are sparse near the terminal transition; ordering does not prove which upstream term is causal',
      nextProbeRequirement:'repeat native extremis with denser sampling near myocardial failure and preserve the same upstream myocardial variables',
      modelPolicy:'do not tune reduced-model HR or substitute arterial pH; reproduce native myocardial state chain first',
    },
  };
}

if(require.main===module){
  const inputPath=process.argv[2], outputPath=process.argv[3];
  if(!inputPath) throw new Error('usage: node scripts/analyze-v13-native-myocardial-collapse.js <native-all-variables.json> [output.json]');
  const report=analyze(JSON.parse(fs.readFileSync(inputPath,'utf8')));
  const text=JSON.stringify(report,null,2)+'\n';
  if(outputPath) fs.writeFileSync(outputPath,text);
  else process.stdout.write(text);
}

module.exports={REQUIRED,analyze};
