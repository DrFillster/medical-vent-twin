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
