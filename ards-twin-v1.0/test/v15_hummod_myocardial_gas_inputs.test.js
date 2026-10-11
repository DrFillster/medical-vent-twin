'use strict';
const assert=require('node:assert/strict');
const {
  myocardialBloodChemistryInputsFromGasSnapshot,
}=require('../src/hummod_myocardial_gas_inputs.js');

const x=myocardialBloodChemistryInputsFromGasSnapshot({
  boundary:{blood:{sidMolPerL:0.042}},
  state:{arterialHco3MolPerL:0.024},
  gases:{arterial:{pco2MmHg:80}},
});
assert.equal(x.bloodSid,0.042);
assert.equal(x.arterialHco3,0.024);
assert.equal(x.source.arterialPco2Used,false);

assert.throws(
  ()=>myocardialBloodChemistryInputsFromGasSnapshot({
    boundary:{blood:{sidMolPerL:0.042}},
    state:{},
  }),
  /arterialHco3MolPerL/
);
console.log('ok - myocardial chemistry reuses source-aligned SID/HCO3 without arterial PCO2 substitution');
