'use strict';

// Strict parser for native HumMod .SOLN files produced by the pinned
// riliescu/hummod-standalone runtime. This parser intentionally extracts only
// the verified direct-export symbols already approved by the Vent mapping layer.

const {
  HUMMOD_STANDALONE_UPSTREAM,
  listVerifiedDirectMappings,
} = require('./hummod_standalone_manifest.js');
const { HUMMOD_SOURCE_CLOCK } = require('./hummod_runner_contract.js');
const {
  HUMMOD_RAW_SERIES_SCHEMA,
  validateHumModRawSeries,
} = require('./hummod_raw_series_adapter.js');

const HUMMOD_NATIVE_SOLN_EXPORTER_VERSION = 'native-soln-parser/1';

function decodeXmlEntity(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseFinite(text, label) {
  const value = Number(text.trim());
  if (!Number.isFinite(value)) throw new Error(label + ' must be finite');
  return value;
}

function parseHumModNativeSolution(text, {
  trajectoryId = 'hummod-native-solution',
  exporterVersion = HUMMOD_NATIVE_SOLN_EXPORTER_VERSION,
} = {}) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('HumMod native solution text is required');
  }
  if (!/<solution>[\s\S]*<\/solution>/.test(text)) {
    throw new Error('invalid HumMod native solution envelope');
  }

  const indexMatch = text.match(/<index>\s*(\d+)\s*<\/index>/);
  if (!indexMatch) throw new Error('native solution index is required');
  const maxIndex = Number(indexMatch[1]);
  const expectedSamples = maxIndex + 1;

  const variables = new Map();
  const varRe = /<var>\s*<name>\s*([\s\S]*?)\s*<\/name>([\s\S]*?)<\/var>/g;
  let match;
  while ((match = varRe.exec(text)) !== null) {
    const name = decodeXmlEntity(match[1].trim());
    if (!name) throw new Error('native solution contains an empty variable name');
    if (variables.has(name)) throw new Error('duplicate native HumMod variable: ' + name);
    const values = [];
    const valRe = /<val>\s*([\s\S]*?)\s*<\/val>/g;
    let valueMatch;
    while ((valueMatch = valRe.exec(match[2])) !== null) {
      values.push(parseFinite(valueMatch[1], name + ' value ' + values.length));
    }
    variables.set(name, values);
  }
  if (variables.size === 0) throw new Error('native solution contains no variables');

  const clock = variables.get(HUMMOD_SOURCE_CLOCK.symbol);
  if (!clock) throw new Error('native solution missing verified clock ' + HUMMOD_SOURCE_CLOCK.symbol);
  if (clock.length !== expectedSamples) {
    throw new Error(
      'native HumMod clock has ' + clock.length + ' values; expected ' + expectedSamples);
  }

  const symbols = listVerifiedDirectMappings().map(m => m.symbol);
  symbols.forEach(symbol => {
    if (!variables.has(symbol)) {
      throw new Error('native solution missing verified HumMod symbol: ' + symbol);
    }
    const values = variables.get(symbol);
    if (values.length !== expectedSamples) {
      throw new Error(
        'verified native HumMod symbol ' + symbol + ' has ' + values.length +
        ' values; expected ' + expectedSamples);
    }
  });

  const rows = clock.map((sourceClockValue, index) => {
    const row = { [HUMMOD_SOURCE_CLOCK.symbol]: sourceClockValue };
    symbols.forEach(symbol => { row[symbol] = variables.get(symbol)[index]; });
    return row;
  });

  const raw = {
    schema: HUMMOD_RAW_SERIES_SCHEMA,
    trajectoryId,
    source: {
      repository: HUMMOD_STANDALONE_UPSTREAM.repository,
      revision: HUMMOD_STANDALONE_UPSTREAM.revision,
      exporterVersion,
    },
    clock: {
      symbol: HUMMOD_SOURCE_CLOCK.symbol,
      unit: HUMMOD_SOURCE_CLOCK.unit,
    },
    symbols,
    rows,
    nativeSolution: {
      format: 'HumMod.SOLN',
      index: maxIndex,
      sampleCount: expectedSamples,
      variableCount: variables.size,
      scenarioApplied: false,
    },
  };

  validateHumModRawSeries(raw);
  return raw;
}

module.exports = {
  HUMMOD_NATIVE_SOLN_EXPORTER_VERSION,
  parseHumModNativeSolution,
};
