var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/clock.js
var require_clock = __commonJS({
  "src/clock.js"(exports, module) {
    var SimulationClock = class {
      constructor(dt) {
        if (!(typeof dt === "number" && Number.isFinite(dt) && dt > 0)) {
          throw new Error("dt must be > 0 finite number");
        }
        this._t = 0;
        this._steps = 0;
        this.dt = dt;
      }
      get t() {
        return this._t;
      }
      get steps() {
        return this._steps;
      }
      step() {
        this._t = Math.round((this._t + this.dt) * 1e12) / 1e12;
        this._steps += 1;
        return this._t;
      }
      reset() {
        this._t = 0;
        this._steps = 0;
      }
      // Run a closure for `seconds` real-time, capped by 1e9 steps as safety.
      runFor(seconds, fn) {
        if (typeof seconds !== "number" || !(seconds > 0)) {
          throw new Error("seconds must be > 0 finite number");
        }
        const total = Math.ceil(seconds / this.dt);
        if (total > 1e9) throw new Error(`runFor too many steps: ${total}`);
        for (let i = 0; i < total; i++) fn(this.step(), this.dt);
      }
    };
    module.exports = { SimulationClock };
  }
});

// src/compartments.js
var require_compartments = __commonJS({
  "src/compartments.js"(exports, module) {
    var EPS_CAP = 1e-9;
    function availabilityFor(cp, recruitment) {
      if (cp.id === "normal") return 1;
      if (cp.id === "recruitable") {
        if (typeof recruitment !== "number" || !Number.isFinite(recruitment)) {
          throw new Error("recruitment must be finite number");
        }
        if (recruitment < 0) return 0;
        if (recruitment > 1) return 1;
        return recruitment;
      }
      if (cp.id === "consolidated") return 0;
      throw new Error(`unknown compartment id ${cp.id}`);
    }
    function fullCompliance(cp) {
      if (!(cp.elasticScale > 0)) throw new Error("elasticScale must be > 0");
      return cp.capacity / cp.elasticScale;
    }
    function effectiveVolumeCapacity2(cp, recruitment) {
      return availabilityFor(cp, recruitment) * cp.capacity;
    }
    function elasticPressureAboveAOP(volume, cp, recruitment) {
      const vmax = effectiveVolumeCapacity2(cp, recruitment);
      if (vmax <= 0) {
        if (Math.abs(volume) <= 1e-15) return 0;
        throw new Error("positive volume in unavailable compartment");
      }
      if (volume < 0) {
        throw new Error(`negative elastic volume: V=${volume}`);
      }
      if (volume >= (1 - EPS_CAP) * vmax) {
        throw new Error(`volume outside finite-capacity domain: V=${volume}, Vmax=${vmax}`);
      }
      return -cp.elasticScale * Math.log1p(-volume / vmax);
    }
    function elasticPressure(volume, cp, recruitment, aop = 0) {
      if (typeof aop !== "number" || !Number.isFinite(aop)) {
        throw new Error("aop must be finite number");
      }
      return aop + elasticPressureAboveAOP(volume, cp, recruitment);
    }
    function tangentCompliance(volume, cp, recruitment) {
      const a = availabilityFor(cp, recruitment);
      if (a <= 0) return 0;
      const vmax = a * cp.capacity;
      if (volume < 0 || volume >= vmax) {
        throw new Error("volume outside finite-capacity domain");
      }
      return a * fullCompliance(cp) * (1 - volume / vmax);
    }
    function dPressureDVolume2(volume, cp, recruitment) {
      const c = tangentCompliance(volume, cp, recruitment);
      if (!(c > 0)) throw new Error("non-positive tangent compliance");
      return 1 / c;
    }
    function forwardElasticVolume2(pressure, cp, recruitment, aop = 0) {
      const a = availabilityFor(cp, recruitment);
      if (a <= 0) return 0;
      if (pressure <= aop) return 0;
      const vmax = a * cp.capacity;
      const p = pressure - aop;
      return vmax * (1 - Math.exp(-p / cp.elasticScale));
    }
    function branchConductance(cp, recruitment) {
      const a = availabilityFor(cp, recruitment);
      if (a <= 0) return 0;
      if (!(cp.resistance > 0)) throw new Error("resistance must be > 0");
      return a / cp.resistance;
    }
    function effectiveCapacity(cp, recruitment) {
      return effectiveVolumeCapacity2(cp, recruitment);
    }
    function clampVolume(volume, cp, recruitment) {
      const vmax = effectiveVolumeCapacity2(cp, recruitment);
      if (vmax <= 0) {
        if (Math.abs(volume) <= 1e-15) return 0;
        throw new Error("positive volume in unavailable compartment");
      }
      if (volume < 0) return 0;
      if (volume >= (1 - EPS_CAP) * vmax) {
        throw new Error("volume outside finite-capacity domain");
      }
      return volume;
    }
    module.exports = {
      EPS_CAP,
      availabilityFor,
      fullCompliance,
      effectiveVolumeCapacity: effectiveVolumeCapacity2,
      effectiveCapacity,
      elasticPressureAboveAOP,
      elasticPressure,
      tangentCompliance,
      dPressureDVolume: dPressureDVolume2,
      forwardElasticVolume: forwardElasticVolume2,
      branchConductance,
      clampVolume
    };
  }
});

// src/recruitment.js
var require_recruitment = __commonJS({
  "src/recruitment.js"(exports, module) {
    var EPS_CAP = 1e-9;
    var EPS_PROJ = 1e-6;
    var OPEN_DEFAULT = 25;
    var CLOSE_DEFAULT = 10;
    var K_OPEN_DEFAULT = 0.02;
    var K_CLOSE_DEFAULT = 0.05;
    function distendingPressure(pAlv, aop) {
      return Math.max(0, pAlv - aop);
    }
    function recruitmentRate(recruitment, pDist, params = {}) {
      const Popen = params.P_open ?? OPEN_DEFAULT;
      const Pclose = params.P_close ?? CLOSE_DEFAULT;
      const kopen = params.k_open ?? K_OPEN_DEFAULT;
      const kclose = params.k_close ?? K_CLOSE_DEFAULT;
      if (!(Pclose < Popen)) {
        throw new Error(`P_close (${Pclose}) must be < P_open (${Popen})`);
      }
      const r = clamp(recruitment, 0, 1);
      if (pDist > Popen) return kopen * (pDist - Popen) * (1 - r);
      if (pDist < Pclose) return -kclose * (Pclose - pDist) * r;
      return 0;
    }
    function stepRecruitment(recruitment, PAlv, dt, params = {}, aop = 0) {
      const pdist = distendingPressure(PAlv, aop);
      const rate = recruitmentRate(recruitment, pdist, params);
      return clamp(recruitment + rate * dt, 0, 1);
    }
    function minimumFeasibleRecruitment(volume, cp, epsCap = EPS_CAP) {
      if (cp.id !== "recruitable") {
        if (cp.id === "normal") return 1;
        if (cp.id === "consolidated") return 0;
        throw new Error(`unknown compartment id ${cp.id}`);
      }
      if (cp.capacity <= 0) return 0;
      return clamp(volume / ((1 - epsCap) * cp.capacity), 0, 1);
    }
    function stepRecruitmentWithFloor(recruitment, PAlv, dt, volume, cp, aop = 0) {
      const rCandidate = stepRecruitment(recruitment, PAlv, dt, cp, aop);
      const rFloor = minimumFeasibleRecruitment(volume, cp);
      if (rCandidate >= rFloor) return rCandidate;
      if (cp.id !== "recruitable" || cp.capacity <= 0) {
        return rFloor;
      }
      const projectedR = volume / ((1 - EPS_PROJ) * cp.capacity);
      return Math.max(rCandidate, Math.min(projectedR, 1));
    }
    function clamp(x, lo, hi) {
      if (x < lo) return lo;
      if (x > hi) return hi;
      return x;
    }
    module.exports = {
      EPS_CAP,
      OPEN_DEFAULT,
      CLOSE_DEFAULT,
      K_OPEN_DEFAULT,
      K_CLOSE_DEFAULT,
      distendingPressure,
      recruitmentRate,
      stepRecruitment,
      minimumFeasibleRecruitment,
      stepRecruitmentWithFloor,
      clamp,
      // Deprecated (v0.4): kept as a no-op shim for legacy callers. The new law
      // uses availability-based capacity scaling, not the old capMult * capacity.
      capacityMultiplier(recruitment, _fN_max) {
        if (typeof recruitment !== "number") return 1;
        if (recruitment < 0) return 1;
        if (recruitment > 1) return 1;
        return 1;
      }
    };
  }
});

