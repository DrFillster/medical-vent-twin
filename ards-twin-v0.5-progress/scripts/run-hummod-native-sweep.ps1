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
  try {
    node (Join-Path $root 'scripts/mutate-hummod-native-solution.js') $BaselineSolution $scenarioFile.FullName $inputSolution
    if($LASTEXITCODE -ne 0){ throw "Scenario mutation failed with exit code $LASTEXITCODE" }
    & (Join-Path $root 'scripts/export-hummod-native.ps1') -HumModRoot $HumModRoot -LoadSolution $inputSolution -OutputDirectory $caseDir
    node (Join-Path $root 'scripts/convert-hummod-native-solution.js') (Join-Path $caseDir 'Vent.SOLN') $caseDir $scenarioFile.FullName
    if($LASTEXITCODE -ne 0){ throw "Trajectory conversion failed with exit code $LASTEXITCODE" }
    $results += [ordered]@{case=$caseName;scenarioId=$scenario.id;status='passed';trajectory=(Join-Path $caseDir 'Vent.trajectory.json');error=$null}
  }
  catch {
    $message=$_.Exception.Message
    Set-Content -Path (Join-Path $caseDir 'case-error.txt') -Value $message
    $results += [ordered]@{case=$caseName;scenarioId=$scenario.id;status='failed';trajectory=$null;error=$message}
    Write-Warning "Sweep case $caseName failed: $message"
  }
}
$baseline=Join-Path $out 'baseline/Vent.trajectory.json'
$baselineAvailable=Test-Path $baseline
if($baselineAvailable){
  foreach($r in $results){
    if($r.case -eq 'baseline' -or $r.status -ne 'passed'){ continue }
    try {
      $comparison=Join-Path (Split-Path $r.trajectory) 'comparison.json'
      node (Join-Path $root 'scripts/compare-hummod-trajectories.js') $baseline $r.trajectory $comparison
      if($LASTEXITCODE -ne 0){ throw "Comparison failed with exit code $LASTEXITCODE" }
    }
    catch {
      $r.status='comparison-failed'
      $r.error=$_.Exception.Message
      Set-Content -Path (Join-Path (Split-Path $r.trajectory) 'comparison-error.txt') -Value $r.error
    }
  }
}
$successfulComparisons=@($results | Where-Object { $_.case -ne 'baseline' -and $_.status -eq 'passed' -and (Test-Path (Join-Path (Split-Path $_.trajectory) 'comparison.json')) })
$sensitivitySummary=$null
if($successfulComparisons.Count -gt 0){
  $sensitivitySummary=Join-Path $out 'sensitivity-summary.json'
  node (Join-Path $root 'scripts/summarize-hummod-native-sweep.js') $out $sensitivitySummary
  if($LASTEXITCODE -ne 0){ $sensitivitySummary=$null }
}
$summary=[ordered]@{
  schema='vent-hummod-native-sweep-run/v1'
  caseCount=$results.Count
  passedCount=@($results | Where-Object { $_.status -eq 'passed' }).Count
  failedCount=@($results | Where-Object { $_.status -ne 'passed' }).Count
  baselineAvailable=$baselineAvailable
  cases=$results
  sensitivitySummary=$sensitivitySummary
  clinicalValidation=$false
}
$summary | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $out 'sweep-run.json')
$summary | ConvertTo-Json -Depth 8
