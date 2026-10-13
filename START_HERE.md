# START HERE — Vent / Cardiopulmonary Digital Twin

## Current project state

- **Active branch:** `v1.6`
- **Recovery checkpoint before anti-regression governance:** `3ec2ea2aad34ef27b24bf0d2ce7ac6ef23e5e724`
- **Current clinical milestone:** **finish the integrated ARDS candidate first**
- **Project target:** one persistent bedside ARDS/sepsis cardiopulmonary digital twin that responds to ventilation and, after ARDS is coherent, vasoactive support.
- **HumMod role:** source/donor/comparator. **HumMod is not the acceptance standard.**
- **Acceptance authority:** source fidelity + internal conservation/consistency + independent physiology + physician review.

Always query the live `v1.6` branch HEAD before modifying code. The recovery checkpoint above is historical orientation, not a claim that HEAD is unchanged.

## Read order before changing code

A new agent/conversation MUST read, in order:

1. this file;
2. `candidate-state.json`;
3. the **CURRENT RECOVERY POINT** block at the top of `ards-twin-v1.0/HANDOFF.md`;
4. the relevant equation/source ledger before changing physiology;
5. the implementation and focused tests for the module being changed.

Do not begin by reading old release directories or chasing unresolved dependencies.

## Current architecture

| Domain | Current owner / candidate |
|---|---|
| Ventilator settings, airway mechanics, recruitment, waveforms, holds | **Vent** |
| Cardiovascular plant + autonomic candidate | **Ursino/Magosso source-family candidate** |
| Gas/autonomic coupling | Magosso/Ursino source-family candidate |
| ARDS pulmonary gas exchange | HumMod source-aligned equations, candidate-only |
| Pulmonary vascular/RV loading | candidate work in progress; do not invent coordinate bridges |
| Myocardial flow/O2/pHi/contractility | HumMod-2013 source-derived candidate chain |
| Sepsis/vasoplegia | **deferred until ARDS candidate is physician-testable** |
| Pressors/inotropes | **deferred until ARDS candidate is physician-testable** |

## Immediate work order

1. Finish ARDS gas exchange and V/Q/shunt authority.
2. Finish pulmonary vascular / RV-load coupling without inventing an absolute-volume transform.
3. Couple Vent pressure/PEEP effects to the integrated cardiovascular candidate.
4. Reconnect myocardial O2/pHi/contractility into that same persistent patient.
5. Produce a physician-testable ARDS candidate.
6. Only then resume sepsis/vasoplegia and pressors.

## Do not do now

- Do **not** rebuild whole-body HumMod.
- Do **not** expand endocrine/metabolic systems unless directly required to close a bedside-critical ARDS state.
- Do **not** work on sepsis or pressors before the ARDS milestone is complete.
- Do **not** tune equations to force expected clinical behavior.
- Do **not** use HumMod as a truth standard to which all other models must conform.
- Do **not** promote a shadow/candidate module merely because its code runs.
- Do **not** chase initialization differences unless they prevent reproducibility or materially alter trajectories.
- Do **not** turn modest biologically plausible mismatch into parameter tuning; surface it for physician judgment.

## Forbidden shortcuts

The following are explicitly prohibited unless a new source/validation decision supersedes them:

- `FRC + Vent.totalVolume` as absolute alveolar volume.
- Static `perfusionFraction * recruitment` as final regional pulmonary perfusion/VQ physiology.
- Arterial pH substituted for myocardial intracellular pH.
- Timer-based PEA/asystole or a fixed arterial-pH death switch.
- Direct MAP-targeting drug behavior in place of a sourced effector/receptor pathway.
- New unsourced gains introduced to make HR, MAP, CO, PVR, or contractility “look right.”

## Governing clinical target

The physician-facing v1.6 ARDS candidate should allow changes in **PEEP, VT, RR, FiO2 and airway pressure** and show one persistent patient's coupled response in:

- PaO2 / PaCO2 / pH;
- shunt/VQ state;
- PAP/PVR and RV load;
- HR, MAP, CO, SV, SVR;
- coronary flow / myocardial O2 state / myocardial pHi / contractility;
- terminal perfusion/rhythm state when produced by the equations.

## Source registries

Use these before adding/changing physiology:

- `ards-twin-v1.0/docs/physiology-registry.json`
- `ards-twin-v1.0/docs/PULMONARY_VASCULAR_CANDIDATE_EQUATION_LEDGER.md`
- `ards-twin-v1.0/docs/OXYGEN_DELIVERY_EVIDENCE_STACK.md`
- `ards-twin-v1.0/docs/VENT_TO_PULMONARY_VASCULAR_COORDINATE_AUDIT.md`
- relevant source-specific ledgers under `ards-twin-v1.0/docs/`

## Continuation rule

Before coding, be able to state:

> We are on v1.6. ARDS comes first. We are assembling the existing sourced modules into one persistent patient, not broadening the project. The current blocker is ____. The source owner is ____. The next test is ____.

If that statement cannot be made from repository state, stop and inspect the repository rather than guessing.
