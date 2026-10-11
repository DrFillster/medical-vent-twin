'use strict';

const assert=require('node:assert/strict');
const {
  HEADER,
  expectedAt,
  validate,
}=require('../scripts/validate-shimayoshi-dynamic-co2.js');

const row=(time,phase,fb,co2)=>[
  time,phase,fb,7.0,0.24,0.23,6.9,10.8,1.8,0.0008,co2
].join(',');

const csv=[
  HEADER.join(','),
  row(0.4,'control',6,5),
  row(299.6,'control',6,5),
  row(300.0,'acidosis',6,15),
  row(419.6,'acidosis',5.8,15),
  row(420.0,'acidosis',5.7,25),
  row(540.0,'acidosis',5.9,10),
  row(660.0,'acidosis',5.5,30),
  row(780.0,'acidosis',5.6,20),
  row(900.0,'control',5.8,5),
  row(960.0,'control',6.1,5),
].join('\n');

const manifest={
  upstreamGitSha:'6478d2ab0acbfc88d3da461d2594658bcb2798ca',
  physiologyChanged:false,
  stimulusScheduleChanged:true,
};

assert.equal(expectedAt(299.6).co2Percent,5);
assert.equal(expectedAt(300).co2Percent,15);
assert.equal(expectedAt(420).co2Percent,25);
assert.equal(expectedAt(540).co2Percent,10);
assert.equal(expectedAt(660).co2Percent,30);
assert.equal(expectedAt(780).co2Percent,20);
assert.equal(expectedAt(900).co2Percent,5);

const x=validate({csvText:csv,manifest});
assert.equal(x.status,'shimayoshi-dynamic-co2-source-validation-complete');
assert.equal(x.closedLoopAuthority,false);
assert.equal(x.segments.length,7);
assert.equal(x.segments[1].co2Percent,15);
assert.equal(x.segments[5].co2Percent,20);

assert.throws(
  ()=>validate({
    csvText:csv.replace('660,acidosis,5.5,7,0.24,0.23,6.9,10.8,1.8,0.0008,30',
                        '660,acidosis,5.5,7,0.24,0.23,6.9,10.8,1.8,0.0008,25'),
    manifest,
  }),
  /schedule mismatch/
);
console.log('ok - dynamic source validator enforces the exact multistep CO2 schedule');
