[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$HumModRoot,
  [Parameter(Mandatory)][string]$BaselineSolution,
  [Parameter(Mandatory)][string]$OutputRoot,
  [int]$InterAdvanceDelayMilliseconds = 250
)
$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$suitePath=Join-Path $repo 'NATIVE_PERTURBATION_SUITE.json'
$suite=Get-Content $suitePath -Raw | ConvertFrom-Json
$baseline=(Resolve-Path $BaselineSolution).Path
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
$out=(Resolve-Path $OutputRoot).Path

foreach($case in $suite.scenarios){
  $scenarioPath=Join-Path $repo $case.scenarioFile
  $runDir=Join-Path $out $case.id
  New-Item -ItemType Directory -Force -Path $runDir | Out-Null
  $inputSoln=Join-Path $runDir 'scenario-input.SOLN'

  & node (Join-Path $repo 'scripts/mutate-hummod-native-solution.js') $baseline $scenarioPath $inputSoln
  if($LASTEXITCODE -ne 0){ throw "Scenario mutation failed: $($case.id)" }

  $exportArgs=@{
    HumModRoot=$HumModRoot
    LoadSolution=$inputSoln
    OutputDirectory=$runDir
    AdvanceMenuLabel='1 Sec'
    AdvanceCount=[int]$case.durationSec
    InterAdvanceDelayMilliseconds=$InterAdvanceDelayMilliseconds
  }
  & (Join-Path $repo 'scripts/export-hummod-native.ps1') @exportArgs

  & node (Join-Path $repo 'scripts/postprocess-v13-native-perturbation.js') $runDir $scenarioPath
  if($LASTEXITCODE -ne 0){ throw "Postprocessing failed: $($case.id)" }
}

& node (Join-Path $repo 'scripts/summarize-v13-native-perturbation-suite.js') $out
if($LASTEXITCODE -ne 0){ throw 'Suite summary failed' }
Write-Host "Native perturbation suite complete: $out"
