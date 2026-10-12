'use strict';

/**
 * Ursino & Magosso 2000 systemic vascular topology and basal parameters.
 *
 * Primary source:
 * Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia.
 * I. A mathematical model. Am J Physiol Heart Circ Physiol.
 * 2000;279:H149-H165. DOI 10.1152/ajpheart.2000.279.1.H149.
 *
 * Candidate parameter layer only. No state ownership.
 */

const SOURCE=Object.freeze({
  citation:'Ursino M, Magosso E. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
  doi:'10.1152/ajpheart.2000.279.1.H149',
  table:1,
  authority:'candidate-not-canonical',
});

function bed({C,Vu,R}){
  return Object.freeze({C,Vu,R});
}

const VASCULAR_2000=Object.freeze({
  sa:Object.freeze({C:0.28,Vu:0,R:0.06,L:0.22e-3}),
  sp:bed({C:2.05,Vu:274.4,R:3.307}),
  ep:bed({C:0.668,Vu:134.64,R:3.52}),
  mp:bed({C:0.525,Vu:105.8,R:4.48}),
  bp:bed({C:0.358,Vu:72.13,R:6.57}),
  hp:bed({C:0.119,Vu:24,R:19.71}),
  sv:bed({C:61.11,Vu:1121,R:0.038}),
  ev:bed({C:20,Vu:550,R:0.04}),
  mv:bed({C:15.71,Vu:432.14,R:0.05}),
  bv:bed({C:10.71,Vu:294.64,R:0.075}),
  hv:bed({C:3.57,Vu:98.21,R:0.224}),
  pa:Object.freeze({C:0.76,Vu:0,R:0.023,L:0.18e-3}),
  pp:bed({C:5.80,Vu:123,R:0.0894}),
  pv:bed({C:25.37,Vu:120,R:0.0056}),
  totalBloodVolumeMl:5300,
});

const PARENT_1998_EXTRASPLANCHNIC=Object.freeze({
  peripheral:Object.freeze({C:1.67,Vu:336.6,R:1.407}),
  venous:Object.freeze({C:50,Vu:1375,R:0.016}),
});

function sum(values){
  return values.reduce((a,b)=>a+b,0);
}
function parallelResistance(values){
  return 1/sum(values.map(r=>1/r));
}

function partitionAudit(){
  const peripheral=[
    VASCULAR_2000.ep,VASCULAR_2000.mp,VASCULAR_2000.bp,VASCULAR_2000.hp,
  ];
  const venous=[
    VASCULAR_2000.ev,VASCULAR_2000.mv,VASCULAR_2000.bv,VASCULAR_2000.hv,
  ];
  return Object.freeze({
    peripheral:Object.freeze({
      C:sum(peripheral.map(x=>x.C)),
      Vu:sum(peripheral.map(x=>x.Vu)),
      Rparallel:parallelResistance(peripheral.map(x=>x.R)),
    }),
    venous:Object.freeze({
      C:sum(venous.map(x=>x.C)),
      Vu:sum(venous.map(x=>x.Vu)),
      Rparallel:parallelResistance(venous.map(x=>x.R)),
    }),
  });
}

module.exports=Object.freeze({
  SOURCE,VASCULAR_2000,PARENT_1998_EXTRASPLANCHNIC,partitionAudit,
});
