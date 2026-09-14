# A Browser-Based Three-Compartment Lung Simulator for Ventilation Education: Development and Computational Verification

Release 0.2.0-rc1 | Development report | Not peer reviewed

Author, affiliation, correspondence and ORCID: pending owner completion before journal submission.

## Abstract

**Background:** Browser-based simulators can make ventilator-related concepts accessible without a physical simulator. However, software consistency, physiological validity, and educational effectiveness are distinct properties. An inspectable implementation should state its assumptions and provide reproducible verification without implying that matching selected outputs establishes clinical realism.

**Objective:** To develop a browser-deployable educational lung model, paired with a Python reference implementation, and report computational verification of its supported mechanics, gas-exchange and recruitment-index calculations.

**Methods:** The model combines three quasi-static tissue compartments, one lumped airway resistance, a finite-capacity exponential elastic law, and discrete recruitment relays with pressure history. Tissue fractions weight mechanics; independent perfusion fractions weight steady oxygen-content mixing. Supported ventilation is passive volume control with constant inspiratory flow. Recruitment state is fixed during inspiration, and full expiration is assumed. A signed recruitment-to-inflation-style endpoint index is calculated from settled model states, not an expired breath. Four assumed parameter sets, numerical-resolution studies, parameter sweeps, native unit checks, interface-adapter checks, and complete-record Python/JavaScript comparisons were evaluated. No patient or learner data were used.

**Results:** 36 Python tests, 24 JavaScript model tests, 14 interface-adapter/input-contract tests, and 49 complete cross-language scenarios passed. All executed verification commands passed. The illustrative single-step snapshots produced P/F values of 457.2, 193.0, 111.4, 62.4 and plateau pressures of 10.3, 15.4, 20.9, 34.3 cmH2O. These are model outputs, not cohort fits or diagnostic classifications. A no-recruitable-tissue case yielded a negative endpoint index because nonlinear inflation differed from the linear reference. Conditioning changed the model state and outputs at the same set PEEP. Undefined states were retained explicitly. Browser rendering, bench performance, physiological accuracy, expert face validity, and learning outcomes were not evaluated.

**Conclusions:** The artifact provides an executable, inspectable model and reproducible evidence of computational consistency within the tested domain. It is an educational exploration prototype, not a clinical decision tool. Neither software verification nor agreement between its implementations establishes physiological or educational validity.

Keywords: mechanical ventilation; computational verification; educational simulation; lung mechanics; recruitment; browser application

## 1. Introduction

Learning mechanical ventilation requires understanding interactions among pressure, volume, flow, recruitment, and gas exchange. Browser simulators can expose these interactions through repeatable experiments, but the presence of plausible monitor values does not establish that a model accurately reproduces a patient or improves learning. In a nonrandomized controlled non-inferiority study involving 70 first-year critical care fellows, Safadi and colleagues compared web-based and on-site simulators for ventilator-waveform education [4]. That study supports the relevance of evaluating educational outcomes; its findings cannot be transferred automatically to a different model or interface.

The functional "baby lung" concept motivates distinguishing aerated tissue from tissue unavailable for ventilation [1]. Here it serves as conceptual background, not as a claim that the following compartment equations or parameters were established by that work. The present artifact separates model design choices from the published saturation equation it uses [2] and from the bedside recruitment-to-inflation measurement that motivates an endpoint calculation [3].

The objectives were to implement an auditable quasi-static lung model, expose its assumptions in a browser, and verify defined numerical properties and agreement between two implementations. The study did not seek to reproduce LUNG SAFE distributions, assign Berlin ARDS grades, identify a clinical PEEP, or establish learner benefit. No systematic novelty search was performed, and no priority claim is made.

## 2. Methods

### 2.1 Design, implementation and scope

This is a software-development and computational-verification report. Python is the mathematical source of record; a JavaScript implementation supplies the browser and Node interfaces. The artifact comprises multiple static files with no application network calls or runtime library dependencies. It is not a single-file HTML simulator. Python 3.10+ and Node 18+ are required to reproduce the paired-language checks; neither is required to open the static browser interface.

