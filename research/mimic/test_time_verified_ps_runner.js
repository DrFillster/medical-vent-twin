'use strict';
const assert=require('assert');
const {config,run}=require('./time_verified_ps_runner');
const p={vent:{fio2_percent:40,peep:5,psv:10}},c={drive:.3,elastic:1,capacity:1,resistance:1,transmission:1};
const a=config(p,c);assert.equal(a.ventilation.fio2,.4);assert.equal(a.mechanics.capacityScale,1);assert.equal(a.mechanics.elasticScale,1);const z=config(p,{...c,elastic:2});assert.equal(z.mechanics.capacityScale,1);assert.equal(z.mechanics.elasticScale,2);
const x=run(p,c,30),y=run(p,c,30);assert.deepStrictEqual(x,y);assert(Object.values(x.model).every(Number.isFinite));assert.throws(()=>run(p,{...c,capacity:0},30),/positive/);
console.log('PASS independent controls, fresh deterministic replay, finite breath readout, invalid-capacity rejection');
