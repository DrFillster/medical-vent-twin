'use strict';

// Exact HumMod intracellular SID algebra used by myocardial pH.
// Pinned source:
// riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
// Structure/Electrolytes/CellSID.DES
// Structure/LeftHeart/LeftHeart-Ph.DES
// Structure/RightHeart/RightHeart-Ph.DES

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}

const CELL_SID_WEAK_ANIONS=0.036;
const CELL_SID_STRONG_ANIONS=0.117;
const CELL_SID_OTHER_CATIONS=0.012;

function cellSidLessLactate({
  intracellularPotassium,
  otherCations=CELL_SID_OTHER_CATIONS,
  strongAnions=CELL_SID_STRONG_ANIONS,
}={}){
  finite(intracellularPotassium,'intracellularPotassium');
  finite(otherCations,'otherCations');
  finite(strongAnions,'strongAnions');
  return intracellularPotassium+otherCations-strongAnions;
}

function myocardialSid({
  intracellularPotassium,
  myocardialLactate,
  otherCations=CELL_SID_OTHER_CATIONS,
  strongAnions=CELL_SID_STRONG_ANIONS,
}={}){
  finite(myocardialLactate,'myocardialLactate');
  const lessLactate=cellSidLessLactate({
    intracellularPotassium,
    otherCations,
    strongAnions,
  });
  const sid=lessLactate-myocardialLactate;
  return Object.freeze({
    sid,
    sidMeqPerL:1000*sid,
    lessLactate,
    intracellularPotassium,
    myocardialLactate,
    otherCations,
    strongAnions,
  });
}

module.exports={
  CELL_SID_WEAK_ANIONS,
  CELL_SID_STRONG_ANIONS,
  CELL_SID_OTHER_CATIONS,
  cellSidLessLactate,
  myocardialSid,
};
