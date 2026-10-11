'use strict';

/*
 * regional_pulmonary_vq_shadow.js
 *
 * Audit-only bridge from Vent's actual regional mechanics to a future
 * source-complete regional pulmonary V/Q model.
 *
 * This module DOES NOT calculate arterial gases, redistribute perfusion,
 * apply HPV to the patient, or claim control authority.
 *
 * Vent inputs are measured from the most recent completed breath:
 *   regional tidal volume = end-inspiratory volume - end-expiratory volume.
 *
 * The current perfusionFraction values are carried through only as the
 * existing synthetic phenotype metadata so that their influence is visible.
 *
 * Marquis et al. 2021 source/reference:
 *   PLoS Comput Biol 17(5):e1008861
 *   DOI 10.1371/journal.pcbi.1008861
 *   public code: beards-lab/VQmodel
 *   inspected revision: 59416ed8f777a82df29c4b5707150cd58d9b4b32
 *
 * VQ_RHS.m terminal HPV stimulus:
 *   S = exp(-PalvO / Phpv)
 *
 * load_network_par.m:
 *   Phpv = 80 / log(2)
 *
 * IMPORTANT: the Marquis vascular network/morphometry and fitted tone
 * parameters are rat-derived. The source HPV signal is exposed only for
 * source-reproduction/shadow comparison and is not a human ARDS controller.
 */

const MARQUIS_VQ_REFERENCE = Object.freeze({
  article:
    'Marquis AD, Jezek F, Pinsky DJ, Beard DA. PLoS Comput Biol. 2021;17(5):e1008861.',
  doi: '10.1371/journal.pcbi.1008861',
  repository: 'beards-lab/VQmodel',
  revision: '59416ed8f777a82df29c4b5707150cd58d9b4b32',
  sourceFile: 'VQ_RHS.m',
  parameterFile: 'load_network_par.m',
  species: 'rat-pulmonary-vascular-network/reference-only',
  controlAuthority: false,
  physiologyAuthority: false,
});

const MARQUIS_PHPV_MMHG = 80 / Math.log(2);

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(label + ' must be finite');
  }
  return value;
}

function nonNegative(value, label) {
  finite(value, label);
  if (value < 0) throw new Error(label + ' must be non-negative');
  return value;
}

function marquisTerminalHpvStimulus({
  alveolarPo2MmHg,
  phpvMmHg = MARQUIS_PHPV_MMHG,
} = {}) {
  nonNegative(alveolarPo2MmHg, 'alveolarPo2MmHg');
  if (!(phpvMmHg > 0) || !Number.isFinite(phpvMmHg)) {
    throw new Error('phpvMmHg must be finite and > 0');
  }
  return Object.freeze({
    stimulus: Math.exp(-alveolarPo2MmHg / phpvMmHg),
    alveolarPo2MmHg,
    phpvMmHg,
    equation: 'S = exp(-PalvO / Phpv)',
    authority: 'source-reproduction-shadow-only',
    provenance: MARQUIS_VQ_REFERENCE,
  });
}

function mostRecentCompleteBreath(simulation) {
  if (!simulation || typeof simulation.metrics !== 'function') {
    throw new Error('Vent simulation with metrics() is required');
  }
  const breaths = simulation.metrics();
  for (let i = breaths.length - 1; i >= 0; i -= 1) {
    const c = breaths[i]?.compartments;
    if (!c) continue;
    const values = Object.values(c);
    if (values.length &&
        values.every(x =>
          Number.isFinite(x.endInspV) &&
          Number.isFinite(x.endExpV))) {
      return breaths[i];
    }
  }
  return null;
}

function deriveRegionalVentilationAudit({ simulation } = {}) {
  if (!simulation?.params?.compartments || !simulation?.state?.compartments) {
    throw new Error('Vent simulation state and parameters are required');
  }

  const breath = mostRecentCompleteBreath(simulation);
  if (!breath) {
    return Object.freeze({
      schema: 'regional-pulmonary-vq-shadow/v1',
      status: 'waiting-for-completed-breath',
      controlAuthority: false,
      physiologyAuthority: false,
      regions: Object.freeze([]),
      provenance: Object.freeze({
        ventilation: 'Vent mechanics: no completed breath available yet',
        perfusion:
          'existing synthetic phenotype perfusionFraction; diagnostic carry-through only',
      }),
    });
  }

  const params = simulation.params.compartments;
  const states = simulation.state.compartments;
  const rows = params.map((cp, index) => {
    const m = breath.compartments['comp_' + index] || {};
    const state = states[index];
    const tidalVolumeL = Math.max(
      0,
      finite(m.endInspV, cp.id + ' endInspV') -
      finite(m.endExpV, cp.id + ' endExpV')
    );
    return {
      id: cp.id,
      tidalVolumeL,
      perfusionFractionMetadata: nonNegative(
        cp.perfusionFraction,
        cp.id + ' perfusionFraction'
      ),
      recruitment: finite(state.recruitment, cp.id + ' recruitment'),
      endExpiratoryVolumeL: finite(m.endExpV, cp.id + ' endExpV'),
      endInspiratoryVolumeL: finite(m.endInspV, cp.id + ' endInspV'),
      endExpiratoryAlveolarPressureCmH2O:
        Number.isFinite(m.endExpP) ? m.endExpP : null,
      endInspiratoryAlveolarPressureCmH2O:
        Number.isFinite(m.endInspP) ? m.endInspP : null,
    };
  });

  const totalTidalVolumeL = rows.reduce((sum, row) => sum + row.tidalVolumeL, 0);
  const totalPerfusionMetadata = rows.reduce(
    (sum, row) => sum + row.perfusionFractionMetadata,
    0
  );

  const regions = rows.map(row => {
    const ventilationFraction = totalTidalVolumeL > 0
      ? row.tidalVolumeL / totalTidalVolumeL
      : 0;
    const perfusionFraction = totalPerfusionMetadata > 0
      ? row.perfusionFractionMetadata / totalPerfusionMetadata
      : 0;
    return Object.freeze({
      ...row,
      ventilationFraction,
      perfusionFraction,
      normalizedVqRatio:
        perfusionFraction > 0 ? ventilationFraction / perfusionFraction : null,
      perfusionAuthority: false,
      note:
        'V/Q ratio is diagnostic only because perfusion is still synthetic static metadata.',
    });
  });

  return Object.freeze({
    schema: 'regional-pulmonary-vq-shadow/v1',
    status: 'regional-ventilation-measured-perfusion-not-source-complete',
    breathIndex: breath.breathIndex,
    breathStartSec: breath.breathStartT,
    breathEndSec: breath.breathEndT,
    totalTidalVolumeL,
    rrPerMin: breath.RR,
    regions: Object.freeze(regions),
    controlAuthority: false,
    physiologyAuthority: false,
    provenance: Object.freeze({
      ventilation:
        'Vent measured end-inspiratory minus end-expiratory regional volume',
      perfusion:
        'existing synthetic phenotype perfusionFraction; diagnostic carry-through only',
      nextRequiredModel:
        'source-complete regional pulmonary vascular resistance/perfusion + HPV + regional blood-gas exchange',
    }),
  });
}

module.exports = {
  MARQUIS_VQ_REFERENCE,
  MARQUIS_PHPV_MMHG,
  marquisTerminalHpvStimulus,
  deriveRegionalVentilationAudit,
};
