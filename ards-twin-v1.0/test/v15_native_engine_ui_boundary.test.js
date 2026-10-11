'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
const config=fs.readFileSync(path.join(root,'web/native-engine-config.js'),'utf8');

assert.match(html,/native-engine-config\.js/);
assert.match(html,/native-engine-client\.js/);
assert.match(html,/id="clinical-native-engine-status">Not configured</);
assert.match(app,/MEDICAL_TWIN_NATIVE_ENGINE_URL/);
assert.match(app,/createNativeEngineClient/);
assert.match(app,/pollNativeEngineBoundary/);
assert.match(app,/Connected · boundary only/);
assert.match(app,/Unavailable/);
assert.doesNotMatch(
  app,
  /clinical-native-engine-status[\s\S]{0,500}(heartRatePerMin|meanArterialPressureMmHg|cardiacOutputLPerMin)/
);
assert.match(config,/MEDICAL_TWIN_NATIVE_ENGINE_URL/);

console.log('ok - remote native engine wiring remains connection-status-only and non-authoritative');
