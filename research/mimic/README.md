# Local MIMIC-IV v3.1 extraction

Patient-level MIMIC data stay outside Git under `/Users/philipbernard/mimic-data`.

## Phase 1
1. Download only tables required for ventilator-transition validation.
2. Build DuckDB views directly over compressed CSV files.
3. Resolve ventilator/vital-sign and ABG item IDs from MIMIC dictionaries.
4. Manually review the candidate item map before defining the cohort.
5. Create a reduced Parquet cohort containing only required variables and time windows.

## Data boundary
Do not commit raw MIMIC files, row-level extracts, credentials, or patient-level output.

## Run
```
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/build_duckdb.py
```


## Core reduction

After `chartevents.csv.gz` and `labevents.csv.gz` complete:

```
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/extract_core.py
```

Outputs remain outside Git in `/Users/philipbernard/mimic-data/derived/`:
- `adult_icustays.parquet`
- `vent_chart_events.parquet`
- `blood_gas_events.parquet`
- `ventilator_transition_candidates.parquet`

Transition candidates are discovery data only. They require protocol filters and manual verification before use as the validation cohort.


## Cohort refinement and phenotype pipeline

All commands below operate on local MIMIC data and write patient-level outputs only under
`/Users/philipbernard/mimic-data/derived/`.

### 1. Refine transitions and arterial blood gases

```
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/refine_transitions.py
```

### 2. Build strict pilot cohort and confounder screens

```
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/build_pilot_pool.py
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/build_full_confounder_pool.py
```

### 3. Build official MIMIC ventilation-status episodes

The local implementation follows the MIT-LCP MIMIC ventilation concept.

```
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/extract_oxygen_delivery.py
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/build_mimic_ventilation_status.py
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/build_invasive_pilot.py
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/build_final_review_sample.py
```

### 4. Map only directly supported HumMod ventilator modes

```
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/map_supported_modes.py
```

Adaptive/vendor-specific modes are not silently converted to VC_AC or PC_AC.

### 5. Build pre-transition phenotype inputs and historical identification data

```
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/build_phenotype_inputs.py
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/build_preindex_peep_history.py
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/prepare_phenotype_fit.py
```

See `PHENOTYPE.md` and `phenotype_schema.json` for the no-future-leakage contract.

### 6. Extract controller timing/flow context

```
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/extract_vent_timing_flow.py
```

### 7. Controlled-mode prefit

```
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/export_controlled_fit_inputs.py
node research/mimic/fit_controlled_phenotype.js
```

The controlled-mode fitter uses only pre-transition data and records gas and mechanics
representability separately.

### 8. Pressure-support prefit

```
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/export_ps_fit_inputs.py
node research/mimic/fit_ps_phenotype.js
```

PS effort fitting uses:

- continuous Hennigs relative drive within the supported frequency envelope;
- one of the existing discrete transmission profiles;
- pre-transition RR, VT and minute ventilation only.

The project-created muscle-transmission scalar is not fitted continuously.

### 9. Local event index

```
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/build_fit_event_index.py
```

This local-only file maps hashed fit event IDs back to MIMIC identifiers and transition
timestamps. It must never be committed.

### 10. Freeze phenotypes

After all prefit code and results are final and committed:

```
/Users/philipbernard/.local/venvs/physionet/bin/python research/mimic/freeze_phenotypes.py
```

The frozen phenotype record stores the phenotype schema version and Git commit. Freeze
must occur before index-intervention prediction errors are inspected.

## Research integrity rules

- No post-index observation may be used in phenotype fitting.
- Do not tune fit bounds or weights using post-index prediction performance.
- Keep gas, mechanics and effort prefit quality as separate domains.
- Retain fail-closed and model-mismatch events as explicit model-limit categories.
- Do not add a direct PaO2 correction or unrestricted shunt knob.
- Do not commit patient-level MIMIC rows or fitted patient records.
