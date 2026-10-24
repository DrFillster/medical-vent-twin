'use strict';

/**
 * v2.4 terminal-state controller.
 *
 * Objective:
 * Remove elapsed-asphyxia and oxygen-debt timers as direct arrest triggers.
 * Terminal transition is tied to failure of the perfusing circulation.
 *
 * Authorized arrest pathways:
 * 1. mechanical pump failure -> PEA;
 * 2. sustained profound hypotension using the existing published
 *    cardiovascular-collapse criteria:
 *      MAP <30 mmHg for 10 min, or
 *      MAP <20 mmHg for 10 sec.
 *
 * Oxygen deficit, hypoxemia, hypercapnia, and acidemia remain important
 * upstream disease states, but none is used alone as a deterministic death
 * threshold.
 *
 * This is a simulator state-transition rule, not a clinical resuscitation
 * criterion and not a mortality prediction model.
 */

const SOURCE=Object.freeze({
  collapseCriteria:
    'Gomez et al. cardiovascular-collapse definition retained from project evidence ledger: MAP <30 mmHg for 10 min or MAP <20 mmHg for 10 sec',
  rhythm:
    'PEA used for nonperfusing mechanical/circulatory collapse in this reduced respiratory-shock pathway',
  elapsedAsphyxiaTimer:false,
  oxygenDebtDeathThreshold:false,
  clinicalValidation:false,
  authority:'v2.4-physiology-triggered-terminal-state',
});

const MAP30_MMHG=30;
const MAP30_SEC=10*60;
const MAP20_MMHG=20;
const MAP20_SEC=10;

const ASPHYXIAL_COLLAPSE_ENVELOPE=Object.freeze({
  arterialPh:7.03,
  arterialPco2MmHg:93,
  citation:
    'DeBehnke DJ et al. Resuscitation. 1995;30:169-175. PMID 8560107. At loss of aortic fluctuation: pH 7.03 +/- 0.07, PaCO2 93 +/- 19 mmHg, with a tachycardia/hypertension -> bradycardia/hypotension trajectory.',
  role:
    'experimental asphyxial collapse envelope; not a universal patient death threshold',
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

function createV24TerminalStateController(){
  let lowMapBelow30Sec=0;
  let lowMapBelow20Sec=0;
  let cardiacArrest=false;
  let cardiacArrestReason=null;
  let arrestRhythm=null;
  let referenceHeartRatePerMin=null;
  let referenceMapMmHg=null;
  let last=null;

  function step({
    dtSec,
    meanArterialPressureMmHg,
    cardiacOutputMlPerMin,
    mechanicalPumpFailure=false,
    oxygenDeficit=null,
    heartRatePerMin=null,
    arterialPh=null,
    arterialPco2MmHg=null,
  }={}){
    positive(dtSec,'dtSec');
    finite(meanArterialPressureMmHg,'meanArterialPressureMmHg');
    finite(cardiacOutputMlPerMin,'cardiacOutputMlPerMin');
    if(heartRatePerMin!=null) positive(heartRatePerMin,'heartRatePerMin');
    if(arterialPh!=null) finite(arterialPh,'arterialPh');
    if(arterialPco2MmHg!=null) positive(arterialPco2MmHg,'arterialPco2MmHg');

    if(referenceMapMmHg==null && meanArterialPressureMmHg>0){
      referenceMapMmHg=meanArterialPressureMmHg;
    }
    if(referenceHeartRatePerMin==null && heartRatePerMin!=null){
      referenceHeartRatePerMin=heartRatePerMin;
    }

    const asphyxialEnvelopeReached=
      oxygenDeficit&&oxygenDeficit.supplyDependent===true &&
      arterialPh!=null &&
      arterialPco2MmHg!=null &&
      heartRatePerMin!=null &&
      referenceHeartRatePerMin!=null &&
      referenceMapMmHg!=null &&
      arterialPh<=ASPHYXIAL_COLLAPSE_ENVELOPE.arterialPh &&
      arterialPco2MmHg>=ASPHYXIAL_COLLAPSE_ENVELOPE.arterialPco2MmHg &&
      heartRatePerMin<referenceHeartRatePerMin &&
      meanArterialPressureMmHg<referenceMapMmHg;

    if(!cardiacArrest){
      lowMapBelow30Sec=meanArterialPressureMmHg<MAP30_MMHG
        ?lowMapBelow30Sec+dtSec
        :0;
      lowMapBelow20Sec=meanArterialPressureMmHg<MAP20_MMHG
        ?lowMapBelow20Sec+dtSec
        :0;

      if(mechanicalPumpFailure){
        cardiacArrest=true;
        cardiacArrestReason='mechanical-pump-failure';
        arrestRhythm='PEA';
      }else if(asphyxialEnvelopeReached){
        cardiacArrest=true;
        cardiacArrestReason='asphyxial-hemodynamic-collapse-envelope';
        arrestRhythm='PEA';
      }else if(lowMapBelow20Sec>=MAP20_SEC){
        cardiacArrest=true;
        cardiacArrestReason='sustained-map-below-20';
        arrestRhythm='PEA';
      }else if(lowMapBelow30Sec>=MAP30_SEC){
        cardiacArrest=true;
        cardiacArrestReason='sustained-map-below-30';
        arrestRhythm='PEA';
      }
    }

    let stage='perfusing';
    if(cardiacArrest) stage='cardiac-arrest';
    else if(meanArterialPressureMmHg<MAP20_MMHG) stage='profound-circulatory-failure';
    else if(meanArterialPressureMmHg<MAP30_MMHG) stage='severe-circulatory-failure';
    else if(oxygenDeficit&&oxygenDeficit.supplyDependent) stage='oxygen-supply-failure';

    last=Object.freeze({
      stage,
      alive:!cardiacArrest,
      cardiacArrest,
      cardiacArrestReason,
      arrestRhythm,
      meanArterialPressureMmHg,
      cardiacOutputMlPerMin,
      mechanicalPumpFailure:Boolean(mechanicalPumpFailure),
      asphyxialEnvelopeReached,
      referenceHeartRatePerMin,
      referenceMapMmHg,
      heartRatePerMin,
      arterialPh,
      arterialPco2MmHg,
      lowMapBelow30Sec,
      lowMapBelow20Sec,
      oxygenDeficit:oxygenDeficit?Object.freeze({
        supplyDependent:Boolean(oxygenDeficit.supplyDependent),
        cumulativeOxygenDeficitMl:
          oxygenDeficit.cumulativeOxygenDeficitMl,
        cumulativeFractionalDeficitMin:
          oxygenDeficit.cumulativeFractionalDeficitMin,
      }):null,
      elapsedAsphyxiaTimerUsed:false,
      oxygenDebtDeathThresholdUsed:false,
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot(){
    return last||Object.freeze({
      stage:'perfusing',
      alive:true,
      cardiacArrest:false,
      cardiacArrestReason:null,
      arrestRhythm:null,
      lowMapBelow30Sec,
      lowMapBelow20Sec,
      elapsedAsphyxiaTimerUsed:false,
      oxygenDebtDeathThresholdUsed:false,
      provenance:SOURCE,
      status:'initialized-not-stepped',
    });
  }

  return Object.freeze({
    kind:'v2.4-terminal-state-controller',
    step,
    snapshot,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  MAP30_MMHG,
  MAP30_SEC,
  MAP20_MMHG,
  MAP20_SEC,
  ASPHYXIAL_COLLAPSE_ENVELOPE,
  createV24TerminalStateController,
});
