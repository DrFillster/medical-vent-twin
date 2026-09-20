[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$HumModRoot,
  [Parameter(Mandatory)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$hm = (Resolve-Path $HumModRoot).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$outDir = (Resolve-Path $OutputDirectory).Path
$solutionPath = Join-Path $outDir 'Vent.SOLN'
if (Test-Path $solutionPath) { throw 'Refusing to overwrite an existing solution export.' }
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class NativeWindow {
  public long Handle; public int Id; public string Class; public string Text;
}
public class NativeMenu {
  public uint Id; public string Path; public uint State;
}
public static class HumModNative {
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
  [DllImport("user32.dll")] static extern uint GetMenuState(IntPtr m, uint pos, uint flags);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetMenuString(IntPtr m, uint pos, StringBuilder text, int count, uint flags);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, string l);
  [DllImport("user32.dll", EntryPoint="SendMessageW")] static extern IntPtr SendValue(IntPtr h, uint msg, IntPtr w, IntPtr l);
  public static void TypeText(long handle, string text) {
    IntPtr h=new IntPtr(handle);
    SendValue(h,0xB1,IntPtr.Zero,new IntPtr(-1)); // EM_SETSEL
    SendValue(h,0x102,new IntPtr(8),IntPtr.Zero); // WM_CHAR backspace
    foreach(char c in text) SendValue(h,0x102,new IntPtr(c),IntPtr.Zero);
  }
  static NativeWindow Describe(IntPtr h) {
    var text = new StringBuilder(4096); var cls = new StringBuilder(256);
    GetWindowText(h, text, text.Capacity); GetClassName(h, cls, cls.Capacity);
    return new NativeWindow { Handle=h.ToInt64(), Id=GetDlgCtrlID(h), Class=cls.ToString(), Text=text.ToString() };
  }
  public static NativeWindow[] Windows(uint processId, bool children) {
    var rows = new List<NativeWindow>();
    EnumWindows((h, p) => { uint id; GetWindowThreadProcessId(h, out id);
      if (id==processId) { rows.Add(Describe(h));
        if(children) EnumChildWindows(h,(c, ignored)=>{rows.Add(Describe(c));return true;},IntPtr.Zero);
      } return true;
    },IntPtr.Zero); return rows.ToArray();
  }
  public static NativeWindow[] Children(long handle) {
    var rows = new List<NativeWindow>();
    EnumChildWindows(new IntPtr(handle),(h,p)=>{rows.Add(Describe(h));return true;},IntPtr.Zero);
    return rows.ToArray();
  }
  static void Walk(IntPtr m, string path, List<NativeMenu> rows) {
    for(int i=0; i<GetMenuItemCount(m); i++) {
      var text=new StringBuilder(512); GetMenuString(m,(uint)i,text,text.Capacity,0x400);
      var label=text.ToString().Replace("&", ""); var next=path+"/"+label;
      IntPtr sub=GetSubMenu(m,i);
      if(sub!=IntPtr.Zero) Walk(sub,next,rows);
      else rows.Add(new NativeMenu{Id=GetMenuItemID(m,i),Path=next,State=GetMenuState(m,(uint)i,0x400)});
    }
  }
  public static NativeMenu[] Menu(long handle) {
    var rows=new List<NativeMenu>(); Walk(GetMenu(new IntPtr(handle)),"",rows);return rows.ToArray();
  }
  public static void Command(long handle, uint command) {
    if(!PostMessage(new IntPtr(handle),0x111,new IntPtr(command),IntPtr.Zero)) throw new Exception("PostMessage failed");
  }
  public static void SetText(long handle, string text) {
    SendMessage(new IntPtr(handle),0xC,IntPtr.Zero,text);
  }
}
'@
$status = [ordered]@{
  schema='vent-hummod-native-export/v1'
  repository='riliescu/hummod-standalone'
  revision='8dab57e05631f779bf5020fe0dd51874d8ae98c1'
  scenarioApplied=$false
  outputCaptured=$false
  runtimeVerified=$false
}
$proc=$null
function Save-Diagnostics([string]$stage) {
  $data=[ordered]@{stage=$stage;windows=@([HumModNative]::Windows([uint32]$proc.Id,$true))}
  if($script:mainWindow) { $data.menu=@([HumModNative]::Menu($script:mainWindow.Handle)) }
  try {
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $names = @()
    foreach ($w in @([HumModNative]::Windows([uint32]$proc.Id,$false))) {
      $element=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$w.Handle)
      $descendants=$element.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
      foreach($child in $descendants) {
        if($child.Current.Name) { $names += $child.Current.Name }
      }
    }
    $data.accessibleNames=$names
    $fields=@()
    foreach($child in $descendants) {
      if($child.Current.ControlType -eq [System.Windows.Automation.ControlType]::ComboBox -or $child.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit) {
        $field=[ordered]@{name=$child.Current.Name;id=$child.Current.AutomationId;type=$child.Current.ControlType.ProgrammaticName}
        try { $field.value=$child.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value } catch {}
        try { $field.selection=@($child.GetCurrentPattern([System.Windows.Automation.SelectionPattern]::Pattern).GetCurrentSelection() | ForEach-Object { $_.Current.Name }) } catch {}
        $fields += $field
      }
    }
    $data.accessibleFields=$fields
  } catch { $data.accessibilityError=$_.Exception.Message }
  $data | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $outDir "$stage.json")
  $data | ConvertTo-Json -Depth 8 | Write-Output
}
try {
  $exe=Join-Path $hm 'HumMod.EXE'
  $status.executableSha256=(Get-FileHash $exe -Algorithm SHA256).Hash
  # Unmodified upstream model: the unsupported remote bootstrap is never injected.
  $proc=Start-Process -FilePath $exe -WorkingDirectory $hm -ArgumentList '<model> HumMod.DES </model>' -PassThru
  Start-Sleep -Seconds 10
  $script:mainWindow=@([HumModNative]::Windows([uint32]$proc.Id,$false) | Where-Object { $_.Class -eq 'HumMod' }) | Select-Object -First 1
  Save-Diagnostics 'loaded'
  if(-not $script:mainWindow) { throw 'HumMod main window did not load.' }
  $errors=@([HumModNative]::Windows([uint32]$proc.Id,$true) | Where-Object { $_.Text -match 'PARSER REPORT|Parsing Error' })
  if($errors.Count) { throw 'Native model parsing failed; see loaded.json.' }
  $menus=@([HumModNative]::Menu($script:mainWindow.Handle))
  $advance=@($menus | Where-Object { $_.Path -match '/Go/5 Min$' })
  if($advance.Count -ne 1) { throw 'Cannot identify unique Go / 5 Min command.' }
  $status.advanceCommand=$advance[0].Path
  [HumModNative]::Command($script:mainWindow.Handle,$advance[0].Id)
  Start-Sleep -Seconds 15
  Save-Diagnostics 'advanced'
  $save=@([HumModNative]::Menu($script:mainWindow.Handle) | Where-Object { $_.Path -match '(?i)/File/.*save.*sol' })
  if($save.Count -ne 1) { throw 'Cannot identify unique Save Solution command.' }
  $status.saveCommand=$save[0].Path
  [HumModNative]::Command($script:mainWindow.Handle,$save[0].Id)
  Start-Sleep -Seconds 3
  Save-Diagnostics 'save-dialog'
  $dialogs=@([HumModNative]::Windows([uint32]$proc.Id,$false) | Where-Object { $_.Class -eq '#32770' -and $_.Text -match '(?i)save' })
  if($dialogs.Count -ne 1) { throw 'Cannot identify unique native Save dialog.' }
  $dialog=$dialogs[0]
  $edits=@([HumModNative]::Children($dialog.Handle) | Where-Object { $_.Class -eq 'Edit' })
  $filename=@($edits | Where-Object { $_.Id -eq 1148 -or $_.Id -eq 1001 })
  if($filename.Count -ne 1) {
    if($edits.Count -eq 1) { $filename=$edits } else { throw 'Cannot identify filename edit control.' }
  }
  # WM_CHAR follows the edit/combo notification path used by real typing.
  # Quoting an absolute filename suppresses legacy default-extension rewriting.
  $filenameText='"' + $solutionPath + '"'
  [HumModNative]::TypeText($filename[0].Handle,$filenameText)
  $status.filenameEntered=$filenameText
  $button=@([HumModNative]::Children($dialog.Handle) | Where-Object { $_.Class -eq 'Button' -and $_.Id -eq 1 })
  if($button.Count -ne 1) { throw 'Cannot identify Save button.' }
  [HumModNative]::PostMessage([IntPtr]$button[0].Handle,0xF5,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null
  $deadline=(Get-Date).AddSeconds(60)
  $lastLength=-1
  while((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    if(Test-Path $solutionPath) {
      $length=(Get-Item $solutionPath).Length
      if($length -gt 0 -and $length -eq $lastLength) { break }
      $lastLength=$length
    }
  }
  Save-Diagnostics 'saved'
  if(-not (Test-Path $solutionPath)) { throw 'Native solution file was not created.' }
  # Native output already resides in the artifact directory.
  $status.outputBytes=(Get-Item $solutionPath).Length
  $status.outputSha256=(Get-FileHash $solutionPath -Algorithm SHA256).Hash
  $status.outputCaptured=$status.outputBytes -gt 0
  if(-not $status.outputCaptured) { throw 'Native solution is empty.' }
}
catch { $status.error=$_.Exception.Message; throw }
finally {
  if($proc) {
    if(-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  }
  $status | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $outDir 'native-export-status.json')
  $status | ConvertTo-Json -Depth 6 | Write-Output
}