The mechanical model is quasi-static, with three tissue classes and one lumped airway resistance. It is not a system of three parallel dynamic RC ordinary differential equations. All pressures in the mechanical equations are airway pressures unless identified as the effective distending pressure. Lung and chest-wall mechanics are not separated. No individual patient calibration, synchronization, clinical data, or learning process is present; the artifact is not a patient-specific digital twin.

### 2.2 Tissue mechanics and consistent compliance

Tissue fractions fN, fR and fC sum to one. Normal tissue is mechanically available; recruitable tissue has open fraction r; consolidated tissue contributes no elastic volume. Define cN=fN*C0 and cR=fR*r*C0. With r fixed, elastic volume above an arbitrary common reference is:

```text
p = max(P - AOP, 0)
V(P,r) = sum_i c_i*K_i*[1 - exp(-p/K_i)], i in {N,R}
C_tan(P,r) = sum_i c_i*exp(-p/K_i), for P >= AOP
C_tan(P,r) = 0, for P < AOP
```

The derivative at AOP is the right derivative. C0 has units L/cmH2O; K has units cmH2O. Exponential stiffening and its scales are phenomenological assumptions, not fitted patient mechanics. As pressure increases, elastic volume approaches a finite capacity. The model does not label this capacity an anatomical total lung capacity.

For a supported breath, set PEEP must be at least AOP. Baseline volume is V(PEEP,r), and plateau pressure solves V(Pplat,r)=V(PEEP,r)+Vt by 65-step bisection. The numerical bracket extends from AOP to AOP+1000 cmH2O; targets reaching capacity or outside the bracket are rejected. These are computational guards, not pressure recommendations. Tidal and tangent compliance are distinct:

```text
C_tidal = Vt / (Pplat - PEEP)                  [L/cmH2O]
integral from PEEP to Pplat of C_tan(P,r) dP
        = V(Pplat,r) - V(PEEP,r) = Vt          [L]
```

Displayed compliance multiplies the L/cmH2O value by 1000. The integral identity requires the same fixed recruitment state throughout. Increasing consolidation removes a contribution; it does not itself create a positive lower bound on system compliance.

### 2.3 Pressure-history recruitment

The recruitable compartment contains N equally weighted numerical relays, not anatomical alveoli. At relay index i=0,...,N-1:

```text
u_i = (i + 0.5)/N
close_i = max(0, closing_mid + width*log[u_i/(1-u_i)])
open_i = close_i + opening_mid - closing_mid
```

Thresholds refer to pressure above AOP. On each history step a relay opens when p>=open_i, closes when p<=close_i, and otherwise retains its previous state. The open fraction is the fraction of open relays. Every experiment starts with closed relays unless an explicit state is passed through the low-level API. Relays settle instantaneously at each history step and remain fixed during the modeled breath. Conditioning at 30 cmH2O initializes a model history; it neither guarantees every relay is open nor represents a recommended clinical maneuver.

### 2.4 Inspiratory airway work

For constant inspiratory flow Q, the airway pressure at tidal volume increment v is P_el(V_EE+v,r)+R*Q. The simulator evaluates:

```text
MP_insp = 0.0980665*RR*integral_0^Vt [P_el(V_EE+v,r)+R*Q] dv
Ppeak = Pplat + R*Q
MP_linear = 0.0980665*RR*Vt*[Ppeak - 0.5*(Pplat-PEEP)]
```

Volumes are in L, flow in L/s, R in cmH2O/(L/s), and work rate in J/min. The integral uses 240 trapezoidal intervals by default. The second expression is a linear-pressure-rise approximation shown for comparison, not treated as exact for the nonlinear model. The work convention includes the PEEP baseline relative to atmospheric pressure and airway resistive work. It is not parenchymal dissipated energy, total patient-plus-ventilator energy, or a modeled injury-risk threshold. Expiration is assumed complete; expiratory work, intrinsic PEEP, spontaneous effort and pressure-control ventilation are not simulated.

### 2.5 Gas exchange and acid-base assumptions

Perfusion fractions qN, qR and qC independently sum to one. A tissue compartment with zero tissue fraction cannot carry nonzero perfusion. Perfusion does not redistribute automatically with recruitment. Effective shunt is:

