'use strict';

/**
 * v1.6 Vent -> regional alveolar ventilation adapter.
 *
 * Vent owns regional mechanics. This adapter reads measured compartment
 * end-inspiratory/end-expiratory volumes from the latest completed breath and
 * converts each regional tidal volume from BTPS mL/breath to STPD mL/min using
 * the existing HumMod source conversion.
 *
 * No anatomic dead-space allocation is subtracted here: Vent compartment
 * volumes represent the distal mechanical/alveolar compartments, not the
 * upstream conducting dead-space volume.
 *
 * Candidate composition only.
 */

const {
  deriveRegionalVentilationAudit,
}=require('./regional_pulmonary_vq_shadow.js');
const {
  btpsToStpdVolumeMl,
}=require('./hummod_ards_core_breathing.js');

const SOURCE=Object.freeze({
  mechanics:'Vent measured completed-breath compartment volumes',
  conversion:'HumMod BTPS_To_STPD.DES',
  authority:'candidate-composition-boundary',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

function ventRegionalAlveolarVentilationStpd({
  simulation,
  barometricPressureMmHg,
  bodyTempC,
}={}){
  positive(barometricPressureMmHg,'barometricPressureMmHg');
  finite(bodyTempC,'bodyTempC');

  const regional=deriveRegionalVentilationAudit({simulation});
  if(regional.status==='waiting-for-completed-breath'){
    return Object.freeze({
      schema:'v16-vent-regional-alveolar-ventilation/v1',
      status:'waiting-for-completed-breath',
      authority:SOURCE.authority,
      regions:Object.freeze([]),
      provenance:SOURCE,
    });
  }

  positive(regional.rrPerMin,'regional rrPerMin');

  const regions=regional.regions.map(row=>{
    const tidalVolumeBtpsMl=row.tidalVolumeL*1000;
    const converted=btpsToStpdVolumeMl({
      volumeBtpsMl:tidalVolumeBtpsMl,
      inspiredPressureMmHg:barometricPressureMmHg,
      bodyTempC,
    });
    return Object.freeze({
      id:row.id,
      tidalVolumeBtpsMl,
      tidalVolumeStpdMl:converted.volumeStpdMl,
      alveolarVentilationStpdMlPerMin:
        regional.rrPerMin*converted.volumeStpdMl,
      recruitment:row.recruitment,
      endExpiratoryVolumeL:row.endExpiratoryVolumeL,
      endInspiratoryVolumeL:row.endInspiratoryVolumeL,
      endExpiratoryAlveolarPressureCmH2O:
        row.endExpiratoryAlveolarPressureCmH2O,
      endInspiratoryAlveolarPressureCmH2O:
        row.endInspiratoryAlveolarPressureCmH2O,
      perfusionMetadataUsed:false,
    });
  });

  return Object.freeze({
    schema:'v16-vent-regional-alveolar-ventilation/v1',
    status:'ready',
    authority:SOURCE.authority,
    breathIndex:regional.breathIndex,
    breathStartSec:regional.breathStartSec,
    breathEndSec:regional.breathEndSec,
    rrPerMin:regional.rrPerMin,
    regions:Object.freeze(regions),
    totalAlveolarVentilationStpdMlPerMin:
      regions.reduce((s,r)=>s+r.alveolarVentilationStpdMlPerMin,0),
    prohibited:Object.freeze({
      staticPerfusionMetadata:
        'Vent perfusionFraction metadata is intentionally ignored',
    }),
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  ventRegionalAlveolarVentilationStpd,
});
