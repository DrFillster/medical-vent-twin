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
  public int Left;
  public int Top;
  public int Width;
  public int Height;
}
public class NativeMenu {
  public uint Id;
  public string Path;
}
public static class HumModMembraneProbeNative {
  public delegate bool Callback(IntPtr h, IntPtr p);
  [StructLayout(LayoutKind.Sequential)]
  public struct SCROLLINFO {
    public uint cbSize;
    public uint fMask;
    public int nMin;
    public int nMax;
    public uint nPage;
    public int nPos;
    public int nTrackPos;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

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
  [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetScrollInfo(IntPtr hwnd, int fnBar, ref SCROLLINFO lpsi);
  [DllImport("user32.dll")] static extern int SetScrollPos(IntPtr hWnd, int nBar, int nPos, bool bRedraw);
  [DllImport("user32.dll", EntryPoint="SendMessageW")] static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);

  static NativeWindow Describe(IntPtr h) {
    var text=new StringBuilder(4096);
    var cls=new StringBuilder(256);
    GetWindowText(h,text,text.Capacity);
    GetClassName(h,cls,cls.Capacity);
    RECT r; GetWindowRect(h,out r);
    return new NativeWindow {
      Handle=h.ToInt64(),
      Id=GetDlgCtrlID(h),
      Class=cls.ToString(),
      Text=text.ToString(),
      Left=r.Left,
      Top=r.Top,
      Width=r.Right-r.Left,
      Height=r.Bottom-r.Top
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

  static IntPtr MakeWParam(int low,int high){
    long value=(long)((low & 0xffff)|((high & 0xffff)<<16));
    return new IntPtr(value);
  }

  public static int[] ScrollInfo(long handle){
    var info=new SCROLLINFO();
    info.cbSize=(uint)Marshal.SizeOf(typeof(SCROLLINFO));
    info.fMask=0x17;
    if(!GetScrollInfo(new IntPtr(handle),2,ref info))
      throw new Exception("GetScrollInfo failed");
    return new int[]{info.nMin,info.nMax,(int)info.nPage,info.nPos,info.nTrackPos};
  }

  public static void SetHorizontalScroll(long handle,int pos){
    IntPtr h=new IntPtr(handle);
    IntPtr parent=GetParent(h);
    SetScrollPos(h,2,pos,true);
    SendMessage(parent,0x114,MakeWParam(4,pos),h);
    SendMessage(parent,0x114,MakeWParam(8,0),h);
  }
}
'@

function Invoke-NativeExport([string]$tag) {
  $script=Join-Path $PSScriptRoot 'native-session-host.ps1'
  if(-not (Test-Path $script)){ throw 'native-session-host.ps1 must be beside probe' }
}

function Parse-Latest([string]$path,[string]$symbol){
  $text=[IO.File]::ReadAllText($path)
  $escaped=[Regex]::Escape($symbol)
  $m=[Regex]::Match($text,"<var>\s*<name>\s*$escaped\s*</name>([\s\S]*?)</var>")
  if(-not $m.Success){ throw "symbol not found: $symbol" }
  $vals=[Regex]::Matches($m.Groups[1].Value,'<val>\s*([^<]+?)\s*</val>')
  if($vals.Count -eq 0){ throw "no values: $symbol" }
  return [double]::Parse($vals[$vals.Count-1].Groups[1].Value.Trim(),[Globalization.CultureInfo]::InvariantCulture)
}

$proc=$null
try{
  $proc=Start-Process -FilePath $exe -WorkingDirectory $hm -ArgumentList '<model> HumMod.DES </model>' -PassThru
  Start-Sleep -Seconds 10

  $wins=@([HumModMembraneProbeNative]::Windows([uint32]$proc.Id))
  $main=$wins | Where-Object { $_.Class -eq 'HumMod' } | Select-Object -First 1
  if(-not $main){throw 'HumMod main window not found'}

  $menu=@([HumModMembraneProbeNative]::Menu($main.Handle))
  $target=@($menu | Where-Object { $_.Path -eq '/Physiology/Lungs/Pulmonary Membrane' })
  if($target.Count -ne 1){throw 'Pulmonary Membrane menu item not unique'}
  [HumModMembraneProbeNative]::Command($main.Handle,$target[0].Id)
  Start-Sleep -Seconds 2

  $wins=@([HumModMembraneProbeNative]::Windows([uint32]$proc.Id))
  $scrolls=@($wins | Where-Object { $_.Class -eq 'ScrollBar' } | Sort-Object Top)
  $panelScrolls=@($scrolls | Where-Object { $_.Top -gt $main.Top -and $_.Top -lt ($main.Top+$main.Height) })

  $inventory=@($panelScrolls | ForEach-Object {
    [ordered]@{
      id=$_.Id
      handle=$_.Handle
      top=$_.Top
      left=$_.Left
      width=$_.Width
      height=$_.Height
      scrollInfo=[HumModMembraneProbeNative]::ScrollInfo($_.Handle)
    }
  })
  $inventory | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $out 'scrollbars.json')

  # On this panel there are exactly two source-defined slidebars.
  if($panelScrolls.Count -lt 2){throw "Expected at least two membrane scrollbars, found $($panelScrolls.Count)"}

  # Identify the two large horizontal panel controls by width, then vertical position.
  $candidates=@($panelScrolls | Where-Object { $_.Width -gt $_.Height } | Sort-Object Top)
  if($candidates.Count -ne 2){
    throw "Expected exactly two horizontal membrane slidebars, found $($candidates.Count)"
  }

  $area=$candidates[0]
  $thickness=$candidates[1]

  $before=[ordered]@{
    areaId=$area.Id
    area=[HumModMembraneProbeNative]::ScrollInfo($area.Handle)
    thicknessId=$thickness.Id
    thickness=[HumModMembraneProbeNative]::ScrollInfo($thickness.Handle)
  }

  # Source repeat lists:
  # TotalArea: 200 repeats, 1.0 step. Default 80.
  # Thickness-Structure: first 0.1, 49 repeats, 0.1 step. Default 0.6.
  # Use modest, reversible challenges.
  [HumModMembraneProbeNative]::SetHorizontalScroll($area.Handle,60)
  [HumModMembraneProbeNative]::SetHorizontalScroll($thickness.Handle,11)
  Start-Sleep -Seconds 1

  $after=[ordered]@{
    area=[HumModMembraneProbeNative]::ScrollInfo($area.Handle)
    thickness=[HumModMembraneProbeNative]::ScrollInfo($thickness.Handle)
  }

  [ordered]@{
    schema='hummod-vent-core/membrane-live-control-discovery/v1'
    processId=$proc.Id
    executableSha256=(Get-FileHash $exe -Algorithm SHA256).Hash
    upstreamRevision='8dab57e05631f779bf5020fe0dd51874d8ae98c1'
    menuId=$target[0].Id
    before=$before
    requested=[ordered]@{
      totalAreaPosition=60
      thicknessStructurePosition=11
    }
    after=$after
    controlsDiscovered=$true
  } | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $out 'membrane-control-status.json')

  Start-Sleep -Seconds 2
}
finally{
  if($proc){
    $proc.Refresh()
    if(-not $proc.HasExited){Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue}
  }
}
