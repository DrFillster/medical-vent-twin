[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$HumModRoot,
  [Parameter(Mandatory)][string]$SessionDirectory
)

$ErrorActionPreference = 'Stop'
$hm = (Resolve-Path $HumModRoot).Path
New-Item -ItemType Directory -Force -Path $SessionDirectory | Out-Null
$sessionDir = (Resolve-Path $SessionDirectory).Path
$exe = Join-Path $hm 'HumMod.EXE'

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
public static class HumModHostNative {
  public delegate bool Callback(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, Callback cb, IntPtr p);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder text, int count);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder text, int count);
  [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetDlgItem(IntPtr h, int id);
  [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr h);
  [DllImport("user32.dll")] static extern int GetScrollPos(IntPtr h, int bar);
  [DllImport("user32.dll")] static extern int SetScrollPos(IntPtr h, int bar, int pos, bool redraw);
  [DllImport("user32.dll")] static extern bool GetScrollRange(IntPtr h, int bar, out int min, out int max);
  [DllImport("user32.dll", EntryPoint="SendMessageW")] static extern IntPtr SendRaw(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr GetMenu(IntPtr h);
  [DllImport("user32.dll")] static extern int GetMenuItemCount(IntPtr m);
  [DllImport("user32.dll")] static extern IntPtr GetSubMenu(IntPtr m, int pos);
  [DllImport("user32.dll")] static extern uint GetMenuItemID(IntPtr m, int pos);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetMenuString(IntPtr m, uint pos, StringBuilder text, int count, uint flags);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [StructLayout(LayoutKind.Sequential)]
  struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", EntryPoint="SendMessageW")] static extern IntPtr SendValue(IntPtr h, uint msg, IntPtr w, IntPtr l);

  static NativeWindow Describe(IntPtr h) {
    var text = new StringBuilder(4096);
    var cls = new StringBuilder(256);
    GetWindowText(h, text, text.Capacity);
    GetClassName(h, cls, cls.Capacity);
    RECT r; GetWindowRect(h, out r);
    return new NativeWindow {
      Handle = h.ToInt64(),
      Id = GetDlgCtrlID(h),
      Class = cls.ToString(),
      Text = text.ToString(),
      Left = r.Left,
      Top = r.Top,
      Width = r.Right - r.Left,
      Height = r.Bottom - r.Top
    };
  }

  public static NativeWindow[] Windows(uint processId, bool children) {
    var rows = new List<NativeWindow>();
    EnumWindows((h, p) => {
      uint id;
      GetWindowThreadProcessId(h, out id);
      if (id == processId) {
        rows.Add(Describe(h));
        if (children) {
          EnumChildWindows(h, (c, ignored) => {
            rows.Add(Describe(c));
            return true;
          }, IntPtr.Zero);
        }
      }
      return true;
    }, IntPtr.Zero);
    return rows.ToArray();
  }

  public static NativeWindow[] Children(long handle) {
    var rows = new List<NativeWindow>();
    EnumChildWindows(new IntPtr(handle), (h,p) => {
      rows.Add(Describe(h));
      return true;
    }, IntPtr.Zero);
    return rows.ToArray();
  }

  static void Walk(IntPtr m, string path, List<NativeMenu> rows) {
    for (int i=0; i<GetMenuItemCount(m); i++) {
      var text = new StringBuilder(512);
      GetMenuString(m, (uint)i, text, text.Capacity, 0x400);
      var label = text.ToString().Replace("&", "");
      var next = path + "/" + label;
      IntPtr sub = GetSubMenu(m, i);
      if (sub != IntPtr.Zero) Walk(sub, next, rows);
      else rows.Add(new NativeMenu { Id = GetMenuItemID(m,i), Path = next });
    }
  }

  public static NativeMenu[] Menu(long handle) {
    var rows = new List<NativeMenu>();
    Walk(GetMenu(new IntPtr(handle)), "", rows);
    return rows.ToArray();
  }

  public static long Control(long parentHandle, int id) {
    return GetDlgItem(new IntPtr(parentHandle), id).ToInt64();
  }

  public static int ScrollPos(long handle) {
    return GetScrollPos(new IntPtr(handle), 2);
  }

  public static int[] ScrollRange(long handle) {
    int min, max;
    if (!GetScrollRange(new IntPtr(handle), 2, out min, out max)) {
      throw new Exception("GetScrollRange failed");
    }
    return new int[]{min,max};
  }

  public static void SetScroll(long handle, int pos) {
    IntPtr h = new IntPtr(handle);
    IntPtr parent = GetParent(h);
    SetScrollPos(h, 2, pos, true);
    long thumb = ((long)(pos & 0xffff) << 16) | 4; // SB_THUMBPOSITION
    PostMessage(parent, 0x0114, new IntPtr(thumb), h); // WM_HSCROLL / SB_THUMBPOSITION
    PostMessage(parent, 0x0114, new IntPtr(8), h);     // SB_ENDSCROLL
  }

  public static void Click(long handle) {
    PostMessage(new IntPtr(handle), 0x00F5, IntPtr.Zero, IntPtr.Zero); // BM_CLICK
  }

  public static void Command(long handle, uint command) {
    if (!PostMessage(new IntPtr(handle), 0x111, new IntPtr(command), IntPtr.Zero)) {
      throw new Exception("PostMessage failed");
    }
  }

  [DllImport("user32.dll", EntryPoint="SendMessageW", CharSet=CharSet.Unicode)]
  static extern IntPtr SendText(IntPtr h, uint msg, IntPtr w, string l);

  public static void SetText(long handle, string text) {
    SendText(new IntPtr(handle), 0x000C, IntPtr.Zero, text);
  }

  public static void DialogSetControlText(long handle, int controlId, string text) {
    // CDM_SETCONTROLTEXT = WM_USER + 100 + 4 = 0x0468.
    SendText(new IntPtr(handle), 0x0468, new IntPtr(controlId), text);
  }

  public static void TypeText(long handle, string text) {
    IntPtr h = new IntPtr(handle);
    SendValue(h, 0xB1, IntPtr.Zero, new IntPtr(-1));
    SendValue(h, 0x102, new IntPtr(8), IntPtr.Zero);
    foreach(char c in text) SendValue(h, 0x102, new IntPtr(c), IntPtr.Zero);
  }
}
'@

Add-Type -AssemblyName System.Windows.Forms

$proc = $null
$main = $null
$readCounter = 0

function Emit($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 10))
  [Console]::Out.Flush()
}

