# HumMod remote runner protocol

Status: blocked. The pinned executable rejects the remote-control bootstrap (runtime-verified parser error 2220 on 2026-09-20).

Pinned model source:

- repository: `riliescu/hummod-standalone`
- revision: `8dab57e05631f779bf5020fe0dd51874d8ae98c1`

Pinned documentation source:

- repository: `HumMod/documentation`
- revision: `1cd093c001ea5af72e666a20e51542dce2304b38`

## Why remote/scripted control is the preferred path

HumMod's documented control schema supports non-interactive scripted execution.

The documented `remote` interface uses a file listener. When a target file appears, the listener processes the remote request. A remote request may contain scripted control, remote-control tasks, and miscellaneous control.

The documented `scripted` interface supports the exact primitives Vent needs:

- `fileopencreate`
- `fileroster`
- `filewriteheader`
- `filestarttracking`
- `advancefor`
- `filestoptracking`
- `fileupdate`
- `fileclose`
- `logfile`

HumMod documentation states that tracking writes selected variable values to the open file at each display interval while the solution advances.

This is preferable to GUI automation because it gives us:

- exact source-symbol identity
- reproducible run duration and sample interval
- a completion signal through the logfile
- a path to headless or hidden-window execution
- no OCR, screen scraping, or manual copy/paste

## Vent-side generator

`src/hummod_remote_request.js` generates a candidate `remoterequest` using only documented schema elements.

It always includes:

- `System.X`
- every requested verified HumMod source symbol

It converts Vent-facing duration/sample cadence in seconds into HumMod clock minutes using the pinned `System.X` contract.

The generator returns:

- the XML request
- exact output/log filenames
- exact roster
- documentation provenance
- `runtimeVerified: false`

Do not change that flag until an actual pinned HumMod runtime successfully processes the request.

## First reference run

Target case:

`berlin-moderate-moderate-aspiration`

Recommended first runner objective:

1. launch the pinned HumMod standalone runtime on Windows;
2. establish or verify the documented file listener;
3. submit the generated remote request;
4. track:
   - `System.X`
   - `PO2Artys.Pressure`
   - `CO2Artys.Pressure`
   - `BloodPh.ArtysPh`
   - `Heart-Rate.Rate`
   - `SystemicArtys.Pressure`
   - `CardiacOutput.Flow(L/Min)`
5. wait for the documented completion logfile;
6. capture the tracked output file unchanged;
7. identify the exact tracked-file delimiter/layout from the real output;
8. parse it into `hummod-raw-series/v1`;
9. convert that raw series into `vent-hummod-trajectory/v1`;
10. load it into the browser clinical session.

## Listener bootstrap caveat

HumMod documentation recommends a basic listener such as `BasicListener` that watches `BasicListener.DAT` at a fixed polling interval.

That recommendation is documentation-level evidence only.

We have not yet verified that the pinned `HumMod.EXE` ships with that exact listener name, filename, or bootstrap behavior.

The Windows runner must inspect/verify the actual executable configuration before assuming a target request filename.

## Tracked-file parser boundary

The documentation defines `fileroster`, tracking, headers, and file updates, but the checked documentation does not provide a complete machine-readable specification for the tracked text-file delimiter/layout.

Therefore Vent intentionally does **not** guess:

- delimiter
- quoting
- decimal formatting
- header structure
- whether a final `fileupdate` duplicates the final tracked row

The first real runtime output should be retained verbatim and used to implement a parser fixture.

Once one real tracked output is captured, add:

- `test/fixtures/hummod-real-format-sanitized.txt` if redistribution permits;
- parser tests for exact header/value layout;
- rejection tests for malformed rows;
- a parser provenance block identifying the HumMod runtime/version.

Do not include physiologic values from a real person. HumMod outputs should come from a synthetic/model run.

## Alternative: SOLN files

HumMod documentation also describes `.SOLN` files that can contain all stored values for all model variables.

This is potentially useful as a fallback because it preserves full solution history, but documented save/load is tied to File-menu operations and has not yet been shown to be scriptable through the pinned runtime.

The scripted tracking route remains the preferred first automation target.

## Success criterion

The HumMod integration becomes materially different from a stub when all of these are true:

- the pinned executable accepts a generated remote request;
- the completion logfile confirms success;
- raw tracked output is captured;
- `System.X` and all verified variables parse deterministically;
- raw output converts to `hummod-raw-series/v1`;
- the canonical trajectory validates;
- the moderate/intermediate Berlin case runs in the composed browser session using that real HumMod trajectory.

Until then, the browser test fixture remains test-only and must never be described as HumMod-derived clinical physiology.


## 2026-09-20 runtime investigation

The run at commit `b3fb213f` passed the engine, Chromium, and WebKit checks,
but the upstream Windows probe timed out. Its artifact shows that the process
started, both result files were absent, and the listener request remained present.
That evidence does not establish whether model loading or listener setup failed.

Both workflows now invoke `scripts/run-hummod-probe.ps1`. It passes the model
XML directly as the native command line, publishes a complete request atomically,
rejects stale result files, captures native window and child-control text before
terminating the process, and restores the temporary upstream control file.
The shared implementation also fixes the manual workflow's missing model argument.

`outputCaptured` means only that a completion log and nonempty output were
collected. `runtimeVerified` remains false until the log and trajectory are
parsed and validated. Merely finding two files is not an execution-success check.

The generated request currently applies **no ARDS or ventilator initialization**.
It is now labeled `hummod-default-runtime-probe-001`, with `scenarioId: null` and
`scenarioApplied: false`. The intended future moderate aspiration case is recorded
separately in the manifest. A default-model output must not be attached to that
Berlin case or used as its physiologic reference. After transport works, implement
and verify explicit scenario initialization before attempting the comparison.

### Confirmed blocker and next implementation step

[Windows probe run 35506253104](https://github.com/DrFillster/medical-vent-twin/actions/runs/35506253104)
at Vent commit `06e05c8e` captured the native parser report:

- File: `Control\Control.DES`
- Element: `remote`
- Error: `2220`
- Expected next element: `/control`

The model argument is now reaching model parsing. The injected `remote` child
is rejected before any request can run. The pinned documentation itself contains
a legacy [control page](https://github.com/HumMod/documentation/blob/1cd093c001ea5af72e666a20e51542dce2304b38/schema/3_control/control.html)
that describes direct `gofor`/`goto` children and future scripted/remote support,
as well as newer pages describing that support. Documentation availability was
therefore insufficient evidence of executable capability.

Do not retry with longer timeouts or label this a successful reference run.
Obtain and pin a runtime demonstrably supporting the documented remote schema,
or implement and verify the legacy runtime's native export route. Any runtime
change needs a compatibility check against the pinned model and direct-symbol
mappings. The official standalone repository currently returns 404 through the
connected GitHub reader, so no replacement runtime has been verified in this work.
Keep the upstream execution gate failing and PR #3 draft until a real output is
captured, parsed, and assigned truthful scenario provenance.

Verification for `06e05c8e`: 314 local tests passed; GitHub preview tests, legacy
preservation, dependency analysis, Chromium, and WebKit passed. Both Windows
remote probes failed; the dedicated run supplies the parser report above.
