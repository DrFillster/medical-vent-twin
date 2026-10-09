'use strict';

const {humModSource}=require('./hummod_source_identity.js');

const PERIPHERAL_FLOW_SYMBOLS=Object.freeze({
  avFistula:'A-VFistula-Flow.BloodFlow',
  bone:'Bone-Flow.BloodFlow',
  brain:'Brain-Flow.BloodFlow',
  fat:'Fat-Flow.BloodFlow',
  kidney:'Kidney-Flow.BloodFlow',
  leftHeart:'LeftHeart-Flow.BloodFlow',
  otherTissue:'OtherTissue-Flow.BloodFlow',
  respiratoryMuscle:'RespiratoryMuscle-Flow.BloodFlow',
  rightHeart:'RightHeart-Flow.BloodFlow',
  skeletalMuscle:'SkeletalMuscle-Flow.BloodFlow',
  skin:'Skin-Flow.BloodFlow',
});

const SPLANCHNIC_FLOW_SYMBOLS=Object.freeze({
  giTract:'GITract-Flow.BloodFlow',
  hepaticArtery:'HepaticArty.Flow',
});

const AGGREGATE_FLOW_SYMBOLS=Object.freeze({
  peripheral:'OrganFlow.PeripheralFlow',
  hepaticVein:'OrganFlow.HepaticVeinFlow',
  systemicArterialOutflow:'SystemicArtys.Outflow',
  systemicArterialInflow:'SystemicArtys.Inflow',
});

const NATIVE_ORGAN_FLOW_SYMBOLS=Object.freeze({
  ...PERIPHERAL_FLOW_SYMBOLS,
  ...SPLANCHNIC_FLOW_SYMBOLS,
});

const SOURCE=Object.freeze({
  organFlow:humModSource('Structure/Circulation/OrganFlow.DES','OrganFlow.Calc'),
  systemicArteries:humModSource('Structure/VascularCompartments/SystemicArtys.DES','SystemicArtys.Dervs'),
  peripheralResistance:humModSource('Structure/Circulation/PeripheralResistance.DES','PeripheralResistance.Wrapup'),
});

module.exports={
  PERIPHERAL_FLOW_SYMBOLS,
  SPLANCHNIC_FLOW_SYMBOLS,
  AGGREGATE_FLOW_SYMBOLS,
  NATIVE_ORGAN_FLOW_SYMBOLS,
  SOURCE,
};