function Get-Menu([string]$path) {
  $matches = @([HumModHostNative]::Menu($main.Handle) | Where-Object { $_.Path -eq $path })
  if ($matches.Count -ne 1) { throw "Cannot identify unique menu command: $path" }
  return $matches[0]
}

function Set-FileDialogPath([long]$dialogHandle,[string]$value,[string]$purpose) {
  if(-not [HumModHostNative]::SetForegroundWindow([IntPtr]$dialogHandle)){
    throw "Cannot focus $purpose dialog"
  }
  Start-Sleep -Milliseconds 200
  [System.Windows.Forms.SendKeys]::SendWait('%n')
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  Start-Sleep -Milliseconds 100
  # The generated session paths contain no SendKeys metacharacters.
  [System.Windows.Forms.SendKeys]::SendWait($value)
  Start-Sleep -Milliseconds 200
}
function Wait-FileDialog([string]$purpose,[int]$timeoutSeconds=8) {
  $deadline=(Get-Date).AddSeconds($timeoutSeconds)
  while((Get-Date) -lt $deadline) {
    $dialogs=@([HumModHostNative]::Windows([uint32]$proc.Id,$false) |
      Where-Object { $_.Class -eq '#32770' })

    $scored=@()
    foreach($dialog in $dialogs) {
      $children=@([HumModHostNative]::Children($dialog.Handle))
      $filenameControls=@($children | Where-Object {
        $_.Id -eq 1148 -or $_.Id -eq 1152 -or $_.Id -eq 1001
      })
      if($filenameControls.Count -gt 0) {
        $scored += [pscustomobject]@{
          Dialog=$dialog
          Children=$children
          Score=$filenameControls.Count
        }
      }
    }

    if($scored.Count -eq 1) { return $scored[0].Dialog }
    if($scored.Count -gt 1) {
      $exact=@($scored | Where-Object { $_.Score -eq 1 })
      if($exact.Count -eq 1) { return $exact[0].Dialog }
    }
    if($dialogs.Count -eq 1) { return $dialogs[0] }

    Start-Sleep -Milliseconds 250
  }

  $windows=@([HumModHostNative]::Windows([uint32]$proc.Id,$true))
  $summary=($windows | ForEach-Object {
    ('class=' + $_.Class + ',id=' + $_.Id + ',text=' + $_.Text)
  }) -join '; '
  throw ("Timed out waiting for "+$purpose+" dialog. Windows: "+$summary)
}


function Wait-FilenameEdit([long]$dialogHandle,[string]$purpose,[int]$timeoutSeconds=10) {
  $deadline=(Get-Date).AddSeconds($timeoutSeconds)
  while((Get-Date) -lt $deadline) {
    $edits=@([HumModHostNative]::Children($dialogHandle) |
      Where-Object { $_.Class -eq 'Edit' })
    $preferred=@($edits | Where-Object { $_.Id -eq 1148 -or $_.Id -eq 1001 })
    if($preferred.Count -eq 1){ return $preferred[0] }
    if($edits.Count -eq 1){ return $edits[0] }
    Start-Sleep -Milliseconds 250
  }

  $children=@([HumModHostNative]::Children($dialogHandle))
  $summary=($children | ForEach-Object {
    ('class=' + $_.Class + ',id=' + $_.Id + ',text=' + $_.Text)
  }) -join '; '
  throw ("Cannot identify "+$purpose+" filename edit control. Children: "+$summary)
}

function Describe-Children([long]$dialogHandle) {
  return @([HumModHostNative]::Children($dialogHandle) | ForEach-Object {
    [ordered]@{Handle=$_.Handle;Id=$_.Id;Class=$_.Class;Text=$_.Text}
  })
}

