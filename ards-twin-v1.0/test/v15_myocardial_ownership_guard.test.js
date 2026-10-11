'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const myocardial=fs.readFileSync(
  path.join(__dirname,'..','src','myocardial_lv_pressure_shadow.js'),'utf8'
);
const legacy=fs.readFileSync(
  path.join(__dirname,'..','src','hummod_ards_decompensation_controller.js'),'utf8'
);

assert.match(
  myocardial,
  /blocked-pending-Shimayoshi-source-stress-trajectory/,
  'myocardial path must fail closed without source stress'
);

assert.doesNotMatch(
  myocardial,
  /oxygenDebtMl|equivalentDebtMinutes|myocardialContractilityMultiplier/,
  'source myocardial path must not import legacy oxygen-debt contractility'
);

assert.match(
  legacy,
  /legacy|engineering bridge|NOT a mortality prediction model|not a mortality prediction model/i,
  'legacy decompensation controller must remain explicitly non-authoritative'
);

console.log('ok - selected myocardial path is isolated from legacy oxygen-debt contractility');
