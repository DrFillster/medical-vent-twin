# Disease context, exact chart reconstruction and longer-run results

## Development disease context available

All 19 cases now linked to hospital discharge codes and exact dictionary titles:
453 rows retained outside git. Titles include pneumonia, aspiration pneumonitis,
chronic airway obstruction/emphysema, heart failure and obesity. This is a
retrospective context inventory, not a diagnosis at the prediction time or
phenotype assignment. Codes may describe complications occurring later. They
are excluded from prospective fitter inputs. Outcome-related discharge context
has now been inspected for development patients; these remain development only.
No post-change physiologic outcome measurements read.

## Original source reconstruction

Legacy latest-chart selection with its inclusive cutoff reproduces all 247
field checks across 19 cases, including 75 missing values. Among 172 present
selected sources, 114 have charttime equal to intervention; 49 have chart and
store times strictly earlier. Four fields have top timestamp ties. Exact value
reproduction is established, not unique original row identity when tied.
Same-minute documentation can reflect workflow rather than contamination;
these fields need ordering evidence or a strictly earlier replacement before
prospective use. Saved fitting results remain unchanged development evidence.

Strict earlier-source packet built separately: 112 raw fields found, 110
unambiguous raw fields pass time/type gate, 61 match saved field values.
Do not compare 61 to 63 from previous value-candidate audit: this packet chooses
the latest available row, not any older row matching the old target. It does
not silently refit old cases; packet remains prediction-not-ready.

## Dictionary and unit review

Local bootstrap d_items dictionary inspected. General, inspiratory and
expiratory resistance have distinct labels and must not be interchangeable.
Compliance dictionary carries a unit string inappropriate to a simple numeric
compliance interpretation. Resistance and compliance blocked from numeric fit
use pending type/unit/source review. Other raw values still need clinical
validity/context and matching simulator units, not blanket qualification.

## Blood-gas availability

Recovered raw pH/PCO2/PO2 chart/store times for latest complete pre-transition
arterial specimen. All three component timestamps strictly available in 18 of
19 cases (54 of 57 components). One case has delayed availability. Agreement
with original target values, specimen ties, and alternative earlier specimen
selection remain to review; no blood-gas-derived quantities calculated here.

## Longer synthetic tests

Four pressure-support configurations completed 600 seconds each with finite
volume checks every ten seconds and positive final completed breath volume.
Distinct control effects remain tested. This is longer execution coverage,
not physiological stationarity, stability bounds or clinical validation.
No gas-error or cardiovascular accuracy inference from this test.

## Checks and next block

Synthetic 19-case disease-context test passes delayed result, future specimen
exclusion and discharge-code firewall. Strict packet assertions verify both
timestamps and tie exclusion. Mechanics batch tests retained.

Next: ventilator setting timestamps and lab target agreement; then medication
start/store context and clinically reviewed developmental example selection.
No disease states assigned yet. Recruitment legacy mismatch remains tracked.
No production edits. Patient records remain outside git.
