# HumMod Respiratory Architecture: Focused Teardown

## Sources reviewed
1. Hester RL, Brown AJ, Husband L, et al. *HumMod: A Modeling Environment for the Simulation of Integrative Human Physiology.* Front Physiol. 2011;2:12. DOI: 10.3389/fphys.2011.00012.
2. Public HumMod GitHub organization and `hummod-standalone` repository.
3. HumMod Manual v2 (publicly indexed manual showing respiratory subsystem organization).
4. HumMod website descriptions of current scope.

Public source locations:
- https://pmc.ncbi.nlm.nih.gov/articles/PMC3082131/
- https://github.com/HumMod/hummod-standalone
- https://www.hummod.org/

## What HumMod does architecturally well

### 1. Physiology is separated from the solver
HumMod describes physiological relationships in editable XML `.DES` files while a separate executable parses and solves those equations. This is the most important pattern to borrow.

**Our translation:** keep patient physiology declarative/modular and keep numerical integration in a dedicated engine. Ventilator control is another module, not embedded in the lung equations.

### 2. System decomposition is explicit
Public HumMod structure separates major domains such as:
- Lungs
- RespiratoryCenter
- RespiratoryMuscle
- O2
- CO2
- AcidBase
- Circulation
- AirSupply / environment

The indexed manual further breaks respiratory physiology into areas including bronchi/inspired air, lung gases, gas exchange, lung volumes, pulmonary membrane, recruitment, oxygen diffusion and respiratory chemical drive.

**Our translation:** do not build one giant `LungModel`. Use narrow modules with explicit inputs and outputs.

### 3. Dynamic state is first-class
HumMod runs time-dependent physiology from seconds to long time horizons. State is advanced over time rather than recalculated only as isolated snapshots.

**Our translation:** simulation time and persistent state become fundamental primitives in v0.3.

### 4. Cross-system coupling is possible without hard-wiring everything together
HumMod's variable-based design allows respiratory, cardiovascular, acid-base and metabolic systems to interact through defined variables.

**Our translation:** define stable contracts now so pulmonary circulation, metabolism, spontaneous breathing and renal acid-base responses can be added later without rewriting the ventilator.

## What NOT to copy

### Whole-body complexity
HumMod is vastly broader than needed for an ARDS ventilation teaching simulator. Recreating thousands of variables would increase development and validation burden without improving the first educational target.

### Legacy file/runtime design
HumMod's Windows executable and XML runtime are not appropriate as the browser architecture for this project.

### Unclear derivative boundary
The public `hummod-standalone` README states that XML descriptions are GPL-2.0 but places separate restrictions on other source, derivatives, modification and commercialization. Therefore:

**Do not copy HumMod implementation code or equations into this project unless licensing is separately reviewed.**

Use HumMod only as an architectural/reference influence for this handoff.

## Architectural lessons adopted

| HumMod pattern | ARDS simulator equivalent |
|---|---|
| Physiology descriptions separate from solver | Patient model separate from integrator |
| System folders | Mechanics, recruitment, gas exchange, circulation, controller modules |
| Time-dependent state | Fixed-step simulation clock |
| Editable model parameters | Phenotype configuration objects |
| Cross-system variables | Typed state contracts / event bus |
| Interactive interventions | Ventilator control surface |

## Key conclusion
HumMod supports the decision to build a modular dynamic physiology engine, but it does **not** justify copying its full physiology or calling v0.3 a patient-specific digital twin. The near-term target remains a computational ARDS virtual patient.