```text
s = qN*sN + qR*[(1-r) + r*sR] + qC
```

sN and sR are residual shunt fractions, not low-V/Q distributions. All ventilated perfusion shares a single alveolar PO2. Alveolar ventilation, CO2 and the fixed-bicarbonate pH calculation are:

```text
VA = RR*Vt*(1 - VD/VT)                         [L/min BTPS]
PaCO2 = 863*VCO2/VA                           [mmHg]
pH = 6.1 + log10[HCO3/(0.03*PaCO2)]
PAO2 = (PB-PH2O)*FiO2 - PaCO2*[FiO2+(1-FiO2)/RQ]
```

VCO2 is supplied in L/min STPD. Inspired CO2 is assumed zero and alveolar CO2 is approximated by the calculated arterial CO2. Dead-space fraction, bicarbonate, respiratory quotient and metabolic CO2 production are imposed, not dynamically estimated.

The baseline oxygen saturation equation is the Severinghaus polynomial form [2]: S0(x)=(x^3+150x)/(x^3+150x+23400). A numerical root identifies its baseline half-saturation pressure P50,base. The implemented curve is S(P)=S0(P*P50,base/P50), with user-specified P50 held fixed. This normalization is an explicit model choice. No automatic Bohr, temperature, 2,3-DPG or carboxyhemoglobin shifts are implemented.

```text
C_O2(P) = 1.34*Hb*S(P) + 0.0031*P            [mL O2/dL blood]
Cv = C_O2(PvO2), where S(PvO2)=imposed SvO2
Cc = C_O2(PAO2)
Ca = (1-s)*Cc + s*Cv
PaO2 solves C_O2(PaO2)=Ca
```

Oxygen content, rather than saturation or partial pressure, is mixed. A state with alveolar PO2 below the imposed venous PO2 is rejected. Fixed SvO2 is an externally imposed boundary, not the result of a cardiac-output/metabolism model. The interface reports modeled SaO2, not measured SpO2. P/F is calculated as PaO2/FiO2 without a diagnostic grade.

### 2.6 Signed endpoint recruitment index

The endpoint index is inspired by, but is not an implementation of the measured expired breath in, Chen and colleagues' bedside R/I method [3]. The independent model protocol starts closed, then steps through conditioning pressure 30, high pressure 15 and effective low pressure max(5,AOP), all in cmH2O. Let rH and rL be the resulting high and low states. If AOP>=15, the index is undefined.

```text
V_H = V(15,rH); V_L = V(P_low_eff,rL)
deltaP = 15 - P_low_eff
C_low = Vt / [Pplat_low - P_low_eff]
deltaV = V_H - V_L
expected = C_low*deltaP
R/I* = (deltaV - expected)/expected
```

Pplat_low is solved from the low-state volume law for the specified Vt, holding rL fixed. C_low is in L/cmH2O. Negative values are retained, not clipped. To identify what the index contains within this model, the implementation also evaluates a counterfactual high-pressure volume at the low state:

```text
V_recruit = V(15,rH) - V(15,rL)
V_inflate = V(15,rL) - V(P_low_eff,rL)
R/I* = V_recruit/expected + (V_inflate/expected - 1)
```

The two terms are a model recruitment component and a nonlinear inflation-reference bias. They are algebraic model diagnostics, not separately validated biological measurements. No numerical or directional agreement with Chen patient measurements, clinical cutoff, or recruiter category is claimed.

### 2.7 Decremental PEEP-compliance experiment

A separate experiment starts closed, conditions at 30, and evaluates PEEP 20 to 4 in decrements of 2 cmH2O. State is propagated between steps; within each breath it is fixed. Every row reports its pressure, tidal compliance and validity. Undefined rows retain a reason. The output identifies all sampled pressures tied for maximum valid tidal compliance and flags whether a maximum lies at the edge of the valid sampled domain. It reports no optimum when no valid rows exist. This is not a conventional P/V loop and does not identify Pflex. An interior sampled maximum is also not a clinical PEEP recommendation.

### 2.8 Inputs and experiment histories