// src/mechanics.js
var require_mechanics = __commonJS({
  "src/mechanics.js"(exports, module) {
    var {
      availabilityFor,
      elasticPressure,
      elasticPressureAboveAOP,
      forwardElasticVolume: forwardElasticVolume2,
      branchConductance,
      effectiveVolumeCapacity: effectiveVolumeCapacity2,
      dPressureDVolume: dPressureDVolume2,
      EPS_CAP
    } = require_compartments();
    var {
      recruitmentRate,
      minimumFeasibleRecruitment,
      distendingPressure,
      clamp
    } = require_recruitment();
    var SOLVER_TOL_ABS = 1e-5;
    var SOLVER_TOL_REL = 1e-8;
    var SOLVER_MAX_ITER = 25;
    var LINESEARCH_MAX = 25;
    var DT_SUBDIV_LIMIT = 8;
    var RECRUITMENT_TOL = 1e-6;
    var SOLVER_TOL_SCALED = 1e-3;
    var V_SCALE_FLOOR = 0.01;
    function computeScales(activeComps, params, pBranchGuess) {
      let vmaxMin = Infinity;
      for (const { cp, cs } of activeComps) {
        const vmax = effectiveVolumeCapacity2(cp, cs.recruitment);
        if (vmax > 0 && vmax < vmaxMin) vmaxMin = vmax;
      }
      if (!isFinite(vmaxMin)) vmaxMin = V_SCALE_FLOOR;
      const V_scale = Math.min(vmaxMin, V_SCALE_FLOOR);
      const P_scale = Math.max(
        Math.abs(pBranchGuess),
        Math.abs(params.airwayOpeningPressure),
        1
      );
      return { V_scale, P_scale };
    }
    function classifyBoundaryFeasibility(activeComps, params, boundary, dt) {
      let capacityRemaining = 0;
      for (const { cp, cs } of activeComps) {
        const vmax = effectiveVolumeCapacity2(cp, cs.recruitment);
        const remaining = Math.max(0, (1 - EPS_CAP) * vmax - cs.volume);
        capacityRemaining += remaining;
      }
      if (boundary.kind === "FLOW") {
        const requestedDelta = boundary.flowLps * dt;
        if (Math.abs(requestedDelta) > capacityRemaining + 1e-12) {
          return "INFEASIBLE_BOUNDARY";
        }
        return "SOLVER_NONCONVERGENCE";
      }
      if (boundary.kind === "PRESSURE") {
        return "SOLVER_NONCONVERGENCE";
      }
      return "SOLVER_NONCONVERGENCE";
    }
    function scaledNorm(F, scales) {
      let maxR = 0;
      for (let i = 0; i < F.length - 1; i++) {
        const r = Math.abs(F[i]) / scales.V_scale;
        if (r > maxR) maxR = r;
      }
      const rP = Math.abs(F[F.length - 1]) / scales.P_scale;
      if (rP > maxR) maxR = rP;
      return maxR;
    }
    function solve4x4(A, b) {
      const n = b.length;
      const M = A.map((row, i) => [...row, b[i]]);
      for (let i = 0; i < n; i++) {
        let maxVal = Math.abs(M[i][i]);
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
          if (Math.abs(M[k][i]) > maxVal) {
            maxVal = Math.abs(M[k][i]);
            maxRow = k;
          }
        }
        if (maxVal < 1e-30) return null;
        if (maxRow !== i) {
          const tmp = M[i];
          M[i] = M[maxRow];
          M[maxRow] = tmp;
        }
        for (let k = i + 1; k < n; k++) {
          const factor = M[k][i] / M[i][i];
          for (let j = i; j < n + 1; j++) M[k][j] -= factor * M[i][j];
        }
      }
      const x = new Array(n);
      for (let i = n - 1; i >= 0; i--) {
        let sum = M[i][n];
        for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
        x[i] = sum / M[i][i];
      }
      return x;
    }
    function buildSystem(activeComps, vOld, pBranchGuess, boundary, params, dt) {
      const N = activeComps.length;
      const dim = N + 1;
      const F = new Array(dim).fill(0);
      const J = Array.from({ length: dim }, () => new Array(dim).fill(0));
      const aop = params.airwayOpeningPressure;
      let sumQ = 0;
      for (let i = 0; i < N; i++) {
        const { cp, cs, G } = activeComps[i];
        if (G === 0 || effectiveVolumeCapacity2(cp, cs.recruitment) <= 0) {
          F[i] = 0;
          J[i][i] = 1;
          continue;
        }
        const FLOW_ZERO_FRAC = 1e-6;
        const vmax = effectiveVolumeCapacity2(cp, cs.recruitment);
        const FLOW_ZERO_TOL = vmax > 0 ? vmax * FLOW_ZERO_FRAC : 1e-9;
        const vNew = Math.max(0, Math.min(vOld[i], vmax * (1 - 2 * EPS_CAP)));
        const flowDir = G * (pBranchGuess - aop);
        const satLimit = vmax > 0 ? vmax * (1 - EPS_CAP) : 0;
        if (vmax > 0 && vNew >= satLimit - 1e-15 && flowDir > 0) {
          F[i] = 0 - cs.volume;
          J[i][i] = 1;
          J[i][N] = 0;
          continue;
        }
        if (vNew < FLOW_ZERO_TOL && flowDir < 0) {
          F[i] = 0 - cs.volume;
          J[i][i] = 1;
          J[i][N] = 0;
          continue;
        }
        let pEl;
        if (vNew < FLOW_ZERO_TOL) {
          const vTiny = 1e-12;
          pEl = elasticPressureAboveAOP(vTiny, cp, cs.recruitment);
        } else {
          pEl = elasticPressureAboveAOP(vNew, cp, cs.recruitment);
        }
        const vForTangent = vNew < FLOW_ZERO_TOL ? 1e-12 : vNew;
        const dpdV = dPressureDVolume2(vForTangent, cp, cs.recruitment);
        F[i] = vNew - cs.volume - dt * G * (pBranchGuess - aop - pEl);
        J[i][i] = 1 + dt * G * dpdV;
        J[i][N] = -dt * G;
        sumQ += (vNew - cs.volume) / dt;
      }
      if (boundary.kind === "FLOW") {
        F[N] = sumQ - boundary.flowLps;
        for (let i = 0; i < N; i++) J[N][i] = 1 / dt;
        J[N][N] = 0;
      } else {
        const Rc = params.centralAirwayResistance;
        if (Rc > 0) {
          F[N] = (boundary.pressureCmH2O - pBranchGuess) / Rc - sumQ;
          for (let i = 0; i < N; i++) J[N][i] = -1 / dt;
          J[N][N] = -1 / Rc;
        } else {
          F[N] = pBranchGuess - boundary.pressureCmH2O;
          J[N][N] = 1;
        }
      }
      return { F, J };
    }
    function feasibleV(v, cp, cs) {
      const vmax = effectiveVolumeCapacity2(cp, cs.recruitment);
      if (vmax <= 0) {
        return 0;
      }
      const limit = (1 - EPS_CAP) * vmax;
      if (v < 0) return 0;
      if (v > limit) return limit;
      return v;
    }
    function newtonStep(activeComps, vTrial, pBranch, boundary, params, dt) {
      const N = activeComps.length;
      let iter;
      let lastResidualNorm = Infinity;
      let initialNorm = Infinity;
      let initialScaled = Infinity;
      let lastScaled = Infinity;
      let converged = false;
      let totalHalvings = 0;
      let activeSetTransitions = 0;
      function regime(vNew, cp, cs) {
        const vmax = effectiveVolumeCapacity2(cp, cs.recruitment);
        if (vmax <= 0) return "CLOSED";
        const floorTol = 1e-6 * vmax;
        if (vNew <= floorTol) return "FLOOR";
        const constLimit = (1 - EPS_CAP) * vmax;
        if (vNew >= constLimit - 1e-15) return "CAP";
        return "INTERIOR";
      }
      const initialRegimes = activeComps.map((ac, i) => regime(vTrial[i], ac.cp, ac.cs));
      const scales = computeScales(activeComps, params, pBranch[0]);
      for (iter = 0; iter < SOLVER_MAX_ITER; iter++) {
        const { F, J } = buildSystem(
          activeComps,
          vTrial,
          pBranch[0],
          boundary,
          params,
          dt
        );
        let norm = 0;
        for (let i = 0; i < F.length; i++) norm += F[i] * F[i];
        norm = Math.sqrt(norm);
        if (iter === 0) initialNorm = norm;
        lastResidualNorm = norm;
        const scaled = scaledNorm(F, scales);
        if (iter === 0) initialScaled = scaled;
        lastScaled = scaled;
        if (scaled < SOLVER_TOL_SCALED || scaled < SOLVER_TOL_REL * Math.max(initialScaled, 1e-12)) {
          converged = true;
          break;
        }
        const b = F.map((x) => -x);
        const dx = solve4x4(J, b);
        if (!dx) {
          return {
            converged: false,
            residual: norm,
            scaledResidual: scaled,
            iterations: iter,
            substeps: 0,
            lineSearchHalvings: totalHalvings,
            activeSetTransitions
          };
        }
        let stepScale = 1;
        let stepAccepted = false;
        let lineIter;
        for (lineIter = 0; lineIter < LINESEARCH_MAX; lineIter++) {
          const newVTrial = vTrial.map((v, i) => feasibleV(
            v + stepScale * dx[i],
            activeComps[i].cp,
            activeComps[i].cs
          ));
          let trialOK = true;
          for (let i = 0; i < N; i++) {
            const { cp, cs, G } = activeComps[i];
            if (G === 0) continue;
            const vmax = effectiveVolumeCapacity2(cp, cs.recruitment);
            if (vmax > 0) {
              const constLimit = (1 - EPS_CAP) * vmax;
              if (newVTrial[i] >= constLimit - 1e-15) {
                trialOK = false;
                break;
              }
            }
          }
          if (!trialOK) {
            stepScale *= 0.5;
            totalHalvings++;
            continue;
          }
          const newPBranch = pBranch[0] + stepScale * dx[N];
          let newScaled = 0;
          let sumQ = 0;
          const trialF = new Array(N + 1);
          for (let i = 0; i < N; i++) {
            const { cp, cs, G } = activeComps[i];
            if (G === 0) {
              trialF[i] = 0;
              continue;
            }
            const vmax = effectiveVolumeCapacity2(cp, cs.recruitment);
            const floorFrac = 1e-6;
            const floorTol = vmax > 0 ? vmax * floorFrac : 1e-9;
            if (newVTrial[i] <= floorTol && newPBranch - params.airwayOpeningPressure <= 0) {
              trialF[i] = 0;
              continue;
            }
            const pEl = elasticPressureAboveAOP(newVTrial[i], cp, cs.recruitment);
            const r = newVTrial[i] - cs.volume - dt * G * (newPBranch - params.airwayOpeningPressure - pEl);
            trialF[i] = r;
            sumQ += (newVTrial[i] - cs.volume) / dt;
          }
          let boundaryRes = 0;
          if (boundary.kind === "FLOW") {
            boundaryRes = sumQ - boundary.flowLps;
          } else if (params.centralAirwayResistance > 0) {
            boundaryRes = (boundary.pressureCmH2O - newPBranch) / params.centralAirwayResistance - sumQ;
          } else {
            boundaryRes = newPBranch - boundary.pressureCmH2O;
          }
          trialF[N] = boundaryRes;
          newScaled = scaledNorm(trialF, scales);
          if (newScaled < lastScaled) {
            const newRegimes = activeComps.map((ac, i) => regime(newVTrial[i], ac.cp, ac.cs));
            for (let i = 0; i < N; i++) {
              if (newRegimes[i] !== initialRegimes[i]) {
                activeSetTransitions++;
                initialRegimes[i] = newRegimes[i];
              }
            }
            for (let i = 0; i < N; i++) vTrial[i] = newVTrial[i];
            pBranch[0] = newPBranch;
            stepAccepted = true;
            break;
          }
          stepScale *= 0.5;
          totalHalvings++;
        }
        if (!stepAccepted) {
          return {
            converged: false,
            residual: norm,
            scaledResidual: lastScaled,
            iterations: iter,
            substeps: 0,
            lineSearchHalvings: totalHalvings,
            activeSetTransitions
          };
        }
      }
      return {
        converged,
        residual: lastResidualNorm,
        scaledResidual: lastScaled,
        iterations: iter,
        substeps: 0,
        lineSearchHalvings: totalHalvings,
        activeSetTransitions
      };
    }
    function solveImplicitStep(params, state, boundary, dt, recruitmentSnapshot) {
      const activeComps = [];
      for (let i = 0; i < params.compartments.length; i++) {
        const cp = params.compartments[i];
        const cs = state.compartments[i];
        const csWithR = { ...cs, recruitment: recruitmentSnapshot[i] };
        const a = availabilityFor(cp, recruitmentSnapshot[i]);
        const G = branchConductance(cp, recruitmentSnapshot[i]);
        if (a > 0 && G > 0) {
          activeComps.push({ cp, cs: csWithR, G, idx: i });
        }
      }
      if (activeComps.length === 0) {
        const zero = state.compartments.map((cs) => ({
          ...cs,
          volume: 0,
          flow: 0,
          alveolarPressure: params.airwayOpeningPressure
        }));
        const totalVolume = zero.reduce((s, c) => s + c.volume, 0);
        const pVent = boundary.kind === "PRESSURE" ? boundary.pressureCmH2O : params.airwayOpeningPressure;
        return {
          state: { ...state, compartments: zero, totalVolume, totalFlow: 0 },
          output: {
            airwayPressure: pVent,
            branchPressure: pVent,
            airwayFlow: 0,
            centralFlow: 0,
            deliveredVolume: totalVolume,
            totalVolume,
            compartmentVolumes: zero.map((c) => c.volume),
            compartmentFlows: zero.map((c) => c.flow),
            compartmentPressures: zero.map((c) => c.alveolarPressure),
            iterations: 0,
            residualNorm: 0,
            substeps: 1
          }
        };
      }
      const N = activeComps.length;
      const vTrial = activeComps.map(({ cp, cs }) => feasibleV(cs.volume, cp, cs));
      const pBranch = [boundary.kind === "PRESSURE" ? boundary.pressureCmH2O : params.airwayOpeningPressure];
      const r = newtonStep(activeComps, vTrial, pBranch, boundary, params, dt);
      if (r.converged) {
        return finalize(
          activeComps,
          vTrial,
          pBranch[0],
          state,
          boundary,
          params,
          dt,
          r.iterations,
          r.residual,
          r.scaledResidual,
          1,
          r.lineSearchHalvings,
          r.activeSetTransitions
        );
      }
      if (dt / 2 < 1e-6) {
        const classification = classifyBoundaryFeasibility(
          activeComps,
          params,
          boundary,
          dt
        );
        return {
          state: {
            t: state.t,
            compartments: state.compartments.map((cs, i) => ({
              ...cs,
              id: cs.id || params.compartments[i].id
            })),
            airwayPressure: pBranch[0],
            totalFlow: 0,
            totalVolume: state.totalVolume
          },
          output: {
            airwayPressure: pBranch[0],
            branchPressure: pBranch[0],
            airwayFlow: 0,
            centralFlow: 0,
            deliveredVolume: 0,
            totalVolume: state.totalVolume,
            compartmentVolumes: state.compartments.map((c) => c.volume),
            compartmentFlows: state.compartments.map(() => 0),
            compartmentPressures: state.compartments.map((c) => c.alveolarPressure),
            iterations: 0,
            residualNorm: r.residual,
            scaledResidual: r.scaledResidual,
            substeps: DT_SUBDIV_LIMIT,
            solverFailure: true,
            failureKind: classification
          }
        };
      }
      const half1 = solveImplicitStep(params, state, boundary, dt / 2, recruitmentSnapshot);
      const newR = half1.state.compartments.map((cs, i) => recruitmentSnapshot[i]);
      const half2 = solveImplicitStep(params, half1.state, boundary, dt / 2, newR);
      half2.output.substeps = 2;
      return half2;
    }
    function finalize(activeComps, vTrial, pBranchSolved, state, boundary, params, dt, iterations, residualNorm, scaledResidual, substeps, lineSearchHalvings, activeSetTransitions) {
      const aop = params.airwayOpeningPressure;
      const nextComps = state.compartments.map((cs, i) => {
        const ac = activeComps.find((a) => a.idx === i);
        if (!ac) {
          return { ...cs, volume: 0, flow: 0, alveolarPressure: aop };
        }
        const vNew = vTrial[activeComps.indexOf(ac)];
        const pAlv = elasticPressure(vNew, ac.cp, ac.cs.recruitment, aop);
        const q = (vNew - ac.cs.volume) / dt;
        return { ...cs, volume: vNew, flow: q, alveolarPressure: pAlv };
      });
      const compartmentFlows = nextComps.map((c) => c.flow);
      const qCentral = compartmentFlows.reduce((s, q) => s + q, 0);
      const Rc = params.centralAirwayResistance;
      let pVent;
      if (boundary.kind === "PRESSURE") {
        pVent = boundary.pressureCmH2O;
      } else {
        pVent = pBranchSolved + qCentral * Rc;
      }
      const totalVolume = nextComps.reduce((s, c) => s + c.volume, 0);
      return {
        state: {
          t: state.t + dt,
          compartments: nextComps,
          airwayPressure: pVent,
          totalFlow: qCentral,
          totalVolume
        },
        output: {
          airwayPressure: pVent,
          branchPressure: pBranchSolved,
          airwayFlow: qCentral,
          centralFlow: qCentral,
          deliveredVolume: totalVolume,
          totalVolume,
          compartmentVolumes: nextComps.map((c) => c.volume),
          compartmentFlows,
          compartmentPressures: nextComps.map((c) => c.alveolarPressure),
          iterations,
          residualNorm,
          scaledResidual,
          substeps,
          // v0.4.3: per-step solver work counters for instrumentation.
          solverStats: {
            newtonIters: iterations,
            substeps,
            lineSearchHalvings,
            activeSetTransitions,
            residualNorm,
            scaledResidual,
            converged: iterations > 0 && iterations < SOLVER_MAX_ITER
          }
        }
      };
    }
    var ThreeCompartmentMechanics = class {
      step(params, state, boundary, dt) {
        if (!(dt > 0)) throw new Error("dt must be > 0");
        if (boundary.kind !== "FLOW" && boundary.kind !== "PRESSURE") {
          throw new Error(`unknown boundary kind ${boundary.kind}`);
        }
        const aop = params.airwayOpeningPressure;
        const compartments = state.compartments;
        const rPredict = compartments.map((cs, i) => {
          const cp = params.compartments[i];
          const pAlv = cs.alveolarPressure || aop;
          const pdist = distendingPressure(pAlv, aop);
          let rCand = clamp(
            cs.recruitment + recruitmentRate(cs.recruitment, pdist, cp) * dt,
            0,
            1
          );
          const rFloor = minimumFeasibleRecruitment(cs.volume, cp);
          rCand = Math.max(rCand, rFloor);
          return rCand;
        });
        const sol1 = solveImplicitStep(params, state, boundary, dt, rPredict);
        const rCorrect = sol1.state.compartments.map((cs, i) => {
          const cp = params.compartments[i];
          const pAlv = cs.alveolarPressure || aop;
          const pdist = distendingPressure(pAlv, aop);
          const rateOld = recruitmentRate(
            compartments[i].recruitment,
            distendingPressure(compartments[i].alveolarPressure || aop, aop),
            cp
          );
          const rateNew = recruitmentRate(
            cs.recruitment,
            pdist,
            cp
          );
          const rMid = clamp(
            compartments[i].recruitment + 0.5 * (rateOld + rateNew) * dt,
            0,
            1
          );
          const rFloor = minimumFeasibleRecruitment(cs.volume, cp);
          return Math.max(rMid, rFloor);
        });
        let final = sol1;
        for (let i = 0; i < compartments.length; i++) {
          if (Math.abs(rCorrect[i] - rPredict[i]) > RECRUITMENT_TOL) {
            const newState = {
              ...state,
              compartments: state.compartments.map((cs, idx) => ({
                ...cs,
                recruitment: rCorrect[idx]
              }))
            };
            final = solveImplicitStep(params, newState, boundary, dt, rCorrect);
            break;
          }
        }
        final.state.compartments = final.state.compartments.map((cs, i) => ({
          ...cs,
          recruitment: rCorrect[i]
        }));
        return final;
      }
    };
    module.exports = {
      ThreeCompartmentMechanics,
      EPS_CAP,
      SOLVER_TOL_ABS,
      // raw tolerance (diagnostic only)
      SOLVER_TOL_SCALED,
      // v0.4.3: dimensionlessly scaled convergence criterion
      SOLVER_TOL_REL,
      SOLVER_MAX_ITER,
      RECRUITMENT_TOL,
      solve4x4,
      buildSystem,
      newtonStep,
      solveImplicitStep,
      // Backward-compat shim: legacy tests called `solveBranchForFlow`. The
      // v0.4.2 solver is implicit; this returns the per-step solve output.
      solveBranchForFlow(boundary, params, compartments) {
        const m = new ThreeCompartmentMechanics();
        const state = {
          t: 0,
          compartments: compartments.map((cs, i) => ({
            id: params.compartments[i].id,
            volume: cs.volume,
            flow: 0,
            alveolarPressure: 0,
            recruitment: cs.recruitment ?? 1
          })),
          airwayPressure: 0,
          totalFlow: 0,
          totalVolume: compartments.reduce((s, c) => s + c.volume, 0)
        };
        const rPredict = state.compartments.map((c) => c.recruitment);
        const sol = solveImplicitStep(params, state, boundary, 1e-3, rPredict);
        return {
          pBranch: sol.output.branchPressure,
          pVent: sol.output.airwayPressure,
          delivered: sol.output.centralFlow,
          requested: boundary.kind === "FLOW" ? boundary.flowLps : null
        };
      }
    };
  }
});

