# HumMod remote runner protocol

Status: documentation-grounded candidate; not yet runtime-verified against the pinned HumMod executable.

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
