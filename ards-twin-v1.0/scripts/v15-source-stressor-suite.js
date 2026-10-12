#!/usr/bin/env node
'use strict';

const {spawnSync}=require('node:child_process');
const path=require('node:path');

const root=path.resolve(__dirname,'..');

const jobs=[
  {
    id:'ursino-1998-hemorrhage',
    kind:'source-reproduction',
    script:'scripts/ursino-1998-closed-loop-challenge.js',
    source:'Ursino 1998 Fig. 9',
  },
  {
    id:'ursino-magosso-2000-deep-hypoxia',
    kind:'source-reproduction',
    script:'scripts/ursino-magosso-2000-fig11-expanded-reproduction.js',
    source:'Ursino & Magosso 2000 Fig. 11',
  },
  {
    id:'ursino-magosso-controlled-gas-stress',
    kind:'source-family-integration-audit',
    script:'scripts/ursino-magosso-gas-closed-loop-challenge.js',
    source:'Ursino/Magosso gas-autonomic cardiovascular family',
  },
  {
    id:'houssiere-2005-human-isocapnic-hypoxia',
    kind:'external-human-validation',
    script:'scripts/houssiere-2005-isocapnic-hypoxia-validation.js',
    source:'Houssiere et al. 2005',
  },
  {
    id:'physician-tachycardia-magnitude',
    kind:'physician-macro-validation',
    script:'scripts/v15-physician-tachycardia-audit.js',
    source:'source-backed candidate under physician challenge states',
  },
  {
    id:'chronotropy-coupling-localization',
    kind:'mechanism-localization',
    script:'scripts/v15-chronotropy-coupling-audit.js',
    source:'Ursino/Magosso 2000 autonomic and heart-period equations',
  },
];

function parseJson(stdout){
  const s=String(stdout||'').trim();
  if(!s) return null;
  try{return JSON.parse(s);}catch{}
  const first=s.indexOf('{');
  const last=s.lastIndexOf('}');
  if(first>=0&&last>first){
    try{return JSON.parse(s.slice(first,last+1));}catch{}
  }
  return null;
}

const results=[];
let failed=false;

for(const job of jobs){
  const run=spawnSync(process.execPath,[path.join(root,job.script)],{
    cwd:root,
    encoding:'utf8',
    timeout:240000,
    maxBuffer:16*1024*1024,
  });
  const ok=run.status===0&&!run.error;
  if(!ok) failed=true;
  results.push({
    ...job,
    status:ok?'completed':'failed',
    exitCode:run.status,
    error:run.error?run.error.message:null,
    parsed:parseJson(run.stdout),
    stderr:String(run.stderr||'').trim()||null,
  });
}

const out={
  schema:'v15-source-stressor-suite/v1',
  authority:'validation-harness-only',
  physiologyChanged:false,
  policy:{
    sourceReproduction:
      'Judge against the named source protocol and source-reported behavior.',
    externalHumanValidation:
      'Use as independent validation, not calibration.',
    physicianMacroValidation:
      'Judge integrated bedside plausibility without inventing endpoint overlays.',
    missingStressors:
      'Do not add a stressor until its protocol and expected behavior have source provenance.',
  },
  results,
};

console.log(JSON.stringify(out,null,2));
process.exitCode=failed?1:0;
