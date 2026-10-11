'use strict';

const assert=require('node:assert/strict');
const {patchReleaseProject}=require('../scripts/prepare-shimayoshi-release-build.js');

const xml=`<Project>
  <PropertyGroup Condition="'$(Configuration)|$(Platform)'=='Debug|x64'">
    <LibraryPath>$(SolutionDir)\\cvode\\lib;$(VC_LibraryPath_x64);$(WindowsSDK_LibraryPath_x64);$(LibraryPath)</LibraryPath>
    <IncludePath>$(SolutionDir)\\cvode\\include;$(VC_IncludePath);$(WindowsSDK_IncludePath);$(IncludePath)</IncludePath>
  </PropertyGroup>
  <ItemDefinitionGroup Condition="'$(Configuration)|$(Platform)'=='Release|x64'">
    <ClCompile>
      <WarningLevel>Level3</WarningLevel>
      <WholeProgramOptimization>true</WholeProgramOptimization>
    </ClCompile>
    <Link>
      <SubSystem>Console</SubSystem>
      <GenerateDebugInformation>true</GenerateDebugInformation>
    </Link>
  </ItemDefinitionGroup>
</Project>`;

const patched=patchReleaseProject(xml);
assert.match(patched,/Release\|x64/);
assert.match(patched,/sundials_cvode\.lib/);
assert.match(patched,/Release\|x64'">\n    <LibraryPath>/);
assert.match(patched,/cvode\\include/);
console.log('ok - Release x64 build reuses pinned upstream CVODE paths without physiology edits');