// src/ventilator/controller.js
var require_controller = __commonJS({
  "src/ventilator/controller.js"(exports, module) {
    var BreathPhase = class {
    };
    __publicField(BreathPhase, "EXPIRATION", "EXPIRATION");
    __publicField(BreathPhase, "INSPIRATION", "INSPIRATION");
    __publicField(BreathPhase, "PAUSE", "PAUSE");
    var BreathTracker = class {
      constructor({ rr, ti, pause, cycleTime = 0 }) {
        if (!(rr > 0)) throw new Error("rr must be > 0");
        this.rr = rr;
        this.ti = ti;
        this.pause = pause || 0;
        this.cycleTime = cycleTime;
        this.breathIndex = 0;
      }
      beginBreath() {
        this.cycleTime = 0;
        this.breathIndex += 1;
      }
      // Return phase for current cycleTime. ti is full inspiration length.
      phaseFor(cycleTime) {
        if (cycleTime < this.ti) return BreathPhase.INSPIRATION;
        if (cycleTime < this.ti + this.pause) return BreathPhase.PAUSE;
        return BreathPhase.EXPIRATION;
      }
      breathPeriod() {
        return 60 / this.rr;
      }
      // Total inspiration time including pause = ti + pause.
      isBreathComplete(cycleTime) {
        return cycleTime >= this.breathPeriod();
      }
    };
    module.exports = { BreathPhase, BreathTracker };
  }
});

