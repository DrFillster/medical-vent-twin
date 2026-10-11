#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const PINNED_SHA='6478d2ab0acbfc88d3da461d2594658bcb2798ca';

function replaceOnce(text,from,to,label){
  const i=text.indexOf(from);
  if(i<0) throw new Error('release-build anchor not found: '+label);
  if(text.indexOf(from,i+from.length)>=0){
    throw new Error('release-build anchor not unique: '+label);
  }
  return text.slice(0,i)+to+text.slice(i+from.length);
}

function patchReleaseProject(xml){
  const debugPaths=`  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Debug|x64'">
    <LibraryPath>$(SolutionDir)\\cvode\\lib;$(VC_LibraryPath_x64);$(WindowsSDK_LibraryPath_x64);$(LibraryPath)</LibraryPath>
    <IncludePath>$(SolutionDir)\\cvode\\include;$(VC_IncludePath);$(WindowsSDK_IncludePath);$(IncludePath)</IncludePath>
  </PropertyGroup>`;

  const releasePaths=`  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Release|x64'">
    <LibraryPath>$(SolutionDir)\\cvode\\lib;$(VC_LibraryPath_x64);$(WindowsSDK_LibraryPath_x64);$(LibraryPath)</LibraryPath>
    <IncludePath>$(SolutionDir)\\cvode\\include;$(VC_IncludePath);$(WindowsSDK_IncludePath);$(IncludePath)</IncludePath>
  </PropertyGroup>`;

  xml=replaceOnce(
    xml,
    debugPaths,
    debugPaths+'\n'+releasePaths,
    'Release x64 include/library paths'
  );

  const releaseLink=`    <Link>
      <SubSystem>Console</SubSystem>
      <GenerateDebugInformation>true</GenerateDebugInformation>
    </Link>`;

  const releaseLinkWithCvode=`    <Link>
      <SubSystem>Console</SubSystem>
      <GenerateDebugInformation>true</GenerateDebugInformation>
      <AdditionalDependencies>sundials_cvode.lib;$(CoreLibraryDependencies);%(AdditionalDependencies)</AdditionalDependencies>
    </Link>`;

  const releaseGroupStart=`  <ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Release|x64'">`;
  const start=xml.indexOf(releaseGroupStart);
  if(start<0) throw new Error('release-build anchor not found: Release x64 item group');
  const end=xml.indexOf('</ItemDefinitionGroup>',start);
  if(end<0) throw new Error('release-build anchor not found: Release x64 item group end');
  const before=xml.slice(0,start);
  let group=xml.slice(start,end+'</ItemDefinitionGroup>'.length);
  const after=xml.slice(end+'</ItemDefinitionGroup>'.length);
  group=replaceOnce(group,releaseLink,releaseLinkWithCvode,'Release x64 CVODE dependency');
  return before+group+after;
}

function main(argv=process.argv.slice(2)){
  const [upstreamRoot]=argv;
  if(!upstreamRoot){
    throw new Error('usage: prepare-shimayoshi-release-build.js <upstream-root>');
  }
  const root=path.resolve(upstreamRoot);
  const actual=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(actual!==PINNED_SHA){
    throw new Error('upstream SHA mismatch: expected '+PINNED_SHA+' got '+actual);
  }
  const projectPath=path.join(root,'simulator','simulator.vcxproj');
  const original=fs.readFileSync(projectPath,'utf8').replace(/\r\n/g,'\n');
  fs.writeFileSync(projectPath,patchReleaseProject(original));
  process.stdout.write(JSON.stringify({
    upstreamSha:actual,
    buildConfiguration:'Release|x64',
    physiologyChanged:false,
    modifiedFiles:['simulator/simulator.vcxproj'],
    note:'build metadata only: reuse bundled CVODE include/library paths and import library'
  },null,2)+'\n');
}

if(require.main===module){
  try{main();}
  catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}

module.exports=Object.freeze({PINNED_SHA,patchReleaseProject,main});
