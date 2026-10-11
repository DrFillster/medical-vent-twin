# Shimayoshi respiratory-acidosis CO2 source grid result

Date: 2026-10-11

Pinned upstream source:
`atakeuti/TS-AT-SM-2026-IRmodel@6478d2ab0acbfc88d3da461d2594658bcb2798ca`

Validated source-grid run:
- GitHub Actions run: `38164241750`
- artifact: `v15-shimayoshi-co2-source-grid`
- artifact ID: `11711169046`
- artifact digest:
  `sha256:c039492d3a62740d05a910cb70be8a41bc10a0a87fe664d920ef942cf68e93fb`

Each challenge used the native Shimayoshi respiratory-acidosis equations:
- 0-300 s: control
- 300-900 s: challenge
- 900-960 s: recovery
- paced-cycle output every 0.4 s
- external CVODE target cadence 0.2 ms

The 0.2 ms extraction cadence had already been validated against the source
0.1 ms cadence through acidosis onset.

## Source response by CO2 challenge

| CO2 challenge | Mean challenge stress ratio | Minimum stress ratio | Force-nadir time | Minimum pHi | Minimum-pHi time |
|---:|---:|---:|---:|---:|---:|
| 5% | 0.9999951 | 0.9999924 | 898.4 s | 7.1448090 | 300.0 s |\n| 10% | 0.9758252 | 0.9718626 | 464.0 s | 6.9964744 | 583.6 s |
| 15% | 0.9502849 | 0.9417766 | 455.6 s | 6.9002803 | 585.6 s |
| 20% | 0.9311322 | 0.9153867 | 431.6 s | 6.8329764 | 538.0 s |
| 25% | 0.9178497 | 0.8931375 | 412.4 s | 6.7845222 | 506.8 s |
| 30% | 0.9076674 | 0.8731003 | 401.2 s | 6.7449572 | 490.0 s |

Across all 1,500 source cycles in the challenge interval, peak `Fb` was
monotonically non-increasing as the imposed extracellular CO2 challenge rose
from 10% to 30%.

## Leave-one-challenge-out validation

Piecewise-linear interpolation in challenge CO2 percent was tested by removing
each interior source level and reconstructing it from its two neighboring
source trajectories.

| Held-out level | Training bracket | Max relative Fb error |
|---:|---:|---:|
| 10% | 5%-15% | 0.1323% |\n| 15% | 10%-20% | 0.5433% |
| 20% | 15%-25% | 0.4016% |
| 25% | 20%-30% | 0.2126% |

This validation is against source `Fb`, not HR, MAP, CO, SV, SVR, arterial
pH, or PaCO2.

## Time compression

For browser use, each 2,400-cycle source trajectory can be represented by
adaptive piecewise-linear stress-ratio keyframes with a declared maximum
absolute source stress-ratio representation error of `0.0002`.

For the 10%-30% grid this requires:
- 10%: 19 keyframes
- 15%: 31 keyframes
- 20%: 38 keyframes
- 25%: 40 keyframes
- 30%: 46 keyframes
- total: 174 keyframes

Combined time compression plus leave-one-challenge-out interpolation produced
maximum relative `Fb` errors of:
- 15%: 0.5511%
- 20%: 0.3999%
- 25%: 0.2151%

Source phase-boundary cycles are retained explicitly so interpolation does not
cross the 300 s challenge-on or 900 s recovery transition.

## Authority

This source grid is a myocardial-force **shadow** only.

It does not grant:
- whole-heart Emax authority;
- LV pressure control authority;
- closed-loop circulation authority.

The 5% source trajectory is being generated separately so the final validated
domain includes the Shimayoshi control CO2 boundary rather than beginning at
10%.
