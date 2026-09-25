[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$HumModRoot,
  [Parameter(Mandatory)][string]$RequestPath,
  [Parameter(Mandatory)][string]$OutputDirectory,
  [ValidateRange(10, 600)][int]$TimeoutSeconds = 120,
  [ValidatePattern('^[A-Za-z0-9_.-]+\.DAT$')][string]$ListenerFile = 'BasicListener.DAT'
)

$ErrorActionPreference = 'Stop'
$hm = (Resolve-Path $HumModRoot).Path
$request = (Resolve-Path $RequestPath).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$outDir = (Resolve-Path $OutputDirectory).Path
$exe = Join-Path $hm 'HumMod.EXE'
$control = Join-Path $hm 'Control/Control.DES'
$originalControl = [IO.File]::ReadAllText($control)
$listener = Join-Path $hm $ListenerFile
$log = Join-Path $hm 'VentHumMod-done.log'
$output = Join-Path $hm 'VentHumMod-output.txt'
foreach ($path in @($listener, $log, $output)) {
  if (Test-Path $path) { throw "Refusing stale probe file: $path. Use a fresh upstream checkout." }
}

# Capture native error dialogs without dismissing them or driving the UI.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class HumModWindows {
  public delegate bool Callback(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, Callback cb, IntPtr p);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder text, int count);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder text, int count);
  static string Describe(IntPtr h) {
    var text = new StringBuilder(4096); var cls = new StringBuilder(256);
    GetWindowText(h, text, text.Capacity); GetClassName(h, cls, cls.Capacity);
    return cls.ToString() + ": " + text.ToString();
  }
  public static string[] Read(uint processId) {
    var rows = new List<string>();
    EnumWindows((h, p) => {
      uint id; GetWindowThreadProcessId(h, out id);
      if (id == processId) {
        rows.Add(Describe(h));
        EnumChildWindows(h, (child, ignored) => { rows.Add("  " + Describe(child)); return true; }, IntPtr.Zero);
      }
      return true;
    }, IntPtr.Zero);
    return rows.ToArray();
  }
}
'@

$status = [ordered]@{
  attempted = $true
  listenerFile = $ListenerFile
  listenerBootstrapInjected = $false
  processStarted = $false
  completionLogObserved = $false
  outputFileObserved = $false
  outputCaptured = $false
  runtimeVerified = $false
  # Capturing files alone is not proof of successful script execution or valid physiology.
  validationStatus = 'awaiting-log-and-trajectory-parser'
  commandLine = '<model> HumMod.DES </model>'
}
$proc = $null
try {
  if ($originalControl -match '<openlistener>') { throw 'Expected pristine control file without a listener.' }
  if ($originalControl -notmatch '</control>') { throw 'Missing control closing element.' }
  $bootstrap = "<remote><openlistener><name>BasicListener</name><filename>$ListenerFile</filename><interval>1</interval></openlistener></remote>"
  [IO.File]::WriteAllText($control, $originalControl.Replace('</control>', "$bootstrap`r`n</control>"), [Text.Encoding]::ASCII)
  $status.listenerBootstrapInjected = $true
  [ordered]@{
    sha256 = (Get-FileHash $exe -Algorithm SHA256).Hash
    lengthBytes = (Get-Item $exe).Length
    pinnedRevision = '8dab57e05631f779bf5020fe0dd51874d8ae98c1'
  } | ConvertTo-Json | Set-Content (Join-Path $outDir 'executable-verification.json')

  # Start-Process passes this raw command line to the native solver. Do not
  # wrap the XML in literal quotes: those are part of the solver's input.
  $proc = Start-Process -FilePath $exe -WorkingDirectory $hm -ArgumentList $status.commandLine -PassThru
  $status.processStarted = $true
  $status.processId = $proc.Id
  # Publish the complete request atomically so the listener cannot read a partial copy.
  $pending = Join-Path $hm 'VentHumMod-request.pending'
  Copy-Item $request $pending
  Move-Item $pending $listener
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $proc.Refresh()
    if ((Test-Path $log) -and (Test-Path $output)) { break }
    if ($proc.HasExited) {
      $status.processExitedEarly = $true
      $status.processExitCode = $proc.ExitCode
      break
    }
    Start-Sleep -Seconds 2
  }
  $status.completionLogObserved = Test-Path $log
  $status.outputFileObserved = Test-Path $output
  $status.listenerRequestStillPresent = Test-Path $listener
  if ($status.completionLogObserved) { Copy-Item $log $outDir }
  if ($status.outputFileObserved) {
    Copy-Item $output $outDir
    $status.outputBytes = (Get-Item $output).Length
  }
  $status.outputCaptured = $status.completionLogObserved -and $status.outputFileObserved -and ($status.outputBytes -gt 0)
  if (-not $status.outputCaptured) { throw 'HumMod did not produce a completion log and nonempty tracked output.' }
}
catch {
  $status.error = $_.Exception.Message
  throw
}
finally {
  # Write diagnostics before killing the process; error dialogs are otherwise lost.
  if ($proc) {
    try {
      $status.windows = @([HumModWindows]::Read([uint32]$proc.Id))
    } catch { $status.windowCaptureError = $_.Exception.Message }
    $proc.Refresh()
    if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  }
  [IO.File]::WriteAllText($control, $originalControl, [Text.Encoding]::ASCII)
  $status | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $outDir 'probe-status.json')
  $status | ConvertTo-Json -Depth 6 | Write-Output
}
