#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  buildSourceStressTrajectory,
}=require('../src/shimayoshi_source_run.js');

function usage(){
  console.error(
    'Usage: node scripts/import-shimayoshi-source-run.js '+
    '<control.csv> <challenge.csv> <SHIMAYOSHI_SOURCE_RUN.json> [output.json]'
  );
}

function main(argv=process.argv.slice(2)){
  if(argv.length<3||argv.length>4){
    usage();
    return 2;
  }
  const [controlPath,challengePath,manifestPath,outputPath]=argv;
  const controlCsvText=fs.readFileSync(path.resolve(controlPath),'utf8');
  const challengeCsvText=fs.readFileSync(path.resolve(challengePath),'utf8');
  const manifest=JSON.parse(fs.readFileSync(path.resolve(manifestPath),'utf8'));

  const result=buildSourceStressTrajectory({
    controlCsvText,
    challengeCsvText,
    manifest,
  });

  const serialized=JSON.stringify(result,null,2)+'\n';
  if(outputPath){
    fs.writeFileSync(path.resolve(outputPath),serialized);
  }else{
    process.stdout.write(serialized);
  }
  return 0;
}

if(require.main===module){
  try{
    process.exitCode=main();
  }catch(error){
    console.error('Shimayoshi source-run import rejected: '+error.message);
    process.exitCode=1;
  }
}

module.exports=Object.freeze({main});
