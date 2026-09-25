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
}
public class NativeMenu {
  public uint Id;
  public string Path;
}
public static class HumModLiveSliderNative {
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
  [DllImport("user32.dll")] static extern int SetScrollPos(IntPtr hWnd, int nBar, int nPos, bool bRedraw);
  [DllImport("user32.dll")] static extern bool GetScrollInfo(IntPtr hwnd, int fnBar, ref SCROLLINFO lpsi);
  [DllImport("user32.dll", EntryPoint="SendMessageW")] static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
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

  static IntPtr MakeWParam(int low, int high) {
    long value=(long)((low & 0xffff) | ((high & 0xffff) << 16));
    return new IntPtr(value);
  }

  public static int[] ScrollInfo(long handle) {
    var info=new SCROLLINFO();
    info.cbSize=(uint)Marshal.SizeOf(typeof(SCROLLINFO));
    info.fMask=0x17; // SIF_RANGE | SIF_PAGE | SIF_POS | SIF_TRACKPOS
    if(!GetScrollInfo(new IntPtr(handle),2,ref info))
      throw new Exception("GetScrollInfo failed");
    return new int[]{info.nMin,info.nMax,(int)info.nPage,info.nPos,info.nTrackPos};
  }

  public static void SetHorizontalScroll(long handle,int pos) {
    IntPtr h=new IntPtr(handle);
    IntPtr parent=GetParent(h);
    SetScrollPos(h,2,pos,true);
    SendMessage(parent,0x114,MakeWParam(4,pos),h); // WM_HSCROLL / SB_THUMBPOSITION
    SendMessage(parent,0x114,MakeWParam(8,0),h);   // SB_ENDSCROLL
  }
}
'@

$proc=$null
try{
  $proc=Start-Process -FilePath $exe -WorkingDirectory $hm -ArgumentList '<model> HumMod.DES </model>' -PassThru
  Start-Sleep -Seconds 10

  $wins=@([HumModLiveSliderNative]::Windows([uint32]$proc.Id))
  $main=$wins | Where-Object { $_.Class -eq 'HumMod' } | Select-Object -First 1
  if(-not $main){throw 'HumMod main window not found'}

  $menu=@([HumModLiveSliderNative]::Menu($main.Handle))
  $thorax=@($menu | Where-Object { $_.Path -eq '/Physiology/Lungs/Thorax' })
  if($thorax.Count -ne 1){throw 'Thorax menu item not unique'}
  [HumModLiveSliderNative]::Command($main.Handle,$thorax[0].Id)
  Start-Sleep -Seconds 2

  $wins=@([HumModLiveSliderNative]::Windows([uint32]$proc.Id))
  $right=@($wins | Where-Object { $_.Id -eq 4220 -and $_.Class -eq 'ScrollBar' })
  $left=@($wins | Where-Object { $_.Id -eq 4233 -and $_.Class -eq 'ScrollBar' })
  if($right.Count -ne 1 -or $left.Count -ne 1){
    throw 'Pinned thorax scrollbar controls not found'
  }

  $before=[ordered]@{
    right=[HumModLiveSliderNative]::ScrollInfo($right[0].Handle)
    left=[HumModLiveSliderNative]::ScrollInfo($left[0].Handle)
  }

  # Display source defines -10 as first value, 30 x 1-mmHg steps.
  # Position 10 therefore requests 0 mmHg.
  [HumModLiveSliderNative]::SetHorizontalScroll($right[0].Handle,10)
  [HumModLiveSliderNative]::SetHorizontalScroll($left[0].Handle,10)
  Start-Sleep -Seconds 1

  $after=[ordered]@{
    right=[HumModLiveSliderNative]::ScrollInfo($right[0].Handle)
    left=[HumModLiveSliderNative]::ScrollInfo($left[0].Handle)
  }

  [ordered]@{
    schema='hummod-vent-core/live-thorax-slider-probe/v1'
    executableSha256=(Get-FileHash $exe -Algorithm SHA256).Hash
    processId=$proc.Id
    menuId=$thorax[0].Id
    rightControlId=$right[0].Id
    leftControlId=$left[0].Id
    before=$before
    requestedPosition=10
    requestedPleuralPressureMmHg=0
    after=$after
  } | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $out 'slider-status.json')

  # Leave process alive briefly so UI has completed its parameter callback.
  Start-Sleep -Seconds 2
}
finally{
  if($proc){
    $proc.Refresh()
    if(-not $proc.HasExited){Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue}
  }
}
