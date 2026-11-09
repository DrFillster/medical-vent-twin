'use strict';

const assert = require('node:assert/strict');
const data = require('../data/hennigs_figure6_digitized_targets.json');
const { createCalibrationTarget } = require('../src/hennigs_gco2_ph_calibration.js');

assert.equal(data.authority, 'digitized-literature-markers-not-raw-data');
assert.equal(data.hypercapnia.inspiredCo2Fraction, 0.07);
assert.equal(data.hypoxia.inspiredO2Fraction, 0.08);
assert.equal(data.publishedTable7MapePercent.hypercapnia.respiratoryRate, 9.72);
assert.equal(data.publishedTable7MapePercent.hypercapnia.tidalVolume, 11.18);
assert.equal(data.publishedTable7MapePercent.hypoxia.respiratoryRate, 3.86);
assert.equal(data.publishedTable7MapePercent.hypoxia.tidalVolume, 10.23);

function rows(condition) {
  return condition.series.map(([timeMin, respiratoryRatePerMin, tidalVolumeL]) => ({
    timeSec: timeMin * 60,
    respiratoryRatePerMin,
    tidalVolumeL,
  }));
}

const target = createCalibrationTarget({
  hypercapniaSeries: rows(data.hypercapnia),
  hypoxiaSeries: rows(data.hypoxia),
  provenance: {
    hypercapnia: {
      authority: data.authority,
      source: data.source,
      condition: 'Figure 6a literature markers',
    },
    hypoxia: {
      authority: data.authority,
      source: data.source,
      condition: 'Figure 6b literature markers',
    },
  },
});

assert.equal(target.hypercapnia.length, data.hypercapnia.series.length);
assert.equal(target.hypoxia.length, data.hypoxia.series.length);
assert.equal(target.authority, 'reference-data-target');

console.log('ok - Figure 6 digitized RR/VT markers load as provenance-locked calibration targets');
