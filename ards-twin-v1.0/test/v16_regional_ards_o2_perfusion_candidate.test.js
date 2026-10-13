'use strict';

const assert=require('node:assert/strict');
const {
  solveRegionalArdsO2PerfusionFixedPoint,
}=require('../src/v16_regional_ards_o2_perfusion_candidate.js');

let passed=0,failed=0;
function test(name,fn){
  try{fn();console.log('ok -',name);passed++;}
  catch(e){console.error('FAIL -',name,':',e.stack||e.message);failed++;}
}

const common={
  totalPulmonaryBloodFlowMlPerMin:5000,
  bronchiO2Fraction:0.46,
  barometricPressureMmHg:760,
  mixedVenousO2ContentMlPerMl:0.15,
  o2MaxMlPerMl:0.201,
  tempC:37,
  arterialPhEstimate:7.40,
  arterialPco2EstimateMmHg:40,
  carboxyPercent:0,
  regionalIds:['fast','slow','recruitable'],
  toleranceMmHg:0.05,
  maxIterations:100,
};

test('equal regional ventilation converges to symmetric gas/perfusion state',()=>{
  const s=solveRegionalArdsO2PerfusionFixedPoint({
    ...common,
    regionalAlveolarVentilationStpdMlPerMin:[2000,2000,2000],
  });
  assert(s.converged);
  assert(Math.abs(s.flowClosureMlPerMin)<1e-8);
  assert(Math.abs(s.regions[0].perfusionFraction-
    s.regions[1].perfusionFraction)<1e-6);
  assert(Math.abs(s.regions[1].perfusionFraction-
    s.regions[2].perfusionFraction)<1e-6);
});

test('poorly ventilated region becomes more hypoxic and receives less flow via HPV',()=>{
  const s=solveRegionalArdsO2PerfusionFixedPoint({
    ...common,
    regionalAlveolarVentilationStpdMlPerMin:[2000,2000,150],
  });
  const poor=s.regions[2];
  const normal=s.regions[0];
  assert(poor.pAlveolarO2MmHg<normal.pAlveolarO2MmHg);
  assert(poor.hpvResistanceCoefficient>normal.hpvResistanceCoefficient);
  assert(poor.perfusionFraction<normal.perfusionFraction);
});

test('zero regional ventilation equilibrates toward venous oxygen rather than inventing zero PO2',()=>{
  const s=solveRegionalArdsO2PerfusionFixedPoint({
    ...common,
    regionalAlveolarVentilationStpdMlPerMin:[2000,2000,0],
  });
  const closed=s.regions[2];
  assert(closed.pAlveolarO2MmHg>0);
  assert(Math.abs(closed.pAlveolarO2MmHg-s.mixedVenousPo2MmHg)<1);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