The four cases are assumed numerical configurations named Baseline and Injury A-C. Their labels do not indicate epidemiological prevalence or Berlin grades. Snapshot outputs start closed and use one step at the set PEEP; the R/I* and sweep columns instead use the independent protocols in Sections 2.6-2.7. This distinction is preserved in the UI and exported JSON.

| Case | Tissue N/R/C | Perfusion N/R/C | AOP | R | VD/VT |
| --- | --- | --- | --- | --- | --- |
| Baseline | 0.98/0.00/0.02 | 0.98/0.00/0.02 | 0 | 6 | 0.3 |
| Injury A | 0.65/0.25/0.10 | 0.75/0.18/0.07 | 2 | 8 | 0.4 |
| Injury B | 0.40/0.40/0.20 | 0.55/0.30/0.15 | 4 | 10 | 0.5 |
| Injury C | 0.20/0.50/0.30 | 0.30/0.45/0.25 | 6 | 14 | 0.6 |

| Case | Vt (L) | PEEP | FiO2 | RR |
| --- | --- | --- | --- | --- |
| Baseline | 0.480 | 5 | 0.3 | 14 |
| Injury A | 0.420 | 8 | 0.4 | 16 |
| Injury B | 0.360 | 10 | 0.55 | 20 |
| Injury C | 0.280 | 14 | 0.8 | 26 |

Common defaults: C0=0.120 L/cmH2O; KN=30 and KR=22 cmH2O; opening midpoint=14, closing midpoint=6 and width=1.5 cmH2O above AOP; N=128; residual shunts sN=0.02 and sR=0.05; flow=0.50 L/s; PBW=70 kg; Hb=12 g/dL; SvO2=0.75; VCO2=0.200 L/min STPD; bicarbonate=24 mmol/L; RQ=0.8; PB=760 and PH2O=47 mmHg; P50=26.8 mmHg. Exact inputs accompany every case in results/benchmark.json. No PBW formula is needed to reproduce these cases because PBW is an explicit input.

### 2.9 Verification design and reproducibility

Native unit checks examine input rejection, volume/compliance consistency, inverse solutions, state behavior, conservation, endpoint decomposition, invalid states and work integration. An analytical single-compartment check in each language uses the primitive F(V)=K*[(capacity-V)*log(1-V/capacity)-(capacity-V)] to calculate elastic inspiratory work independently of the numerical inverse/trapezoidal routine. This is a limited special-case numerical check, not an independent clinical reference.

The paired-language comparison includes four cases under two histories, selected relay/AOP/Vt/FiO2/work-resolution sweeps, and 12 seeded multifactor configurations. The latter use seed 20260914 and vary tissue fractions, independent perfusion fractions, AOP, resistance, PEEP, Vt, FiO2, Hb and dead-space fraction within the ranges encoded in cross_check.py. They are software test scenarios, not sampled patients. Full nested output schemas, protocol states, all trial rows, and requested inspiratory traces are compared without preliminary rounding. Numerical tolerance is abs(a-b)<=max(1e-9,1e-9*max(abs(a),abs(b))). Booleans, relay vectors, strings, nulls and schemas require exact agreement; unexpected nonfinite values fail. Complete Python and JavaScript audit JSON records and the actual canonical preset configurations encoded in each implementation are compared too.

Power integration uses 60, 120, 240 and 480 intervals for one conditioned Injury C configuration. Recruitment resolution uses 64, 128, 256 and 512 relays. These checks assess sensitivity of selected numerical outputs and do not establish convergence throughout every possible input domain. Interface-adapter tests exercise canonical defaults, stale-output clearing, history reset, specific errors, trial-column mapping and export invalidation in an in-memory DOM. Real-browser rendering and file-download behavior were not tested in the build environment.

The tests are development verification, not a preregistered external evaluation. The release includes a one-command verification runner, captured logs, full-precision JSON, source hashes and manuscript-generation code. Source-derived table regeneration prevents manual reconciliation of numerical results.

## 3. Results

### 3.1 Computational and implementation checks

36 Python tests, 24 JavaScript model tests, 14 interface-adapter/input-contract tests, and 49 complete cross-language scenarios passed. All commands listed in results/verification.json completed successfully. Across the complete-record comparisons, the largest observed absolute difference among compared numeric scalars was 5.68e-14; because fields have different units, this maximum is a software diagnostic, not a pooled physiological error measure. The comparison criterion is relative-or-absolute as specified, not simultaneous satisfaction of two independent bounds.

