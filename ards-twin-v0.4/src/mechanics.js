// mechanics.js — ThreeCompartmentMechanics implementing the DynamicMechanics
// interface from mechanics.spec.ts.
//
// Model: Pvent --[Rcentral]-- Pbranch --[Ri || Ci(r)]--> x 3 compartments
//
// Where:
//   Pvent  = ventilator/circuit pressure (the sensor/measured point)
//   Rcentral = central (endotracheal tube, circuit) resistance
//   Pbranch = distal branching-node pressure (drives the compartments)
//   Ri, Ci(r) = branch resistance and recruitment-scaled elastance
//   compartment i alveolar pressure P_alv_i = f(V_i, r_i)
//
// Elastic law (linear, recruitment-dependent effective capacity):
//   P_alv_i = V_i × K_i / (capacity_i × capMult(r_i)) + AOP
//   capMult(r) = 1 + r × (fN_max − 1), in [1, fN_max]
//   K_i = elasticScale (cmH2O per unit V fraction)
//   Units: V in L, P in cmH2O.
//
// Per-step update:
//   1. Compute P_alv_i from elastic law at current V, r.
//   2. Solve Pbranch from boundary (PRESSURE or FLOW) given Rcentral.
//   3. For each compartment: implicit-Euler V update using effective capacity.
//   4. Update recruitment state via opening/closing hysteresis.
//   5. Report Pvent (sensor) as output.airwayPressure; Pbranch drives V updates.
//
// Limiting case: Rcentral = 0 reduces to the legacy parallel-RC solution.

const { elasticPressure, clampVolume, effectiveCapacity } = require('./compartments.js');
const { stepRecruitment } = require('./recruitment.js');

const MAX_ITER = 50;
const TOL = 1e-9;

function solveBranchForFlow(boundary, params, compartments) {
  // For FLOW boundary: Q = Q_requested. Solve Pbranch such that
  //   Σ_i (Pbranch − P_alv_i) / R_i = Q
  // => Pbranch = (Q + Σ P_alv_i/R_i) / Σ 1/R_i
  // Pvent is then Pbranch + Q × Rcentral.
  let sumInvR = 0, sumPoverR = 0;
  for (let i = 0; i < compartments.length; i++) {
    const cp = params.compartments[i];
    if (cp.resistance <= 0) continue;
    if (cp.capacity <= 1e-12) continue;
    const cs = compartments[i];
    const pAlv = elasticPressure(cs.volume, cp, cs.recruitment,
                                  params.airwayOpeningPressure);
    sumInvR += 1 / cp.resistance;
    sumPoverR += pAlv / cp.resistance;
  }
  const Q = boundary.flowLps;
  const Rc = params.centralAirwayResistance;
  let pBranch, deliveredBranch;
  if (sumInvR === 0) {
    pBranch = 0;
    deliveredBranch = 0;
  } else {
    pBranch = (Q + sumPoverR) / sumInvR;
    deliveredBranch = 0;
    for (let i = 0; i < compartments.length; i++) {
      const cp = params.compartments[i];
      if (cp.resistance <= 0) continue;
      if (cp.capacity <= 1e-12) continue;
      const cs = compartments[i];
      const pAlv = elasticPressure(cs.volume, cp, cs.recruitment,
                                    params.airwayOpeningPressure);
      deliveredBranch += (pBranch - pAlv) / cp.resistance;
    }
  }
  // Q traverses Rcentral: Pvent = Pbranch + Q × Rcentral.
  const pVent = pBranch + Q * Rc;
  return { pBranch, pVent, delivered: deliveredBranch, requested: Q };
}

function solveBranchForPressure(boundary, params, compartments) {
  // For PRESSURE boundary: Pvent is imposed. Solve Pbranch from
  //   (Pvent − Pbranch) / Rcentral = Σ (Pbranch − P_alv_i) / R_i
  // => Pbranch × (Σ 1/R_i + 1/Rcentral) = Pvent/Rcentral + Σ P_alv_i/R_i
  let sumInvR = 0, sumPoverR = 0;
  for (let i = 0; i < compartments.length; i++) {
    const cp = params.compartments[i];
    if (cp.resistance <= 0) continue;
    if (cp.capacity <= 1e-12) continue;
    const cs = compartments[i];
    const pAlv = elasticPressure(cs.volume, cp, cs.recruitment,
                                  params.airwayOpeningPressure);
    sumInvR += 1 / cp.resistance;
    sumPoverR += pAlv / cp.resistance;
  }
  const Rc = params.centralAirwayResistance;
  const pVent = boundary.pressureCmH2O;
  let pBranch, deliveredCentral;
  if (Rc <= 0) {
    // Rcentral = 0 → Pbranch = Pvent (legacy parallel-RC solution).
    pBranch = pVent;
    // Central flow = sum of branch flows (no drop across Rcentral).
    deliveredCentral = 0;
    if (sumInvR > 0) {
      for (let i = 0; i < compartments.length; i++) {
        const cp = params.compartments[i];
        if (cp.resistance <= 0) continue;
        if (cp.capacity <= 1e-12) continue;
        const cs = compartments[i];
        const pAlv = elasticPressure(cs.volume, cp, cs.recruitment,
                                      params.airwayOpeningPressure);
        deliveredCentral += (pBranch - pAlv) / cp.resistance;
      }
    }
  } else if (sumInvR === 0) {
    // No branches — central flow = 0, Pbranch = Pvent.
    pBranch = pVent;
    deliveredCentral = 0;
  } else {
    pBranch = (pVent / Rc + sumPoverR) / (sumInvR + 1 / Rc);
    deliveredCentral = (pVent - pBranch) / Rc;
  }
  return { pBranch, pVent, delivered: deliveredCentral, requested: null };
}

