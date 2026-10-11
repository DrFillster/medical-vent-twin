'use strict';

const assert=require('node:assert/strict');
const {
  myocardialAcidBaseState,
}=require('../src/hummod_myocardial_acid_base_state.js');
const {
  myocardialSid,
}=require('../src/hummod_myocardial_sid_source_aligned.js');
const {
  calculateMyocardialCo2Derivatives,
}=require('../src/hummod_myocardial_co2_source_aligned.js');
const {
  phCells,
}=require('../src/hummod_acid_base_source_aligned.js');

const input={
  side:'left',
  intracellularPotassium:0.145,
  myocardialLactate:0.002,
  co2Mass:3.5,
  liquidVolumeMl:100,
  bloodFlowMlPerMin:250,
  o2UseMlPerMin:25,
  bloodSid:0.024,
  arterialHco3:0.024,
  dxMin:0.01,
};

const composed=myocardialAcidBaseState(input);
const sid=myocardialSid({
  intracellularPotassium:input.intracellularPotassium,
  myocardialLactate:input.myocardialLactate,
});
const co2=calculateMyocardialCo2Derivatives({
  side:input.side,
  mass:input.co2Mass,
  liquidVolumeMl:input.liquidVolumeMl,
  tissueSid:sid.sid,
  bloodFlowMlPerMin:input.bloodFlowMlPerMin,
  o2UseMlPerMin:input.o2UseMlPerMin,
  bloodSid:input.bloodSid,
  arterialHco3:input.arterialHco3,
  dxMin:input.dxMin,
});
const ph=phCells({pCO2:co2.pCO2,SID:sid.sid});

assert.equal(composed.myocardialSid,sid.sid);
assert.equal(composed.myocardialPco2,co2.pCO2);
assert.equal(composed.intracellularPh,ph.pH);
assert.equal(composed.controlAuthority,false);
assert.match(composed.status,/source-aligned-myocardial-acid-base/);
console.log('ok - myocardial pH composes exact HumMod SID, CO2, and PhCells primitives');

const changed=myocardialAcidBaseState({
  ...input,
  co2Mass:4.0,
});
assert.notEqual(changed.intracellularPh,composed.intracellularPh);
console.log('ok - myocardial pH responds through myocardial CO2 state, not an arterial-pH multiplier');