// src/contracts.js
var require_contracts = __commonJS({
  "src/contracts.js"(exports, module) {
    var assertFinite = (v, name) => {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new Error(`${name} must be finite number, got ${v}`);
      }
    };
    function forwardElasticVolume2(pressure, cp, availability, aop = 0) {
      if (availability <= 0) return 0;
      if (pressure <= aop) return 0;
      const vmax = availability * cp.capacity;
      const p = pressure - aop;
      return vmax * (1 - Math.exp(-p / cp.elasticScale));
    }
    function makeBoundaryFlow2({ flowLps, fio2 }) {
      assertFinite(flowLps, "flowLps");
      assertFinite(fio2, "fio2");
      return Object.freeze({ kind: "FLOW", flowLps, fio2 });
    }
    function makeBoundaryPressure2({ pressureCmH2O, fio2 }) {
      assertFinite(pressureCmH2O, "pressureCmH2O");
      assertFinite(fio2, "fio2");
      return Object.freeze({ kind: "PRESSURE", pressureCmH2O, fio2 });
    }
    var COMPARTMENT_IDS = Object.freeze(["normal", "recruitable", "consolidated"]);
    function makeCompartmentParams(p) {
      if (!COMPARTMENT_IDS.includes(p.id)) throw new Error(`unknown compartment id ${p.id}`);
      [
        "fraction",
        "resistance",
        "capacity",
        "elasticScale",
        "perfusionFraction",
        "deadSpaceFraction"
      ].forEach((k) => {
        if (typeof p[k] !== "number" || !Number.isFinite(p[k])) {
          throw new Error(`CompartmentParams.${k} must be finite number`);
        }
      });
      if (p.fraction < 0) throw new Error("fraction < 0");
      if (p.capacity < 0) throw new Error("capacity < 0");
      const reco = p.recruitment || {};
      return Object.freeze({
        id: p.id,
        fraction: p.fraction,
        resistance: p.resistance,
        capacity: p.capacity,
        elasticScale: p.elasticScale,
        perfusionFraction: p.perfusionFraction,
        deadSpaceFraction: p.deadSpaceFraction,
        P_open: typeof reco.P_open === "number" ? reco.P_open : void 0,
        P_close: typeof reco.P_close === "number" ? reco.P_close : void 0,
        k_open: typeof reco.k_open === "number" ? reco.k_open : void 0,
        k_close: typeof reco.k_close === "number" ? reco.k_close : void 0,
        // v0.4.2: fN_max is deprecated; the new model uses linear availability
        // scaling. Accepted for schema-compat but ignored by the new law.
        fN_max: typeof reco.fN_max === "number" ? reco.fN_max : void 0
      });
    }
    function makeCompartmentState(s) {
      ["volume", "flow", "alveolarPressure", "recruitment"].forEach((k) => {
        if (typeof s[k] !== "number" || !Number.isFinite(s[k])) {
          throw new Error(`CompartmentState.${k} must be finite number`);
        }
      });
      if (s.recruitment < 0 || s.recruitment > 1) {
        throw new Error(`recruitment out of [0,1]: ${s.recruitment}`);
      }
      return Object.freeze({
        volume: s.volume,
        flow: s.flow,
        alveolarPressure: s.alveolarPressure,
        recruitment: s.recruitment
      });
    }
    function makePatientParams2(p) {
      if (!Array.isArray(p.compartments) || p.compartments.length !== 3) {
        throw new Error("PatientParams.compartments must be array of 3");
      }
      const compartments = p.compartments.map(makeCompartmentParams);
      const totalFrac = compartments.reduce((s, c) => s + c.fraction, 0);
      if (Math.abs(totalFrac - 1) > 1e-9) {
        throw new Error(`compartment fractions must sum to 1, got ${totalFrac}`);
      }
      const totalPerf = compartments.reduce((s, c) => s + c.perfusionFraction, 0);
      if (Math.abs(totalPerf - 1) > 1e-9) {
        throw new Error(`compartment perfusions must sum to 1, got ${totalPerf}`);
      }
      if (typeof p.centralAirwayResistance !== "number" || !Number.isFinite(p.centralAirwayResistance)) {
        throw new Error("centralAirwayResistance must be finite number");
      }
      if (typeof p.airwayOpeningPressure !== "number" || !Number.isFinite(p.airwayOpeningPressure)) {
        throw new Error("airwayOpeningPressure must be finite number");
      }
      return Object.freeze({
        compartments,
        centralAirwayResistance: p.centralAirwayResistance,
        airwayOpeningPressure: p.airwayOpeningPressure,
        // v0.4.3: preserve preset-owned initial state through PatientParams
        // so makeInitialState() can pick them up.
        initialPEEP: typeof p.initialPEEP === "number" ? p.initialPEEP : void 0,
        initialRecruitmentState: p.initialRecruitmentState && typeof p.initialRecruitmentState === "object" ? Object.freeze({ ...p.initialRecruitmentState }) : void 0
      });
    }
    function cloneState(state) {
      return {
        t: state.t,
        compartments: state.compartments.map((s) => ({ ...s })),
        airwayPressure: state.airwayPressure,
        totalFlow: state.totalFlow,
        totalVolume: state.totalVolume
      };
    }
    function makeInitialState2(params, options = {}) {
      function pickRecState() {
        if (options.initialRecruitmentState) return options.initialRecruitmentState;
        if (params.initialRecruitmentState && typeof params.initialRecruitmentState === "object") {
          return params.initialRecruitmentState;
        }
        return { normal: 1, recruitable: 0, consolidated: 0 };
      }
      function pickPEEP() {
        if (typeof options.initialPEEP === "number") return options.initialPEEP;
        if (typeof params.initialPEEP === "number") return params.initialPEEP;
        return null;
      }
      const peep = pickPEEP();
      if (peep === null) {
        throw new Error(
          "makeInitialState: initialPEEP is required (preset or options must provide it). The initializer does not guess initial PEEP."
        );
      }
      const aop = params.airwayOpeningPressure;
      const recState = pickRecState();
      function availabilityFor(cp) {
        function validateNumeric(name, expected) {
          if (recState[name] === void 0) return;
          if (typeof recState[name] !== "number" || !Number.isFinite(recState[name])) {
            throw new Error(
              `makeInitialState: initialRecruitmentState.${name} must be finite number, got ${recState[name]}`
            );
          }
          if (expected !== void 0 && recState[name] !== expected) {
            throw new Error(
              `makeInitialState: initialRecruitmentState.${name} must be ${expected} (preset said ${recState[name]})`
            );
          }
        }
        if (cp.id === "normal") {
          validateNumeric("normal", 1);
          return 1;
        }
        if (cp.id === "consolidated") {
          validateNumeric("consolidated", 0);
          return 0;
        }
        if (cp.id === "recruitable") {
          validateNumeric("recruitable", void 0);
          return Math.max(0, Math.min(1, recState.recruitable ?? 0));
        }
        throw new Error(`unknown compartment id: ${cp.id}`);
      }
      const compartments = params.compartments.map((cp) => {
        const a = availabilityFor(cp);
        const vmax = a * cp.capacity;
        let volume;
        if (vmax <= 0) {
          volume = 0;
        } else if (peep > aop) {
          volume = forwardElasticVolume2(peep, { ...cp, capacity: vmax }, a, aop);
        } else {
          volume = 0;
        }
        if (vmax <= 0 && Math.abs(volume) > 1e-15) {
          throw new Error(
            `initial volume ${volume} > 0 in closed compartment ${cp.id} (Vmax=0)`
          );
        }
        if (vmax > 0 && volume >= vmax) {
          throw new Error(
            `initial volume ${volume} exceeds capacity ${vmax} for ${cp.id}`
          );
        }
        if (volume < 0) {
          throw new Error(
            `initial volume ${volume} is negative for ${cp.id} (lower-bound regime violated)`
          );
        }
        const alveolarPressure = a > 0 && peep > aop ? peep : aop;
        return {
          id: cp.id,
          volume,
          flow: 0,
          alveolarPressure,
          recruitment: a
        };
      });
      return {
        t: 0,
        compartments,
        airwayPressure: peep,
        totalFlow: 0,
        totalVolume: compartments.reduce((s, c) => s + c.volume, 0)
      };
    }
    module.exports = {
      COMPARTMENT_IDS,
      makeBoundaryFlow: makeBoundaryFlow2,
      makeBoundaryPressure: makeBoundaryPressure2,
      makeCompartmentParams,
      makeCompartmentState,
      makePatientParams: makePatientParams2,
      makeInitialState: makeInitialState2,
      cloneState
    };
  }
});

