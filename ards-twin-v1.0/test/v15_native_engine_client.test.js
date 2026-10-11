'use strict';

const assert=require('node:assert/strict');
const {
  validateHealth,
  validateState,
  validateAcidosisDiagnostic,
  createNativeEngineClient,
}=require('../web/native-engine-client.js');

assert.equal(validateHealth({
  schema:'native-engine-health/v1',
  status:'ok',
  physiologyAuthority:false,
  controlAuthority:false,
}).status,'ok');

assert.throws(
  ()=>validateHealth({
    schema:'native-engine-health/v1',
    status:'ok',
    physiologyAuthority:true,
    controlAuthority:false,
  }),
  /must not claim authority/
);

assert.equal(validateState({
  schema:'native-engine-state/v1',
  status:'boundary-only',
  physiologyAuthority:false,
  controlAuthority:false,
  patientState:null,
}).status,'boundary-only');

assert.throws(
  ()=>validateState({
    schema:'native-engine-state/v1',
    status:'boundary-only',
    physiologyAuthority:false,
    controlAuthority:false,
    patientState:{heartRatePerMin:90},
  }),
  /must not contain patient state/
);

assert.equal(validateAcidosisDiagnostic({
  schema:'native-acidosis-diagnostic/v1',
  status:'HumMod-myocardial-PCO2-to-dynamic-Shimayoshi-LV-pressure-shadow-complete',
  physiologyAuthority:false,
  controlAuthority:false,
  stateless:true,
}).stateless,true);

assert.throws(
  ()=>validateAcidosisDiagnostic({
    schema:'native-acidosis-diagnostic/v1',
    status:'bad',
    physiologyAuthority:true,
    controlAuthority:false,
    stateless:true,
  }),
  /must not claim authority/
);

const payloads={
  '/health':{
    schema:'native-engine-health/v1',
    status:'ok',
    physiologyAuthority:false,
    controlAuthority:false,
  },
  '/state':{
    schema:'native-engine-state/v1',
    status:'boundary-only',
    physiologyAuthority:false,
    controlAuthority:false,
    patientState:null,
  },
  '/diagnostics/myocardium/acidosis':{
    schema:'native-acidosis-diagnostic/v1',
    status:'HumMod-myocardial-PCO2-to-dynamic-Shimayoshi-LV-pressure-shadow-complete',
    myocardialPco2MmHg:158,
    lvVolumeMl:120,
    dtSec:0.4,
    steps:300,
    durationSec:120,
    sourceEquivalentCo2Percent:20,
    stressRatio:0.94,
    peakFbMnPerMm2:5.68,
    lvPressureMmHg:100,
    pressureShadowEligible:true,
    physiologyAuthority:false,
    controlAuthority:false,
    stateless:true,
  },
};
const fakeFetch=async url=>{
  const path=new URL(url).pathname;
  return {
    ok:true,
    status:200,
    json:async()=>payloads[path],
  };
};

(async()=>{
  const c=createNativeEngineClient({
    baseUrl:'https://engine.example.test/',
    fetchImpl:fakeFetch,
    staleAfterMs:1000,
  });
  assert.equal(c.baseUrl,'https://engine.example.test');
  assert.equal(c.physiologyAuthority,false);
  await c.health();
  await c.state();
  const diag=await c.acidosisDiagnostic({
    myocardialPco2MmHg:158,
    lvVolumeMl:120,
    dtSec:0.4,
    steps:300,
  });
  assert.equal(diag.schema,'native-acidosis-diagnostic/v1');
  assert.equal(diag.stateless,true);
  assert.equal(diag.controlAuthority,false);
  assert.equal(c.connectionStatus().status,'connected');
  assert.equal(c.lastState().status,'boundary-only');
  console.log('ok - browser native-engine client validates read-only non-authoritative boundary');
})().catch(error=>{
  console.error(error.stack||error.message);
  process.exitCode=1;
});
