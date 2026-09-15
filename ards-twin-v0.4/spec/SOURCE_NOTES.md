# Source Notes

## Current project source
The included v0.2.0-rc1 manuscript states that the current model is quasi-static, has three tissue classes and one lumped airway resistance, is not a three-parallel-RC ODE system, is passive volume-control only, freezes recruitment within a modeled breath, assumes complete expiration, and does not model pressure-control or spontaneous effort. That is the architectural gap this handoff addresses.

## HumMod public architecture
Hester et al. describe HumMod as an integrative, time-dependent physiological model in which physiological relationships are encoded in editable XML and interpreted by a separate solver. Public repository structure separates lungs, respiratory control, O2, CO2, acid-base and circulation domains. These separation-of-concerns patterns informed this architecture.

## Licensing
The public HumMod standalone README states XML descriptions are GPL-2.0 and describes separate restrictions for other HumMod source/derivative use. No HumMod code is included in this package.
