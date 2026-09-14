# lung-reference — browser-port of lung_reference.py v0.1.0

This directory is the **reference-backed revision** of the lung simulator.
The Python source `lung_reference.py` is the contract; `lung.js` is its
faithful JS port; `cross_check.py` enforces 1e-6 agreement.

The previous simulator (`../index.html`) is preserved unchanged in version
control, per the handoff brief. This directory sits alongside it.

## Layout

| File | Role |
|---|---|
| `lung_reference.py` | Python source of record (v0.1.0, stdlib only, 506 lines) |
| `test_lung_reference.py` | 24 software-verification tests, Python |
| `audit_reference.py` | Sensitivity/convergence records, Python |
| `example_config.json` | Reproducible scenario; consumed by `lung_reference.py --config` |
| `lung.js` | Equivalent JS port |
| `harness.js` | Node CLI: case evaluation + parametric sweeps |
| `test_lung_reference.js` | 24 software-verification tests, JS |
| `audit_lung_reference.js` | Equivalent JS audit; produces `results/audit.js.json` |
| `cross_check.py` | Cross-language check at abs/rel tolerance 1e-6 |
| `index.html`, `app.js`, `style.css` | Browser UI for manual exploration |
| `results/benchmark.json` | Reference benchmark JSON (Python) |
| `results/audit.json` | Reference audit JSON (Python) |
| `results/audit.js.json` | JS audit JSON (matches Python at 1e-6) |
| `results/tests.txt` | Reference test log |
| `results/example/scenario.json` | Reference example config output |
| `SHA256.json` | SHA-256 hashes for delivered files |

## Run

```bash
# Software verification (each language independently)
python3 -m unittest test_lung_reference.py
node test_lung_reference.js

# Benchmarks
python3 lung_reference.py --out results
node harness.js --case Injury C

# Sensitivity/convergence (Python / JS mirrors)
python3 audit_reference.py
node audit_lung_reference.js

# Cross-language verification (the contract for the JS port)
python3 cross_check.py
```

All four inputs and outputs use the unit conventions in the docstrings of
`lung_reference.py` and the header of `lung.js`.

## Scope (consistent with `lung_reference.py`)

- Quasi-static three-compartment elastic mechanics (`tissue`, `perfusion`)
- One lumped airway resistance
- Passive constant-flow VCV; **not** dynamic parallel RC
- Discrete relay-based PEEP-history recruitment; **frozen during a breath**
- Pressure-dependent stiffening via a finite-capacity elastic law
- Steady shunt-only oxygen mixing with content conservation
- Fixed-bicarbonate pH; P50 is held fixed (no automatic Bohr/COHb shift)
- A signed R/I-style endpoint analogue with its exact model decomposition
- An explicit feasible grid (NOT a clinical optimizer)
- A failure state returned explicitly when AOP ≥ high PEEP, gas boundary is
  invalid, or the elastic capacity cannot supply the tidal volume

## What is *not* in scope

- Parallel RC transients, expiration, intrinsic PEEP, intratidal recruitment
- Assisted or pressure-control ventilation; the displayed MP value is for
  passive VCV only
- V/Q mismatch, true low-V/Q distribution, cardiac output coupling
- Learner-outcome validation, bench validation, ASL 5000 comparison
- A clinical "best PEEP" recommendation; the sampled compliance maximum is
  explicitly labeled as such and is *not* a recommendation

## Caveats on the JS output

Browser usage loads `lung.js` as a classic script exposing
`window.LungRef`; Node usage `require`s it. Both paths produce identical
floating-point output and pass `cross_check.py`. Compatibility is checked by
running the suite in both languages and diffing the audit JSON.
