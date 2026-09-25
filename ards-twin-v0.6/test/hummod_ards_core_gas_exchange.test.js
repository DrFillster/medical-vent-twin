'use strict';

const {
  hco3FromPco2Sid,
  o2ContentFromPo2,
  po2FromO2Content,
  solveOxygenExchange,
  mixOxygenAcrossShunt,
  solveCo2Exchange,
  mixCo2AcrossShunt,
} = require('../src/hummod_ards_core_gas_exchange.js');
const {
  hemoglobinProperties,
} = require('../src/hummod_ards_core_chemistry.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed += 1; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed += 1; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function near(a,b,tol=1e-8){ assert(Math.abs(a-b)<=tol, a+' != '+b); }

test('HumMod O2 content conversion round-trips below saturation threshold', () => {
  const props = hemoglobinProperties({
    tempC: 37, pH: 7.4, pco2MmHg: 40, carboxyPercent: 0,
  });
  const content = o2ContentFromPo2({
    po2MmHg: 60,
    o2MaxMlPerMl: 0.2,
    p50MmHg: props.p50MmHg,
    scaleForSat: props.scaleForSat,
  });
  const po2 = po2FromO2Content({
    o2ContentMlPerMl: content,
    o2MaxMlPerMl: 0.2,
    p50MmHg: props.p50MmHg,
    scaleForSat: props.scaleForSat,
  });
  near(po2, 60, 1e-7);
});

test('HumMod Blood-GasToBase equation follows source constants', () => {
  const out = hco3FromPco2Sid({ pco2MmHg: 40, sidMolPerL: 0.04 });
  near(out.hco3MolPerL, (0.2325 * 0.04) + (0.00036 * 40));
});

test('oxygen exchange implicit solver converges to a bounded solution', () => {
  const out = solveOxygenExchange({
    alveolarVentilationStpdMlPerMin: 5000,
    bronchiO2Fraction: 0.21,
    barometricPressureMmHg: 760,
    pulmonaryMembranePermeabilityMlPerMinPerMmHg: 1000,
    ventilatedPulmonaryBloodFlowMlPerMin: 5000,
    mixedVenousO2ContentMlPerMl: 0.15,
    o2MaxMlPerMl: 0.2,
    tempC: 37,
    arterialPhEstimate: 7.4,
    arterialPco2EstimateMmHg: 40,
  });
  assert(out.uptakeMlPerMin > 0);
  assert(out.uptakeMlPerMin < 1050);
  assert(out.alveolarO2Fraction > 0 && out.alveolarO2Fraction < 0.21);
  assert(out.pCapillaryO2MmHg > 0);
  assert(out.capillaryO2ContentMlPerMl > 0.15);
});

test('oxygen shunt mixing respects ventilated and shunt endpoints', () => {
  near(mixOxygenAcrossShunt({
    totalPulmonaryBloodFlowMlPerMin: 5000,
    ventilatedPulmonaryBloodFlowMlPerMin: 5000,
    capillaryO2ContentMlPerMl: 0.2,
    mixedVenousO2ContentMlPerMl: 0.15,
  }), 0.2);
  near(mixOxygenAcrossShunt({
    totalPulmonaryBloodFlowMlPerMin: 5000,
    ventilatedPulmonaryBloodFlowMlPerMin: 0,
    capillaryO2ContentMlPerMl: 0.2,
    mixedVenousO2ContentMlPerMl: 0.15,
  }), 0.15);
});

test('CO2 exchange implicit solver converges and lowers capillary bicarbonate', () => {
  const out = solveCo2Exchange({
    alveolarVentilationStpdMlPerMin: 5000,
    bronchiCo2Fraction: 0,
    barometricPressureMmHg: 760,
    ventilatedPulmonaryBloodFlowMlPerMin: 5000,
    mixedVenousHco3MolPerL: 0.0256,
    sidMolPerL: 0.04,
  });
  assert(out.expiredCo2MlPerMin > 0);
  assert(out.alveolarCo2Fraction > 0);
  assert(out.capillaryHco3MolPerL < 0.0256);
});

test('CO2 shunt mixing respects ventilated and shunt endpoints', () => {
  near(mixCo2AcrossShunt({
    totalPulmonaryBloodFlowMlPerMin: 5000,
    ventilatedPulmonaryBloodFlowMlPerMin: 5000,
    capillaryHco3MolPerL: 0.024,
    mixedVenousHco3MolPerL: 0.026,
  }), 0.024);
  near(mixCo2AcrossShunt({
    totalPulmonaryBloodFlowMlPerMin: 5000,
    ventilatedPulmonaryBloodFlowMlPerMin: 0,
    capillaryHco3MolPerL: 0.024,
    mixedVenousHco3MolPerL: 0.026,
  }), 0.026);
});

console.log('\nTests: passed=' + passed + ' failed=' + failed);
process.exit(failed === 0 ? 0 : 1);