// src/ventilator/vc_ac.js
var require_vc_ac = __commonJS({
  "src/ventilator/vc_ac.js"(exports, module) {
    var { BreathTracker, BreathPhase } = require_controller();
    var { makeBoundaryFlow: makeBoundaryFlow2, makeBoundaryPressure: makeBoundaryPressure2 } = require_contracts();
    var VcAcController2 = class {
      /**
       * @param {object} settings  VcAcSettings from ventilator.spec.ts
       *   { fio2, peep, rr, vt, inspiratoryFlow, inspiratoryPause }
       */
      constructor(settings) {
        ["peep", "rr", "vt", "fio2"].forEach((k) => {
          if (typeof settings[k] !== "number" || !Number.isFinite(settings[k])) {
            throw new Error(`VcAcSettings.${k} must be finite number`);
          }
        });
        if (!(settings.rr > 0)) throw new Error("rr must be > 0");
        if (!(settings.vt > 0)) throw new Error("vt must be > 0");
        if (settings.peep < 0) throw new Error("peep must be \u2265 0");
        if (settings.fio2 < 0 || settings.fio2 > 1) {
          throw new Error("fio2 must be in [0,1]");
        }
        if (!(settings.inspiratoryFlow > 0)) {
          throw new Error("inspiratoryFlow must be > 0");
        }
        if (settings.inspiratoryPause != null && settings.inspiratoryPause < 0) {
          throw new Error("inspiratoryPause must be \u2265 0");
        }
        this.settings = {
          fio2: settings.fio2,
          peep: settings.peep,
          rr: settings.rr,
          vt: settings.vt,
          inspiratoryFlow: settings.inspiratoryFlow,
          inspiratoryPause: settings.inspiratoryPause || 0
        };
        this.ti = this.settings.vt / this.settings.inspiratoryFlow;
        if (!(this.ti > 0)) throw new Error("inspiration time must be > 0");
        this.tracker = new BreathTracker({
          rr: this.settings.rr,
          ti: this.ti,
          pause: this.settings.inspiratoryPause
        });
        this.phaseTime = 0;
        this.cycleTime = 0;
        this.breathIndex = 0;
        this.lastBoundaryKind = null;
        this.deliveredThisBreath = 0;
      }
      get breath() {
        return this.breathIndex;
      }
      get phase() {
        return this.tracker.phaseFor(this.cycleTime);
      }
      /**
       * Advance the controller by dt and return the requested boundary.
       * Simulator passes deliveredVolume (mL since last breath start) so the
       * controller can switch inspiration → pause when target Vt is met.
       *
       * @param {object} state   PatientState
       * @param {number} dt      seconds
       * @param {number} deliveredSinceBreathStart   volume L since this breath's start
       */
      step(_state, dt, deliveredSinceBreathStart = 0) {
        if (!(dt > 0)) throw new Error("dt must be > 0");
        if (this.tracker.isBreathComplete(this.cycleTime)) {
          this.tracker.beginBreath();
          this.cycleTime = 0;
          this.phaseTime = 0;
          this.deliveredThisBreath = 0;
        }
        const phase = this.tracker.phaseFor(this.cycleTime);
        let boundary;
        if (phase === BreathPhase.INSPIRATION) {
          if (deliveredSinceBreathStart >= this.settings.vt) {
            boundary = makeBoundaryFlow2({ flowLps: 0, fio2: this.settings.fio2 });
            this.lastBoundaryKind = "PAUSE_FROM_VT_TARGET";
          } else {
            boundary = makeBoundaryFlow2({
              flowLps: this.settings.inspiratoryFlow,
              fio2: this.settings.fio2
            });
            this.lastBoundaryKind = "INSPIRATION";
          }
        } else if (phase === BreathPhase.PAUSE) {
          boundary = makeBoundaryFlow2({ flowLps: 0, fio2: this.settings.fio2 });
          this.lastBoundaryKind = "PAUSE";
        } else {
          boundary = makeBoundaryFlow2({ flowLps: 0, fio2: this.settings.fio2 });
          this.lastBoundaryKind = "EXPIRATION";
        }
        this.phaseTime += dt;
        this.cycleTime += dt;
        return boundary;
      }
    };
    module.exports = { VcAcController: VcAcController2 };
  }
});

