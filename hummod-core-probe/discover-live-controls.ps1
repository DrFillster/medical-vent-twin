[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$HumModRoot,
  [Parameter(Mandatory)][string]$OutputDirectory
)

$ErrorActionPreference='Stop'
$hm=(Resolve-Path $HumModRoot).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$out=(Resolve-Path $OutputDirectory).Path
$exe=Join-Path $hm 'HumMod.EXE'

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class NativeWindow {
  public long Handle;
  public int Id;
  public string Class;
  public string Text;
}
public static class HumModUiProbeNative {
  public delegate bool Callback(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, Callback cb, IntPtr p);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder text, int count);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder text, int count);
  [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr h);

  static NativeWindow Describe(IntPtr h) {
    var text=new StringBuilder(4096);
    var cls=new StringBuilder(256);
    GetWindowText(h,text,text.Capacity);
    GetClassName(h,cls,cls.Capacity);
    return new NativeWindow {
      Handle=h.ToInt64(),
      Id=GetDlgCtrlID(h),
      Class=cls.ToString(),
      Text=text.ToString()
    };
  }

  public static NativeWindow[] Windows(uint processId) {
    var rows=new List<NativeWindow>();
    EnumWindows((h,p)=>{
      uint id; GetWindowThreadProcessId(h,out id);
      if(id==processId){
        rows.Add(Describe(h));
        EnumChildWindows(h,(c,ignored)=>{rows.Add(Describe(c));return true;},IntPtr.Zero);
      }
      return true;
    },IntPtr.Zero);
    return rows.ToArray();
  }
}
'@

function Dump-Automation([IntPtr]$handle,[string]$stage){
  $root=[System.Windows.Automation.AutomationElement]::FromHandle($handle)
  $rows=@()
  if($root){
    $all=$root.FindAll(
      [System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.Condition]::TrueCondition)
    foreach($el in $all){
      $row=[ordered]@{
        name=$el.Current.Name
        automationId=$el.Current.AutomationId
        className=$el.Current.ClassName
        controlType=$el.Current.ControlType.ProgrammaticName
        enabled=$el.Current.IsEnabled
        offscreen=$el.Current.IsOffscreen
      }
      foreach($pattern in @(
        [System.Windows.Automation.ValuePattern]::Pattern,
        [System.Windows.Automation.RangeValuePattern]::Pattern,
        [System.Windows.Automation.SelectionItemPattern]::Pattern,
        [System.Windows.Automation.InvokePattern]::Pattern,
        [System.Windows.Automation.TogglePattern]::Pattern,
        [System.Windows.Automation.ExpandCollapsePattern]::Pattern
      )){
        try{
          $p=$el.GetCurrentPattern($pattern)
          if($pattern -eq [System.Windows.Automation.ValuePattern]::Pattern){
            $row.value=$p.Current.Value
            $row.valueReadOnly=$p.Current.IsReadOnly
          } elseif($pattern -eq [System.Windows.Automation.RangeValuePattern]::Pattern){
            $row.rangeValue=$p.Current.Value
            $row.rangeMinimum=$p.Current.Minimum
            $row.rangeMaximum=$p.Current.Maximum
            $row.smallChange=$p.Current.SmallChange
            $row.largeChange=$p.Current.LargeChange
          } elseif($pattern -eq [System.Windows.Automation.SelectionItemPattern]::Pattern){
            $row.selected=$p.Current.IsSelected
          } elseif($pattern -eq [System.Windows.Automation.TogglePattern]::Pattern){
            $row.toggleState=[string]$p.Current.ToggleState
          } elseif($pattern -eq [System.Windows.Automation.ExpandCollapsePattern]::Pattern){
            $row.expandState=[string]$p.Current.ExpandCollapseState
          } elseif($pattern -eq [System.Windows.Automation.InvokePattern]::Pattern){
            $row.invokable=$true
          }
        }catch{}
      }
      $rows += $row
    }
  }
  $rows | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $out ("uia-"+$stage+".json"))
  return $rows
}

$proc=$null
try{
  $proc=Start-Process -FilePath $exe -WorkingDirectory $hm -ArgumentList '<model> HumMod.DES </model>' -PassThru
  Start-Sleep -Seconds 10

  $wins=@([HumModUiProbeNative]::Windows([uint32]$proc.Id))
  $wins | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $out 'native-windows.json')

  $main=$wins | Where-Object { $_.Class -eq 'HumMod' } | Select-Object -First 1
  if(-not $main){ throw 'HumMod main window not found' }

  $rows=Dump-Automation ([IntPtr]$main.Handle) 'main'

  $interesting=@($rows | Where-Object {
    $_.name -match '(?i)ventilat|thorax|lung|normal|rate|tidal|pressure|clinic|physiology'
  })
  $interesting | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $out 'interesting-controls.json')

  [ordered]@{
    schema='hummod-vent-core/live-control-discovery/v1'
    processId=$proc.Id
    executableSha256=(Get-FileHash $exe -Algorithm SHA256).Hash
    mainHandle=$main.Handle
    automationElementCount=$rows.Count
    interestingCount=$interesting.Count
    runtimeVerified=$true
  } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $out 'status.json')
}
finally{
  if($proc){
    $proc.Refresh()
    if(-not $proc.HasExited){ Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  }
}
