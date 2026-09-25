[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$HumModRoot,
  [Parameter(Mandatory)][string]$ToolRoot,
  [Parameter(Mandatory)][string]$OutputDirectory,
  [ValidateRange(15,120)][int]$TimeoutSeconds=60
)

$ErrorActionPreference='Stop'
$hm=(Resolve-Path $HumModRoot).Path
$tools=(Resolve-Path $ToolRoot).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$outDir=(Resolve-Path $OutputDirectory).Path

$solver=Join-Path $tools 'Model Solver.exe'
$controller=Join-Path $tools 'ScriptedController.exe'
$model=Join-Path $hm 'HumMod.DES'
$scriptPath=Join-Path $outDir 'full-hummod-probe.Script'
$dataPath=Join-Path $outDir 'full-hummod-probe.txt'
$statusPath=Join-Path $outDir 'modular-probe-status.json'

foreach($p in @($solver,$controller,$model)){
  if(-not (Test-Path $p)){ throw "Required file missing: $p" }
}
if(Test-Path $dataPath){ Remove-Item -Force $dataPath }

function XmlEscape([string]$value){ return [Security.SecurityElement]::Escape($value) }
$solverXml=XmlEscape $solver
$modelXml=XmlEscape $model
$dataXml=XmlEscape $dataPath

$script=@"
<script>
<launch>
  <solver> $solverXml </solver>
  <model> $modelXml </model>
</launch>
<roster>
  <var><name> System.X </name><format> 6 </format></var>
  <var><name> Heart-Rate.Rate </name><format> 6 </format></var>
  <var><name> SystemicArtys.Pressure </name><format> 6 </format></var>
  <var><name> CardiacOutput.Flow(L/Min) </name><format> 6 </format></var>
  <var><name> PO2Artys.Pressure </name><format> 6 </format></var>
  <var><name> CO2Artys.Pressure </name><format> 6 </format></var>
  <var><name> BloodPh.ArtysPh </name><format> 6 </format></var>
</roster>
<reset/>
<restart/>
<dumproster><filename> $dataXml </filename></dumproster>
<dumppoint><filename> $dataXml </filename><append/></dumppoint>
<setvalue><var> Ventilator.Switch </var><val> 1 </val></setvalue>
<setvalue><var> Ventilator.Rate </var><val> 12 </val></setvalue>
<setvalue><var> Ventilator.TidalVolume </var><val> 500 </val></setvalue>
<setvalue><var> AirSupply-GasTanks.Switch </var><val> 1 </val></setvalue>
<setvalue><var> AirSupply-GasTanks.O2Valve(%) </var><val> 40 </val></setvalue>
<setvalue><var> AirSupply-GasTanks.N2Valve(%) </var><val> 60 </val></setvalue>
<setvalue><var> AirSupply-GasTanks.CO2Valve(%) </var><val> 0 </val></setvalue>
<gofor>
  <solutionint> 0.1666666 </solutionint>
  <displayint> 0.1666666 </displayint>
</gofor>
<dumppoint><filename> $dataXml </filename><append/></dumppoint>
</script>
"@
[IO.File]::WriteAllText($scriptPath,$script,[Text.Encoding]::ASCII)

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class ProbeWindows {
 public delegate bool Callback(IntPtr h, IntPtr p);
 [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb, IntPtr p);
 [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, Callback cb, IntPtr p);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder text, int count);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder text, int count);
 static string D(IntPtr h){var t=new StringBuilder(4096);var c=new StringBuilder(256);GetWindowText(h,t,t.Capacity);GetClassName(h,c,c.Capacity);return c.ToString()+": "+t.ToString();}
 public static string[] Read(uint pid){var r=new List<string>();EnumWindows((h,p)=>{uint id;GetWindowThreadProcessId(h,out id);if(id==pid){r.Add(D(h));EnumChildWindows(h,(x,z)=>{r.Add("  "+D(x));return true;},IntPtr.Zero);}return true;},IntPtr.Zero);return r.ToArray();}
}
'@

$attempts=@(
  ('<script> '+$scriptPath+' </script>'),
  ('<root><script> '+$scriptPath+' </script></root>'),
  $scriptPath
)
$status=[ordered]@{
  schema='hummod-vent-core/modular-script-probe/v1'
  toolRepository='HumMod/small-stoch-model'
  toolRevision='a5e940445e5cd2d39f4e639b5a02e6b1966c85f5'
  modelRepository='riliescu/hummod-standalone'
  modelRevision='8dab57e05631f779bf5020fe0dd51874d8ae98c1'
  controllerSha256=(Get-FileHash $controller -Algorithm SHA256).Hash
  solverSha256=(Get-FileHash $solver -Algorithm SHA256).Hash
  modelPath=$model
  scriptPath=$scriptPath
  attempts=@()
  runtimeVerified=$false
}

foreach($arg in $attempts){
  if(Test-Path $dataPath){ Remove-Item -Force $dataPath }
  $rec=[ordered]@{ argument=$arg; outputObserved=$false }
  $proc=$null
  try{
    $proc=Start-Process -FilePath $controller -WorkingDirectory $tools -ArgumentList ('"'+$arg+'"') -PassThru
    $rec.processId=$proc.Id
    $deadline=(Get-Date).AddSeconds($TimeoutSeconds)
    while((Get-Date) -lt $deadline){
      Start-Sleep -Milliseconds 500
      $proc.Refresh()
      if(Test-Path $dataPath){
        $len=(Get-Item $dataPath).Length
        if($len -gt 0){$rec.outputObserved=$true;$rec.outputBytes=$len;break}
      }
      if($proc.HasExited){$rec.exited=$true;$rec.exitCode=$proc.ExitCode;break}
    }
    if(-not $proc.HasExited){$rec.windows=@([ProbeWindows]::Read([uint32]$proc.Id))}
    if($rec.outputObserved){
      $rec.preview=((Get-Content $dataPath -TotalCount 20) -join [Environment]::NewLine)
      $status.successfulArgument=$arg
      $status.outputSha256=(Get-FileHash $dataPath -Algorithm SHA256).Hash
      $status.outputPreview=$rec.preview
      $status.runtimeVerified=$true
      $status.attempts += $rec
      break
    }
  } catch { $rec.error=$_.Exception.Message }
  finally { if($proc){$proc.Refresh();if(-not $proc.HasExited){Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue}} }
  $status.attempts += $rec
}

$status | ConvertTo-Json -Depth 10 | Set-Content $statusPath
$status | ConvertTo-Json -Depth 10 | Write-Output
if(-not $status.runtimeVerified){throw 'No ScriptedController invocation produced full-HumMod output.'}
