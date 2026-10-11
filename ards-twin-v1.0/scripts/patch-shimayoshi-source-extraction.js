#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const PINNED_SHA='6478d2ab0acbfc88d3da461d2594658bcb2798ca';

function replaceOnce(text,from,to,label){
  const i=text.indexOf(from);
  if(i<0) throw new Error('patch anchor not found: '+label);
  if(text.indexOf(from,i+from.length)>=0){
    throw new Error('patch anchor not unique: '+label);
  }
  return text.slice(0,i)+to+text.slice(i+from.length);
}

function normalizeSourceText(text){
  return text.replace(/\r\n/g,'\n');
}

function patchProtocol(modelText,protocol){
  const ischemiaOn=protocol==='ischemia';
  const acidosisOn=protocol==='acidosis';

  modelText=replaceOnce(
    modelText,
    '#define USE_ISCHEMIA_PROTOCOL\n#ifdef USE_ISCHEMIA_PROTOCOL',
    (ischemiaOn?'#define USE_ISCHEMIA_PROTOCOL':'//#define USE_ISCHEMIA_PROTOCOL')+
      '\n#ifdef USE_ISCHEMIA_PROTOCOL',
    'ischemia compile switch'
  );
  modelText=replaceOnce(
    modelText,
    '//#define USE_Acidosis_PROTOCOL\n#ifdef USE_Acidosis_PROTOCOL',
    (acidosisOn?'#define USE_Acidosis_PROTOCOL':'//#define USE_Acidosis_PROTOCOL')+
      '\n#ifdef USE_Acidosis_PROTOCOL',
    'acidosis compile switch'
  );
  return modelText;
}

