'use strict';

/**
 * Yamanaka et al. 2019 standard-patient sepsis parameters used by v2.2.
 *
 * Primary source:
 * Yamanaka Y et al. Mathematical modeling of septic shock based on clinical
 * data. Theor Biol Med Model. 2019;16:5.
 * doi:10.1186/s12976-019-0101-9
 *
 * Table 7:
 *   La,min 0.01 mL/mmHg/s
 *   La,max 0.06 mL/mmHg/s
 *   EC50,La 0.22
 *   slopeLa 1.0
 *   kEX 50
 *   EC50,EX 0.5
 *   slopeEX 3.0
 *   kS 1.0
 *
 * Table 6:
 *   S0 73.8 mL
 *   cInfinity 0.28 CA-units
 *
 * These are source-model standard-patient parameters, not patient-specific
 * calibration and not universal clinical thresholds.
 */

const SOURCE=Object.freeze({
  citation:'Yamanaka Y et al. Theor Biol Med Model. 2019;16:5.',
  doi:'10.1186/s12976-019-0101-9',
  tables:Object.freeze([6,7]),
  authority:'source-table-standard-patient',
  clinicalValidation:false,
});

const PARAMS=Object.freeze({
  permeability:Object.freeze({
    laMin:0.01,
    laMax:0.06,
    ec50La:0.22,
    slopeLa:1.0,
    units:'mL/mmHg/s',
  }),
  vasodilation:Object.freeze({
    kEx:50,
    ec50Ex:0.5,
    slopeEx:3.0,
  }),
  myocardial:Object.freeze({
    normalStrokeVolumeMl:73.8,
    kS:1.0,
    cInfinity:0.28,
  }),
});

module.exports=Object.freeze({SOURCE,PARAMS});
