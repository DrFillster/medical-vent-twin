'use strict';

/**
 * Lin, Ngwompo & Tilley 2012 baro-chemoreflex interaction candidate.
 *
 * Primary source:
 * Lin J, Ngwompo RF, Tilley DG.
 * Development of a cardiopulmonary mathematical model incorporating a
 * baro-chemoreceptor reflex control system.
 * Proc Inst Mech Eng H. 2012;226(10):787-803.
 * doi:10.1177/0954411912451823. PMID:23157080.
 *
 * This module transcribes ONLY the published chemoreflex/baroreflex
 * interaction relations that have been verified from the primary manuscript.
 * It deliberately does not invent the downstream sigmoid/efferent dynamics
 * where a complete primary-source transcription is not yet in this repo.
 *
 * Eq. 30: peripheral chemoreceptor reset of baroreflex operating pressure.
 * Eq. 31: central chemoreceptor change in sympathetic gain.
 *
 * Because the manuscript's notation for Eq. 30 is a delta/operating-point
 * quantity whose absolute baseline interpretation is ambiguous when read
 * outside the full block diagram, this candidate uses the SOURCE-PRESERVING
 * change from a declared reference gas state:
 *
 *   baroreflexOperatingPointShift =
 *      Eq30(current gas) - Eq30(reference gas)
 *
 * No fitted gain is introduced.
 */

const SOURCE=Object.freeze({
  citation:
    'Lin J, Ngwompo RF, Tilley DG. Proc Inst Mech Eng H. 2012;226(10):787-803.',
  doi:'10.1177/0954411912451823',
  pmid:'23157080',
  equations:Object.freeze([30,31]),
  validation:
    'Published integrated model validated HR and MAP responses during hypoxia and hypercapnia; reported percentage differences in changes were within 3%.',
  authority:'shadow-source-equations-only',
  clinicalValidation:false,
});

const P=Object.freeze({
  peripheralReset:Object.freeze({
    k1:-13.8,
    k2:0.182,
    k3:828,
    co2FloorMmHg:40,
    o2CeilingMmHg:104,
  }),
  centralSympatheticGain:Object.freeze({
    k4:1,
    k5:-18.118,
    co2FloorMmHg:40,
    units:'percent change',
  }),
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

// Lin 2012 Eq. 30, piecewise exactly as published.
function peripheralChemoreflexOperatingPointTerm({
  arterialPo2MmHg,
  arterialPco2MmHg,
}={}){
  positive(arterialPo2MmHg,'arterialPo2MmHg');
  positive(arterialPco2MmHg,'arterialPco2MmHg');
  const p=P.peripheralReset;
  const co2=Math.max(arterialPco2MmHg,p.co2FloorMmHg);
  const o2=Math.min(arterialPo2MmHg,p.o2CeilingMmHg);
  return p.k1+p.k2*co2+p.k3/o2;
}

// Lin 2012 Eq. 31, exactly as published.
function centralChemoreflexSympatheticGainPercent({
  arterialPco2MmHg,
}={}){
  positive(arterialPco2MmHg,'arterialPco2MmHg');
  const p=P.centralSympatheticGain;
  const co2=Math.max(arterialPco2MmHg,p.co2FloorMmHg);
  return p.k4*co2+p.k5;
}

function createLin2012BaroChemoreflexInteraction({
  referenceArterialPo2MmHg=90,
  referenceArterialPco2MmHg=40,
}={}){
  positive(referenceArterialPo2MmHg,'referenceArterialPo2MmHg');
  positive(referenceArterialPco2MmHg,'referenceArterialPco2MmHg');

  const referencePeripheralTerm=
    peripheralChemoreflexOperatingPointTerm({
      arterialPo2MmHg:referenceArterialPo2MmHg,
      arterialPco2MmHg:referenceArterialPco2MmHg,
    });
  const referenceSympatheticGainPercent=
    centralChemoreflexSympatheticGainPercent({
      arterialPco2MmHg:referenceArterialPco2MmHg,
    });

  let last=null;

  function evaluate({arterialPo2MmHg,arterialPco2MmHg}={}){
    const peripheralTerm=peripheralChemoreflexOperatingPointTerm({
      arterialPo2MmHg,arterialPco2MmHg,
    });
    const sympatheticGainPercent=
      centralChemoreflexSympatheticGainPercent({arterialPco2MmHg});

    last=Object.freeze({
      arterialPo2MmHg,
      arterialPco2MmHg,
      peripheralOperatingPointTermMmHg:peripheralTerm,
      referencePeripheralOperatingPointTermMmHg:referencePeripheralTerm,
      baroreflexOperatingPointShiftMmHg:
        peripheralTerm-referencePeripheralTerm,
      sympatheticGainPercent,
      referenceSympatheticGainPercent,
      sympatheticGainShiftPercentagePoints:
        sympatheticGainPercent-referenceSympatheticGainPercent,
      controlAuthority:false,
      unresolved:Object.freeze({
        downstreamEfferentMapping:
          'Not activated until Lin 2012 Eqs. 12-28 and all associated parameters are line-by-line primary-source verified.',
      }),
      provenance:SOURCE,
    });
    return last;
  }

  return Object.freeze({
    kind:'lin-2012-baro-chemoreflex-interaction-shadow',
    evaluate,
    snapshot:()=>last,
    source:SOURCE,
    parameters:P,
  });
}

module.exports=Object.freeze({
  SOURCE,
  P,
  peripheralChemoreflexOperatingPointTerm,
  centralChemoreflexSympatheticGainPercent,
  createLin2012BaroChemoreflexInteraction,
});
