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
    '<control.csv> <control-manifest.json> <challenge.csv> '+
    '<challenge-manifest.json> [output.json]'
  );
}

function main(argv=process.argv.slice(2)){
  if(argv.length<4||argv.length>5){
    usage();
    return 2;
  }
  const [
    controlPath,
    controlManifestPath,
    challengePath,
    challengeManifestPath,
    outputPath,
  ]=argv;
  const controlCsvText=fs.readFileSync(path.resolve(controlPath),'utf8');
  const challengeCsvText=fs.readFileSync(path.resolve(challengePath),'utf8');
  const controlManifest=JSON.parse(
    fs.readFileSync(path.resolve(controlManifestPath),'utf8')
  );
  const challengeManifest=JSON.parse(
    fs.readFileSync(path.resolve(challengeManifestPath),'utf8')
  );

  const result=buildSourceStressTrajectory({
    controlCsvText,
    challengeCsvText,
    controlManifest,
    challengeManifest,
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
