'use strict';

const assert=require('node:assert/strict');
const {createClinicalSessionRecord}=require('../src/clinical_session_record.js');

const snapshot={
  sessionSchema:'berlin-clinical-twin-live-hummod-session/v1',
  case:{id:'test-case'},
  timeSec:12,
  ventilator:{mode:'VC_AC'},
  ventilatorChangePending:false,
  pulmonary:{measurements:null,compartments:null,gasExchangeAuthority:'test'},
  systemic:{
    source:null,
    gasExchange:{pao2MmHg:50},
    hemodynamics:{heartRatePerMin:90},
    physicianComparison:{
      liveHumMod:{heartRatePerMin:90},
      candidateModel:{
        heartRatePerMin:110,
        meanArterialPressureMmHg:70,
        cardiacOutputMlPerMin:5000,
        strokeVolumeMl:45,
        systemicPeripheralResistanceMmHgMinPerL:12,
        authority:'candidate-not-canonical',
        controlAuthority:false,
      },
      publishedModelInterim:{heartRatePerMin:100,controlAuthority:false},
    },
  },
  coupling:{mode:'test'},
  events:[],
  provenance:{status:'test'},
};

const record=createClinicalSessionRecord(snapshot);
assert(record.physicianComparison);
assert.equal(record.physicianComparison.liveHumMod.heartRatePerMin,90);
assert.equal(record.physicianComparison.candidateModel.heartRatePerMin,110);
assert.equal(record.physicianComparison.candidateModel.controlAuthority,false);
assert.equal(record.physicianComparison.publishedModelInterim.heartRatePerMin,100);

console.log('ok - clinical session export preserves physician comparison');
