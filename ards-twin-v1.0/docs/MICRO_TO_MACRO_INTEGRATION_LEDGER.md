# Micro-to-Macro Cardiopulmonary Integration Ledger

Date: 2026-10-12
Authority: architecture / integration ledger only
Clinical authority: none

## Governing rule

The digital twin must generate believable bedside physiology from source-backed
lower-level mechanisms. A locally source-correct module is not sufficient if
the integrated patient trajectory is implausible.

No macro endpoint may be forced merely to look correct. Missing source-valid
couplings remain explicit blockers.

## Current integration map

### 1. Gas exchange -> autonomic afferents

**Available**

- PaO2 / PaCO2 inputs from the live gas runtime.
- Ursino-Magosso peripheral chemoreceptor equations.
- pulmonary-stretch afferent driven by actual delivered tidal volume.
- Ursino baroreceptor afferent.
- CNS hypoxia / CO2 autonomic offsets in the candidate layer.

**Current problem**

The autonomic layer can produce strong cardiac sympathetic firing, but the
integrated candidate still does not produce a physician-believable tachycardic
macrostate.

**Next gate**

Run the chronotropy coupling audit before modifying any equation.

---

### 2. Autonomic output -> chronotropy

**Available**

- cardiac sympathetic firing `f_sh`;
- cardiac vagal firing `f_v`;
- Ursino/Magosso delayed first-order heart-period effectors;
- cardiovascular plant accepts one explicit heart-period input.

**Current problem**

The current physician tachycardia audit shows strong sympathetic activation
without HR >100/min in any tested challenge.

**Status**

SOURCE EQUATIONS PRESENT / INTEGRATED MAGNITUDE NOT ACCEPTED.

Do not add an HR overlay.

---

### 3. Autonomic output -> circulating catecholamines

**Available**

`hummod_ards_catecholamines_source_aligned.js` contains a source-aligned acute
HumMod subset for:

- adrenal nerve input;
- general ganglia spillover;
- norepinephrine pool;
- epinephrine pool;
- alpha and beta pool effects.

**Missing coupling**

The digital-twin candidate does not yet have a source-validated mapping from the
selected Ursino/Magosso autonomic state into the HumMod adrenal-nerve and
general-ganglia inputs.

**Status**

SOURCE MODULE AVAILABLE / CROSS-MODEL INPUT MAPPING BLOCKED.

Do not infer a mapping from similarly named neural variables.

---

### 4. Regional systemic circulation

**Available**

The Ursino-Magosso expanded cardiovascular candidate contains explicit beds for:

- splanchnic circulation;
- remaining extrasplanchnic circulation;
- skeletal muscle;
- cerebral circulation;
- coronary circulation.

The plant has explicit regional resistance and venous states and aggregates
those beds into the systemic circulation.

**Current limitation**

Regional metabolic / oxygen-delivery feedback is incomplete outside the
implemented local-O2 candidate pathways.

**Status**

STRUCTURAL PLANT AVAILABLE / REGIONAL METABOLIC COUPLING PARTIAL.

---

### 5. Microcirculatory oxygen availability

**Available**

`microcirculation_oxygen_shadow_contract.js` defines the integration boundary
for regional oxygen delivery, oxygen use, and effective local oxygen
availability.

**Not available**

No quantitative source-valid equations are yet selected for:

- functional capillary density;
- perfusion heterogeneity;
- extraction efficiency modifier;
- cellular utilization modifier.

Those fields intentionally remain null.

**Status**

ARCHITECTURE ONLY / QUANTITATIVE MODEL BLOCKED.

Do not manufacture microcirculatory disease gains.

---

### 6. Coronary flow and myocardial oxygen delivery

**Available**

`hummod_myocardial_flow_source_aligned.js` contains the source-aligned HumMod
implicit myocardial-flow / tissue-PO2 relation, including:

