**A Three-Compartment Mechanistic Lung Simulator for Mechanical
Ventilation Education**

*Development and Computational Verification of an Inspectable
Browser-Based Model*

Author(s): [Add details here]

Affiliation(s): [Add details here] | Corresponding author: [Add
details here] | ORCID: [Add details here]

Version evaluated: v0.4.4.1 | Educational exploration prototype | Not
a clinical decision tool

# Abstract

Background

Mechanical ventilation is difficult to teach because the relationship
among pressure, flow, volume, resistance, compliance, and recruitment is
dynamic and often hidden inside commercial simulators. An educational
model is most useful when its assumptions are explicit, its internal
state is inspectable, and numerical failure is distinguishable from a
physiologically impossible request.

Objective

To describe the development and computational verification of a
browser-based, three-compartment mechanistic lung simulator designed for
education and model exploration, with emphasis on transparent
initialization, solver behavior, and failure semantics.

Methods

The simulator represents the lung as three quasi-static tissue
compartments connected through a common central airway resistance and
compartment-specific branch resistances. Each compartment follows a
finite-capacity nonlinear elastic pressure-volume relationship and may
undergo discrete recruitment or derecruitment. Patient-like mechanical
parameters are separated from scenario-dependent choices such as initial
PEEP, recruitment state, and ventilator settings. The numerical solver
uses an analytic Jacobian, scaled convergence criteria, and
direction-aware boundary checks. Computational verification included
initialization, Jacobian accuracy, resistance-compliance behavior,
conservation laws, recruitment constraints, volume- and
pressure-controlled ventilation, timestep convergence, failure
semantics, and step-level solver instrumentation.

Results

The v0.4.4.1 release passed 127 prespecified acceptance assertions
across 21 test files with no failures. Multi-breath simulations were
stable across all four mechanical phenotypes in both volume-controlled
and pressure-controlled modes. Timestep refinement from 2 ms to 1 ms to
0.5 ms showed monotone convergence in the tested scenarios. Failed steps
preserved time and state, and the simulator distinguished boundary
infeasibility from solver non-convergence. In an illustrative
high-recruitability scenario at PEEP 5 cmH2O and a 1 ms timestep, 10
seconds of simulated time completed in approximately 1.5 seconds with no
solver failures.

Conclusions

This release establishes computational consistency and transparent
failure behavior within the tested domain. It does not establish
physiological accuracy, clinical validity, or educational effectiveness.
The current system is best described as a mechanistic lung simulator
rather than a patient-specific digital twin.

Keywords: mechanical ventilation; simulation; lung mechanics;
recruitment; numerical methods; medical education; computational
verification

# Introduction

Mechanical ventilation requires learners to reason simultaneously about
airway pressure, flow, lung volume, resistance, compliance, time
constants, and recruitment. These relationships are familiar in
isolation but become harder to interpret when several mechanisms
interact over successive breaths. Simulation can make those interactions
visible, but only if the model is sufficiently transparent for the
learner - and the reviewer - to understand what the software is assuming
and why it behaves as it does.

Educational lung simulators span physical test lungs, high-fidelity
mannequins, and software models. Web-based systems offer an additional
advantage: they can expose state variables, equations, and solver
diagnostics directly to the user and can be distributed without
dedicated hardware [1-3]. That transparency also creates a
methodological obligation. A model that produces plausible waveforms but
silently guesses missing state, violates conservation, or obscures
numerical failure can teach the wrong lesson while appearing credible.

The present work therefore focuses on computational verification rather
than clinical validation. We developed a browser-based simulator that
represents the lung as three mechanically distinct compartments and
explicitly separates intrinsic model parameters from scenario-dependent
clinical choices. We then tested whether the implementation behaves
consistently with its own equations, preserves state when a numerical
step fails, and differentiates an impossible requested boundary
condition from ordinary solver non-convergence.

The principal contribution of this release is not a new clinical model
of acute respiratory distress syndrome (ARDS). The four available
phenotypes are deliberately labeled as mechanical constructs -
Reference, Low-recruitability, Moderate-recruitability, and
High-recruitability - and are not mapped to Berlin ARDS severity
categories or to clinical cohorts. The goal is a reproducible
educational substrate on which later physiologic calibration and
educational validation can be built.

# Methods

## Model architecture

