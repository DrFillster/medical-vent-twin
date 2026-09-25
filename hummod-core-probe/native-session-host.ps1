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
  [DllImport("user32.dll")] static extern IntPtr GetMenu(IntPtr h);
  [DllImport("user32.dll")] static extern int GetMenuItemCount(IntPtr m);
  [DllImport("user32.dll")] static extern IntPtr GetSubMenu(IntPtr m, int pos);
  [DllImport("user32.dll")] static extern uint GetMenuItemID(IntPtr m, int pos);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetMenuString(IntPtr m, uint pos, StringBuilder text, int count, uint flags);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll", EntryPoint="SendMessageW")] static extern IntPtr SendValue(IntPtr h, uint msg, IntPtr w, IntPtr l);

  static NativeWindow Describe(IntPtr h) {
    var text = new StringBuilder(4096);
    var cls = new StringBuilder(256);
    GetWindowText(h, text, text.Capacity);
    GetClassName(h, cls, cls.Capacity);
    return new NativeWindow {
      Handle = h.ToInt64(),
      Id = GetDlgCtrlID(h),
      Class = cls.ToString(),
      Text = text.ToString()
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

  public static void Command(long handle, uint command) {
    if (!PostMessage(new IntPtr(handle), 0x111, new IntPtr(command), IntPtr.Zero)) {
      throw new Exception("PostMessage failed");
    }
  }

  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  static extern IntPtr SendText(IntPtr h, uint msg, IntPtr w, string l);

  public static void SetText(long handle, string text) {
    SendText(new IntPtr(handle), 0x000C, IntPtr.Zero, text);
  }

  public static void TypeText(long handle, string text) {
    IntPtr h = new IntPtr(handle);
    SendValue(h, 0xB1, IntPtr.Zero, new IntPtr(-1));
    SendValue(h, 0x102, new IntPtr(8), IntPtr.Zero);
    foreach(char c in text) SendValue(h, 0x102, new IntPtr(c), IntPtr.Zero);
  }
}
'@

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

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
  $root=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$dialogHandle)
  if($null -eq $root){ throw "Cannot access $purpose dialog through UI Automation" }

  $elements=$root.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition
  )

  $candidates=@()
  foreach($el in $elements){
    $type=$el.Current.ControlType
    if($type -ne [System.Windows.Automation.ControlType]::Edit -and
       $type -ne [System.Windows.Automation.ControlType]::ComboBox){
      continue
    }

    try {
      $pattern=$el.GetCurrentPattern(
        [System.Windows.Automation.ValuePattern]::Pattern
      )
      if($null -eq $pattern -or $pattern.Current.IsReadOnly){ continue }

      $name=[string]$el.Current.Name
      $automationId=[string]$el.Current.AutomationId
      $score=0
      if($name -match '(?i)file\s*name|filename'){ $score += 100 }
      if($automationId -match '^(1001|1148|1152)$'){ $score += 50 }
      if($type -eq [System.Windows.Automation.ControlType]::Edit){ $score += 10 }

      $candidates += [pscustomobject]@{
        Element=$el
        Pattern=$pattern
        Name=$name
        AutomationId=$automationId
        Score=$score
      }
    } catch {}
  }

  if($candidates.Count -eq 0){
    $names=@()
    foreach($el in $elements){
      if($el.Current.Name){
        $names += (
          $el.Current.ControlType.ProgrammaticName + ':' +
          $el.Current.AutomationId + ':' +
          $el.Current.Name
        )
      }
    }
    throw (
      "Cannot find writable filename control in $purpose dialog. UIA: " +
      ($names -join '; ')
    )
  }

  $best=@($candidates | Sort-Object Score -Descending)
  if($best.Count -gt 1 -and $best[0].Score -eq $best[1].Score){
    $summary=($best | ForEach-Object {
      ('name=' + $_.Name + ',automationId=' + $_.AutomationId +
       ',score=' + $_.Score)
    }) -join '; '
    throw (
      "Ambiguous writable filename controls in $purpose dialog: " + $summary
    )
  }

  $best[0].Pattern.SetValue($value)
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

function Wait-StableFile([string]$path, [int]$timeoutSeconds = 60) {
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
  throw "Timed out waiting for file: $path"
}

function Save-Solution([string]$path) {
  if(Test-Path $path) { Remove-Item -Force $path }

  $save = @([HumModHostNative]::Menu($main.Handle) |
    Where-Object { $_.Path -match '(?i)/File/.*save.*sol' })
  if($save.Count -ne 1) { throw 'Cannot identify unique Save Solution command.' }
  [HumModHostNative]::Command($main.Handle,$save[0].Id)
  Start-Sleep -Milliseconds 800

  $dialog = Wait-FileDialog 'Save Solution'
  Set-FileDialogPath $dialog.Handle ('"' + $path + '"') 'Save Solution'
  $children = @([HumModHostNative]::Children($dialog.Handle))
  $button = @($children | Where-Object { $_.Class -eq 'Button' -and $_.Id -eq 1 })
  if($button.Count -ne 1) { throw 'Cannot identify Save button.' }
  [HumModHostNative]::PostMessage([IntPtr]$button[0].Handle,0xF5,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null
  Wait-StableFile $path
}

function Load-Solution([string]$path) {
  $resolved = (Resolve-Path $path).Path
  $load = Get-Menu '/File/Load Solution'
  [HumModHostNative]::Command($main.Handle,$load.Id)
  Start-Sleep -Milliseconds 800

  $dialog = Wait-FileDialog 'Load Solution'
  Set-FileDialogPath $dialog.Handle ('"' + $resolved + '"') 'Load Solution'
  $children = @([HumModHostNative]::Children($dialog.Handle))
  $button = @($children | Where-Object { $_.Class -eq 'Button' -and $_.Id -eq 1 })
  if($button.Count -ne 1) { throw 'Cannot identify Load button.' }
  [HumModHostNative]::PostMessage([IntPtr]$button[0].Handle,0xF5,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null
  Start-Sleep -Milliseconds 1200

  $errors = @([HumModHostNative]::Windows([uint32]$proc.Id,$true) |
    Where-Object { $_.Text -match 'PARSER REPORT|Parsing Error' })
  if($errors.Count) { throw 'HumMod reported a solution-load parser error.' }
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
  if($seconds -lt 1) { throw 'durationSec must be an integer >= 1 for native host v1' }
  $one = Get-Menu '/Go/1 Sec'
  for($i=0; $i -lt $seconds; $i++) {
    [HumModHostNative]::Command($main.Handle,$one.Id)
    Start-Sleep -Milliseconds 200
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
          $snap=Apply-Assignments $cmd.assignments
          Emit ([ordered]@{ok=$true;command='set';simulationTimeSec=$snap.simulationTimeSec;state=$snap.state})
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
