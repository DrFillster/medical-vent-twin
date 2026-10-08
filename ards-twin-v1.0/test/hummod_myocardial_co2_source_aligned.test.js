'use strict';
const {
  LITERS_TO_MOLS,
  RESPIRATORY_QUOTIENT,
  HEART_CONFIG,
  calculateMyocardialCo2Derivatives,
}=require('../src/hummod_myocardial_co2_source_aligned.js');

let passed=0,failed=0;
function test(name,fn){try{fn();console.log('ok -',name);passed++;}catch(e){console.error('FAIL -',name,':',e.message);failed++;}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
function near(a,b,tol=1e-12){assert(Math.abs(a-b)<=tol,a+' not near '+b);}

test('preserves HumMod CO2 constants and ventricular initial masses',()=>{
  near(LITERS_TO_MOLS,0.0446);
  near(RESPIRATORY_QUOTIENT,0.8);
  near(HEART_CONFIG.left.initialMass,3.5);
  near(HEART_CONFIG.right.initialMass,0.6);
});

test('inflow gas and base match native source equations',()=>{
  const d=calculateMyocardialCo2Derivatives({
    side:'left',mass:3.5,liquidVolumeMl:100,
    tissueSid:0.04,bloodFlowMlPerMin:200,o2UseMlPerMin:20,
    bloodSid:0.04,arterialHco3:0.024,dxMin:0.01,
  });
  near(d.inflowGas,RESPIRATORY_QUOTIENT*20);
  near(d.inflowBase,LITERS_TO_MOLS*d.inflowGas);
});

test('source alpha uses blood-flow/liquid-volume rate',()=>{
  const d=calculateMyocardialCo2Derivatives({
    side:'right',mass:0.6,liquidVolumeMl:50,
    tissueSid:0.04,bloodFlowMlPerMin:100,o2UseMlPerMin:10,
    bloodSid:0.04,arterialHco3:0.024,dxMin:0.1,
  });
  near(d.k,2);
  near(d.alpha,Math.exp(-0.2));
});

test('undefined dx preserves source alpha zero branch',()=>{
  const d=calculateMyocardialCo2Derivatives({
    side:'left',mass:3.5,liquidVolumeMl:100,
    tissueSid:0.04,bloodFlowMlPerMin:200,o2UseMlPerMin:20,
    bloodSid:0.04,arterialHco3:0.024,dxUndefined:true,
  });
  near(d.alpha,0);
});

test('large k*dx preserves source 4E-44 branch',()=>{
  const d=calculateMyocardialCo2Derivatives({
    side:'left',mass:3.5,liquidVolumeMl:0.1,
    tissueSid:0.04,bloodFlowMlPerMin:100,o2UseMlPerMin:20,
    bloodSid:0.04,arterialHco3:0.024,dxMin:1,
  });
  near(d.alpha,4e-44,1e-50);
});

test('outflow and derivative are finite for physiologic positive inputs',()=>{
  const d=calculateMyocardialCo2Derivatives({
    side:'left',mass:3.5,liquidVolumeMl:100,
    tissueSid:0.04,bloodFlowMlPerMin:200,o2UseMlPerMin:20,
    bloodSid:0.04,arterialHco3:0.024,dxMin:0.01,
  });
  assert(Number.isFinite(d.outflow0));
  assert(Number.isFinite(d.outflowBase));
  assert(Number.isFinite(d.change));
  assert(d.pCO2>0);
});

console.log('\nTests: passed='+passed+' failed='+failed);
process.exit(failed===0?0:1);
