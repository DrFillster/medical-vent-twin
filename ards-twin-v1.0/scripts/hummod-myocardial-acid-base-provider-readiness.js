#!/usr/bin/env node
'use strict';

const {
  REQUIRED_FIELDS,
  CURRENT_AVAILABILITY,
  UPSTREAM_DEPENDENCIES,
}=require('../src/hummod_myocardial_acid_base_input_contract.js');

const status={
  schema:'hummod-myocardial-acid-base-provider-readiness/v1',
  authority:'diagnostic-only',
  physiologyChanged:false,
  requiredFields:REQUIRED_FIELDS,
  providers:REQUIRED_FIELDS.map(field=>{
    const availability=CURRENT_AVAILABILITY[field];
    const liveCoupled=/available from hummod-ards-core-gas-runtime/.test(availability);
    return {
      field,
      liveCoupled,
      availability,
      sourceDependency:UPSTREAM_DEPENDENCIES[field],
    };
  }),
};
status.summary={
  requiredCount:status.providers.length,
  liveCoupledCount:status.providers.filter(x=>x.liveCoupled).length,
  blockedCount:status.providers.filter(x=>!x.liveCoupled).length,
  liveCoupledFields:status.providers.filter(x=>x.liveCoupled).map(x=>x.field),
  blockedFields:status.providers.filter(x=>!x.liveCoupled).map(x=>x.field),
  readyForLiveMyocardialPHi:
    status.providers.every(x=>x.liveCoupled),
  nominalBackfillAllowed:false,
  arterialPco2SubstitutionAllowed:false,
};

console.log(JSON.stringify(status,null,2));