The simulator uses three quasi-static lung compartments representing
mechanically distinct regions of lung tissue. Each compartment has its
own nominal capacity, elastic stiffness, resistance, perfusion fraction,
dead-space fraction, and recruitment state. The compartments share a
central airway resistance before flow divides into the branch pathways.
This topology allows the model to express heterogeneous filling and
emptying while retaining a compact state space that can be inspected in
real time.

For each open compartment, volume is related to pressure by a
finite-capacity exponential elastic law. As compartment volume
approaches its available capacity, the slope of the pressure-volume
relationship steepens. The analytic derivative of this relationship is
used directly by the Newton solver rather than estimated numerically.
Closed compartments are constrained to zero volume and zero recruitment.

## Separation of phenotype and scenario

A central design decision was to separate parameters intended to
describe the mechanical phenotype from parameters that define a
particular simulation scenario. The phenotype contains tissue and airway
properties; the scenario contains the starting state and ventilator
choices. In particular, initial PEEP and initial recruitment state are
supplied explicitly by the caller. If either is missing, initialization
fails rather than substituting a hidden default. This change was
introduced after earlier development versions showed how silently
inferred recruitment could propagate through downstream comparisons.

  -----------------------------------------------------------------------
  **Component**           **Stored in phenotype** **Supplied by
                                                  scenario**
  ----------------------- ----------------------- -----------------------
  Mechanical properties   Compartment fractions,  \-
                          resistance, capacity,   
                          elastic stiffness,      
                          perfusion/dead-space    
                          fractions               

  Shared airway           Central airway          \-
                          resistance; airway      
                          opening pressure        

  Initial state           \-                      Initial PEEP; initial
                                                  recruitment state

  Ventilator              \-                      Mode, FiO2, PEEP,
                                                  respiratory rate, tidal
                                                  volume or pressure
                                                  target, flow/timing
                                                  settings
  -----------------------------------------------------------------------

## Mechanical phenotypes

Four prespecified mechanical phenotypes are included. Their names refer
to the size of the recruitable pool and are intended only to provide
reproducible test conditions. They are not clinical diagnostic
categories.

  -----------------------------------------------------------------------
  **Internal identifier**             **Display label**
  ----------------------------------- -----------------------------------
  phenotype_baseline                  Reference phenotype

  phenotype_low_recruitability        Low-recruitability phenotype

  phenotype_moderate_recruitability   Moderate-recruitability phenotype

  phenotype_high_recruitability       High-recruitability phenotype
  -----------------------------------------------------------------------

## Numerical solution and convergence

At each mechanics step, the solver determines the change in compartment
volumes together with the common branch pressure while enforcing the
requested total flow. Newton iteration is driven by an analytic
Jacobian. Residuals are normalized to bounded volume and pressure
reference scales so that convergence tolerance does not become
artificially permissive in large-capacity states. The implementation
also uses line search and adaptive subdivision when a full step cannot
be accepted.

If Newton iteration cannot find an acceptable solution, the simulator
performs a direction-aware feasibility check. During inspiration, the
requested incremental volume is compared with remaining available
capacity. During expiration, requested removal is compared with the gas
volume that can actually be removed. A step that exceeds these necessary
bounds is classified as INFEASIBLE_BOUNDARY; otherwise the failure is
classified as SOLVER_NONCONVERGENCE. The nonlinear solve remains
authoritative - the boundary checks are used to interpret failure, not
to replace the solver.

## Failure semantics and instrumentation

A failed mechanics step is transactional: simulation time does not
advance and the partially computed state is not committed. Per-step
diagnostics record Newton iterations, subdivision depth, line-search
halvings, active-set transitions, residual measures, and convergence
status. These diagnostics were included so that a user or reviewer can
distinguish a difficult but converged step from one that failed or
required substantial numerical intervention.

## Computational verification

