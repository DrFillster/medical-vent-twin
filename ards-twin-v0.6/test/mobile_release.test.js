'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createScenario, runScenario, validateScenario } = require('../src/scenario.js');
const { classify } = require('./runner.js');
const { PRESETS } = require('../src/presets.js');
let failures = 0;
function test(name, fn) { try { fn(); console.log('ok -', name); } catch (error) { failures++; console.error('FAIL -', name, error.stack); } }
const base = { preset: 'phenotype_baseline', mode: 'VC', peep: 5, rr: 14, vt: .48, flow: .5, pause: .5, pinsp: 12, ti: .8, recruitment: 0, breaths: 3, dt: .001 };
test('failed step restores controller, tracker, patient, and trace', () => {
  const {sim} = createScenario(base);
  sim.controller.cycleTime = 60 / base.rr; // force beginBreath() too
  const before = JSON.stringify({ controller: sim.controller, state: sim.state, gas: sim.gas, trace: sim.trace });
  sim.mechanics.step = (_, state) => ({ state, output: {solverFailure: true, failureKind: 'SOLVER_NONCONVERGENCE'} });
  assert.equal(sim.step().failed, true);
  assert.equal(JSON.stringify({ controller: sim.controller, state: sim.state, gas: sim.gas, trace: sim.trace }), before);
});
test('runFor aborts on first failed step', () => {
  const {sim} = createScenario(base); let calls = 0;
  sim.mechanics.step = (_, state) => { calls++; return { state, output: {solverFailure: true, failureKind: 'INFEASIBLE_BOUNDARY'} }; };
  assert.throws(() => sim.runFor(2), /INFEASIBLE_BOUNDARY/); assert.equal(calls, 1); assert.equal(sim.state.t, 0);
});
test('mechanics exception restores controller', () => {
  const {sim} = createScenario(base); const before = JSON.stringify(sim.controller);
  sim.mechanics.step = () => { throw new Error('injected exception'); };
  assert.throws(() => sim.step(), /injected/); assert.equal(JSON.stringify(sim.controller), before);
});
test('runner rejects crash, empty output, signal, and timeout', () => {
  assert(classify({ status: 1, stderr: 'Uncaught exception' }).broken);
  assert(classify({ status: 0, stdout: '' }).broken);
  assert(classify({ status: null, signal: 'SIGTERM' }).broken);
  assert(classify({ status: null, error: new Error('timeout') }).broken);
  assert(!classify({ status: 0, stdout: 'ok - passed\n' }).broken);
});
test('scenario rejects missing recruitment, invalid timing, nonfinite inputs', () => {
  assert.throws(() => validateScenario({...base, recruitment: undefined}));
  assert.throws(() => validateScenario({...base, rr:40, vt:1, flow:.1}));
  assert.throws(() => validateScenario({...base, dt:NaN}));
  assert.throws(() => validateScenario({...base, breaths:2.5}));
  assert.throws(() => validateScenario({...base, preset:'__proto__'}));
});
for (const preset of Object.keys(PRESETS)) for (const mode of ['VC','PC']) {
  test(`UI scenario runs: ${preset}, ${mode}`, () => {
    const result = runScenario({...base, preset, mode, peep:10, vt:.28, recruitment:.5, rr:22});
    assert(Number.isFinite(result.metrics.Ppeak)); assert(result.metrics.VtInspired > 0);
    assert(result.waveform.length > 100); assert(result.waveform.length <= 1201);
    assert(result.waveform.every(r => Object.values(r).every(Number.isFinite)));
    assert(result.stats.newtonIterations > 0); assert.equal(result.stats.failures,0);
    if(mode==='PC') assert.equal(result.metrics.Pplat,null);
  });
}
test('no-pause VC does not claim a plateau', () => {
  assert.equal(runScenario({...base, pause:0}).metrics.Pplat,null);
});
test('generated browser bundle runs default scenario without module imports', () => {
  const context = {}; vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../web/engine.js'),'utf8'),context);
  const result = context.VENT.runScenario(base);
  assert.equal(result.version,'0.4.5'); assert(Number.isFinite(result.metrics.Ppeak));
});
test('actual worker script loads bundle and returns results and errors', () => {
  const messages=[];
  const context={self:{postMessage:m=>messages.push(m)}};vm.createContext(context);
  context.importScripts = name => {assert.equal(name,'./engine.js?v=0.4.5');vm.runInContext(fs.readFileSync(require.resolve('../web/engine.js'),'utf8'),context);};
  vm.runInContext(fs.readFileSync(require.resolve('../web/worker.js'),'utf8'),context);
  context.self.onmessage({data:base}); assert.equal(messages.at(-1).type,'result');
  context.self.onmessage({data:{...base, dt:0}}); assert.equal(messages.at(-1).type,'error');
});
process.exitCode = failures ? 1 : 0;