function Find-FilenameEdit([long]$dialogHandle) {
  $children=@([HumModHostNative]::Children($dialogHandle))
  $edits=@($children | Where-Object { $_.Class -eq 'Edit' })
  $preferred=@($edits | Where-Object { $_.Id -eq 1148 -or $_.Id -eq 1001 })
  if($preferred.Count -eq 1){ return $preferred[0] }

  # Common Windows file-dialog layouts can expose several Edit controls.
  # Prefer a nonempty edit whose text resembles a filename/path field.
  $textual=@($edits | Where-Object {
    $_.Text -and ($_.Text -match '\\|/|\.SOLN|File name|filename')
  })
  if($textual.Count -eq 1){ return $textual[0] }

  # Fall back to the largest/direct filename candidate by control id ordering.
  # We still fail loudly if no Edit exists.
  if($edits.Count -gt 0){
    return ($edits | Sort-Object Id -Descending | Select-Object -First 1)
  }
  throw 'Cannot identify filename edit control.'
}


function Save-DialogDiagnostics([long]$dialogHandle,[string]$stage) {
  $data=[ordered]@{
    stage=$stage
    nativeChildren=@(Describe-Children $dialogHandle)
    automationFields=@()
  }
  try {
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $root=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$dialogHandle)
    $desc=$root.FindAll(
      [System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.Condition]::TrueCondition)
    foreach($el in $desc){
      if($el.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit -or
         $el.Current.ControlType -eq [System.Windows.Automation.ControlType]::ComboBox -or
         $el.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button){
        $row=[ordered]@{
          name=$el.Current.Name
          automationId=$el.Current.AutomationId
          className=$el.Current.ClassName
          controlType=$el.Current.ControlType.ProgrammaticName
          enabled=$el.Current.IsEnabled
        }
        try {
          $row.value=$el.GetCurrentPattern(
            [System.Windows.Automation.ValuePattern]::Pattern).Current.Value
        } catch {}
        $data.automationFields += $row
      }
    }
  } catch {
    $data.automationError=$_.Exception.Message
  }
  $path=Join-Path $sessionDir ("dialog-"+$stage+".json")
  $data | ConvertTo-Json -Depth 8 | Set-Content $path
}

function Set-FileDialogFilename([long]$dialogHandle,[string]$filename,[string]$stage) {
  Save-DialogDiagnostics $dialogHandle $stage
  try {
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $root=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$dialogHandle)
    $desc=$root.FindAll(
      [System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.Condition]::TrueCondition)

    $edits=@()
    foreach($el in $desc){
      if($el.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit){
        try {
          $pattern=$el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
          if($pattern){ $edits += $el }
        } catch {}
      }
    }

    $preferred=@($edits | Where-Object {
      $_.Current.AutomationId -eq '1001' -or
      $_.Current.AutomationId -eq '1148' -or
      $_.Current.Name -match '(?i)file\s*name|filename'
    })

    $target=$null
    if($preferred.Count -eq 1){ $target=$preferred[0] }
    elseif($edits.Count -eq 1){ $target=$edits[0] }
    elseif($preferred.Count -gt 1){ $target=$preferred[0] }

    if($null -ne $target){
      $vp=$target.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
      $vp.SetValue($filename)
      return
    }
  } catch {}

  # Fallback to the native edit-control path proven by the earlier exporter.
  $native=Find-FilenameEdit $dialogHandle
  [HumModHostNative]::TypeText($native.Handle,$filename)
}

function Wait-StableFile([string]$path, [int]$timeoutSeconds = 20) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  $lastLength = -1
  while((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 300
    if(Test-Path $path) {
      $length = (Get-Item $path).Length
      if($length -gt 0 -and $length -eq $lastLength) { return }
      $lastLength = $length
    }
  }
  throw "Timed out waiting for file: $path; inspect dialog diagnostics in $sessionDir"
}