Verification was organized as prespecified acceptance tests rather than
retrospective examples. The battery addressed the model implementation
at several levels: local constitutive behavior, network conservation,
multi-breath controller behavior, timestep sensitivity, and explicit
failure contracts. Tests were executed in CommonJS mode under Node
v26.8.2 using the package test runner.

  -----------------------------------------------------------------------
  **Domain**                          **What was tested**
  ----------------------------------- -----------------------------------
  Initialization                      Pressure-consistent initialization;
                                      closed-compartment behavior; lower
                                      volume bound; rejection of missing
                                      recruitment state

  Constitutive law                    Analytic Jacobian compared with a
                                      numerical derivative

  Single-compartment dynamics         Small-signal time constant
                                      approximately equal to resistance x
                                      tangent compliance

  Network physics                     Central and branch flow
                                      conservation; pressure drop across
                                      central resistance

  Resistance limit                    Peak-to-plateau pressure difference
                                      approaches zero as resistance
                                      decreases

  Recruitment constraints             Closed-compartment invariants and
                                      derecruitment feasibility
                                      projection

  Multi-breath simulation             Volume-control and pressure-control
                                      stability across all four
                                      mechanical phenotypes

  Numerical convergence               Monotone behavior with timestep
                                      refinement at 2, 1, and 0.5 ms

  Failure behavior                    State preservation on failed steps;
                                      separation of infeasible boundary
                                      conditions from non-convergence

  Instrumentation                     Presence and validity of per-step
                                      solver statistics, including
                                      active-set transitions
  -----------------------------------------------------------------------

# Results

## Acceptance testing

All 127 acceptance assertions passed across 21 test files; no assertion
failed. The passing set covered initialization and state contracts,
analytic derivatives, small-signal dynamics, conservation, resistance
limits, recruitment behavior, multi-breath operation, timestep
convergence, failure semantics, and solver instrumentation.

  -----------------------------------------------------------------------
  **Verification section**            **Assertions passed**
  ----------------------------------- -----------------------------------
  Initialization and state contract   11/11

  Analytic Jacobian                   3/3

  Small-signal dynamics               1/1

  Conservation and airway topology    8/8

  Low-resistance limit                2/2

  Recruitment invariants              4/4

  Multi-breath VC/PC stability        5/5

  Timestep convergence                3/3

  Failure semantics                   7/7

  Solver instrumentation              4/4
  -----------------------------------------------------------------------

The remaining package-level tests covered additional controller,
gas-exchange, metric, and determinism behavior; together they produced
the total of 127 passing assertions.

## Multi-breath behavior and timestep refinement

Volume-controlled and pressure-controlled simulations completed across
all four mechanical phenotypes without solver failure in the designated
acceptance scenarios. Timestep refinement from 2 ms to 1 ms to 0.5 ms
produced monotone convergence in the tested volume-control and
pressure-control cases. These results support numerical consistency of
the current implementation within the tested operating domain; they do
not establish that the underlying parameter choices reproduce human
physiology.

## Failure classification

The failure contract behaved as intended. When a step failed, the
simulator preserved both simulation time and total lung volume rather
than committing a partial update. Tests separately exercised impossible
inspiratory filling and impossible expiratory emptying, confirming that
both could be classified as boundary infeasibility. Feasible expiration
did not trigger the infeasibility classifier. This distinction is
important for an educational simulator because "the model cannot
converge" and "the requested state cannot exist within the model" are
conceptually different events.

## Illustrative performance benchmark

Performance was measured as an engineering benchmark rather than a
correctness criterion. In the High-recruitability phenotype with PEEP 5
cmH2O and a 1 ms timestep, 10 seconds of simulated time required
approximately 1.5 seconds of wall-clock time. The run contained 10,000
mechanics steps, 5,859 Newton iterations, and no solver failures.
Approximately 31.9% of steps required bounded subdivision, and nine
active-set transitions were recorded.

  -----------------------------------------------------------------------
  **Metric**                          **Observed value**
  ----------------------------------- -----------------------------------
  Simulated duration                  10 s

  Mechanics timestep                  1 ms

  Mechanics steps                     10,000

  Wall-clock time                     \~1.5 s

  Total Newton iterations             5,859

  Mean Newton iterations per step     0.59

  Subdivision-bounded steps           31.92%

  Active-set transitions              9

  Solver failures                     0
  -----------------------------------------------------------------------

A separate three-breath instrumentation test observed three active-set
transitions across 6,924 mechanics steps. That test exists to verify
that the transition counter is connected and exercised; the observed
transition frequency is not presented as a physiological quantity.

# Discussion

This work describes a deliberately modest milestone: a mechanistic lung
simulator that can explain its own numerical behavior. The principal
result is not that the model is clinically realistic, but that its
internal rules are consistently applied and testable. That distinction
matters in simulation research. Before asking whether a model represents
patients, it should first be possible to show that the software
represents the model it claims to implement.

Three design choices appear especially important for educational use.
First, separating phenotype from scenario prevents ventilator choices or
hidden starting conditions from masquerading as patient characteristics.
Second, the analytic Jacobian and scaled convergence rules make solver
behavior more reproducible across operating regimes. Third, explicit
failure semantics preserve state and provide a reason for failure rather
than allowing an unstable or impossible step to contaminate subsequent
breaths.

