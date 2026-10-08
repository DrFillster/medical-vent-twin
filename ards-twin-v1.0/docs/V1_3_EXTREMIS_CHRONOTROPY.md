# v1.3 Extremis Chronotropy Iteration

## Goal

Produce a physiologically plausible heart-rate trajectory in the unchanged extremis challenge without changing HumMod SA-node gains or inventing an unbounded tachycardia target.

## Source-grounded findings

The reduced HumMod autonomic subset still lacks native Brain-Fuel and skeletal-muscle metaboreflex state, both of which can increase `SympsCNS.NA` in full HumMod. The current browser core does not contain enough brain- or skeletal-muscle-specific metabolism to calculate those states faithfully, so arterial pH, PaO2, MAP, or oxygen debt were not substituted as proxies.

Native HumMod source inspection also confirmed that:
- baroreflex equations and time constants are already represented correctly;
- carotid pressure is systemic arterial pressure plus a hydrostatic gradient, so MAP is an appropriate neutral reduction when orthostatic gradients are absent;
- adrenal and catecholamine pool equations are already represented correctly.

## Explicit empirical bridge

Because the native metabolic sympathetic inputs are not yet available, v1.3 now adds a separate bounded hypercapnic-acidosis chronotropy bridge outside the HumMod SA-node equations.

The bridge:
- does not modify `SANode-Rate` curves, autonomic gains, catecholamine constants, or baroreflex constants;
- is capped to an in-vivo hypercapnic HR increment of 30/min;
- tracks time since onset of hypercapnic-acidotic exposure;
- remains fully active through the early approximately 2-3 minute exposure window;
- fades toward zero by 11.4 minutes of exposure;
- remains visible separately from `sourceSaNodeHeartRatePerMin`.

This is an engineering bridge, not a HumMod equation and not clinical validation.

## Extremis regression

Unchanged challenge:
- FiO2 0.20
- PEEP 8 cmH2O
- RR 4/min
- VT 0.10 L

Generated v1.3 browser engine result:
- peak effective HR: 113.1/min
- peak occurs at patient time 211 s, after 182 s of hypercapnic-acidotic exposure
- source HumMod SA-node rate at peak: 83.2/min
- empirical bridge contribution at peak: 29.9/min
- MAP at peak: 83.9 mmHg
- CO at peak: 5.44 L/min
- pH at peak: 7.114
- PaCO2 at peak: 81.0 mmHg
- PaO2 at peak: 15.8 mmHg

Thereafter HR declines:
- 481 s: 99.9/min
- 601 s: 93.8/min
- 721 s: 91.3/min, with bridge contribution zero

Terminal PEA still occurs at approximately 811 s in this run.

## Interpretation

This produces the expected qualitative pattern of early tachycardia followed by progressive decline during worsening asphyxia, while preserving the lower underlying HumMod SA-node output for provenance.

The bridge should be removed or reduced once native HumMod Brain-Fuel / metaboreflex / A2 traces are available and those pathways can be ported directly.
