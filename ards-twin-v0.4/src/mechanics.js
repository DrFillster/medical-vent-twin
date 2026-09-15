// mechanics.js — ThreeCompartmentMechanics implementing the DynamicMechanics
// interface from mechanics.spec.ts.
//
// Model: central airway node at P_airway drives three parallel compartments
// (each with R_i, C_i, recruitment state r_i ∈ [0,1]).
//
// Per-step update:
//   1. Compute P_alv_i from each compartment's elastic law at current V, r.
//   2. Solve Paw given boundary (PRESSURE or FLOW).
//   3. For each compartment: implicit-Euler V update using effective capacity
//      (= capacity × capMult(recruitment)).
//   4. Update recruitment state via opening/closing hysteresis.

const { elasticPressure, clampVolume, effectiveCapacity } = require('./compartments.js');
const { stepRecruitment } = require('./recruitment.js');

const MAX_ITER = 50;
const TOL = 1e-9;

function solveAirwayForFlow(boundary, params, compartments) {
  // Linear solve: sum_i (P_airway − P_alv_i) / R_i = Q_aw, no clamp.
  // Bi-directional flow is allowed — expiration is a passive recoil.
  // Compartment with capacity ≈ 0 is a placeholder; it does not participate.
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
  if (sumInvR === 0) return { pAirway: 0, delivered: 0,
                              requested: boundary.flowLps };
  const pAirway = (boundary.flowLps + sumPoverR) / sumInvR;
  let delivered = 0;
  for (let i = 0; i < compartments.length; i++) {
    const cp = params.compartments[i];
    if (cp.resistance <= 0) continue;
    if (cp.capacity <= 1e-12) continue;
    const cs = compartments[i];
    const pAlv = elasticPressure(cs.volume, cp, cs.recruitment,
                                  params.airwayOpeningPressure);
    delivered += (pAirway - pAlv) / cp.resistance;
  }
  return { pAirway, delivered, requested: boundary.flowLps };
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

    let pAirway, requestedFlow = null;
    if (boundary.kind === 'PRESSURE') {
      pAirway = boundary.pressureCmH2O;
    } else {
      const r = solveAirwayForFlow(boundary, params, compartments);
      pAirway = r.pAirway;
      requestedFlow = r.requested;
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
      const q = compartmentFlow(pAirway, pAlv, cp.resistance);

      // Implicit-Euler update for V with effective (recruitment-scaled) capacity.
      const K = cp.elasticScale;
      const R = cp.resistance;
      let vNew;
      if (R > 0) {
        const denom = 1 + (K * dt) / (R * capEff);
        vNew = (cs.volume + (pAirway * dt) / R) / denom;
      } else {
        vNew = cs.volume;
      }
      cs.volume = clampVolume(vNew, cp, cs.recruitment);

      // Update recruitment state using P_alv as the driver.
      cs.recruitment = stepRecruitment(cs.recruitment, pAlv, dt, cp);

      // Recompute q and P_alv at the new state for output fidelity.
      const pAlvNew = elasticPressure(cs.volume, cp, cs.recruitment,
                                       params.airwayOpeningPressure);
      const qNew = compartmentFlow(pAirway, pAlvNew, R);
      cs.flow = qNew;
      cs.alveolarPressure = pAlvNew;
      nextComps.push(cs);
      qTotal += qNew;
    }

    let vTotal = 0;
    for (const c of nextComps) vTotal += c.volume;

    const newState = {
      t: state.t + dt,
      compartments: nextComps,
      airwayPressure: pAirway,
      totalFlow: qTotal,
      totalVolume: vTotal,
    };

    const reportedFlow = (vTotal - state.totalVolume) / dt;
    const output = {
      airwayPressure: pAirway,
      airwayFlow: reportedFlow,
      deliveredVolume: vTotal,
      totalVolume: vTotal,
      compartmentVolumes: nextComps.map(c => c.volume),
      compartmentFlows: nextComps.map(c => c.flow),
      compartmentPressures: nextComps.map(c => c.alveolarPressure),
    };

    if (requestedFlow !== null) {
      const gap = requestedFlow - qTotal;
      if (Math.abs(gap) > 0.01) {
        output.requestedFlow = requestedFlow;
        output.deliveryGap = gap;
      }
    }

    return { state: newState, output };
  }
}

module.exports = { ThreeCompartmentMechanics, solveAirwayForFlow };