// src/ventilator/pc_ac.js
var require_pc_ac = __commonJS({
  "src/ventilator/pc_ac.js"(exports, module) {
    var { BreathTracker, BreathPhase } = require_controller();
    var {
      makeBoundaryPressure: makeBoundaryPressure2,
      makeBoundaryFlow: makeBoundaryFlow2
    } = require_contracts();
    var PcAcController2 = class {
      constructor(settings) {
        ["peep", "rr", "fio2", "pinsp", "inspiratoryTime"].forEach((k) => {
          if (typeof settings[k] !== "number" || !Number.isFinite(settings[k])) {
            throw new Error(`PcAcSettings.${k} must be finite number`);
          }
        });
        if (!(settings.rr > 0)) throw new Error("rr must be > 0");
        if (!(settings.pinsp > 0)) throw new Error("pinsp must be > 0");
        if (!(settings.inspiratoryTime > 0)) {
          throw new Error("inspiratoryTime must be > 0");
        }
        if (settings.peep < 0) throw new Error("peep must be \u2265 0");
        if (settings.fio2 < 0 || settings.fio2 > 1) {
          throw new Error("fio2 must be in [0,1]");
        }
        if (settings.inspiratoryPause != null && settings.inspiratoryPause < 0) {
          throw new Error("inspiratoryPause must be \u2265 0");
        }
        const tiTotal = settings.inspiratoryTime + (settings.inspiratoryPause || 0);
        const tBreath = 60 / settings.rr;
        if (tiTotal >= tBreath) {
          throw new Error(
            `inspiratory time ${settings.inspiratoryTime.toFixed(3)} + pause ${(settings.inspiratoryPause || 0).toFixed(3)} exceeds breath period ${tBreath.toFixed(3)} at RR=${settings.rr}`
          );
        }
        this.settings = {
          fio2: settings.fio2,
          peep: settings.peep,
          rr: settings.rr,
          pinsp: settings.pinsp,
          inspiratoryTime: settings.inspiratoryTime,
          inspiratoryPause: settings.inspiratoryPause || 0
        };
        this.tracker = new BreathTracker({
          rr: this.settings.rr,
          ti: this.settings.inspiratoryTime,
          pause: this.settings.inspiratoryPause
        });
        this.phaseTime = 0;
        this.cycleTime = 0;
        this.breathIndex = 0;
      }
      get breath() {
        return this.breathIndex;
      }
      get phase() {
        return this.tracker.phaseFor(this.cycleTime);
      }
      step(_state, dt, _deliveredSinceBreathStart = 0) {
        if (!(dt > 0)) throw new Error("dt must be > 0");
        if (this.tracker.isBreathComplete(this.cycleTime)) {
          this.tracker.beginBreath();
          this.cycleTime = 0;
          this.phaseTime = 0;
        }
        const phase = this.tracker.phaseFor(this.cycleTime);
        let boundary;
        if (phase === BreathPhase.INSPIRATION || phase === BreathPhase.PAUSE) {
          boundary = makeBoundaryPressure2({
            pressureCmH2O: this.settings.peep + this.settings.pinsp,
            fio2: this.settings.fio2
          });
        } else {
          boundary = makeBoundaryFlow2({ flowLps: 0, fio2: this.settings.fio2 });
        }
        this.phaseTime += dt;
        this.cycleTime += dt;
        return boundary;
      }
    };
    module.exports = { PcAcController: PcAcController2 };
  }
});

// src/gas_exchange.js
var require_gas_exchange = __commonJS({
  "src/gas_exchange.js"(exports, module) {
    var ATMOSPHERIC_PO2 = 150;
    var HEMOGLOBIN_P50 = 26.7;
    var HILL_N = 2.7;
    var CO2_PRODUCTION_ML_PER_KG_MIN = 3;
    var REFERENCE_BODY_WEIGHT_KG = 70;
    var STANDARD_CO2_PRODUCTION = CO2_PRODUCTION_ML_PER_KG_MIN * REFERENCE_BODY_WEIGHT_KG / 60;
    function makeInitialGasState(params, fio2 = 0.21) {
      const inspiredPo2 = fio2 * (ATMOSPHERIC_PO2 - 47) + 47;
      const gas = {
        fio2,
        inspiredPo2,
        compartments: params.compartments.map((c) => ({
          va_ratio: c.fraction > 0 ? c.fraction / Math.max(c.perfusionFraction, 1e-6) : 0,
          po2: inspiredPo2,
          pco2: 40,
          spo2: 0.97
        }))
      };
      return gas;
    }
    function spo2FromPo2(po2) {
      if (po2 <= 0) return 0;
      const ratio = po2 / HEMOGLOBIN_P50;
      const spo2 = Math.pow(ratio, HILL_N) / (1 + Math.pow(ratio, HILL_N));
      return Math.max(0, Math.min(1, spo2));
    }
    function stepGasState(gas, params, compartments, dt) {
      const next = {
        fio2: gas.fio2,
        inspiredPo2: gas.inspiredPo2,
        compartments: gas.compartments.map((g, i) => {
          const cp = params.compartments[i];
          const cs = compartments[i];
          const va_proxy = Math.abs(cs.flow) + 1e-6;
          const q_proxy = Math.max(cp.perfusionFraction, 1e-6);
          const va_ratio = va_proxy / q_proxy;
          const mixedVenousPo2 = 40;
          const alvPo2 = (gas.inspiredPo2 * va_ratio + mixedVenousPo2) / (va_ratio + 1);
          const tau = 4;
          const alpha = 1 - Math.exp(-dt / tau);
          const po2 = g.po2 + alpha * (alvPo2 - g.po2);
          const pco2 = 40 / Math.max(va_ratio, 0.01);
          return {
            va_ratio,
            po2,
            pco2: Math.max(pco2, 5),
            spo2: spo2FromPo2(po2)
          };
        })
      };
      return next;
    }
    function mixedArterialPo2(gas, params) {
      let totalPerf = 0, weighted = 0;
      for (let i = 0; i < gas.compartments.length; i++) {
        const cp = params.compartments[i];
        const perf = cp.perfusionFraction;
        weighted += gas.compartments[i].po2 * perf;
        totalPerf += perf;
      }
      return totalPerf > 0 ? weighted / totalPerf : 0;
    }
    function shuntFraction(gas, params) {
      let totalPerf = 0, weighted = 0;
      for (let i = 0; i < gas.compartments.length; i++) {
        const cp = params.compartments[i];
        const perf = cp.perfusionFraction;
        const va = gas.compartments[i].va_ratio;
        weighted += perf * (1 / (1 + va));
        totalPerf += perf;
      }
      return totalPerf > 0 ? weighted / totalPerf : 0;
    }
    function deadSpaceFraction(gas, params) {
      let totalPerf = 0, weighted = 0;
      for (let i = 0; i < gas.compartments.length; i++) {
        const cp = params.compartments[i];
        const perf = cp.perfusionFraction;
        const va = gas.compartments[i].va_ratio;
        weighted += perf * Math.max(0, (va - 1) / va);
        totalPerf += perf;
      }
      return totalPerf > 0 ? weighted / totalPerf : 0;
    }
    module.exports = {
      makeInitialGasState,
      stepGasState,
      mixedArterialPo2,
      shuntFraction,
      deadSpaceFraction,
      spo2FromPo2
    };
  }
});

