#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const { parseHumModNativeSolution }=require('../src/hummod_native_solution.js');
const { convertHumModRawSeries }=require('../src/hummod_raw_series_adapter.js');

const input=process.argv[2];
const outputDir=process.argv[3] || path.dirname(input || '.');
const scenarioPath=process.argv[4] || null;
if(!input) throw new Error('usage: node scripts/convert-hummod-native-solution.js <Vent.SOLN> [output-dir] [scenario.json]');
const scenario=scenarioPath ? JSON.parse(fs.readFileSync(scenarioPath,'utf8')) : null;
const text=fs.readFileSync(input,'utf8');
const raw=parseHumModNativeSolution(text,{
  trajectoryId:'hummod-default-native-5min-001',
  exporterVersion:'native-soln-parser/1',
  scenario: scenario ? {
    id: scenario.id,
    scenarioClass: scenario.scenarioClass,
    clinicalValidation: Boolean(scenario.provenance && scenario.provenance.clinicalValidation),
    assignments: scenario.assignments || null,
  } : null,
});
const canonical=convertHumModRawSeries(raw);
fs.mkdirSync(outputDir,{recursive:true});
fs.writeFileSync(path.join(outputDir,'Vent.raw-series.json'),JSON.stringify(raw,null,2)+'\n');
fs.writeFileSync(path.join(outputDir,'Vent.trajectory.json'),JSON.stringify(canonical,null,2)+'\n');
console.log(JSON.stringify({
  source:path.resolve(input),
  rawSchema:raw.schema,
  canonicalSchema:canonical.schema,
  sampleCount:raw.rows.length,
  startMinute:raw.rows[0]['System.X'],
  endMinute:raw.rows[raw.rows.length-1]['System.X'],
  symbols:raw.symbols,
  scenarioApplied:Boolean(scenario),
  scenario:raw.nativeSolution.scenario,
},null,2));