function Save-Solution([string]$path) {
  if(Test-Path $path) { Remove-Item -Force $path }

  $save=@([HumModHostNative]::Menu($main.Handle) |
    Where-Object { $_.Path -match '(?i)/File/.*save.*sol' })
  if($save.Count -ne 1){ throw 'Cannot identify unique Save Solution command.' }

  [HumModHostNative]::Command($main.Handle,$save[0].Id)
  # Proven native exporter timing for this exact pinned HumMod executable.
  Start-Sleep -Seconds 3

  $dialogs=@([HumModHostNative]::Windows([uint32]$proc.Id,$false) |
    Where-Object { $_.Class -eq '#32770' -and $_.Text -match '(?i)save' })
  if($dialogs.Count -ne 1){ throw 'Cannot identify unique native Save dialog.' }

  $dialog=$dialogs[0]
  Save-DialogDiagnostics $dialog.Handle 'save'
  $filename=Wait-FilenameEdit $dialog.Handle 'Save Solution'

  # This exact WM_CHAR path produced the verified native HumMod export.
  $filenameText='"' + $path + '"'
  [HumModHostNative]::TypeText($filename.Handle,$filenameText)

  $children=@([HumModHostNative]::Children($dialog.Handle))
  $button=@($children | Where-Object { $_.Class -eq 'Button' -and $_.Id -eq 1 })
  if($button.Count -ne 1){ throw 'Cannot identify Save button.' }
  [HumModHostNative]::PostMessage(
    [IntPtr]$button[0].Handle,0xF5,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null

  Wait-StableFile $path 60
}

function Load-Solution([string]$path) {
  $resolved=(Resolve-Path $path).Path
  $load=Get-Menu '/File/Load Solution'
  [HumModHostNative]::Command($main.Handle,$load.Id)
  Start-Sleep -Seconds 3

  $dialogs=@([HumModHostNative]::Windows([uint32]$proc.Id,$false) |
    Where-Object { $_.Class -eq '#32770' -and $_.Text -match '(?i)load|open' })
  if($dialogs.Count -ne 1){ throw 'Cannot identify unique native Load Solution dialog.' }

  $dialog=$dialogs[0]
  Save-DialogDiagnostics $dialog.Handle 'load'
  $filename=Wait-FilenameEdit $dialog.Handle 'Load Solution'
  [HumModHostNative]::TypeText($filename.Handle,('"' + $resolved + '"'))

  $children=@([HumModHostNative]::Children($dialog.Handle))
  $button=@($children | Where-Object { $_.Class -eq 'Button' -and $_.Id -eq 1 })
  if($button.Count -ne 1){ throw 'Cannot identify Load button.' }
  [HumModHostNative]::PostMessage(
    [IntPtr]$button[0].Handle,0xF5,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null

  Start-Sleep -Seconds 8
  $errors=@([HumModHostNative]::Windows([uint32]$proc.Id,$true) |
    Where-Object { $_.Text -match 'PARSER REPORT|Parsing Error' })
  if($errors.Count){ throw 'HumMod reported a solution-load parser error.' }
}

function Get-LatestValue([string]$text,[string]$symbol) {
  $escaped = [Regex]::Escape($symbol)
  $m = [Regex]::Match($text,"<var>\s*<name>\s*$escaped\s*</name>([\s\S]*?)</var>")
  if(-not $m.Success) { throw "HumMod symbol not found: $symbol" }
  $vals = [Regex]::Matches($m.Groups[1].Value,'<val>\s*([^<]+?)\s*</val>')
  if($vals.Count -eq 0) { throw "No values for HumMod symbol: $symbol" }
  $value = 0.0
  if(-not [double]::TryParse(
      $vals[$vals.Count-1].Groups[1].Value.Trim(),
      [Globalization.NumberStyles]::Float,
      [Globalization.CultureInfo]::InvariantCulture,
      [ref]$value)) {
    throw "Non-numeric value for HumMod symbol: $symbol"
  }
  return $value
}

function Snapshot([string[]]$symbols) {
  $script:readCounter += 1
  $path = Join-Path $sessionDir ("read-" + $script:readCounter + ".SOLN")
  Save-Solution $path
  $text = [IO.File]::ReadAllText($path)
  $state = [ordered]@{}
  foreach($symbol in $symbols) { $state[$symbol] = Get-LatestValue $text $symbol }
  $systemX = Get-LatestValue $text 'System.X'
  return [ordered]@{
    simulationTimeSec = $systemX * 60.0
    state = $state
  }
}

function Replace-SolutionSeries([string]$text,[string]$symbol,[double]$value) {
  $escaped=[Regex]::Escape($symbol)
  $pattern="(<var>\s*<name>\s*$escaped\s*</name>)([\s\S]*?)(</var>)"
  $m=[Regex]::Match($text,$pattern)
  if(-not $m.Success){ throw "HumMod parameter not found in solution: $symbol" }
  $vals=[Regex]::Matches($m.Groups[2].Value,'<val>\s*[^<]+?\s*</val>')
  if($vals.Count -eq 0){ throw "HumMod parameter has no solution values: $symbol" }
  $formatted=$value.ToString("R",[Globalization.CultureInfo]::InvariantCulture)
  $replacement="`n"+(("<val> "+$formatted+" </val>`n")*$vals.Count)
  return $text.Substring(0,$m.Index)+$m.Groups[1].Value+$replacement+$m.Groups[3].Value+$text.Substring($m.Index+$m.Length)
}

$allowedSetSymbols=@{
  'Ventilator.Switch'=@{min=0.0;max=1.0;integer=$true}
  'Ventilator.Rate'=@{min=0.0;max=[double]::PositiveInfinity;integer=$false}
  'Ventilator.TidalVolume'=@{min=0.0;max=[double]::PositiveInfinity;integer=$false}
  'AirSupply-GasTanks.Switch'=@{min=0.0;max=1.0;integer=$true}
  'AirSupply-GasTanks.O2Valve(%)'=@{min=0.0;max=100.0;integer=$false}
  'AirSupply-GasTanks.N2Valve(%)'=@{min=0.0;max=100.0;integer=$false}
  'AirSupply-GasTanks.CO2Valve(%)'=@{min=0.0;max=100.0;integer=$false}
  'LeftHemithorax.NormalPressure'=@{min=[double]::NegativeInfinity;max=[double]::PositiveInfinity;integer=$false}
  'RightHemithorax.NormalPressure'=@{min=[double]::NegativeInfinity;max=[double]::PositiveInfinity;integer=$false}
  'PulmonaryMembrane.TotalArea'=@{min=0.0;max=200.0;integer=$false}
  'PulmonaryMembrane.Thickness-Structure'=@{min=0.1;max=5.0;integer=$false}
  'ExcessLungWater.Perm'=@{min=0.0;max=20.0;integer=$false}
}


function Open-Panel([string]$path) {
  $menu=Get-Menu $path
  [HumModHostNative]::Command($main.Handle,$menu.Id)
  Start-Sleep -Milliseconds 500
}

function Native-Control([int]$id,[string]$label) {
  $handle=[HumModHostNative]::Control($main.Handle,$id)
  if($handle -eq 0){ throw "Cannot locate live control $label (id=$id)" }
  return $handle
}

function Set-LiveScrollByPosition([int]$id,[int]$position,[string]$label) {
  $handle=Native-Control $id $label
  $range=[HumModHostNative]::ScrollRange($handle)
  if($position -lt $range[0] -or $position -gt $range[1]){
    throw "$label position $position outside native scrollbar range $($range[0])..$($range[1])"
  }
  [HumModHostNative]::SetScroll($handle,$position)
  Start-Sleep -Milliseconds 150
  return [ordered]@{
    id=$id
    requestedPosition=$position
    actualPosition=[HumModHostNative]::ScrollPos($handle)
    minimum=$range[0]
    maximum=$range[1]
  }
}

function Click-LiveButton([int]$id,[string]$label) {
  $handle=Native-Control $id $label
  [HumModHostNative]::Click($handle)
  Start-Sleep -Milliseconds 150
}

function Write-LiveControlStage([string]$stage,$data=$null) {
  $row=[ordered]@{
    timestamp=(Get-Date).ToString('o')
    stage=$stage
    data=$data
  }
  $row | ConvertTo-Json -Depth 8 | Add-Content (Join-Path $sessionDir 'live-control-stages.ndjson')
}

function Apply-LiveControls($assignments) {
  Write-LiveControlStage 'begin'
  if($null -eq $assignments){ throw 'live-set requires assignments' }
  $diag=[ordered]@{}

  $ventNames=@(
    'Ventilator.Switch',
    'Ventilator.Rate',
    'Ventilator.TidalVolume'
  )
  if(@($assignments.PSObject.Properties | Where-Object { $ventNames -contains $_.Name }).Count){
    Write-LiveControlStage 'ventilator-panel-opening'
    Open-Panel '/Clinic/Ventilator'
    Write-LiveControlStage 'ventilator-panel-open'
    if($null -ne $assignments.'Ventilator.Switch'){
      $v=[int]$assignments.'Ventilator.Switch'
      if($v -ne 0 -and $v -ne 1){ throw 'Ventilator.Switch must be 0 or 1' }
      Write-LiveControlStage 'ventilator-switch-before' @{value=$v}
      Click-LiveButton ($(if($v -eq 1){15489}else{15487})) 'Ventilator.Switch'
      Write-LiveControlStage 'ventilator-switch-after' @{value=$v}
    }
    if($null -ne $assignments.'Ventilator.Rate'){
      $v=[double]$assignments.'Ventilator.Rate'
      if($v -lt 0 -or $v -gt 50 -or $v -ne [math]::Round($v)){ throw 'Ventilator.Rate live control supports integer 0..50' }
      Write-LiveControlStage 'ventilator-rate-before' @{value=$v}
      $diag['Ventilator.Rate']=Set-LiveScrollByPosition 15491 ([int]$v) 'Ventilator.Rate'
      Write-LiveControlStage 'ventilator-rate-after' $diag['Ventilator.Rate']
    }
    if($null -ne $assignments.'Ventilator.TidalVolume'){
      $v=[double]$assignments.'Ventilator.TidalVolume'
      if($v -lt 0 -or $v -gt 2000 -or (($v/10)-ne [math]::Round($v/10))){ throw 'Ventilator.TidalVolume live control supports 10-mL steps from 0..2000 mL' }
      Write-LiveControlStage 'ventilator-vt-before' @{value=$v}
      $diag['Ventilator.TidalVolume']=Set-LiveScrollByPosition 15494 ([int]($v/10)) 'Ventilator.TidalVolume'
      Write-LiveControlStage 'ventilator-vt-after' $diag['Ventilator.TidalVolume']
    }
  }

  $thoraxNames=@('LeftHemithorax.NormalPressure','RightHemithorax.NormalPressure')
  if(@($assignments.PSObject.Properties | Where-Object { $thoraxNames -contains $_.Name }).Count){
    Write-LiveControlStage 'thorax-panel-opening'
    Open-Panel '/Physiology/Lungs/Thorax'
    Write-LiveControlStage 'thorax-panel-open'
    if($null -ne $assignments.'RightHemithorax.NormalPressure'){
      $v=[double]$assignments.'RightHemithorax.NormalPressure'
      if($v -lt -10 -or $v -gt 19 -or $v -ne [math]::Round($v)){ throw 'RightHemithorax.NormalPressure live control supports integer -10..19 mmHg' }
      $diag['RightHemithorax.NormalPressure']=Set-LiveScrollByPosition 4220 ([int]($v+10)) 'RightHemithorax.NormalPressure'
    }
    if($null -ne $assignments.'LeftHemithorax.NormalPressure'){
      $v=[double]$assignments.'LeftHemithorax.NormalPressure'
      if($v -lt -10 -or $v -gt 19 -or $v -ne [math]::Round($v)){ throw 'LeftHemithorax.NormalPressure live control supports integer -10..19 mmHg' }
      $diag['LeftHemithorax.NormalPressure']=Set-LiveScrollByPosition 4233 ([int]($v+10)) 'LeftHemithorax.NormalPressure'
    }
  }

  $membraneNames=@(
    'PulmonaryMembrane.TotalArea',
    'PulmonaryMembrane.Thickness-Structure'
  )
  if(@($assignments.PSObject.Properties | Where-Object { $membraneNames -contains $_.Name }).Count){
    Write-LiveControlStage 'pulmonary-membrane-panel-opening'
    Open-Panel '/Physiology/Lungs/Pulmonary Membrane'
    Write-LiveControlStage 'pulmonary-membrane-panel-open'

    if($null -ne $assignments.'PulmonaryMembrane.TotalArea'){
      $v=[double]$assignments.'PulmonaryMembrane.TotalArea'
      if($v -lt 0 -or $v -gt 200 -or $v -ne [math]::Round($v)){
        throw 'PulmonaryMembrane.TotalArea live control supports integer 0..200 m^2'
      }
      $diag['PulmonaryMembrane.TotalArea']=
        Set-LiveScrollByPosition 4311 ([int]$v) 'PulmonaryMembrane.TotalArea'
    }

    if($null -ne $assignments.'PulmonaryMembrane.Thickness-Structure'){
      $v=[double]$assignments.'PulmonaryMembrane.Thickness-Structure'
      $scaled=$v*10
      if($v -lt 0.1 -or $v -gt 5.0 -or
         [math]::Abs($scaled-[math]::Round($scaled)) -gt 1e-9){
        throw 'PulmonaryMembrane.Thickness-Structure live control supports 0.1-micron steps from 0.1..5.0'
      }
      $position=[int]([math]::Round($scaled)-1)
      $diag['PulmonaryMembrane.Thickness-Structure']=
        Set-LiveScrollByPosition 4318 $position 'PulmonaryMembrane.Thickness-Structure'
    }
  }

  $lungWaterNames=@('ExcessLungWater.Perm')
  if(@($assignments.PSObject.Properties | Where-Object { $lungWaterNames -contains $_.Name }).Count){
    Write-LiveControlStage 'lung-fluids-panel-opening'
    Open-Panel '/Physiology/Lungs/Lung Fluids'
    Write-LiveControlStage 'lung-fluids-panel-open'
    $children=@([HumModHostNative]::Children($main.Handle))
    $scrolls=@($children | Where-Object {
      $_.Class -eq 'ScrollBar' -and $_.Width -gt $_.Height
    } | Sort-Object Top)
    if($scrolls.Count -ne 1){
      $summary=($scrolls | ForEach-Object { "id=$($_.Id),left=$($_.Left),top=$($_.Top)" }) -join '; '
      throw "Expected exactly one Lung Fluids horizontal scrollbar; found $($scrolls.Count): $summary"
    }
    $target=$scrolls[0]
    $v=[double]$assignments.'ExcessLungWater.Perm'

    # Search the native repeat-list positions by applying a position and reading
    # the actual parameter from a native snapshot. This avoids guessing the
    # repeatlist's position-to-value encoding.
    $range=[HumModHostNative]::ScrollRange($target.Handle)
    $matched=$false
    for($pos=$range[0]; $pos -le $range[1]; $pos++){
      [HumModHostNative]::SetScroll($target.Handle,$pos)
      Start-Sleep -Milliseconds 100
      $snap=Snapshot @('ExcessLungWater.Perm')
      $actual=[double]$snap.state['ExcessLungWater.Perm']
      if([math]::Abs($actual-$v) -lt 1e-9){
        $diag['ExcessLungWater.Perm']=[ordered]@{
          id=$target.Id
          requestedValue=$v
          actualValue=$actual
          position=$pos
          minimumPosition=$range[0]
          maximumPosition=$range[1]
        }
        $matched=$true
        break
      }
    }
    if(-not $matched){ throw "ExcessLungWater.Perm value $v is not available on the native repeat list" }
  }

  # Air Supply controls are discovered dynamically by class/geometry after opening
  # the pinned panel because control IDs are generated by the display parser.
  $gasNames=@(
    'AirSupply-GasTanks.Switch',
    'AirSupply-GasTanks.O2Valve(%)',
    'AirSupply-GasTanks.N2Valve(%)',
    'AirSupply-GasTanks.CO2Valve(%)'
  )
  if(@($assignments.PSObject.Properties | Where-Object { $gasNames -contains $_.Name }).Count){
    Write-LiveControlStage 'air-supply-panel-opening'
    Open-Panel '/Lifestyle/Air Supply'
    Write-LiveControlStage 'air-supply-panel-open'
    $children=@([HumModHostNative]::Children($main.Handle))
    # Gas Tanks is the upper-right group on the pinned Air Supply panel.
    # Select native ScrollBar controls in that spatial region and order top-to-bottom:
    # O2, N2, CO2, CO, anesthetic. This excludes the lower Pressure Chamber control.
    $gasScrolls=@($children | Where-Object {
      $_.Class -eq 'ScrollBar' -and
      $_.Left -ge ($main.Left + 240) -and
      $_.Top -lt ($main.Top + 260)
    } | Sort-Object Top)
    if($gasScrolls.Count -ne 5){
      $summary=($children | Where-Object { $_.Class -eq 'ScrollBar' } |
        ForEach-Object { "id=$($_.Id),left=$($_.Left),top=$($_.Top)" }) -join '; '
      throw "Expected exactly 5 Gas Tanks scrollbars; found $($gasScrolls.Count). All scrollbars: $summary"
    }
    if($null -ne $assignments.'AirSupply-GasTanks.Switch'){
      $firstScroll=($gasScrolls | Select-Object -First 1)
      $candidate=@($children | Where-Object {
        $_.Class -eq 'Button' -and
        $_.Top -lt $firstScroll.Top -and
        $_.Top -ge ($firstScroll.Top - 40) -and
        $_.Left -ge ($firstScroll.Left - 10) -and
        $_.Left -le ($firstScroll.Left + 100)
      } | Sort-Object Left)
      if($candidate.Count -ne 2){ throw "Cannot identify Gas Tanks switch buttons; found $($candidate.Count)" }
      $v=[int]$assignments.'AirSupply-GasTanks.Switch'
      Click-LiveButton ($(if($v -eq 1){$candidate[1].Id}else{$candidate[0].Id})) 'AirSupply-GasTanks.Switch'
      $diag['AirSupply-GasTanks.Switch']=[ordered]@{offId=$candidate[0].Id;onId=$candidate[1].Id}
    }
    if($null -ne $assignments.'AirSupply-GasTanks.O2Valve(%)'){
      $v=[double]$assignments.'AirSupply-GasTanks.O2Valve(%)'
      if($v -lt 0 -or $v -gt 100 -or $v -ne [math]::Round($v)){ throw 'O2 valve live control supports integer percent' }
      $diag['AirSupply-GasTanks.O2Valve(%)']=Set-LiveScrollByPosition $gasScrolls[0].Id ([int]$v) 'O2Valve'
    }
    if($null -ne $assignments.'AirSupply-GasTanks.N2Valve(%)'){
      $v=[double]$assignments.'AirSupply-GasTanks.N2Valve(%)'
      if($v -lt 0 -or $v -gt 100 -or $v -ne [math]::Round($v)){ throw 'N2 valve live control supports integer percent' }
      $diag['AirSupply-GasTanks.N2Valve(%)']=Set-LiveScrollByPosition $gasScrolls[1].Id ([int]$v) 'N2Valve'
    }
    if($null -ne $assignments.'AirSupply-GasTanks.CO2Valve(%)'){
      $v=[double]$assignments.'AirSupply-GasTanks.CO2Valve(%)'
      if($v -ne 0){ throw 'live coupling v1 currently supports CO2Valve only at 0%' }
      $diag['AirSupply-GasTanks.CO2Valve(%)']=Set-LiveScrollByPosition $gasScrolls[2].Id 0 'CO2Valve'
    }
  }

  Write-LiveControlStage 'complete' $diag
  return $diag
}

function Apply-Assignments($assignments) {
  if($null -eq $assignments){ throw 'set requires assignments' }
  $script:readCounter += 1
  $source=Join-Path $sessionDir ("set-source-"+$script:readCounter+".SOLN")
  $target=Join-Path $sessionDir ("set-target-"+$script:readCounter+".SOLN")
  Save-Solution $source
  $text=[IO.File]::ReadAllText($source)
  $requested=[ordered]@{}
  foreach($p in $assignments.PSObject.Properties){
    $symbol=[string]$p.Name
    if(-not $allowedSetSymbols.ContainsKey($symbol)){ throw "unapproved native HumMod assignment: $symbol" }
    $value=[double]$p.Value
    if([double]::IsNaN($value)-or [double]::IsInfinity($value)){ throw "$symbol must be finite" }
    $meta=$allowedSetSymbols[$symbol]
    if($value -lt $meta.min -or $value -gt $meta.max){ throw "$symbol outside allowed range" }
    if($meta.integer -and $value -ne [math]::Round($value)){ throw "$symbol must be 0 or 1" }
    $text=Replace-SolutionSeries $text $symbol $value
    $requested[$symbol]=$value
  }
  [IO.File]::WriteAllText($target,$text,[Text.Encoding]::ASCII)
  Load-Solution $target
  $verify=Snapshot @($requested.Keys)
  foreach($symbol in $requested.Keys){
    if([math]::Abs([double]$verify.state[$symbol]-[double]$requested[$symbol]) -gt 1e-9){
      throw "native assignment verification failed for $symbol"
    }
  }
  return $verify
}

function Advance-Seconds([int]$seconds) {
  if($seconds -lt 1) {
    throw 'durationSec must be an integer >= 1 for native host v1'
  }

  # Use HumMod's own exact-duration Go menu commands synchronously.
  # PostMessage can queue overlapping advances; SendMessage blocks until
  # the native menu handler returns.
  $go10 = Get-Menu '/Go/10 Sec'
  $go5  = Get-Menu '/Go/5 Sec'
  $go1  = Get-Menu '/Go/1 Sec'

  $remaining=$seconds
  while($remaining -ge 10){
    [HumModHostNative]::CommandSync($main.Handle,$go10.Id)
    $remaining -= 10
  }
  while($remaining -ge 5){
    [HumModHostNative]::CommandSync($main.Handle,$go5.Id)
    $remaining -= 5
  }
  while($remaining -ge 1){
    [HumModHostNative]::CommandSync($main.Handle,$go1.Id)
    $remaining -= 1
  }
}

try {
  $proc = Start-Process -FilePath $exe -WorkingDirectory $hm -ArgumentList '<model> HumMod.DES </model>' -PassThru
  Start-Sleep -Seconds 8
  $main = @([HumModHostNative]::Windows([uint32]$proc.Id,$false) |
    Where-Object { $_.Class -eq 'HumMod' }) | Select-Object -First 1
  if(-not $main) { throw 'HumMod main window did not load.' }

  $errors = @([HumModHostNative]::Windows([uint32]$proc.Id,$true) |
    Where-Object { $_.Text -match 'PARSER REPORT|Parsing Error' })
  if($errors.Count) { throw 'HumMod model parsing failed.' }

  Emit ([ordered]@{
    ok = $true
    event = 'ready'
    processId = $proc.Id
    executableSha256 = (Get-FileHash $exe -Algorithm SHA256).Hash
    upstreamRevision = '8dab57e05631f779bf5020fe0dd51874d8ae98c1'
    mainWindowHandle = $main.Handle
  })

  while($true) {
    $line = [Console]::In.ReadLine()
    if($null -eq $line) { break }
    if([string]::IsNullOrWhiteSpace($line)) { continue }

    try {
      $cmd = $line | ConvertFrom-Json
      switch([string]$cmd.command) {
        'initialize' {
          $snap=Snapshot @('Heart-Rate.Rate','SystemicArtys.Pressure','CardiacOutput.Flow(L/Min)','PO2Artys.Pressure','CO2Artys.Pressure','BloodPh.ArtysPh')
          Emit ([ordered]@{ok=$true;command='initialize';simulationTimeSec=$snap.simulationTimeSec;state=$snap.state})
        }
        'advance' {
          $seconds = [int]$cmd.durationSec
          if([double]$cmd.durationSec -ne [double]$seconds) {
            throw 'native host v1 supports whole-second advances only'
          }
          Advance-Seconds $seconds
          $snap = Snapshot @('System.X')
          Emit ([ordered]@{ok=$true;command='advance';simulationTimeSec=$snap.simulationTimeSec})
        }
        'read' {
          $symbols = @($cmd.symbols | ForEach-Object { [string]$_ })
          if($symbols.Count -eq 0) { throw 'read requires symbols' }
          $snap = Snapshot $symbols
          Emit ([ordered]@{
            ok=$true
            command='read'
            simulationTimeSec=$snap.simulationTimeSec
            state=$snap.state
          })
        }
        'checkpoint' {
          $id = [string]$cmd.checkpointId
          if($id -notmatch '^[A-Za-z0-9_.-]+$') { throw 'invalid checkpointId' }
          $path = Join-Path $sessionDir ("checkpoint-" + $id + ".SOLN")
          Save-Solution $path
          $text = [IO.File]::ReadAllText($path)
          $systemX = Get-LatestValue $text 'System.X'
          Emit ([ordered]@{
            ok=$true
            command='checkpoint'
            checkpointId=$id
            simulationTimeSec=$systemX*60.0
          })
        }
        'restore' {
          $id = [string]$cmd.checkpointId
          if($id -notmatch '^[A-Za-z0-9_.-]+$') { throw 'invalid checkpointId' }
          $path = Join-Path $sessionDir ("checkpoint-" + $id + ".SOLN")
          if(-not (Test-Path $path)) { throw "unknown checkpoint: $id" }
          Load-Solution $path
          $snap = Snapshot @('System.X')
          Emit ([ordered]@{
            ok=$true
            command='restore'
            checkpointId=$id
            simulationTimeSec=$snap.simulationTimeSec
          })
        }
        'set' {
          throw 'legacy saved-solution set transport is disabled; use live-set'
        }
        'live-set' {
          $diag=Apply-LiveControls $cmd.assignments
          $symbols=@($cmd.assignments.PSObject.Properties.Name)
          $snap=Snapshot $symbols
          Emit ([ordered]@{ok=$true;command='live-set';simulationTimeSec=$snap.simulationTimeSec;state=$snap.state;controls=$diag})
        }
        'inspect-menu' {
          $items=@([HumModHostNative]::Menu($main.Handle) | ForEach-Object {
            [ordered]@{id=$_.Id;path=$_.Path}
          })
          Emit ([ordered]@{ok=$true;command='inspect-menu';items=$items})
        }
        'terminate' {
          Emit ([ordered]@{ok=$true;command='terminate'})
          break
        }
        default {
          throw ('unsupported command: ' + [string]$cmd.command)
        }
      }
      if([string]$cmd.command -eq 'terminate') { break }
    }
    catch {
      Emit ([ordered]@{
        ok=$false
        error=$_.Exception.Message
      })
    }
  }
}
finally {
  if($proc) {
    $proc.Refresh()
    if(-not $proc.HasExited) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
  }
}