// src/metrics.js
var require_metrics = __commonJS({
  "src/metrics.js"(exports, module) {
    var PLATEAU_FLOW_THRESHOLD = 0.05;
    var PEEP_WINDOW_MS = 200;
    var PLATEAU_LATE_FRACTION = 0.5;
    function phaseSegments(trace) {
      const out = [];
      if (!trace || trace.length === 0) return out;
      let cur = { phase: trace[0].phase, startIdx: 0 };
      for (let i = 1; i < trace.length; i++) {
        if (trace[i].phase !== cur.phase) {
          cur.endIdx = i - 1;
          out.push(cur);
          cur = { phase: trace[i].phase, startIdx: i };
        }
      }
      cur.endIdx = trace.length - 1;
      out.push(cur);
      return out;
    }
    function median(arr) {
      if (arr.length === 0) return 0;
      const sorted = arr.slice().sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2) return sorted[mid];
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    function maxAbs(arr) {
      if (arr.length === 0) return 0;
      let m = 0;
      for (const x of arr) {
        const a = Math.abs(x);
        if (a > m) m = a;
      }
      return m;
    }
    function analyzeBreath(trace, breathStartIdx, breathEndIdx) {
      const segs = phaseSegments(trace.slice(breathStartIdx, breathEndIdx + 1)).map((s) => ({
        phase: s.phase,
        startIdx: s.startIdx + breathStartIdx,
        endIdx: s.endIdx + breathStartIdx
      }));
      const insp = segs.find((s) => s.phase === "INSPIRATION");
      const pause = segs.find((s) => s.phase === "PAUSE");
      const expir = segs.find((s) => s.phase === "EXPIRATION");
      const rows = (s) => {
        if (!s) return [];
        return trace.slice(s.startIdx, s.endIdx + 1);
      };
      const inspRows = rows(insp);
      const pauseRows = rows(pause);
      const expirRows = rows(expir);
      const Ti = insp && pause ? trace[pause.endIdx].t - trace[insp.startIdx].t : insp ? trace[insp.endIdx].t - trace[insp.startIdx].t : 0;
      const Te = expir ? trace[expir.endIdx].t - trace[expir.startIdx].t : 0;
      const breathDuration = Ti + Te;
      const RR = breathDuration > 0 ? 60 / breathDuration : 0;
      let VtInspired = 0;
      if (insp) {
        const lastPhase = pause || insp;
        const vStart = trace[insp.startIdx].output.totalVolume;
        const vEnd = trace[lastPhase.endIdx].output.totalVolume;
        VtInspired = vEnd - vStart;
      }
      const pawsInsp = inspRows.map((r) => r.output.airwayPressure);
      const Ppeak = pawsInsp.length ? Math.max(...pawsInsp) : 0;
      let Pplat = 0;
      if (pauseRows.length > 0) {
        const start = Math.floor(pauseRows.length * PLATEAU_LATE_FRACTION);
        const late = pauseRows.slice(start);
        const staticLate = late.filter((r) => Math.abs(r.output.airwayFlow) < PLATEAU_FLOW_THRESHOLD);
        const pool = staticLate.length > 0 ? staticLate : late;
        Pplat = median(pool.map((r) => r.output.airwayPressure));
      } else if (inspRows.length > 0) {
        const tail = inspRows.slice(-Math.max(20, Math.floor(inspRows.length * 0.2)));
        Pplat = median(tail.map((r) => r.output.airwayPressure));
      }
      let PEEP = 0;
      if (expirRows.length > 0) {
        const lastT = trace[expir.endIdx].t;
        const cutoff = lastT - PEEP_WINDOW_MS / 1e3;
        const window = expirRows.filter((r) => r.t >= cutoff);
        const pool = window.length > 0 ? window : expirRows.slice(-10);
        PEEP = median(pool.map((r) => r.output.airwayPressure));
      }
      const drivingPressure = Pplat - PEEP;
      const QpeakInsp = inspRows.length ? maxAbs(inspRows.map((r) => r.output.airwayFlow)) : 0;
      const QpeakExp = expirRows.length ? maxAbs(expirRows.map((r) => r.output.airwayFlow)) : 0;
      let VtExpired = 0;
      if (expirRows.length > 0 && insp) {
        const vPeak = trace[insp.endIdx].output.totalVolume;
        const vMin = Math.min(...expirRows.map((r) => r.output.totalVolume));
        VtExpired = vPeak - vMin;
      }
      const volumeError = VtInspired - VtExpired;
      const MV = RR * VtInspired / 60 * 60;
      const autoPEEP = 0;
      const compartments = {};
      if (insp) {
        const cs = trace[pause ? pause.endIdx : insp.endIdx].output;
        for (let i = 0; i < (cs.compartmentVolumes || []).length; i++) {
          compartments[`comp_${i}`] = {
            endInspV: cs.compartmentVolumes[i],
            endInspF: (cs.compartmentFlows || [])[i],
            endInspP: (cs.compartmentPressures || [])[i]
          };
        }
      }
      if (expir) {
        const cs = trace[expir.endIdx].output;
        for (let i = 0; i < (cs.compartmentVolumes || []).length; i++) {
          const key = `comp_${i}`;
          if (!compartments[key]) compartments[key] = {};
          compartments[key].endExpV = cs.compartmentVolumes[i];
          compartments[key].endExpF = (cs.compartmentFlows || [])[i];
          compartments[key].endExpP = (cs.compartmentPressures || [])[i];
        }
      }
      return {
        Ti,
        Te,
        breathDuration,
        RR,
        MV,
        PEEP,
        Ppeak,
        Pplat,
        drivingPressure,
        VtInspired,
        VtExpired,
        volumeError,
        QpeakInsp,
        QpeakExp,
        autoPEEP,
        compartments
      };
    }
    function analyzeAll(trace, setPEEP) {
      const metrics = [];
      const segments = phaseSegments(trace);
      const expirStarts = [0, ...segments.filter((s, i) => i > 0 && s.phase === "EXPIRATION").map((s) => s.startIdx)];
      for (let i = 0; i < expirStarts.length; i++) {
        const startIdx = expirStarts[i];
        const endIdx = i + 1 < expirStarts.length ? expirStarts[i + 1] - 1 : trace.length - 1;
        if (endIdx <= startIdx) continue;
        const m = analyzeBreath(trace, startIdx, endIdx);
        m.breathIndex = i;
        m.breathStartT = trace[startIdx].t;
        m.breathEndT = trace[endIdx].t;
        m.autoPEEP = m.PEEP - (setPEEP || 0);
        metrics.push(m);
      }
      return metrics;
    }
    module.exports = { analyzeAll, analyzeBreath, phaseSegments };
  }
});