function compartmentFlow(pAirway, pAlv, R) {
  if (R <= 0) return 0;
  return (pAirway - pAlv) / R;
}

class ThreeCompartmentMechanics {
  step(params, state, boundary, dt) {
    if (!(dt > 0)) throw new Error('dt must be > 0');
    if (boundary.kind !== 'FLOW' && boundary.kind !== 'PRESSURE') {
      throw new Error(`unknown boundary kind ${boundary.kind}`);
    }
    const compartments = state.compartments;

    let pBranch, pVent, requestedFlow = null, deliveredCentral = 0;
    if (boundary.kind === 'PRESSURE') {
      const r = solveBranchForPressure(boundary, params, compartments);
      pBranch = r.pBranch;
      pVent = r.pVent;
      deliveredCentral = r.delivered;
    } else {
      const r = solveBranchForFlow(boundary, params, compartments);
      pBranch = r.pBranch;
      pVent = r.pVent;
      requestedFlow = r.requested;
      deliveredCentral = r.delivered;
    }

    const nextComps = [];
    let qTotal = 0;
    for (let i = 0; i < compartments.length; i++) {
      const cp = params.compartments[i];
      const cs = { ...compartments[i] };

      if (cp.capacity <= 1e-12) {
        cs.flow = 0;
        cs.alveolarPressure = params.airwayOpeningPressure;
        nextComps.push(cs);
        continue;
      }

      const capEff = effectiveCapacity(cp, cs.recruitment);
      const pAlv = elasticPressure(cs.volume, cp, cs.recruitment,
                                    params.airwayOpeningPressure);
      // Compartments connect to Pbranch (distal of Rcentral).
      const q = compartmentFlow(pBranch, pAlv, cp.resistance);

      // Implicit-Euler update for V with effective (recruitment-scaled) capacity.
      // ODE: dV/dt = (Pbranch − P_alv) / R = (Pbranch − AOP − V·K/capEff) / R.
      // => V_new × (1 + K·dt / (R·capEff)) = V_old + (Pbranch − AOP)·dt / R
      const K = cp.elasticScale;
      const R = cp.resistance;
      let vNew;
      if (R > 0) {
        const denom = 1 + (K * dt) / (R * capEff);
        const aop = params.airwayOpeningPressure;
        vNew = (cs.volume + ((pBranch - aop) * dt) / R) / denom;
      } else {
        vNew = cs.volume;
      }
      cs.volume = clampVolume(vNew, cp, cs.recruitment);

      // Update recruitment state using P_alv as the driver.
      cs.recruitment = stepRecruitment(cs.recruitment, pAlv, dt, cp);

      // Recompute q and P_alv at the new state for output fidelity.
      const pAlvNew = elasticPressure(cs.volume, cp, cs.recruitment,
                                       params.airwayOpeningPressure);
      const qNew = compartmentFlow(pBranch, pAlvNew, R);
      cs.flow = qNew;
      cs.alveolarPressure = pAlvNew;
      nextComps.push(cs);
      qTotal += qNew;
    }

    let vTotal = 0;
    for (const c of nextComps) vTotal += c.volume;

    // Re-solve Pbranch and Q_central at the NEW state for honest
    // conservation reporting. With implicit Euler, the pre-step solve
    // is consistent at OLD state; the post-step sum of branch flows
    // can drift; recomputing at NEW state restores identity.
    const newCompsForSolve = nextComps;
    let pBranchNew, deliveredCentralNew;
    if (boundary.kind === 'PRESSURE') {
      const r = solveBranchForPressure(
        { kind: 'PRESSURE', pressureCmH2O: pVent, fio2: boundary.fio2 },
        params, newCompsForSolve);
      pBranchNew = r.pBranch;
      deliveredCentralNew = r.delivered;
    } else {
      const r = solveBranchForFlow(
        { kind: 'FLOW', flowLps: requestedFlow, fio2: boundary.fio2 },
        params, newCompsForSolve);
      pBranchNew = r.pBranch;
      // For FLOW, solveBranchForFlow returns deliveredBranch = ΣQ_branch
      // at the NEW state, which by construction equals Q_requested.
      // Use that as Q_central (not (Pvent - pBranch)/Rc).
      deliveredCentralNew = r.delivered;
    }

    const newState = {
      t: state.t + dt,
      compartments: nextComps,
      airwayPressure: pVent,
      totalFlow: qTotal,
      totalVolume: vTotal,
    };

    const reportedFlow = (vTotal - state.totalVolume) / dt;
    const output = {
      // Pvent is the sensor/measured airway pressure; Pbranch is the
      // distal pressure driving the compartments.
      airwayPressure: pVent,
      branchPressure: pBranchNew,
      airwayFlow: reportedFlow,
      centralFlow: deliveredCentralNew,
      deliveredVolume: vTotal,
      totalVolume: vTotal,
      compartmentVolumes: nextComps.map(c => c.volume),
      compartmentFlows: nextComps.map(c => c.flow),
      compartmentPressures: nextComps.map(c => c.alveolarPressure),
    };

    if (requestedFlow !== null) {
      const gap = requestedFlow - deliveredCentralNew;
      if (Math.abs(gap) > 0.01) {
        output.requestedFlow = requestedFlow;
        output.deliveryGap = gap;
      }
    }

    return { state: newState, output };
  }
}

module.exports = {
  ThreeCompartmentMechanics,
  solveBranchForFlow,
  solveBranchForPressure,
};
