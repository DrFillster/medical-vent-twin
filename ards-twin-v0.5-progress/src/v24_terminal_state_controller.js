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
  let last=null;

  function step({
    dtSec,
    meanArterialPressureMmHg,
    cardiacOutputMlPerMin,
    mechanicalPumpFailure=false,
    oxygenDeficit=null,
  }={}){
    positive(dtSec,'dtSec');
    finite(meanArterialPressureMmHg,'meanArterialPressureMmHg');
    finite(cardiacOutputMlPerMin,'cardiacOutputMlPerMin');

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
  createV24TerminalStateController,
});
