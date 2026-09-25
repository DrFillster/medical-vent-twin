#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PINNED_REVISION =
  '8dab57e05631f779bf5020fe0dd51874d8ae98c1';

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function replaceExactly(text, oldText, newText, label) {
  const first = text.indexOf(oldText);
  if (first < 0) {
    throw new Error('expected pinned source block not found: ' + label);
  }
  if (text.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error('expected source block is not unique: ' + label);
  }
  return text.slice(0, first) + newText +
    text.slice(first + oldText.length);
}

function patchThorax(root) {
  const structurePath =
    path.join(root, 'Structure', 'Lungs', 'Thorax.DES');
  const displayPath =
    path.join(root, 'Display', 'Physiology', 'Lungs', 'Thorax', 'Thorax.DES');

  if (!fs.existsSync(structurePath)) {
    throw new Error('missing pinned Thorax structure: ' + structurePath);
  }
  if (!fs.existsSync(displayPath)) {
    throw new Error('missing pinned Thorax display: ' + displayPath);
  }

  const originalStructure = fs.readFileSync(structurePath, 'utf8');
  const originalDisplay = fs.readFileSync(displayPath, 'utf8');

  // GitHub Windows runners may materialize CRLF working-tree files.
  // Normalize only the working copies used for deterministic source matching.
  let structure = originalStructure.replace(/\r\n/g, '\n');

  structure = replaceExactly(
    structure,
    '<var><name> AvePressure </name></var>',
    [
      '<var><name> AvePressure </name></var>',
      '',
      '<parm>',
      '  <name> CoupledPressureSwitch </name>',
      '  <val> FALSE </val>',
      '</parm>',
      '',
      '<parm>',
      '  <name> CoupledPressure </name>',
      '  <val> -4.0 </val>',
      '</parm>',
    ].join('\n'),
    'Thorax bridge parameters'
  );

  const stockAvePressure = [
    '<def>',
    '  <name> AvePressure </name>',
    '  <val>',
    '      0.5',
    '    * ( RightHemithorax.Pressure',
    '    + LeftHemithorax.Pressure )',
    '  </val>',
    '</def>',
  ].join('\n');

  const bridgedAvePressure = [
    '<conditional>',
    '  <name> AvePressure </name>',
    '  <test> CoupledPressureSwitch </test>',
    '  <true> CoupledPressure </true>',
    '  <false>',
    '      0.5',
    '    * ( RightHemithorax.Pressure',
    '    + LeftHemithorax.Pressure )',
    '  </false>',
    '</conditional>',
  ].join('\n');

  structure = replaceExactly(
    structure,
    stockAvePressure,
    bridgedAvePressure,
    'Thorax.AvePressure definition'
  );

  let display = originalDisplay.replace(/\r\n/g, '\n');

  const panelEnd = '</panel>';
  const bridgeControls = [
    '',
    '<!-- hummod-vent-core decoupled systemic thoracic-pressure bridge -->',
    '<groupbox>',
    '  <row> 10.0 </row>',
    '  <col> 32.0 </col>',
    '  <high> 6.4 </high>',
    '  <wide> 30.0 </wide>',
    '  <title> Vent Systemic Pressure Bridge </title>',
    '',
    '<structurename> Thorax </structurename>',
    '',
    '<radiobuttons>',
    '  <row> 1.4 </row><col> 1.0 </col>',
    '  <name> CoupledPressureSwitch </name>',
    '  <listname> Common.Switch </listname>',
    '  <label> Bridge </label>',
    '</radiobuttons>',
    '',
    '<repeatlist>',
    '  <name> CoupledPressureList </name>',
    '  <firstval> -10 </firstval>',
    '  <repeat><reps> 30 </reps><stepsize> 1.0 </stepsize></repeat>',
    '</repeatlist>',
    '',
    '<slidebar>',
    '  <row> 2.8 </row><col> 1.0 </col><wide> 8 </wide>',
    '  <name> CoupledPressure </name>',
    '  <listname> CoupledPressureList </listname>',
    '  <label> Systemic Pleural Pressure </label>',
    '</slidebar>',
    '',
    '<showvalue>',
    '  <row> 4.2 </row><col> 1.0 </col>',
    '  <name> AvePressure </name>',
    '  <format><decimal> 1 </decimal></format>',
    '  <label> Applied Pressure </label>',
    '</showvalue>',
    '',
    '</groupbox>',
    '',
  ].join('\n');

  display = replaceExactly(
    display,
    panelEnd,
    bridgeControls + panelEnd,
    'Thorax panel end'
  );

  fs.writeFileSync(structurePath, structure, 'utf8');
  fs.writeFileSync(displayPath, display, 'utf8');

  return {
    schema: 'hummod-vent-core/thorax-bridge-patch/v1',
    upstreamRevision: PINNED_REVISION,
    files: {
      'Structure/Lungs/Thorax.DES': {
        originalSha256: sha256(originalStructure),
        patchedSha256: sha256(structure),
      },
      'Display/Physiology/Lungs/Thorax/Thorax.DES': {
        originalSha256: sha256(originalDisplay),
        patchedSha256: sha256(display),
      },
    },
    bridge: {
      switchSymbol: 'Thorax.CoupledPressureSwitch',
      pressureSymbol: 'Thorax.CoupledPressure',
      units: 'mmHg',
      purpose:
        'systemic thoracic external-pressure coupling without overriding hemithorax LungInflation',
    },
  };
}

function main() {
  const root = process.argv[2];
  const expectedRevision = process.argv[3] || PINNED_REVISION;

  if (!root) {
    throw new Error(
      'usage: node scripts/patch-hummod-thorax-bridge.js <HumModRoot> [revision]'
    );
  }
  if (expectedRevision !== PINNED_REVISION) {
    throw new Error(
      'thorax bridge patch supports only pinned revision ' +
      PINNED_REVISION
    );
  }

  const result = patchThorax(path.resolve(root));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      (error instanceof Error ? error.stack : String(error)) + '\n'
    );
    process.exit(1);
  }
}

module.exports = {
  PINNED_REVISION,
  patchThorax,
};
