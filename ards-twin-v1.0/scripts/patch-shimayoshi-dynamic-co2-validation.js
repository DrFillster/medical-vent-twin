#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {
  PINNED_SHA,
  normalizeSourceText,
  patchProtocol,
  patchMain,
}=require('./patch-shimayoshi-source-grid.js');

const SCHEDULE=Object.freeze([
  Object.freeze({startS:0,endS:300,co2Percent:5,phase:'control'}),
  Object.freeze({startS:300,endS:420,co2Percent:15,phase:'acidosis'}),
  Object.freeze({startS:420,endS:540,co2Percent:25,phase:'acidosis'}),
  Object.freeze({startS:540,endS:660,co2Percent:10,phase:'acidosis'}),
  Object.freeze({startS:660,endS:780,co2Percent:30,phase:'acidosis'}),
  Object.freeze({startS:780,endS:900,co2Percent:20,phase:'acidosis'}),
  Object.freeze({startS:900,endS:null,co2Percent:5,phase:'control'}),
]);

function replaceOnce(text,from,to,label){
  const i=text.indexOf(from);
  if(i<0) throw new Error('patch anchor not found: '+label);
  if(text.indexOf(from,i+from.length)>=0){
    throw new Error('patch anchor not unique: '+label);
  }
  return text.slice(0,i)+to+text.slice(i+from.length);
}

function patchDynamicProtocol(modelText){
  let out=patchProtocol(modelText,'acidosis');

  const original=[
    '    const double t_AsidosisOn = 5.0 * 60 * 1000;   // 1 min control',
    '    const double t_Recovery2On = 15.0 * 60 * 1000;  // 10 min asidosis',
    '    const double tau_a = 10E3;',
    '',
    '    if (t >= t_AsidosisOn && t < t_Recovery2On) {',
    '',
    '        flagAsidosis = 1;',
    '        CO2o_p = CO2o_p2; // ',
    '    }',
    '    else {',
    '        flagAsidosis = 0;',
    '        CO2o_p = 5.0; //',
    '    }',
  ].join('\n');

  const replacement=[
    '    // Validation-only dynamic CO2 stimulus schedule.',
    '    // Source physiology equations are unchanged.',
    '    if (t < 300.0 * 1000.0) {',
    '        flagAsidosis = 0;',
    '        CO2o_p = 5.0;',
    '    } else if (t < 420.0 * 1000.0) {',
    '        flagAsidosis = 1;',
    '        CO2o_p = 15.0;',
    '    } else if (t < 540.0 * 1000.0) {',
    '        flagAsidosis = 1;',
    '        CO2o_p = 25.0;',
    '    } else if (t < 660.0 * 1000.0) {',
    '        flagAsidosis = 1;',
    '        CO2o_p = 10.0;',
    '    } else if (t < 780.0 * 1000.0) {',
    '        flagAsidosis = 1;',
    '        CO2o_p = 30.0;',
    '    } else if (t < 900.0 * 1000.0) {',
    '        flagAsidosis = 1;',
    '        CO2o_p = 20.0;',
    '    } else {',
    '        flagAsidosis = 0;',
    '        CO2o_p = 5.0;',
    '    }',
  ].join('\n');

  return replaceOnce(out,original,replacement,'dynamic CO2 source schedule');
}

function patchDynamicMain(mainText){
  let out=patchMain(mainText);
  // patchMain() returns generated C++ source.
  out=replaceOnce(
    out,
    'extern double CO2o_p2;',
    'extern double CO2o_p2;\nextern double CO2o_p;',
    'CO2 source observable declaration'
  );
  out=replaceOnce(
    out,
    'peak_Cyt_Cai_mM\\n");',
    'peak_Cyt_Cai_mM,source_CO2_percent\\n");',
    'dynamic CSV header'
  );
  out=replaceOnce(
    out,
    '%.17g,%.17g\\n",',
    '%.17g,%.17g,%.17g\\n",',
    'dynamic CSV format'
  );
  out=replaceOnce(
    out,
    'y[IDX_ATPTotal], y[IDX_PhosphoCreatine], v[IDX_PITotal], peakCai);',
    'y[IDX_ATPTotal], y[IDX_PhosphoCreatine], v[IDX_PITotal], peakCai, CO2o_p);',
    'dynamic CSV CO2 value'
  );
  return out;
}

function main(argv=process.argv.slice(2)){
  const [upstreamRoot]=argv;
  if(!upstreamRoot){
    throw new Error('usage: patch-shimayoshi-dynamic-co2-validation.js <upstream-root>');
  }
  const root=path.resolve(upstreamRoot);
  const actual=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(actual!==PINNED_SHA){
    throw new Error('upstream SHA mismatch: expected '+PINNED_SHA+' got '+actual);
  }

  const mainPath=path.join(root,'simulator','main.cpp');
  const modelPath=path.join(root,'simulator','model.cpp');
  const mainOriginal=normalizeSourceText(fs.readFileSync(mainPath,'utf8'));
  const modelOriginal=normalizeSourceText(fs.readFileSync(modelPath,'utf8'));

  fs.writeFileSync(mainPath,patchDynamicMain(mainOriginal));
  fs.writeFileSync(modelPath,patchDynamicProtocol(modelOriginal));

  process.stdout.write(JSON.stringify({
    upstreamSha:actual,
    protocol:'dynamic-respiratory-acidosis-validation',
    physiologyChanged:false,
    stimulusScheduleChanged:true,
    schedule:SCHEDULE,
    modifiedFiles:['simulator/main.cpp','simulator/model.cpp'],
    note:'cell equations unchanged; only source CO2 stimulus schedule and compact output instrumentation changed',
  },null,2)+'\n');
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({
  PINNED_SHA,
  SCHEDULE,
  patchDynamicProtocol,
  patchDynamicMain,
  main,
});
