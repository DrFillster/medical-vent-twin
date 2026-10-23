'use strict';

/**
 * v2.1 reduced pulmonary vascular / RV-load controller.
 *
 * Purpose:
 * Project source-backed pulmonary vascular effects into the compact v1.0
 * circulation without importing the later full cardiopulmonary architecture.
 *
 * Components:
 * 1. Karamolegkos/Albanese/Chbat 2021 lung-volume dependent pulmonary
 *    arteriolar resistance (Eq. 3).
 * 2. Marshall et al. 1994 hypoxic pulmonary vasoconstriction response,
 *    retained with its canine-species limitation.
 * 3. Stengl et al. 2013 hypercapnic-acidosis PVR challenge anchor,
 *    retained as a bounded experimental anchor.
 *
 * Reduction:
 * Each source mechanism is converted to a dimensionless resistance ratio
 * relative to the controller's own normoxic/reference operating point.
 * Ratios are multiplied to compose independent modeled loads. That
 * multiplication is an explicit reduced-order composition assumption; it is
 * not claimed as a published combined equation.
 *
 * The resulting resistance ratio is projected into the v1.0 circulation as:
 *   pulmonary conductance multiplier = 1 / total PVR ratio
 *
 * No absolute PAP/PVR target and no fitted gain is introduced.
 */

const K=require('./karamolegkos_pulmonary_circulation_candidate.js');
const {
  createV21PulmonaryCoordinateRuntime,
}=require('./v21_albanese_karamolegkos_pulmonary_coordinate_runtime.js');
const {
  dasHpvResistanceCoefficientFromMarshall,
}=require('./v21_marshall_hpv_candidate.js');

const SOURCE=Object.freeze({
  mechanical:
    'Karamolegkos N et al. IEEE OJEMB. 2021;2:324-341. doi:10.1109/OJEMB.2021.3128629',
  coordinate:
    'Albanese A et al. Am J Physiol Heart Circ Physiol. 2016;310:H899-H921. doi:10.1152/ajpheart.00230.2014',
  hpv:
    'Marshall BE et al. Respir Physiol. 1994;96:231-247. doi:10.1016/0034-5687(94)90129-5',
  hypercapnicAcidosis:
    'Stengl M et al. Crit Care. 2013;17:R303',
  composition:
    'dimensionless resistance ratios multiplied as an explicit reduced-order assumption',
  clinicalValidation:false,
  authority:'v2.1-source-backed-reduced-pulmonary-vascular-controller',
});

const HCA=Object.freeze({
  definitionPh:7.35,
  challengePh:7.10,
  definitionPaco2MmHg:45,
  pvrBaseline:259,
  pvrChallenge:356,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}

function hcaPvrRatio({arterialPh,arterialPco2MmHg}={}){
  finite(arterialPh,'arterialPh');
  positive(arterialPco2MmHg,'arterialPco2MmHg');
  if(arterialPco2MmHg<=HCA.definitionPaco2MmHg||arterialPh>=HCA.definitionPh){
    return 1;
  }
  const severity=clamp(
    (HCA.definitionPh-arterialPh)/(HCA.definitionPh-HCA.challengePh),
    0,1
  );
  return 1+severity*(HCA.pvrChallenge/HCA.pvrBaseline-1);
}

function createV21PulmonaryVascularController({
  dtSec=0.0005,
  shuntFraction=0.017,
}={}){
  positive(dtSec,'dtSec');
  finite(shuntFraction,'shuntFraction');
  if(shuntFraction<0||shuntFraction>=1) throw new Error('shuntFraction must be in [0,1)');

  let airwayOpeningPressureCmH2O=0;
  const coordinate=createV21PulmonaryCoordinateRuntime({
    dtSec,
    airwayOpeningPressureProvider:()=>airwayOpeningPressureCmH2O,
  });

  let reference=null;
  let last=null;

  function step({
    dtSec:stepDtSec,
    meanAirwayPressureCmH2O,
    arterialPo2MmHg,
    mixedVenousPo2MmHg,
    arterialPco2MmHg,
    arterialPh,
  }={}){
    positive(stepDtSec,'dtSec');
    finite(meanAirwayPressureCmH2O,'meanAirwayPressureCmH2O');
    positive(arterialPo2MmHg,'arterialPo2MmHg');
    positive(mixedVenousPo2MmHg,'mixedVenousPo2MmHg');
    positive(arterialPco2MmHg,'arterialPco2MmHg');
    finite(arterialPh,'arterialPh');

    airwayOpeningPressureCmH2O=meanAirwayPressureCmH2O;
    const coord=coordinate.runFor(stepDtSec);

    const mechanicalResistance=K.pulmonaryArteriolarResistance({
      alveolarVolumeL:coord.alveolarVolumeL,
      shuntFraction,
    });

    const hpv=dasHpvResistanceCoefficientFromMarshall({
      alveolarPo2MmHg:arterialPo2MmHg,
      mixedVenousPo2MmHg,
    });

    if(reference==null){
      reference=Object.freeze({
        mechanicalResistance,
        hpvCoefficient:hpv.hpvCoefficient,
      });
    }

    const mechanicalRatio=
      mechanicalResistance/reference.mechanicalResistance;
    const hpvRatio=
      hpv.hpvCoefficient/reference.hpvCoefficient;
    const acidemiaRatio=hcaPvrRatio({
      arterialPh,
      arterialPco2MmHg,
    });

    const totalResistanceRatio=
      mechanicalRatio*hpvRatio*acidemiaRatio;
    const pulmonaryArterialConductanceMultiplier=
      1/positive(totalResistanceRatio,'totalResistanceRatio');

    last=Object.freeze({
      pulmonaryArterialConductanceMultiplier,
      totalResistanceRatio,
      mechanicalResistanceRatio:mechanicalRatio,
      hpvResistanceRatio:hpvRatio,
      hypercapnicAcidosisResistanceRatio:acidemiaRatio,
      coordinate,
      hpv,
      inputs:Object.freeze({
        meanAirwayPressureCmH2O,
        arterialPo2MmHg,
        mixedVenousPo2MmHg,
        arterialPco2MmHg,
        arterialPh,
      }),
      reference,
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot(){
    return last||Object.freeze({
      pulmonaryArterialConductanceMultiplier:1,
      totalResistanceRatio:1,
      status:'initialized-not-stepped',
      provenance:SOURCE,
    });
  }

  return Object.freeze({
    kind:'v2.1-pulmonary-vascular-controller',
    step,
    snapshot,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  HCA,
  hcaPvrRatio,
  createV21PulmonaryVascularController,
});