- coronary conductance;
- sympathetic vascular effect;
- tissue PO2-dependent conductance;
- metabolic conductance;
- aerobic fraction;
- O2 use;
- myocardial tissue O2 content / PO2.

**Required upstream states not yet fully connected**

- pressure gradient;
- alpha-receptor activity;
- ADH state;
- myocardial O2 need;
- viscosity effect;
- vasculature effect;
- infarction effect;
- arterial O2 content / hemoglobin state.

**Status**

SOURCE EQUATIONS AVAILABLE / LIVE PROVIDER INCOMPLETE.

---

### 7. Myocardial metabolism

**Available**

`hummod_myocardial_metabolism_source_aligned.js` contains source-aligned
myocardial:

- basal metabolic demand;
- work-related caloric demand;
- O2 need;
- O2 lack;
- aerobic and anaerobic caloric accounting.

**Status**

SOURCE PRIMITIVES AVAILABLE / NEEDS LIVE CORONARY-O2 INPUT CHAIN.

---

### 8. Myocardial lactate / CO2 / intracellular acid-base state

**Available**

Source-aligned modules exist for:

- myocardial lactate mass balance;
- myocardial CO2 mass balance;
- myocardial SID;
- myocardial intracellular pH;
- a stateful myocardial acid-base runtime.

**Known blockers**

The live runtime still needs source-complete upstream providers for:

- intracellular potassium;
- myocardial liquid volume;
- systemic lactate-pool state;
- myocardial flow / O2 use.

**Status**

SOURCE EQUATIONS AVAILABLE / LIVE STATE DEPENDENCIES INCOMPLETE.

---

### 9. Intracellular O2 / energetics / calcium / cross-bridge force

**Selected source architecture**

Crampin-Smith and the Shimayoshi/Takeuchi/Matsuoka implementation are the
selected candidate family for:

- intracellular pH effects;
- mitochondrial O2 dependence;
- ATP / ADP / PCr;
- calcium handling;
- cross-bridge force.

**Available**

A validated dynamic reduced-order Shimayoshi respiratory-acidosis surrogate and
the HumMod-to-Shimayoshi CO2 dimensional bridge exist in the repository.

**Blocker**

No source-valid mapping from cellular force to whole-heart ventricular Emax has
yet been established.

**Status**

CELLULAR MODEL AVAILABLE / WHOLE-HEART ADAPTER BLOCKED.

Do not multiply Emax directly by arterial pH, PaO2, ATP, or a cellular force
factor.

---

### 10. Electrical activation / conduction / terminal rhythm

**Required architecture**

Separate states are required for:

- SA-node activity;
- atrial activation;
- AV conduction;
- ventricular electrical activation;
- mechanical contraction;
- effective forward aortic flow.

**Current status**

No source-complete integrated conduction-failure model has yet been accepted
for the candidate digital twin.

**Status**

BLOCKED PENDING SOURCE SELECTION.

PEA must remain defined as organized ventricular electrical activation without
effective forward ejection, not by a timer or pH switch.

---

## Build order from this ledger

1. Complete chronotropy coupling diagnosis.
2. Resolve source-valid autonomic -> catecholamine input mapping or leave the
   catecholamine layer disconnected.
3. Connect the existing regional cardiovascular plant to source-valid regional
   oxygen-delivery / metabolic states.
4. Complete live coronary-flow and myocardial O2-delivery dependencies.
5. Complete myocardial acid-base state dependencies.
6. Run intracellular energetics / calcium / force in parallel.
7. Establish and independently validate a whole-heart force -> chamber
   mechanics adapter.
8. Select and validate an electrical-conduction model.
9. Only then allow terminal rhythm / mechanical-failure phenotypes to emerge.

## Validation rule

Every stage must pass both:

1. **Micro gate** — equation identity, provenance, units, parameter source, and
   coupling are source-supported.
2. **Macro gate** — the integrated trajectory is physician-believable across
   multiple stressors without endpoint-specific overlays.

Failure of either gate blocks promotion.
