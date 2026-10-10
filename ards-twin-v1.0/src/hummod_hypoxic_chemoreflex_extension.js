'use strict';

// External physiology extension for the missing HumMod SympsChemo transfer.
//
// This is intentionally NOT presented as native HumMod. The pinned standalone
// source fixes SympsChemo.Effect=1.0 even though the CNS integration architecture
// multiplies that factor into SympsCNS.ReflexNA.
//
// Evidence anchors:
// - human carotid chemoreceptor afferent activity rises once PaO2 falls below
//   approximately 70 mmHg;
// - arterial chemoreceptor activation is near maximal around PaO2 35-40 mmHg;
// - HumMod's own CNS integration display presents SympsChemo.Effect on a 0-2 scale.
//
// The extension therefore maps acute hypoxemia monotonically into 1.0-2.0 and
// lets the native downstream HumMod cascade determine ganglia, vagus, beta
// receptor activity, SA-node rate, contractility, and vascular effects.

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

const DEFAULTS=Object.freeze({
  onsetPaO2MmHg:70,
  fullPaO2MmHg:40,
  neutralEffect:1,
  maximumEffect:2,
});

function hypoxicSympsChemoEffect({
  arterialPo2MmHg,
  onsetPaO2MmHg=DEFAULTS.onsetPaO2MmHg,
  fullPaO2MmHg=DEFAULTS.fullPaO2MmHg,
  neutralEffect=DEFAULTS.neutralEffect,
  maximumEffect=DEFAULTS.maximumEffect,
}={}){
  finite(arterialPo2MmHg,'arterialPo2MmHg');
  finite(onsetPaO2MmHg,'onsetPaO2MmHg');
  finite(fullPaO2MmHg,'fullPaO2MmHg');
  finite(neutralEffect,'neutralEffect');
  finite(maximumEffect,'maximumEffect');
  if(!(onsetPaO2MmHg>fullPaO2MmHg)) throw new Error('onsetPaO2MmHg must exceed fullPaO2MmHg');
  if(!(maximumEffect>=neutralEffect)) throw new Error('maximumEffect must be >= neutralEffect');

  const drive=clamp(
    (onsetPaO2MmHg-arterialPo2MmHg)/(onsetPaO2MmHg-fullPaO2MmHg),
    0,1);
  const effect=neutralEffect+drive*(maximumEffect-neutralEffect);

  return Object.freeze({
    arterialPo2MmHg,
    drive,
    effect,
    onsetPaO2MmHg,
    fullPaO2MmHg,
    neutralEffect,
    maximumEffect,
    provenance:Object.freeze({
      status:'external-physiology-extension',
      target:'HumMod SympsChemo.Effect insertion point',
      directHeartRateGain:false,
      nativeHumModEquation:false,
      clinicalValidation:false,
      rationale:'bounded acute hypoxemia chemoreflex bridge; downstream HumMod autonomic equations remain authoritative',
    }),
  });
}

module.exports={DEFAULTS,hypoxicSympsChemoEffect};
