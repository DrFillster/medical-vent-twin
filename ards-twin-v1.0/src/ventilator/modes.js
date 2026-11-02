'use strict';
const { VcAcController } = require('./vc_ac.js');
const { PcAcController } = require('./pc_ac.js');
const { AdaptiveVolumeController } = require('./adaptive_volume.js');
// Exact chart-label mapping. Bare CMV lacks vendor/control-variable context.
const ALIASES = Object.freeze({
  VC_AC: 'VC_AC', 'CMV/ASSIST': 'VC_AC', 'VOL/AC': 'VC_AC',
  PC_AC: 'PC_AC', VC_AC_AUTOFLOW: 'VC_AC_AUTOFLOW',
  'CMV/ASSIST/AutoFlow': 'VC_AC_AUTOFLOW',
  APV_CMV: 'APV_CMV', 'APV (cmv)': 'APV_CMV', APVcmv: 'APV_CMV',
});
function normalizeMode(mode) {
  if (!Object.prototype.hasOwnProperty.call(ALIASES, mode)) throw new Error(`unsupported or ambiguous ventilator mode: ${mode}`);
  return ALIASES[mode];
}
function controllerMode(controller) {
  if (controller instanceof AdaptiveVolumeController) return controller.mode;
  if (controller instanceof VcAcController) return 'VC_AC';
  if (controller instanceof PcAcController) return 'PC_AC';
  return 'UNKNOWN';
}
module.exports = { normalizeMode, controllerMode };
