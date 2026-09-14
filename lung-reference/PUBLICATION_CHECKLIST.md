# Before publication

This is a computationally checked release candidate. It is not externally
validated, clinically approved, or accepted by a journal.

## Owner-controlled release decisions

- Supply actual author, affiliation, contact, ORCID, contributions, funding,
  and conflict-of-interest declarations in `author_metadata.json`.
- Confirm ownership and select software/documentation licenses; see
  `LICENSE_STATUS.md`. Do not advertise it as open source until a license exists.
- Review the AI-assistance disclosure and take responsibility for the source,
  mathematics, citations and manuscript. Check the target journal's current
  author instructions and disclosure requirements independently.
- Have a domain-qualified reviewer assess the model and teaching claims.
- Choose and document the intended audience and hosting location. Do not claim
  a public URL is live merely because files exist in this ZIP.

## Manual browser smoke checks still required

In at least two supported browser engines and at desktop/mobile widths:

1. Open `index.html` from disk and from a local HTTP server. Check the console
   for errors and confirm no application network requests are required.
2. Load each preset and compare values/history against `results/benchmark.json`.
3. Change an input; all previous output panels must clear and export must disable.
4. Set PEEP 12 and reset the history; it must become 12, not 30.
5. Enter a malformed history and an invalid tissue sum; specific errors must show
   without stale values. Check keyboard navigation and announced status changes.
6. Check trial header/value alignment, units, failure reasons, horizontal scrolling,
   and visible signed negative R/I* for Baseline.
7. Download results JSON, parse it, and rerun its configuration using Python.
8. Check all manuscript links and inspect the PDF on another PDF reader.

Automated in-memory DOM tests cover interface logic only. These real-browser
checks were not performed in the build environment because no browser executable
was available. Passing DOM tests is not a claim that this checklist was completed.

## Reproducibility and scientific claims

- Run `python3 verify_release.py` and require every command to pass.
- Regenerate manuscript and hashes after any code, input, or text change.
- Keep numerical-verification claims separate from physiological/educational
  validity; do not reintroduce LUNG SAFE/Chen distribution-reproduction claims.
- Do not present the sampled compliance maximum, MP, P/F, or R/I* as a treatment rule.
- Bench comparisons must target supported pressure/volume mechanics. A mechanical
  test lung alone cannot validate oxygen transport, hemodynamics, or learner outcomes.
- Prespecify additional tests, tolerances and validation endpoints before collecting
  evidence. Report failures and undefined scenarios, not just favorable cases.
