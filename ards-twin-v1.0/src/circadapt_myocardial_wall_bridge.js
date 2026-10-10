'use strict';

/**
 * CircAdapt/TriSeg-style wall mechanics bridge.
 *
 * Purpose:
 * Convert source-model myocardial fiber stress + chamber geometry into
 * ventricular pressure without inventing a direct stress->Emax scalar.
 *
 * Based on the open MONARCH implementation derived from CircAdapt/TriSeg:
 *   Tm = sigma_f * Vw / (2 * Am)
 *   P  = 2 * Tm / |Rm| * 7.5e3
 *
 * Units expected here:
 * - sigma_f: MPa
 * - Vw: mm^3
 * - Am: mm^2
 * - Rm: mm
 * - P: mmHg
 *
 * This is a geometry bridge only. It does not create myocardial stress.
 */

const HUMAN_REFERENCE_GEOMETRY=Object.freeze({
  provenance:'MONARCH/CircAdapt human example input; implementation reference, not patient-specific geometry',
  sourceRepository:'BeatLabUCI/monarch',
  sourcePath:'examples/input_files/human.json',
  lvFreeWall:Object.freeze({
    midwallReferenceAreaMm2:7920,
    wallVolumeMm3:58200,
  }),
  septum:Object.freeze({
    midwallReferenceAreaMm2:4160,
    wallVolumeMm3:41896,
  }),
});

const SOURCE=Object.freeze({
  family:'CircAdapt/TriSeg wall mechanics',
  implementationReference:'BeatLabUCI/monarch src/monarch/heart.py',
  equations:Object.freeze({
    wallTension:'Tm = sigma_f * Vw / (2 * Am)',
    chamberPressure:'P = 2 * Tm / |Rm| * 7.5e3',
  }),
  controlAuthority:false,
});

function positive(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)||!(v>0)){
    throw new Error(label+' must be finite and > 0');
  }
  return v;
}

function shimayoshiStressMpaFromMilliNewtonPerMm2(value){
  positive(value,'shimayoshiStressMilliNewtonPerMm2');
  // 1 mN/mm^2 = 1 kPa = 0.001 MPa.
  return value*0.001;
}

function sphericalMidwallRadiusMmFromCavityAndWall({
  cavityVolumeMl,
  wallVolumeMm3,
}={}){
  positive(cavityVolumeMl,'cavityVolumeMl');
  positive(wallVolumeMm3,'wallVolumeMm3');
  const midwallVolumeMm3=cavityVolumeMl*1000+0.5*wallVolumeMm3;
  return Math.cbrt((3*midwallVolumeMm3)/(4*Math.PI));
}

function ventricularPressureFromFiberStress({
  fiberStressMpa,
  wallVolumeMm3,
  midwallAreaMm2,
  midwallRadiusMm,
}={}){
  positive(fiberStressMpa,'fiberStressMpa');
  positive(wallVolumeMm3,'wallVolumeMm3');
  positive(midwallAreaMm2,'midwallAreaMm2');
  positive(midwallRadiusMm,'midwallRadiusMm');

  const wallTensionMpaMm=
    fiberStressMpa*wallVolumeMm3/(2*midwallAreaMm2);
  const chamberPressureMmHg=
    2*wallTensionMpaMm/midwallRadiusMm*7.5e3;

  return Object.freeze({
    wallTensionMpaMm,
    chamberPressureMmHg,
    source:SOURCE,
    controlAuthority:false,
  });
}

function myocardialToChamberContract({
  activeFiberStressMpa=null,
  wallVolumeMm3=null,
  midwallAreaMm2=null,
  midwallRadiusMm=null,
}={}){
  const complete=[
    activeFiberStressMpa,
    wallVolumeMm3,
    midwallAreaMm2,
    midwallRadiusMm,
  ].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0);

  if(!complete){
    return Object.freeze({
      activeFiberStressMpa,
      wallVolumeMm3,
      midwallAreaMm2,
      midwallRadiusMm,
      chamberPressureMmHg:null,
      status:'blocked-pending-source-valid-myocardial-stress-and-chamber-geometry',
      source:SOURCE,
      controlAuthority:false,
    });
  }

  const mapped=ventricularPressureFromFiberStress({
    fiberStressMpa:activeFiberStressMpa,
    wallVolumeMm3,
    midwallAreaMm2,
    midwallRadiusMm,
  });

  return Object.freeze({
    activeFiberStressMpa,
    wallVolumeMm3,
    midwallAreaMm2,
    midwallRadiusMm,
    chamberPressureMmHg:mapped.chamberPressureMmHg,
    status:'geometry-complete-shadow-pressure-available',
    source:SOURCE,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  SOURCE,
  HUMAN_REFERENCE_GEOMETRY,
  shimayoshiStressMpaFromMilliNewtonPerMm2,
  sphericalMidwallRadiusMmFromCavityAndWall,
  ventricularPressureFromFiberStress,
  myocardialToChamberContract,
});