The three-compartment structure is intentionally interpretable. It can
represent regional heterogeneity in resistance, elastic behavior, gas
capacity, perfusion, dead space, and recruitment without requiring a
high-dimensional anatomical model. This makes it useful for
demonstrating mechanisms such as unequal time constants, pressure-flow
relationships, and recruitment-dependent capacity. At the same time, the
simplicity of the architecture means that many clinically important
phenomena are absent or highly abstracted. A passing software test
cannot compensate for missing physiology.

The term "digital twin" is therefore not used for the current release.
In clinical and engineering literature, a digital twin generally implies
a model linked to a specific physical system through patient- or
device-specific data and ongoing calibration. The present simulator is
neither patient-specific nor calibrated to measured bedside data.
Reserving that terminology avoids implying a level of clinical
personalization that has not been demonstrated.

## Limitations

Several limitations are fundamental. The mechanical phenotypes were
chosen as inspectable educational constructs rather than fitted to human
ARDS cohorts. The selected stiffness values and recruitability patterns
are didactic parameters, not validated population estimates. Gas
exchange and other downstream metrics included in the software are
outside the scope of this computational-verification report. No expert
face-validity study, learner study, or comparison with clinical
waveforms is presented here.

The active-set transition mechanism is instrumented but only sparsely
exercised in the benchmark scenario. A more explicit active-set or
boundary formulation is planned for later development.
Historical-pressure initialization is also not implemented; callers must
currently provide an explicit initial recruitment state. Finally,
browser rendering and user-interface behavior were not part of the
acceptance battery reported here.

## Implications and next steps

The next stage should move from software verification toward validation
in two separate directions. Physiologic validation would require
prespecified comparisons between simulator outputs and measured or
well-characterized experimental or clinical data. Educational validation
would require usability and learning-outcome studies in the intended
learner population. Those studies should be treated as distinct from the
numerical verification presented here.

# Conclusion

Version 0.4.4.1 provides an executable, inspectable three-compartment
lung simulator with reproducible evidence of computational consistency
in its tested domain. The release explicitly separates mechanical
phenotype from simulation scenario, uses an analytic and scaled
nonlinear solution strategy, preserves state on failed steps, and
distinguishes boundary infeasibility from solver non-convergence. These
features provide a transparent foundation for education and future model
development. They do not establish clinical realism, patient-specific
validity, or educational effectiveness.

# Software and Reproducibility

The simulator, source code, test suite, and versioned release artifacts
are available from the project website and public source repository. The
evaluated release is v0.4.4.1. The test suite contains 21 files and 127
assertions and is executed with the package test runner.
Machine-readable test results, numerical diagnostics, and the
performance benchmark are generated with the release artifacts.

Project website: https://vent.defying-logic.com/ards-twin-v0.4/
Source tree: served from the project website above
Versioned artifacts: served from the dist/ and manuscript/ subdirectories
of the project website (vent-twin-v0.4.4.1-final-clean.zip,
vent-manuscript-v0.4.4.1-final.zip, MANUSCRIPT_FINAL_v0.4.4.1.{pdf,docx})

# Disclosures

Ethics approval: Not applicable to the computational development work
described here; no patient-specific data were used.
Funding: [Add details here].
Conflicts of interest: [Add details here].
Author contributions: [Add details here].
Data availability: The computational artifacts described above are
publicly available with the versioned release.

# References

1\. Bates JHT. Lung Mechanics: An Inverse Modeling Approach. Cambridge
University Press; 2009.

2\. Mollemans W, et al. Mathematical models of the respiratory system: a
review. Acta Anaesthesiol Belg. 2005;56(4):387-401.

3\. Safadi S, Acho M, Maximous SI, et al. Comparison of web-based and
on-site lung simulators for education in mechanical ventilation. Respir
Care. 2024;69(11):1353-1360. doi:10.4187/respcare.12072.

4\. Press WH, Teukolsky SA, Vetterling WT, Flannery BP. Numerical
Recipes: The Art of Scientific Computing. 3rd ed. Cambridge University
Press; 2007.

5\. Amato MBP, Meade MO, Slutsky AS, et al. Driving pressure and
survival in the acute respiratory distress syndrome. N Engl J Med.
2015;372(8):747-755. doi:10.1056/NEJMsa1410639.
