#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const files=['web/app.js','web/clinical-worker.js','web/worker.js'];

const failures=[];
for(const rel of files){
  const abs=path.join(root,rel);
  const source=fs.readFileSync(abs,'utf8');
  try{
    new vm.Script(source,{filename:abs});
  }catch(error){
    failures.push(rel+': '+error.name+': '+error.message);
  }
}

const report={
  schema:'vent-browser-js-verification/v1',
  files,
  valid:failures.length===0,
  failures,
};

console.log(JSON.stringify(report,null,2));
if(failures.length) process.exit(1);
