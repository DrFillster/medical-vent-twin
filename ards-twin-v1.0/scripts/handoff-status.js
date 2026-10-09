#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');

const p=path.resolve(__dirname,'../HANDOFF_RESULT.json');
if(!fs.existsSync(p)){
  console.log(JSON.stringify({status:'MISSING',path:p},null,2));
  process.exit(2);
}
const r=JSON.parse(fs.readFileSync(p,'utf8'));
const summary={
  schema:r.schema,
  status:r.status,
  sourceCommit:r.sourceCommit,
  buildCommit:r.buildCommit,
  previewDeploymentCommit:r.previewDeploymentCommit,
  focusedTestsPassed:r.focusedTests?.passed ?? null,
  fullTestSuitePassed:r.fullTestSuite?.passed ?? null,
  deployed:r.deployment?.deployed ?? false,
  previewUrl:r.deployment?.previewUrl ?? null,
  nativeArtifacts:r.nativeArtifacts ?? [],
  timestampUtc:r.timestampUtc,
};
console.log(JSON.stringify(summary,null,2));