function patchMain(mainText){
  mainText=replaceOnce(
    mainText,
    'int modelSim(double stepint, double period);//20210513',
    'int modelSim(double stepint, double period, const char* compactPath, const char* protocolLabel);//20210513',
    'modelSim declaration'
  );

  mainText=replaceOnce(
    mainText,
    'void SFChange(double SF[]);',
    [
      'void SFChange(double SF[]);',
      'extern int flagIschemia;',
      'extern int flagAsidosis;',
      'extern double CO2o_p2;',
      'const char* source_phase_label(const char* protocolLabel)',
      '{',
      '    if (strcmp(protocolLabel, "ischemia") == 0) {',
      '        if (flagIschemia == 1) return "ischemia";',
      '        if (flagIschemia == 2) return "reperfusion";',
      '        return "control";',
      '    }',
      '    if (strcmp(protocolLabel, "acidosis") == 0) {',
      '        return flagAsidosis == 1 ? "acidosis" : "control";',
      '    }',
      '    return "control";',
      '}'
    ].join('\n'),
    'source phase label helper'
  );

  mainText=replaceOnce(
    mainText,
    '    const double stepint = 0.1;  // <output interval (ms)> ',
    '    const double stepint = (argc > 4) ? atof(argv[4]) : 0.1; // runtime output/request cadence (ms)',
    'runtime output cadence'
  );

  mainText=replaceOnce(
    mainText,
    '    const double period = 3600; // <simulation period (s)>',
    [
      '    const double period = (argc > 1) ? atof(argv[1]) : 3600.0; // runtime-only duration',
      '    const char* compactPath = (argc > 2) ? argv[2] : "shimayoshi_cycles.csv";',
      '    const char* protocolLabel = (argc > 3) ? argv[3] : "source-protocol";',
      '    if (argc > 5) CO2o_p2 = atof(argv[5]); // source respiratory-acidosis challenge input (%)'
    ].join('\n'),
    'runtime output arguments'
  );

  mainText=replaceOnce(
    mainText,
    '    modelSim(stepint, period);',
    '    modelSim(stepint, period, compactPath, protocolLabel);',
    'modelSim call'
  );

  const legacyPostprocess=
    '    main_dump2csv_EB(period);\n    char ContChar[32] = "Cont";\n    FNchange(ContChar, 0);';
  const legacyLast=mainText.lastIndexOf(legacyPostprocess);
  if(legacyLast<0){
    throw new Error('patch anchor not found: live legacy binary dump post-processing');
  }
  mainText=
    mainText.slice(0,legacyLast)+
    '    // compact source extraction: legacy dump-to-CSV post-processing disabled'+
    mainText.slice(legacyLast+legacyPostprocess.length);

  const modelSimDefinition=/int\s+modelSim\s*\(\s*double\s+stepint\s*,\s*double\s+period\s*\)\s*\{/;
  if(!modelSimDefinition.test(mainText)){
    throw new Error('patch anchor not found: modelSim definition');
  }
  mainText=mainText.replace(
    modelSimDefinition,
    'int modelSim(double stepint, double period, const char* compactPath, const char* protocolLabel)\n{'
  );

  mainText=replaceOnce(
    mainText,
    '    FILE* DumpFile;//20210319',
    [
      '    FILE* DumpFile;//20210319',
      '    FILE* CompactFile;',
      '    double peakFb = 0.0;',
      '    double peakCai = 0.0;',
      '    double cycleStartHsmL = 0.0;',
      '    double minHsmL = 0.0;',
      '    double maxHsmL = 0.0;'
    ].join('\n'),
    'compact output declarations'
  );

  mainText=replaceOnce(
    mainText,
    '    DumpFile = fopen("C:/Simdata/dump.dat", "wb"); ',
    [
      '    DumpFile = fopen("NUL", "wb"); // preserve dump evaluation without large disk output',
      '    CompactFile = fopen(compactPath, "w");',
      '    if (!DumpFile || !CompactFile) {',
      '        fprintf(stderr, "failed to open output file\\n");',
      '        exit(1);',
      '    }',
      '    fprintf(CompactFile, "time_s,protocol,peak_Fb_mN_per_mm2,end_cycle_pHi,end_cycle_ExtCell_O2o_mM,end_cycle_O2i_mM,end_cycle_ATPTotal_mM,end_cycle_PCr_mM,end_cycle_Pi_mM,peak_Cyt_Cai_mM,start_cycle_hsmL_um,min_cycle_hsmL_um,max_cycle_hsmL_um,end_cycle_hsmL_um,end_cycle_hsmX_um\\n");'
    ].join('\n'),
    'output file open'
  );

  mainText=replaceOnce(
    mainText,
    [
      '    for (i = 0; i < NOPRungeKutta_; i++) {',
      '        rc = fscanf(Initial1, "%s%lf", x[i], &y[i]);',
      '    }',
      '',
      '    fclose(Initial1);'
    ].join('\n'),
    [
      '    for (i = 0; i < NOPRungeKutta_; i++) {',
      '        rc = fscanf(Initial1, "%s%lf", x[i], &y[i]);',
      '    }',
      '',
      '    fclose(Initial1);',
      '    cycleStartHsmL = y[IDX_hsmL];',
      '    minHsmL = y[IDX_hsmL];',
      '    maxHsmL = y[IDX_hsmL];'
    ].join('\n'),
    'sarcomere cycle initialization after source initial-state load'
  );

  mainText=replaceOnce(
    mainText,
    '        dump_results(DumpFile, tb + tr, y, v);',
    [
      '        {',
      '            double dyCompact[NOPRungeKutta_];',
      '            dydt(tb + tr, dyCompact, y, v);',
      '        }',
      '        if (v[IDX_Fb] > peakFb) peakFb = v[IDX_Fb];',
      '        if (v[IDX_Cyt_Cai] > peakCai) peakCai = v[IDX_Cyt_Cai];',
      '        if (y[IDX_hsmL] < minHsmL) minHsmL = y[IDX_hsmL];',
      '        if (y[IDX_hsmL] > maxHsmL) maxHsmL = y[IDX_hsmL];'
    ].join('\n'),
    'cycle peak tracking without binary dump I/O'
  );

  mainText=replaceOnce(
    mainText,
    '        if (fabs(tr - STIM_INTERVAL) <= DBL_EPSILON * STIM_INTERVAL) {',
    [
      '        if (fabs(tr - STIM_INTERVAL) <= DBL_EPSILON * STIM_INTERVAL) {',
      '            fprintf(CompactFile, "%.9g,%s,%.17g,%.17g,%.17g,%.17g,%.17g,%.17g,%.17g,%.17g,%.17g,%.17g,%.17g,%.17g,%.17g\\n",',
      '                (tb + tr) / 1000.0, source_phase_label(protocolLabel), peakFb,',
      '                v[IDX_Cyt_pHi], v[IDX_ExtCell_O2o], y[IDX_O2i],',
      '                y[IDX_ATPTotal], y[IDX_PhosphoCreatine], v[IDX_PITotal], peakCai,',
      '                cycleStartHsmL, minHsmL, maxHsmL, y[IDX_hsmL], y[IDX_hsmX]);',
      '            fflush(CompactFile);',
      '            peakFb = 0.0;',
      '            peakCai = 0.0;',
      '            cycleStartHsmL = y[IDX_hsmL];',
      '            minHsmL = y[IDX_hsmL];',
      '            maxHsmL = y[IDX_hsmL];'
    ].join('\n'),
    'cycle row output'
  );

  mainText=replaceOnce(
    mainText,
    '    fclose(DumpFile);\n    return 0;',
    '    fclose(DumpFile);\n    fclose(CompactFile);\n    return 0;',
    'compact output close'
  );

  return mainText;
}

function main(argv=process.argv.slice(2)){
  const [upstreamRoot,protocol='control']=argv;
  if(!upstreamRoot||!['control','acidosis','ischemia'].includes(protocol)){
    throw new Error('usage: patch-shimayoshi-source-extraction.js <upstream-root> <control|acidosis|ischemia>');
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

  fs.writeFileSync(mainPath,patchMain(mainOriginal));
  fs.writeFileSync(modelPath,patchProtocol(modelOriginal,protocol));

  process.stdout.write(JSON.stringify({
    upstreamSha:actual,
    protocol,
    physiologyChanged:false,
    modifiedFiles:['simulator/main.cpp','simulator/model.cpp'],
    note:'changes limited to protocol compile selection, runtime duration/output path, and cycle-level output instrumentation'
  },null,2)+'\n');
}

if(require.main===module){
  try{ main(); }
  catch(error){ console.error(error.stack||error.message); process.exitCode=1; }
}

module.exports=Object.freeze({PINNED_SHA,normalizeSourceText,patchProtocol,patchMain,main});