// src/simulation.js
var require_simulation = __commonJS({
  "src/simulation.js"(exports, module) {
    var { SimulationClock } = require_clock();
    var { ThreeCompartmentMechanics } = require_mechanics();
    var { VcAcController: VcAcController2 } = require_vc_ac();
    var { PcAcController: PcAcController2 } = require_pc_ac();
    var { BreathPhase } = require_controller();
    var {
      makeBoundaryPressure: makeBoundaryPressure2,
      makeInitialState: makeInitialState2
    } = require_contracts();
    var {
      makeInitialGasState,
      stepGasState,
      mixedArterialPo2,
      shuntFraction,
      deadSpaceFraction
    } = require_gas_exchange();
    var { analyzeAll } = require_metrics();
    var Simulation2 = class {
      constructor({ params, controller, dt = 1e-3, fio2 = 0.4, trackGas = true }) {
        this.params = params;
        this.controller = controller;
        this.clock = new SimulationClock(dt);
        const presetRecState = params.initialRecruitmentState && typeof params.initialRecruitmentState === "object" ? params.initialRecruitmentState : null;
        const presetPEEP = typeof params.initialPEEP === "number" ? params.initialPEEP : null;
        const ctrlPEEP = controller.settings && typeof controller.settings.peep === "number" ? controller.settings.peep : null;
        const finalPEEP = presetPEEP !== null ? presetPEEP : ctrlPEEP;
        this.state = makeInitialState2(params, {
          initialPEEP: finalPEEP,
          initialRecruitmentState: presetRecState || { normal: 1, recruitable: 0, consolidated: 0 }
        });
        this.mechanics = new ThreeCompartmentMechanics();
        this.trace = [];
        this.deliveredSinceBreathStart = 0;
        this.peepOverrideActive = false;
        this.fio2 = fio2;
        this.trackGas = trackGas;
        this.gas = trackGas ? makeInitialGasState(params, fio2) : null;
      }
      setPEEP(_value) {
      }
      runFor(seconds) {
        const start = this.state.t;
        const target = start + seconds;
        while (this.state.t < target) {
          this.step();
        }
        return this.trace;
      }
      step() {
        const dt = this.clock.dt;
        let boundary = this.controller.step(this.state, dt, this.deliveredSinceBreathStart);
        if (this.controller.phase === BreathPhase.EXPIRATION) {
          boundary = makeBoundaryPressure2({
            pressureCmH2O: this.controller.settings.peep,
            fio2: this.controller.settings.fio2
          });
        }
        let { state, output } = this.mechanics.step(this.params, this.state, boundary, dt);
        if (output.solverFailure) {
          this.lastFailure = output;
          return { state: this.state, output, boundary, failed: true };
        }
        if (this.trackGas) {
          this.gas = stepGasState(this.gas, this.params, state.compartments, dt);
        }
        if (this.controller.phase === BreathPhase.INSPIRATION) {
          if (this.controller.cycleTime <= dt) {
            this.deliveredSinceBreathStart = 0;
            this.inspStartVolume = this.state.totalVolume;
          }
          this.deliveredSinceBreathStart = state.totalVolume - this.inspStartVolume;
        }
        this.state = state;
        this.trace.push({
          t: state.t,
          phase: this.controller.phase,
          boundaryKind: boundary.kind,
          output
        });
        return { state, output, boundary, failed: false };
      }
      // Per-breath metrics from the current trace. setPEEP = the controller's
      // set PEEP value (used to compute auto-PEEP).
      metrics() {
        const setPEEP = this.controller.settings ? this.controller.settings.peep : 0;
        return analyzeAll(this.trace, setPEEP);
      }
      // Gas exchange summary at current state.
      gasSummary() {
        if (!this.trackGas || !this.gas) return null;
        return {
          pao2: mixedArterialPo2(this.gas, this.params),
          shunt: shuntFraction(this.gas, this.params),
          deadSpace: deadSpaceFraction(this.gas, this.params),
          inspiredPo2: this.gas.inspiredPo2
        };
      }
    };
    module.exports = { Simulation: Simulation2, VcAcController: VcAcController2, PcAcController: PcAcController2 };
  }
});

// src/presets.js
var require_presets = __commonJS({
  "src/presets.js"(exports, module) {
    var C0 = 0.12;
    var K_NORMAL = 30;
    var K_RECRUITABLE = 22;
    var K_CONSOLIDATED = 35;
    function makeCompartment({
      id,
      fraction,
      resistance,
      perfusion,
      deadSpace,
      elasticScale = K_NORMAL
    }) {
      const c = fraction * C0;
      return {
        id,
        fraction,
        resistance,
        capacity: c * elasticScale,
        // saturation asymptote L
        elasticScale,
        perfusionFraction: perfusion,
        deadSpaceFraction: deadSpace
      };
    }
    function presetBaseline() {
      return {
        // v0.4.3: presets own initialPEEP and initialRecruitmentState.
        // Baseline has only normal tissue; the recruitable pool is fraction=0.
        initialPEEP: 5,
        initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 },
        compartments: [
          makeCompartment({
            id: "normal",
            fraction: 0.98,
            resistance: 0.5,
            perfusion: 0.98,
            deadSpace: 0.3,
            elasticScale: K_NORMAL
          }),
          makeCompartment({
            id: "recruitable",
            fraction: 0,
            resistance: 0.5,
            perfusion: 0,
            deadSpace: 0.3,
            elasticScale: K_RECRUITABLE
          }),
          makeCompartment({
            id: "consolidated",
            fraction: 0.02,
            resistance: 0.5,
            perfusion: 0.02,
            deadSpace: 0.3,
            elasticScale: K_CONSOLIDATED
          })
        ],
        centralAirwayResistance: 2.5,
        airwayOpeningPressure: 0
      };
    }
    function presetInjuryA() {
      return {
        // v0.4.3: injury presets have a recruitable pool.
        // initialRecruitmentState is the explicit mid-state value the model
        // should start at. The dynamics will evolve it from there.
        initialPEEP: 8,
        initialRecruitmentState: { normal: 1, recruitable: 0.5, consolidated: 0 },
        compartments: [
          makeCompartment({
            id: "normal",
            fraction: 0.65,
            resistance: 0.7,
            perfusion: 0.75,
            deadSpace: 0.4,
            elasticScale: K_NORMAL
          }),
          makeCompartment({
            id: "recruitable",
            fraction: 0.25,
            resistance: 0.5,
            perfusion: 0.18,
            deadSpace: 0.4,
            elasticScale: K_RECRUITABLE
          }),
          makeCompartment({
            id: "consolidated",
            fraction: 0.1,
            resistance: 0.5,
            perfusion: 0.07,
            deadSpace: 0.4,
            elasticScale: K_CONSOLIDATED
          })
        ],
        centralAirwayResistance: 3,
        airwayOpeningPressure: 2
      };
    }
    function presetInjuryB() {
      return {
        initialPEEP: 10,
        initialRecruitmentState: { normal: 1, recruitable: 0.5, consolidated: 0 },
        compartments: [
          makeCompartment({
            id: "normal",
            fraction: 0.4,
            resistance: 0.8,
            perfusion: 0.55,
            deadSpace: 0.5,
            elasticScale: K_NORMAL
          }),
          makeCompartment({
            id: "recruitable",
            fraction: 0.4,
            resistance: 0.5,
            perfusion: 0.3,
            deadSpace: 0.5,
            elasticScale: K_RECRUITABLE
          }),
          makeCompartment({
            id: "consolidated",
            fraction: 0.2,
            resistance: 0.5,
            perfusion: 0.15,
            deadSpace: 0.5,
            elasticScale: K_CONSOLIDATED
          })
        ],
        centralAirwayResistance: 3.5,
        airwayOpeningPressure: 4
      };
    }
    function presetInjuryC() {
      return {
        initialPEEP: 12,
        initialRecruitmentState: { normal: 1, recruitable: 0.5, consolidated: 0 },
        compartments: [
          makeCompartment({
            id: "normal",
            fraction: 0.2,
            resistance: 1,
            perfusion: 0.3,
            deadSpace: 0.6,
            elasticScale: K_NORMAL
          }),
          makeCompartment({
            id: "recruitable",
            fraction: 0.5,
            resistance: 0.5,
            perfusion: 0.45,
            deadSpace: 0.6,
            elasticScale: K_RECRUITABLE
          }),
          makeCompartment({
            id: "consolidated",
            fraction: 0.3,
            resistance: 0.5,
            perfusion: 0.25,
            deadSpace: 0.6,
            elasticScale: K_CONSOLIDATED
          })
        ],
        centralAirwayResistance: 5,
        airwayOpeningPressure: 6
      };
    }
    var PRESETS2 = Object.freeze({
      Baseline: presetBaseline,
      "Injury A": presetInjuryA,
      "Injury B": presetInjuryB,
      "Injury C": presetInjuryC
    });
    module.exports = { PRESETS: PRESETS2 };
  }
});

// src/_bundle-entry.js
var import_simulation = __toESM(require_simulation());
var import_presets = __toESM(require_presets());
var import_contracts = __toESM(require_contracts());
var import_compartments = __toESM(require_compartments());
var export_PRESETS = import_presets.PRESETS;
var export_PcAcController = import_simulation.PcAcController;
var export_Simulation = import_simulation.Simulation;
var export_VcAcController = import_simulation.VcAcController;
var export_dPressureDVolume = import_compartments.dPressureDVolume;
var export_effectiveVolumeCapacity = import_compartments.effectiveVolumeCapacity;
var export_forwardElasticVolume = import_compartments.forwardElasticVolume;
var export_makeBoundaryFlow = import_contracts.makeBoundaryFlow;
var export_makeBoundaryPressure = import_contracts.makeBoundaryPressure;
var export_makeInitialState = import_contracts.makeInitialState;
var export_makePatientParams = import_contracts.makePatientParams;
export {
  export_PRESETS as PRESETS,
  export_PcAcController as PcAcController,
  export_Simulation as Simulation,
  export_VcAcController as VcAcController,
  export_dPressureDVolume as dPressureDVolume,
  export_effectiveVolumeCapacity as effectiveVolumeCapacity,
  export_forwardElasticVolume as forwardElasticVolume,
  export_makeBoundaryFlow as makeBoundaryFlow,
  export_makeBoundaryPressure as makeBoundaryPressure,
  export_makeInitialState as makeInitialState,
  export_makePatientParams as makePatientParams
};
