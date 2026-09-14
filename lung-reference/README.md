# Lung Reference - 0.2.0-rc1

A browser-based educational explorer with a Python reference implementation.
This is a **release candidate**, not a validated medical device or a journal-accepted publication.

## Start here

Open `index.html` in a modern browser. Keep `index.html`, `lung.js`, `app.js`,
`style.css`, and `paper.html` together. No installation, server, network calls,
external fonts, analytics, or patient data are required by the application.
The distribution is multiple static files, not a single HTML file.

If local-file restrictions interfere, run `python3 -m http.server 8000 --bind
127.0.0.1` in this directory, then open `http://127.0.0.1:8000`.
For web hosting, upload the static application files to a directory on your
host. HTTPS and public deployment were not tested in this environment.

## Run the Python simulator

Requires Python 3.10+; the model and tests use only the standard library.

```bash
python3 lung_reference.py --out results
python3 lung_reference.py --config example_config.json --out results/example
```

Python is the mathematical source of record. `lung.js` implements the same
equations for the browser and Node 18+. The JSON configuration contains `lung`,
`vent`, `gas`, and `history`; omitted model fields use documented defaults.
The browser's results download includes this object under `configuration`.
To reuse a results download with the Python CLI, save that `configuration`
object as the configuration file. Units are L, s, cmH2O, mmHg, g/dL and mL/dL;
Vt is in liters, not milliliters.

```bash
node harness.js --case "Injury C"
node harness.js --case "Injury C" --history "30,14"
node harness.js --config example_config.json
```

## Reproduce verification

Requires Python 3.10+ and Node 18+; no npm install is needed.

```bash
python3 verify_release.py
```

This regenerates unit-test logs, DOM-adapter logs, benchmarks, both audit
JSON files, complete-record cross-language checks, and a verification summary
in `results/`. It exits nonzero on failure. It does not validate the model
against patients, bench equipment, experts, or educational outcomes.

Cross-language comparisons use raw floating-point outputs with
`abs(a-b) <= max(1e-9, 1e-9*max(abs(a),abs(b)))`. They compare complete nested
records, explicit failures, all sampled PEEP rows and all relay vectors;
strings, schemas, booleans and nulls must match exactly. Nonfinite numbers
are rejected. Native tests also include analytical and conservation checks;
agreement between implementations alone does not establish correctness.

The UI tests use a minimal in-memory DOM. They are not real-browser rendering,
accessibility, cross-browser, mobile, or download tests. Perform the manual
browser checks in `PUBLICATION_CHECKLIST.md` before public deployment.

## Model scope

- Three quasi-static mechanical compartments: normally aerated, recruitable,
  consolidated; one lumped airway resistance, not three dynamic RC branches.
- Separate tissue and perfusion fractions, with exponential elastic stiffening.
- Discrete recruitment relays with history, instant settling and frozen state
  during each modeled breath.
- Passive constant-flow volume control; full expiration is assumed, not simulated.
- One ventilated alveolar gas compartment and oxygen-content-conserving shunt
  mixing; fixed venous saturation, P50, dead-space fraction and bicarbonate.
- Signed R/I-style settled endpoint index, with recruitment and nonlinear
  inflation-reference components exposed separately.
- Decremental PEEP-compliance samples; no clinical best-PEEP recommendation.

No patient effort, pressure-control modes, expiratory dynamics, auto-PEEP,
intratidal recruitment, regional V/Q distribution, automatic Bohr shifts,
hemodynamics, clinical outcomes, or therapeutic recommendations are modeled.
The API also retains a research candidate-grid function; it is not exposed
as a clinical optimizer in the interface.

## Files and provenance

- `index.html`, `app.js`, `style.css`: rewritten interface.
- `lung_reference.py`, `lung.js`: hardened paired model implementations.
- `test_*.py`, `test_*.js`, `cross_check.py`, `verify_release.py`: executable checks.
- `results/`: machine-generated evidence, including exact configurations.
- `manuscript.md`, `paper.html`, `manuscript.pdf`: one rewritten manuscript in
  editable, web and PDF forms; numbers are generated from verified outputs.
- `manuscript_template.md`, `build_manuscript.py`: manuscript regeneration.
- `CHANGELOG.md`, `MODEL_REVIEW.md`: changes and remaining scientific critiques.
- `SHA256.json`: hashes of this release's delivered files (excluding itself).
- `author_metadata.json`, `LICENSE_STATUS.md`, `PUBLICATION_CHECKLIST.md`:
  owner-controlled items to complete before publication.

This is a separate revision of the supplied `vent-review-package.zip`.
The supplied originals were not modified. The v0.1.0 Python mathematical core
was retained and hardened; it was not replaced with a new calibrated physiology
model. The interface, comparison harness, manuscript and documentation were
rewritten. The original reference code was AI-assisted, so this review is not
an independent clinical or expert validation.

## Rebuild manuscript and package

`build_manuscript.py` additionally requires `reportlab` to produce the PDF.
The browser and model have no such dependency. Set author metadata first if
preparing a journal submission; unset details remain visibly marked pending.

```bash
python3 verify_release.py
python3 build_manuscript.py
python3 package_release.py
```

The final command hashes the delivered files and creates a sibling ZIP. Do not
claim a checksum matches after editing files without regenerating the manifest.
Keep each returned ZIP intact and increment the release identifier on changes.

No public site was changed by producing this package. No new software license
has been granted on the owner's behalf; see `LICENSE_STATUS.md`.
