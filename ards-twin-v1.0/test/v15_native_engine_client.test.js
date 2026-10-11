'use strict';

const assert=require('node:assert/strict');
const {
  validateHealth,
  validateState,
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
  assert.equal(c.connectionStatus().status,'connected');
  assert.equal(c.lastState().status,'boundary-only');
  console.log('ok - browser native-engine client validates read-only non-authoritative boundary');
})().catch(error=>{
  console.error(error.stack||error.message);
  process.exitCode=1;
});
