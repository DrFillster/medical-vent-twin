# Hypoxic HR direction: published-parameter adaptation

Date: 2026-11-07. Scope: parallel physician comparison candidate.

The production bedside HR controller remains HumMod 2013. The two Halliwill
failures exercised a separate Ursino-Magosso 2000 candidate. In that candidate,
matched hyperpnoea produced HR 91.04/min and adding hypoxia reduced it to
81.17/min. Sympathetic firing increased, but vagal firing increased from
2.52 to 4.22 spikes/s, outweighing the sympathetic acceleration.

## Source and implementation

[Albanese et al. 2016](https://journals.physiology.org/doi/full/10.1152/ajpheart.00230.2014),
Cardiovascular control / Table 7, explicitly reports that the original
Ursino-Magosso parameters produced inappropriate human HR and arterial-pressure
responses and supplies 11 revised parameters. The adaptation uses all 11,
without fitting them to Halliwill:

| Parameter | Published value |
| --- | ---: |
| Lung stretch gain | 11.76 spikes/(L s) |
| Resistance sympathetic baro / chemo / stretch weights | -1.1375 / 1.716 / -0.3997 |
| Venous sympathetic baro / chemo / stretch weights | -1.0806 / 1.716 / -0.2907 |
| Cardiac sympathetic baroreceptor weight | -1.75 |
| Brain / coronary / muscle local oxygen gains | 140 / 490 / 420 mL blood/mL O2 |

The venous and resistance sympathetic signals now have independent delayed
effector inputs; the published distinct weights must not be collapsed into
one vascular signal. Original 2000 behavior remains the default of the source
reproduction runtime. The physician comparison explicitly selects the named
2016 parameter adaptation. State provenance and the browser describe it as
an adaptation, not an exact 2000 or full 2016 reproduction.

The circulation, afferent chemoreceptor and effector equations remain the
existing 2000 implementation. This is therefore **not** a full Albanese 2016
model, and its published validation cannot be inherited. No change is made
to the bedside HumMod HR controller, contractility, collapse criteria or
qualification thresholds outside the pressure comparison described below.

## Qualification interpretation

The Halliwill harness uses the same named parameter set as the physician
comparison. It reports its gas-coordinate approximation and averages both
arms with the same complete-cycle-aligned trapezoidal method (minimum 10 s;
sampled cycle-boundary precision is the simulation time step). This avoids
comparing arbitrary phases of a pulsatile arterial-pressure waveform.

**The hypoxic HR must still strictly exceed matched-hyperpnoea HR in both
qualification suites.** On 2026-11-07 the physician accepted near-equal MAP
between those matched-breathing arms. The pressure check consequently requires
hypoxic MAP to exceed its own normoxic baseline, the pressure rise reported by
the study, rather than requiring it to exceed the matched-hyperpnoea arm.
Both matched-arm pressures and their difference remain in the evidence.
There is no fitted HR gain and no hidden numerical MAP tolerance.

At dt=0.002 s with cycle-aligned averaging: baseline HR 68.85/min,
matched-hyperpnoea HR 76.16/min, hypoxic HR 81.64/min; MAP respectively
89.00, 89.74 and 89.38 mmHg. The hypoxic HR increment over matched breathing
remains about 5.45-5.48/min at dt=0.002, 0.001 and 0.0005 s. The corresponding
matched-arm MAP differences are -0.36, -0.35 and -0.39 mmHg.

The earlier unaligned 10 s estimate of -0.10 mmHg was phase sensitive; it must
not be presented as the refined result. The HR direction is robust, while
the pressure difference is small and the absolute pressure response is muted.

## Limits retained

- [Halliwill et al. 2003](https://pmc.ncbi.nlm.nih.gov/articles/PMC2343329/)
  remains an independent directional comparison, not a calibration dataset.
- The model still raises HR during hyperpnoea alone, unlike that study; its
  response magnitudes and full human physiological validity remain unqualified.
- [Siebenmann et al. 2019](https://journals.physiology.org/doi/full/10.1152/japplphysiol.00701.2018)
  independently demonstrates ventilation-independent vagal withdrawal in awake
  humans. The current adaptation does not explicitly reproduce the separate
  aortic/carotid mechanisms discussed there. It must not be extrapolated as
  validated for sedation, apnea or ventilated ARDS.
- Original basal allocation, local oxygen equilibrium and Fig. 11 source
  reproduction checks remain separate; their remaining failures are retained.
- Source-domain failures stop the comparison with null current values and an
  explanation. They do not alter the bedside patient or synthesize outputs.

Reproduce the current comparison with
`node scripts/halliwill-2003-matched-hyperpnoea-validation.js`.
Reproduce the original source-family comparison with
`node scripts/halliwill-2003-matched-hyperpnoea-validation.js --control-parameter-set=ursino-magosso-2000`.
