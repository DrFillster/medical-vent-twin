'use strict';

/**
 * Diagnostic factors from the selected Crampin-Smith / Shimayoshi myocardial
 * acidosis-hypoxia candidate.
 *
 * These are source-level component factors, NOT a whole-heart Emax model.
 * No control authority.
 */

const SOURCE=Object.freeze({
  crampinSmith2006:Object.freeze({
    doi:'10.1529/biophysj.105.070557',
    pmid:'16473911',
  }),
  shimayoshiTakeuchiMatsuoka2026:Object.freeze({
    doi:'10.1113/JP290440',
    pmid:'42625359',
    codeRepository:'atakeuti/TS-AT-SM-2026-IRmodel',
  }),
  status:'mechanistic-candidate-shadow-only',
  controlAuthority:false,
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

function hillPhFactor({pHi,pHref,pK,n}){
  finite(pHi,'pHi'); finite(pHref,'pHref'); finite(pK,'pK'); positive(n,'n');
  return (1+Math.pow(10,n*(-pHref+pK))) /
    (1+Math.pow(10,n*(-pHi+pK)));
}

function ryrPhFactor(pHi){
  return hillPhFactor({pHi,pHref:7.15,pK:6.64,n:1.87});
}

function ncxPhFactor(pHi){
  return hillPhFactor({pHi,pHref:7.15,pK:7.37,n:0.991});
}

function complexIvOxygenFactor(o2IntracellularMm){
  if(o2IntracellularMm==null) return null;
  finite(o2IntracellularMm,'o2IntracellularMm');
  if(o2IntracellularMm<0) throw new Error('o2IntracellularMm must be >= 0');
  const kmMm=0.150;
  return o2IntracellularMm/(o2IntracellularMm+kmMm);
}

function candidateSnapshot({
  intracellularPh=null,
  intracellularO2Mm=null,
  atpMgMm=null,
  phosphocreatineMm=null,
  phosphateMm=null,
}={}){
  const hasPHi=intracellularPh!=null;
  if(hasPHi) finite(intracellularPh,'intracellularPh');
  if(atpMgMm!=null) finite(atpMgMm,'atpMgMm');
  if(phosphocreatineMm!=null) finite(phosphocreatineMm,'phosphocreatineMm');
  if(phosphateMm!=null) finite(phosphateMm,'phosphateMm');

  return Object.freeze({
    intracellularPh,
    intracellularO2Mm,
    atpMgMm,
    phosphocreatineMm,
    phosphateMm,
    componentFactors:Object.freeze({
      ryrPh:hasPHi?ryrPhFactor(intracellularPh):null,
      ncxPh:hasPHi?ncxPhFactor(intracellularPh):null,
      complexIvOxygen:complexIvOxygenFactor(intracellularO2Mm),
    }),
    wholeHeartContractilityMultiplier:null,
    wholeHeartEmax:null,
    status:
      'candidate source-level myocardial states available; whole-heart force-to-Emax adapter not yet source-validated',
    controlAuthority:false,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  hillPhFactor,
  ryrPhFactor,
  ncxPhFactor,
  complexIvOxygenFactor,
  candidateSnapshot,
});
