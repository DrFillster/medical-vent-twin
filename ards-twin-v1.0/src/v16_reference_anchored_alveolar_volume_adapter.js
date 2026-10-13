'use strict';

/**
 * v1.6 reference-anchored Vent -> absolute alveolar volume coordinate.
 *
 * This implements Option A from VENT_TO_PULMONARY_VASCULAR_COORDINATE_AUDIT.md.
 *
 * At a synchronized reference state:
 *   VA_ref  = source-qualified absolute alveolar volume (L)
 *   Vvent_ref = Vent elastic distal volume at the same instant (L)
 *
 * Thereafter:
 *   VA(t) = VA_ref + [Vvent(t) - Vvent_ref]
 *
 * This is a coordinate translation of a measured/model-owned volume CHANGE.
 * It does NOT assert that Vent zero equals FRC and does NOT use
 * FRC + Vent.totalVolume.
 *
 * The reference absolute volume must be supplied by an authoritative
 * source/measurement/case state. This module does not invent it.
 */

const SOURCE=Object.freeze({
  audit:'docs/VENT_TO_PULMONARY_VASCULAR_COORDINATE_AUDIT.md Option A',
  ventCoordinate:
    'Vent totalVolume = sum of distal elastic compartment gas volumes',
  authority:'candidate-coordinate-adapter',
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
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function createReferenceAnchoredAlveolarVolumeAdapter({
  simulation,
  referenceAbsoluteAlveolarVolumeL,
  referenceVentElasticVolumeL=null,
  referenceProvenance,
}={}){
  if(!simulation?.state){
    throw new Error('simulation.state is required');
  }
  positive(referenceAbsoluteAlveolarVolumeL,'referenceAbsoluteAlveolarVolumeL');

  if(!referenceProvenance||typeof referenceProvenance!=='object'||
     referenceProvenance.sourceQualified!==true){
    throw new Error(
      'referenceProvenance.sourceQualified=true is required'
    );
  }

  const ventReference=
    referenceVentElasticVolumeL==null
      ?simulation.state.totalVolume
      :referenceVentElasticVolumeL;
  nonNegative(ventReference,'referenceVentElasticVolumeL');

  function snapshot(){
    const currentVentElasticVolumeL=nonNegative(
      simulation.state.totalVolume,
      'simulation.state.totalVolume'
    );
    const deltaVentElasticVolumeL=
      currentVentElasticVolumeL-ventReference;
    const absoluteAlveolarVolumeL=
      referenceAbsoluteAlveolarVolumeL+deltaVentElasticVolumeL;
    positive(absoluteAlveolarVolumeL,'derived absoluteAlveolarVolumeL');

    return Object.freeze({
      schema:'v16-reference-anchored-alveolar-volume/v1',
      authority:SOURCE.authority,
      sourceQualified:true,
      absoluteAlveolarVolumeL,
      referenceAbsoluteAlveolarVolumeL,
      referenceVentElasticVolumeL:ventReference,
      currentVentElasticVolumeL,
      deltaVentElasticVolumeL,
      mapping:
        'VA(t) = VA_ref + [Vent.totalVolume(t) - Vent.totalVolume_ref]',
      prohibitedShortcutUsed:false,
      referenceProvenance:Object.freeze({...referenceProvenance}),
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    snapshot,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  createReferenceAnchoredAlveolarVolumeAdapter,
});