### 3.2 Illustrative model outputs

| Case | P/F | Pplat | MP | PaCO2 | R/I* | Max-Crs PEEP | Edge? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | 457.2 | 10.3 | 7.0 | 36.7 | -0.073 | 4 | true |
| Injury A | 193.0 | 15.4 | 10.3 | 42.8 | 0.331 | 10 | false |
| Injury B | 111.4 | 20.9 | 14.2 | 47.9 | 0.918 | 12 | false |
| Injury C | 62.4 | 34.3 | 21.4 | 59.3 | 2.388 | 16 | false |

P/F is in mmHg, Pplat in cmH2O, MP in J/min, and PaCO2 in mmHg. Snapshot columns use the single-step history at the set PEEP. R/I* and the compliance-maximum PEEP use their separate conditioned protocols. All figures are rounded for presentation; unrounded records are supplied. No case was adjusted to fit a clinical cohort range. Baseline has zero recruitable tissue yet a negative R/I*, illustrating that the index includes nonlinear inflation-reference bias. Injury C's large positive index is reported without clipping or assigning a clinical category.

### 3.3 History and numerical sensitivity

For Injury C at PEEP 14 cmH2O, the single-step snapshot gave Pplat 34.32 cmH2O, MP 21.42 J/min and P/F 62.4. Changing only history to [30, 14] gave Pplat 20.18 cmH2O, MP 17.11 J/min and P/F 99.6; Hb remained 12 g/dL and VCO2 0.200 L/min.

Changing only history alters the relay state, explaining why the same set PEEP does not imply the same model mechanics or gas exchange. The two snapshots are not interchangeable observations of a single defined experimental condition.

In that conditioned configuration, 60/120/240/480 work intervals yielded 17.10551408 / 17.10549456 / 17.10548968 / 17.10548846 J/min. The absolute 240-to-480 difference was 1.22e-06 J/min. This is numerical-resolution evidence for this condition, not a clinical accuracy bound.

At 64/128/256/512 relays, the Injury C endpoint index was 2.36759 / 2.38789 / 2.37774 / 2.38281. The corresponding sampled compliance-maximum pressures were 16 / 16 / 16 / 16 cmH2O.

These selected checks do not quantify uncertainty in the assumed biological parameters. Full AOP, Vt, FiO2 and mechanical-fraction sensitivity outputs are supplied. They document model behavior, not agreement with patients. AOP at or above the high endpoint makes R/I* undefined; set PEEP below AOP makes the supported mechanics calculation undefined. Failures remain visible in exported records and the interface.

## 4. Discussion

### 4.1 Principal contribution

The main contribution is an inspectable implementation with a defined mathematical contract and reproducible verification, not a new clinically validated lung model. Consistent volume, compliance and inverse-pressure operations remove an important ambiguity of pressure-dependent compliance models. Separate tissue/perfusion weights avoid conflating mechanical volume fractions with blood-flow fractions. Explicit history and the endpoint-index decomposition reveal mechanisms that a single monitor value could conceal.

The browser supports experimentation without installing a numerical environment. Its suggested exercises compare histories, tidal versus tangent compliance, and endpoint-index behavior in the absence of recruitable tissue. These are proposed uses, not evaluated teaching interventions. Findings from other simulator education studies [4] do not demonstrate efficacy of this artifact.

### 4.2 Limits of the physiological representation

The elastic scales, tissue fractions, residual shunts and relay distributions are assumed rather than inferred from independent measurements. The model does not separate chest-wall and lung pressure, model regional airway closure, or represent time-dependent RC mechanics. Its scalar AOP acts as a shared pressure offset. The finite-capacity curve produces stiffening but is not a validated measure of overdistension or injury. Some mathematically accepted inputs may be physiologically implausible; software input checks are not patient-safety limits.

Gas exchange is a pure-shunt approximation with one ventilated alveolar PO2 and fixed boundaries. It cannot reproduce general V/Q distributions, cardiac-output feedback, dynamic metabolism, dyshemoglobinemia, pulse-oximeter behavior or whole-body acid-base regulation. The reported work includes the PEEP baseline and airway resistance, and excludes patient effort. No value is used to recommend sedation, neuromuscular blockade, extracorporeal support or a clinical ventilator setting.

