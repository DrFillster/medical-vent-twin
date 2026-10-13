'use strict';

/**
 * v1.6 Vent -> Karamolegkos/Albanese pulmonary pressure-coordinate adapter.
 *
 * Source-family equations:
 *   A34: dPpl/dt = Q_thorax/Ccw + dPmus/dt
 *   A40: VA = CA * (PA - Ppl) + VAu
 *
 * For a passive patient (dPmus/dt = 0), registered at a synchronized
 * reference state, integrate A34 over Vent's distal gas-volume change:
 *
 *   Ppl(t) = Ppl_ref + deltaVvent/Ccw
 *
 * The reference-anchored absolute VA adapter supplies:
 *
 *   VA(t) = VA_ref + deltaVvent
 *
 * Then A40 gives:
 *
 *   PA(t) = Ppl(t) + [VA(t) - VAu]/CA
 *
 * This is a reduced coordinate observer. It does not replace Vent mechanics.
 * It is not valid for spontaneous effort and is not clinical validation.
 */

const {
  cmH2OToMmHg,
}=require('./clinical_units.js');

const SOURCE=Object.freeze({
  respiratoryFamily:
    'Albanese/Cheng/Chbat integrated cardiopulmonary model; Appendix A34/A40',
  chestWallComplianceLPerCmH2O:0.2445,
  alveolarComplianceLPerCmH2O:0.2,
  alveolarUnstressedVolumeL:0.001263,
  authority:'candidate-coordinate-adapter',
  clinicalValidation:false,
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

function createVentKaramolegkosPressureCoordinateAdapter({
  alveolarVolumeAdapter,
  referencePleuralPressureCmH2O,
  passivePatient,
  referenceProvenance,
}={}){
  if(!alveolarVolumeAdapter||
     typeof alveolarVolumeAdapter.snapshot!=='function'){
    throw new Error('alveolarVolumeAdapter.snapshot is required');
  }
  finite(referencePleuralPressureCmH2O,'referencePleuralPressureCmH2O');
  if(passivePatient!==true){
    throw new Error(
      'passivePatient=true is required; spontaneous effort needs an explicit Pmus state'
    );
  }
  if(!referenceProvenance||typeof referenceProvenance!=='object'||
     referenceProvenance.sourceQualified!==true){
    throw new Error(
      'referenceProvenance.sourceQualified=true is required'
    );
  }

  function snapshot(){
    const volume=alveolarVolumeAdapter.snapshot();
    if(volume.sourceQualified!==true){
      throw new Error('alveolar volume coordinate must be source-qualified');
    }

    const deltaV=volume.deltaVentElasticVolumeL;
    finite(deltaV,'deltaVentElasticVolumeL');

    const pleuralPressureCmH2O=
      referencePleuralPressureCmH2O+
      deltaV/SOURCE.chestWallComplianceLPerCmH2O;

    const transpulmonaryPressureCmH2O=
      (volume.absoluteAlveolarVolumeL-
       SOURCE.alveolarUnstressedVolumeL)/
      SOURCE.alveolarComplianceLPerCmH2O;

    const alveolarPressureCmH2O=
      pleuralPressureCmH2O+transpulmonaryPressureCmH2O;

    const pleuralPressureMmHg=cmH2OToMmHg(pleuralPressureCmH2O);
    const alveolarPressureMmHg=cmH2OToMmHg(alveolarPressureCmH2O);

    positive(volume.absoluteAlveolarVolumeL,'absoluteAlveolarVolumeL');
    finite(pleuralPressureMmHg,'pleuralPressureMmHg');
    finite(alveolarPressureMmHg,'alveolarPressureMmHg');

    return Object.freeze({
      schema:'v16-vent-karamolegkos-pressure-coordinate/v1',
      authority:SOURCE.authority,
      sourceQualified:true,
      clinicalValidation:false,
      passivePatient:true,
      alveolarVolumeL:volume.absoluteAlveolarVolumeL,
      alveolarPressureCmH2O,
      pleuralPressureCmH2O,
      transpulmonaryPressureCmH2O,
      alveolarPressureMmHg,
      pleuralPressureMmHg,
      deltaVentElasticVolumeL:deltaV,
      referencePleuralPressureCmH2O,
      volumeCoordinate:volume,
      referenceProvenance:Object.freeze({...referenceProvenance}),
      limitations:Object.freeze({
        spontaneousEffort:
          'not supported; A34 requires explicit dPmus/dt when effort is present',
        conductingAirwayCompliance:
          'Vent distal volume change is used as the reduced thoracic gas-volume change',
        clinicalValidation:false,
      }),
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
  createVentKaramolegkosPressureCoordinateAdapter,
});
