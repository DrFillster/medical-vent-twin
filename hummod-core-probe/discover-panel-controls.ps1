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
public class NativeMenu {
  public uint Id;
  public string Path;
}
public static class HumModPanelProbeNative {
  public delegate bool Callback(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, Callback cb, IntPtr p);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder text, int count);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder text, int count);
  [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetMenu(IntPtr h);
  [DllImport("user32.dll")] static extern int GetMenuItemCount(IntPtr m);
  [DllImport("user32.dll")] static extern IntPtr GetSubMenu(IntPtr m, int pos);
  [DllImport("user32.dll")] static extern uint GetMenuItemID(IntPtr m, int pos);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetMenuString(IntPtr m, uint pos, StringBuilder text, int count, uint flags);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);

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

  static void Walk(IntPtr m,string path,List<NativeMenu> rows){
    for(int i=0;i<GetMenuItemCount(m);i++){
      var text=new StringBuilder(512);
      GetMenuString(m,(uint)i,text,text.Capacity,0x400);
      var label=text.ToString().Replace("&","");
      var next=path+"/"+label;
      IntPtr sub=GetSubMenu(m,i);
      if(sub!=IntPtr.Zero) Walk(sub,next,rows);
      else rows.Add(new NativeMenu{Id=GetMenuItemID(m,i),Path=next});
    }
  }

  public static NativeMenu[] Menu(long handle){
    var rows=new List<NativeMenu>();
    Walk(GetMenu(new IntPtr(handle)),"",rows);
    return rows.ToArray();
  }

  public static void Command(long handle,uint command){
    if(!PostMessage(new IntPtr(handle),0x111,new IntPtr(command),IntPtr.Zero))
      throw new Exception("PostMessage failed");
  }
}
'@

function Dump-Panel([uint32]$processId,[long]$mainHandle,[string]$label){
  Start-Sleep -Seconds 2
  $native=@([HumModPanelProbeNative]::Windows($processId))
  $native | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $out ("native-"+$label+".json"))

  $root=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$mainHandle)
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
        bounds=[ordered]@{
          x=$el.Current.BoundingRectangle.X
          y=$el.Current.BoundingRectangle.Y
          width=$el.Current.BoundingRectangle.Width
          height=$el.Current.BoundingRectangle.Height
        }
      }
      try{
        $p=$el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        $row.value=$p.Current.Value
        $row.valueReadOnly=$p.Current.IsReadOnly
      }catch{}
      try{
        $p=$el.GetCurrentPattern([System.Windows.Automation.RangeValuePattern]::Pattern)
        $row.rangeValue=$p.Current.Value
        $row.rangeMinimum=$p.Current.Minimum
        $row.rangeMaximum=$p.Current.Maximum
        $row.smallChange=$p.Current.SmallChange
        $row.largeChange=$p.Current.LargeChange
      }catch{}
      try{
        $p=$el.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
        $row.toggleState=[string]$p.Current.ToggleState
      }catch{}
      try{
        $p=$el.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
        $row.selected=$p.Current.IsSelected
      }catch{}
      try{
        $p=$el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
        $row.invokable=$true
      }catch{}
      $rows += $row
    }
  }
  $rows | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $out ("uia-"+$label+".json"))
}

$proc=$null
try{
  $proc=Start-Process -FilePath $exe -WorkingDirectory $hm -ArgumentList '<model> HumMod.DES </model>' -PassThru
  Start-Sleep -Seconds 10

  $wins=@([HumModPanelProbeNative]::Windows([uint32]$proc.Id))
  $main=$wins | Where-Object { $_.Class -eq 'HumMod' } | Select-Object -First 1
  if(-not $main){ throw 'HumMod main window not found' }

  $menu=@([HumModPanelProbeNative]::Menu($main.Handle))
  $targets=@(
    [ordered]@{label='ventilator';path='/Clinic/Ventilator'},
    [ordered]@{label='thorax';path='/Physiology/Lungs/Thorax'},
    [ordered]@{label='pneumothorax';path='/Clinic/Pneumothorax'}
  )

  $summary=@()
  foreach($target in $targets){
    $m=@($menu | Where-Object { $_.Path -eq $target.path })
    if($m.Count -ne 1){ throw "Menu target not unique: $($target.path)" }
    [HumModPanelProbeNative]::Command($main.Handle,$m[0].Id)
    Dump-Panel ([uint32]$proc.Id) $main.Handle $target.label
    $summary += [ordered]@{
      label=$target.label
      path=$target.path
      commandId=$m[0].Id
    }
  }

  [ordered]@{
    schema='hummod-vent-core/panel-control-discovery/v1'
    processId=$proc.Id
    executableSha256=(Get-FileHash $exe -Algorithm SHA256).Hash
    panels=$summary
    runtimeVerified=$true
  } | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $out 'status.json')
}
finally{
  if($proc){
    $proc.Refresh()
    if(-not $proc.HasExited){ Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  }
}
