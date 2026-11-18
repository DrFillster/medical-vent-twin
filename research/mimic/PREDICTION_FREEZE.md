# Blinded MIMIC prediction freeze

## Freeze 1 — 60-minute trajectory

Status: frozen before post-transition outcome evaluation.

- Prediction-eligible events: 136
- Successful predictions: 136
- Missing: 0
- Duplicates: 0
- Eligible runtime failures: 0
- Horizons: 5, 15, 30, 60 minutes
- Phenotype schema: 0.2.0
- Prediction runtime commit: `fe9884dc3c2c7c84ccc6772e20cc4af814641fbb`
- Local prediction file: `/Users/philipbernard/mimic-data/derived/blinded_predictions_frozen.jsonl`
- SHA-256: `99c4cbac2574178c091133e9743e47561b97f64b608d7ea21a5f0605b988789b`

The patient-level prediction file is local only and is not committed to GitHub.

At the time this freeze was created, the prediction workflow had not opened post-transition MIMIC outcome values.

## Prediction eligibility

A transition must have a well-represented frozen pre-transition phenotype and an intervention supported by the mapped controller:

- FiO2: VC_AC, PC_AC, PS
- PEEP: VC_AC, PC_AC, PS
- set respiratory rate: VC_AC, PC_AC
- set tidal volume: VC_AC

One well-represented PC_AC/set-VT event was excluded because the intervention is not directly executable in that controller.

## Outcome-evaluation separation

Prediction generation and outcome evaluation are separate programs.

Prediction generation may read:
- frozen phenotype parameters;
- pre-transition measurements used for phenotype fitting;
- intervention identity and post-change ventilator setting.

Prediction generation may not read:
- post-transition ABG values;
- post-transition HR/MAP/SpO2;
- post-transition mechanics outcomes.

Outcome values may be opened only after a prediction file is frozen and hashed.
