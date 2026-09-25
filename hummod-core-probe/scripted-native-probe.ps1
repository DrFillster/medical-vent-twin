[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$HumModRoot,
  [Parameter(Mandatory)][string]$OutputDirectory,
  [ValidateRange(10,120)][int]$TimeoutSeconds=45
)

$ErrorActionPreference='Stop'
$hm=(Resolve-Path $HumModRoot).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$outDir=(Resolve-Path $OutputDirectory).Path
$control=Join-Path $hm 'Control/Control.DES'
$exe=Join-Path $hm 'HumMod.EXE'
$output=Join-Path $outDir 'scripted-output.txt'
$statusPath=Join-Path $outDir 'scripted-probe-status.json'

if(Test-Path $output){ Remove-Item -Force $output }

$original=[IO.File]::ReadAllText($control)
if($original -notmatch '</control>'){ throw 'Control.DES has no closing control element' }
if($original -match '<scripted>'){ throw 'Expected pristine Control.DES without scripted block' }

function XmlEscape([string]$value){
  return [Security.SecurityElement]::Escape($value)
}

$escapedOutput=XmlEscape $output

$scripted=@"
<scripted>
  <setpagerstatus> OFF </setpagerstatus>
  <fileopencreate> $escapedOutput </fileopencreate>
  <fileroster>
    <variable><name> System.X </name></variable>
    <variable><name> Heart-Rate.Rate </name></variable>
    <variable><name> SystemicArtys.Pressure </name></variable>
    <variable><name> CardiacOutput.Flow(L/Min) </name></variable>
    <variable><name> PO2Artys.Pressure </name></variable>
    <variable><name> CO2Artys.Pressure </name></variable>
    <variable><name> BloodPh.ArtysPh </name></variable>
  </fileroster>
  <filewriteheader/>
  <fileupdate/>

  <def><name> Ventilator.Switch </name><val> TRUE </val></def>
  <def><name> Ventilator.Rate </name><val> 12 </val></def>
  <def><name> Ventilator.TidalVolume </name><val> 500 </val></def>
  <def><name> AirSupply-GasTanks.Switch </name><val> TRUE </val></def>
  <def><name> AirSupply-GasTanks.O2Valve(%) </name><val> 40 </val></def>
  <def><name> AirSupply-GasTanks.N2Valve(%) </name><val> 60 </val></def>
  <def><name> AirSupply-GasTanks.CO2Valve(%) </name><val> 0 </val></def>

  <advancefor>
    <solutionint> 0.1666666 </solutionint>
    <displayint> 0.0166666 </displayint>
    <storageint> 0.0166666 </storageint>
  </advancefor>

  <fileupdate/>
  <fileclose/>
</scripted>
"@

$modified=$original.Replace('</control>',($scripted+[Environment]::NewLine+'</control>'))
[IO.File]::WriteAllText($control,$modified,[Text.Encoding]::ASCII)

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class HumModProbeWindows {
  public delegate bool Callback(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, Callback cb, IntPtr p);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder text, int count);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder text, int count);
  static string Describe(IntPtr h) {
    var text=new StringBuilder(4096);
    var cls=new StringBuilder(256);
    GetWindowText(h,text,text.Capacity);
    GetClassName(h,cls,cls.Capacity);
    return cls.ToString()+": "+text.ToString();
  }
  public static string[] Read(uint processId) {
    var rows=new List<string>();
    EnumWindows((h,p)=>{
      uint id; GetWindowThreadProcessId(h,out id);
      if(id==processId){
        rows.Add(Describe(h));
        EnumChildWindows(h,(child,ignored)=>{
          rows.Add("  "+Describe(child));
          return true;
        },IntPtr.Zero);
      }
      return true;
    },IntPtr.Zero);
    return rows.ToArray();
  }
}
'@

$status=[ordered]@{
  schema='hummod-vent-core/scripted-native-probe/v1'
  upstreamRevision='8dab57e05631f779bf5020fe0dd51874d8ae98c1'
  executableSha256=(Get-FileHash $exe -Algorithm SHA256).Hash
  scriptedControlInjected=$true
  outputObserved=$false
  parserErrorObserved=$false
  runtimeVerified=$false
}
$proc=$null

try{
  $proc=Start-Process -FilePath $exe -WorkingDirectory $hm -ArgumentList '<model> HumMod.DES </model>' -PassThru
  $status.processId=$proc.Id

  $deadline=(Get-Date).AddSeconds($TimeoutSeconds)
  while((Get-Date) -lt $deadline){
    Start-Sleep -Milliseconds 500
    $proc.Refresh()

    $windows=@([HumModProbeWindows]::Read([uint32]$proc.Id))
    $parserErrors=@($windows | Where-Object { $_ -match 'PARSER REPORT|Parsing Error|Error 22' })
    if($parserErrors.Count){
      $status.parserErrorObserved=$true
      $status.parserErrors=$parserErrors
      break
    }

    if(Test-Path $output){
      $length=(Get-Item $output).Length
      if($length -gt 0){
        $status.outputObserved=$true
        $status.outputBytes=$length
        break
      }
    }

    if($proc.HasExited){
      $status.processExitedEarly=$true
      $status.processExitCode=$proc.ExitCode
      break
    }
  }

  if($proc -and -not $proc.HasExited){
    $status.windows=@([HumModProbeWindows]::Read([uint32]$proc.Id))
  }

  if($status.parserErrorObserved){
    throw 'Pinned HumMod executable rejected the scripted control block; see status diagnostics.'
  }
  if(-not $status.outputObserved){
    throw 'Pinned HumMod executable did not create scripted output within timeout.'
  }

  $status.outputSha256=(Get-FileHash $output -Algorithm SHA256).Hash
  $status.outputPreview=((Get-Content $output -TotalCount 20) -join [Environment]::NewLine)
  $status.runtimeVerified=$true
}
catch{
  $status.error=$_.Exception.Message
  throw
}
finally{
  if($proc){
    $proc.Refresh()
    if(-not $proc.HasExited){
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
  }
  [IO.File]::WriteAllText($control,$original,[Text.Encoding]::ASCII)
  $status | ConvertTo-Json -Depth 8 | Set-Content $statusPath
  $status | ConvertTo-Json -Depth 8 | Write-Output
}