R/I* is a settled-state volume calculation whose denominator depends on the chosen tidal breath. Its signed result can vary with Vt and nonlinear elastic shape even without recruitment. The counterfactual decomposition is exact only within this model. A compliance maximum depends on the sampling protocol and the assumed constitutive law; neither an edge nor an interior maximum establishes clinical benefit.

### 4.3 Limits of verification and next evidence

Python/JavaScript agreement demonstrates translation consistency, not independence of the underlying model. Shared conceptual errors can pass paired-language comparisons. Analytical checks cover special cases, and the selected sweeps and seeded configurations do not exhaust the input space or establish parameter identifiability. The original reference and this revision were AI-assisted; no independent clinical expert review is represented by this report.

The next evidence should match the intended claim. Independent mathematical review and supported passive-VCV bench comparisons could address mechanical accuracy. A mechanical test lung alone cannot validate oxygen transport, hemodynamics or learning outcomes; those require separate reference comparisons or appropriately designed studies. Expert appraisal should specifically assess misleading teaching behaviors, followed by usability and learning-outcome evaluation with prespecified endpoints. The present report contains none of these forms of validation.

### 4.4 Release and publication status

The package is a release candidate, not a deployed or journal-accepted publication. No software license has been selected on the owner's behalf, so the artifact is not described as open source. Author details, ownership/licensing, declarations and browser smoke checks remain owner-controlled publication requirements. No claim of a live public URL, regulatory clearance or journal suitability is made.

## 5. Conclusions

A three-compartment educational lung explorer can be implemented with consistent quasi-static mechanics, explicit pressure history, oxygen-content mixing and reproducible computational checks. This release demonstrates those software properties in the tested configurations. It does not demonstrate physiological validity, medical decision utility or improved learning. The artifact should be used to inspect model assumptions and explore their consequences, with those limits visible to users.

## Declarations

**Data and participation:** This development work used no individual patient data, recruited participants, or learner observations. No ethics approval is claimed; the authors must confirm the institutional and journal requirements applicable to their submission.

**AI assistance:** The reference implementation, software review, interface and manuscript revision were developed with generative-AI assistance. This disclosure records assistance, not independent expert validation. Human authors must verify the material, describe actual contributions, and take responsibility for the submitted work.

**Funding:** To be supplied by the author before submission.

**Conflicts of interest:** To be supplied by the author before submission.

**Contributions:** To be supplied by the author before submission.

**Availability and provenance:** Release 0.2.0-rc1 includes the model, tests, browser interface, manuscript sources, generated numerical records and SHA-256 manifest. Python source SHA-256: f265bae938a143ae3231cd41e4b9d7eb639cc673cba71f6a894529894433770a. The release manifest identifies the other files. The supplied previous package was preserved; no clinical validation or data fitting was added in this rewrite.

## References

[1] Gattinoni L, Pesenti A. The concept of "baby lung." Intensive Care Med. 2005;31(6):776-784. [doi:10.1007/s00134-005-2627-z](https://doi.org/10.1007/s00134-005-2627-z).

[2] Severinghaus JW. Simple, accurate equations for human blood O2 dissociation computations. J Appl Physiol. 1979;46(3):599-602. [doi:10.1152/jappl.1979.46.3.599](https://doi.org/10.1152/jappl.1979.46.3.599).

[3] Chen L, Del Sorbo L, Grieco DL, et al. Potential for lung recruitment estimated by the recruitment-to-inflation ratio in acute respiratory distress syndrome: a clinical trial. Am J Respir Crit Care Med. 2020;201(2):178-187. [doi:10.1164/rccm.201902-0334OC](https://doi.org/10.1164/rccm.201902-0334OC).

[4] Safadi S, Acho M, Maximous SI, et al. Comparison of web-based and on-site lung simulators for education in mechanical ventilation. Respir Care. 2024;69(11):1353-1360. [doi:10.4187/respcare.12072](https://doi.org/10.4187/respcare.12072).
