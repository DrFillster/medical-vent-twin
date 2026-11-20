# Pressure-support and development-source batch

## Executed pressure-support integration tests

Four coupled synthetic configurations ran 60 simulated seconds each, inspected
at six intervals: baseline, lower drive, lower muscle transmission, higher
resistance. All had finite endpoint volume and positive completed breath volume.
Drive and transmission override values were checked separately. Each variant
changed completed breath volume. Lower drive yielded larger individual breath
volume and fewer completed breaths in this fixture; do NOT interpret lower drive
as necessarily lower tidal volume. Record timing/cycling as well as volume.
No long-term stability or physiological accuracy claim from 60-second tests.

## First source-time audit across all 19 development examples

Read pre-transition chart rows for 13 measurement fields, 247 case-field checks.
63 checks have a same-valued candidate with both chart/store times strictly
before transition. Seven have same-valued chart candidates but late/unknown
storetime. 75 have missing manifest values; 102 have no match under strict
cutoff. These are field checks, NOT patient counts, and no-match is not proof
of leakage: exact-transition rows are excluded, mappings/windows and original
extraction identity still need review. Same-valued earlier candidates are not
proof of original source identity. Existing fits remain unmodified.

Original phenotype extractor includes charttime equal to transition and does
not limit storetime to cutoff. These are prospective-availability risks to
resolve before new fitting or held-out accuracy claims. This audit reads no
post-transition chart rows or outcome measurements. Patient source records
remain outside GitHub. Synthetic 19-case test verifies late-store, exact-cutoff
exclusion and explicit candidate-only provenance across all events.

## Remaining work

Verify mappings against local dictionary (not found at initial raw gzip path),
reconstruct exact original timestamped source selections, audit lab and setting
sources, then extract clinical context. Retrospective diagnosis annotations
remain separate. Continue explicit-config longer runs and recruitment regression.

Six mechanics/integration test programs plus synthetic source audit PASS.
Known recruitment mismatch remains reproduced, not fixed in production.
