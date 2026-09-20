param(
  [Parameter(Mandatory)][string]$HumModRoot,
  [Parameter(Mandatory)][string]$BaselineSolution,
  [Parameter(Mandatory)][string]$SweepManifest,
  [Parameter(Mandatory)][string]$OutputDirectory
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$out=[IO.Path]::GetFullPath($OutputDirectory)
$scenarioDir=Join-Path $out 'scenarios'
New-Item -ItemType Directory -Force -Path $scenarioDir | Out-Null
node (Join-Path $root 'scripts/materialize-hummod-native-sweep.js') $SweepManifest $scenarioDir
$scenarioFiles=Get-ChildItem $scenarioDir -Filter '*.json' | Sort-Object Name
if(-not $scenarioFiles.Count){ throw 'No sweep scenarios materialized.' }
$results=@()
foreach($scenarioFile in $scenarioFiles){
  $scenario=Get-Content $scenarioFile.FullName -Raw | ConvertFrom-Json
  $caseName=[IO.Path]::GetFileNameWithoutExtension($scenarioFile.Name)
  $caseDir=Join-Path $out $caseName
  New-Item -ItemType Directory -Force -Path $caseDir | Out-Null
  $inputSolution=Join-Path $caseDir 'input.SOLN'
  node (Join-Path $root 'scripts/mutate-hummod-native-solution.js') $BaselineSolution $scenarioFile.FullName $inputSolution
  & (Join-Path $root 'scripts/export-hummod-native.ps1') -HumModRoot $HumModRoot -LoadSolution $inputSolution -OutputDirectory $caseDir
  node (Join-Path $root 'scripts/convert-hummod-native-solution.js') (Join-Path $caseDir 'Vent.SOLN') $caseDir $scenarioFile.FullName
  $results += [ordered]@{case=$caseName;scenarioId=$scenario.id;trajectory=(Join-Path $caseDir 'Vent.trajectory.json')}
}
$baseline=Join-Path $out 'baseline/Vent.trajectory.json'
if(-not (Test-Path $baseline)){ throw 'Sweep baseline trajectory was not produced.' }
foreach($r in $results){
  if($r.case -eq 'baseline'){ continue }
  $comparison=Join-Path (Split-Path $r.trajectory) 'comparison.json'
  node (Join-Path $root 'scripts/compare-hummod-trajectories.js') $baseline $r.trajectory $comparison
}
node (Join-Path $root 'scripts/summarize-hummod-native-sweep.js') $out (Join-Path $out 'sensitivity-summary.json')
$summary=[ordered]@{schema='vent-hummod-native-sweep-run/v1';caseCount=$results.Count;cases=$results;sensitivitySummary=(Join-Path $out 'sensitivity-summary.json');clinicalValidation=$false}
$summary | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $out 'sweep-run.json')
$summary | ConvertTo-Json -Depth 8
