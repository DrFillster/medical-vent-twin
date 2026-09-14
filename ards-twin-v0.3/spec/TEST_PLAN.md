# Test and Acceptance Plan

## A. Software invariants
1. State contains no NaN/Inf during valid runs.
2. Invalid inputs fail explicitly with reason.
3. Simulation is deterministic.
4. Flow conservation holds at each step.
5. Integrated total flow matches change in total lung volume within tolerance.
6. Compartment fractions and recruitment bounds remain valid.

## B. Dynamic mechanics tests
1. **Single linear RC compartment**: compare numerical response against known exponential filling/emptying behavior.
2. **Zero resistance limit**: resistive pressure drop approaches zero.
3. **Very high resistance**: delayed filling and emptying are visible.
4. **Different time constants**: compartments fill/empty at different rates.
5. **Long expiration**: end-expiratory flow approaches zero in passive valid cases.
6. **Short expiration**: incomplete emptying persists; later milestone may label intrinsic PEEP.

## C. VC-A/C behavior tests
1. Target Vt delivered in valid passive cases.
2. Increasing resistance increases Ppeak more than plateau.
3. Decreasing compliance raises plateau pressure for same Vt/PEEP.
4. Inspiratory hold yields near-zero flow.
5. Increasing PEEP shifts end-expiratory operating point.

## D. PC-A/C behavior tests
1. Pressure target achieved within controller tolerance.
2. Delivered Vt varies with patient mechanics.
3. Higher resistance slows flow/volume response.
4. Mode addition does not modify patient equations.

## E. Recruitment tests
1. Opening thresholds are crossed on inspiration.
2. Closing thresholds are crossed on expiration.
3. Hysteresis persists across breaths.
4. No-recruitable-tissue patient keeps recruitment fixed at zero.
5. Recruitment resolution sensitivity is measured.

## F. Regression against v0.2 reference
Comparison is valid only in overlapping assumptions:
- passive patient
- fixed recruitment state
- adequate expiration
- matched elastic law
- matched PEEP/Vt

Expected comparison targets:
- end-expiratory volume
- end-inspiratory volume
- plateau pressure
- resistive pressure component

Do not require exact equality for dynamic quantities absent from the reference model.

## G. Physiological validation status
Passing these tests establishes computational behavior only. It does not establish clinical realism, ARDS phenotype validity, educational efficacy or safe ventilator recommendations.
