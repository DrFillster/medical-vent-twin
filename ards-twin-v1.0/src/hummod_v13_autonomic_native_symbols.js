'use strict';

// v1.3 native HumMod autonomic trace roster.
// Each symbol below has been verified against the pinned HumMod standalone
// source snapshot. These are diagnostic outputs only; they do not change
// reduced-model physiology.

const HUMMOD_V13_AUTONOMIC_NATIVE_SYMBOLS = Object.freeze([
  Object.freeze({ symbol:'Brain-Fuel.FractUseDelay', sourceFile:'Structure/Brain/Brain-Fuel.DES', role:'SympsCNS FuelEffect input' }),
  Object.freeze({ symbol:'Brain-Fuel.FractUse', sourceFile:'Structure/Brain/Brain-Fuel.DES', role:'Brain-Fuel delayed input' }),
  Object.freeze({ symbol:'Brain-Fuel.MinimumFractionalDelivery', sourceFile:'Structure/Brain/Brain-Fuel.DES', role:'minimum brain substrate delivery fraction' }),
  Object.freeze({ symbol:'Brain-Fuel.KAFractionalDelivery', sourceFile:'Structure/Brain/Brain-Fuel.DES', role:'brain ketoacid delivery fraction' }),
  Object.freeze({ symbol:'Brain-Fuel.AerobicGlucoseFractionalDelivery', sourceFile:'Structure/Brain/Brain-Fuel.DES', role:'brain aerobic glucose delivery fraction' }),
  Object.freeze({ symbol:'Brain-Fuel.AnaerobicGlucoseFractionalDelivery', sourceFile:'Structure/Brain/Brain-Fuel.DES', role:'brain anaerobic glucose delivery fraction' }),
  Object.freeze({ symbol:'Brain-Flow.BloodFlow', sourceFile:'Structure/Brain/Brain-Flow.DES', role:'brain blood flow' }),
  Object.freeze({ symbol:'Brain-Flow.PlasmaFlow', sourceFile:'Structure/Brain/Brain-Flow.DES', role:'brain plasma flow' }),
  Object.freeze({ symbol:'Brain-Flow.PO2', sourceFile:'Structure/Brain/Brain-Flow.DES', role:'brain tissue PO2' }),
  Object.freeze({ symbol:'Brain-Metabolism.O2Need', sourceFile:'Structure/Brain/Brain-Metabolism.DES', role:'brain oxygen need' }),
  Object.freeze({ symbol:'Brain-Metabolism.O2Lack', sourceFile:'Structure/Brain/Brain-Metabolism.DES', role:'brain oxygen lack' }),
  Object.freeze({ symbol:'Brain-Lactate.[Lac-(mG/dL)]', sourceFile:'Structure/Brain/Brain-Lactate.DES', role:'brain lactate concentration' }),
  Object.freeze({ symbol:'Brain-Function.Effect', sourceFile:'Structure/Brain/Brain-Function.DES', role:'SympsCNS branch condition' }),
  Object.freeze({ symbol:'A2Pool.Log10Conc', sourceFile:'Structure/Renin/A2Pool.DES', role:'SympsCNS A2Effect input' }),
  Object.freeze({ symbol:'CNSTrophicFactor.Effect', sourceFile:'Structure/Nerves/CNSTrophicFactor.DES', role:'SympsCNS multiplicative effect' }),
  Object.freeze({ symbol:'CushingResponse.Effect', sourceFile:'Structure/Nerves/CushingResponse.DES', role:'SympsCNS additive effect' }),
  Object.freeze({ symbol:'ExerciseSymps.TotalEffect', sourceFile:'Structure/Nerves/ExerciseSymps.DES', role:'SympsCNS additive effect' }),
  Object.freeze({ symbol:'MotorRadiation.TotalEffect', sourceFile:'Structure/Nerves/MotorRadiation.DES', role:'exercise central-command contribution' }),
  Object.freeze({ symbol:'SkeletalMuscle-Metaboreflex.NerveActivity', sourceFile:'Structure/SkeletalMuscle/SkeletalMuscle-Metaboreflex.DES', role:'exercise metaboreflex afferent activity' }),
  Object.freeze({ symbol:'SkeletalMuscle-Ph.Ph', sourceFile:'Structure/SkeletalMuscle/SkeletalMuscle-Ph.DES', role:'metaboreflex intracellular pH input' }),
  Object.freeze({ symbol:'SkeletalMuscle-Function.Failed', sourceFile:'Structure/SkeletalMuscle/SkeletalMuscle-Function.DES', role:'metaboreflex failure gate' }),
  Object.freeze({ symbol:'Mechanoreceptors.FiringRate', sourceFile:'Structure/Nerves/Mechanoreceptors.DES', role:'SympsCNS MechanoEffect input' }),
  Object.freeze({ symbol:'SympsChemo.Effect', sourceFile:'Structure/Nerves/SympsChemo.DES', role:'SympsCNS reflex multiplier' }),
  Object.freeze({ symbol:'Baroreflex.NA', sourceFile:'Structure/Nerves/Baroreflex.DES', role:'SympsCNS BaroEffect input' }),
  Object.freeze({ symbol:'LowPressureReceptors.NA', sourceFile:'Structure/Nerves/LowPressureReceptors.DES', role:'SympsCNS LowPressureEffect input' }),
  Object.freeze({ symbol:'SympsCNS.FuelEffect', sourceFile:'Structure/Nerves/SympsCNS.DES', role:'resolved fuel contribution' }),
  Object.freeze({ symbol:'SympsCNS.A2Effect', sourceFile:'Structure/Nerves/SympsCNS.DES', role:'resolved angiotensin-II multiplier' }),
  Object.freeze({ symbol:'SympsCNS.BaroEffect', sourceFile:'Structure/Nerves/SympsCNS.DES', role:'resolved baroreflex multiplier' }),
  Object.freeze({ symbol:'SympsCNS.LowPressureEffect', sourceFile:'Structure/Nerves/SympsCNS.DES', role:'resolved low-pressure multiplier' }),
  Object.freeze({ symbol:'SympsCNS.ReflexNA', sourceFile:'Structure/Nerves/SympsCNS.DES', role:'reflex sympathetic neural activity' }),
  Object.freeze({ symbol:'SympsCNS.NA', sourceFile:'Structure/Nerves/SympsCNS.DES', role:'total sympathetic CNS neural activity' }),
  Object.freeze({ symbol:'SympsCNS.NA(Hz)', sourceFile:'Structure/Nerves/SympsCNS.DES', role:'sympathetic CNS firing rate' }),
  Object.freeze({ symbol:'GangliaGeneral.NA(Hz)', sourceFile:'Structure/Nerves/GangliaGeneral.DES', role:'general sympathetic ganglion firing rate' }),
  Object.freeze({ symbol:'VagusNerve.NA(Hz)', sourceFile:'Structure/Nerves/VagusNerve.DES', role:'vagal firing rate' }),
  Object.freeze({ symbol:'BetaPool.Effect', sourceFile:'Structure/Catechols/BetaPool.DES', role:'humoral beta agonism' }),
  Object.freeze({ symbol:'SANode-BetaReceptors.Activity', sourceFile:'Structure/Heart/SANode-BetaReceptors.DES', role:'SA-node beta receptor activity' }),
  Object.freeze({ symbol:'SANode-Rate.ParasympatheticEffect', sourceFile:'Structure/Heart/SANode-Rate.DES', role:'parasympathetic HR contribution' }),
  Object.freeze({ symbol:'SANode-Rate.SympatheticEffect', sourceFile:'Structure/Heart/SANode-Rate.DES', role:'sympathetic HR contribution' }),
  Object.freeze({ symbol:'SANode-Rate.Rate', sourceFile:'Structure/Heart/SANode-Rate.DES', role:'native sinus-node rate' }),
  Object.freeze({ symbol:'SANode-Rate.Is_SinusRhythm', sourceFile:'Structure/Heart/SANode-Rate.DES', role:'native sinus-rhythm state' }),
  Object.freeze({ symbol:'LeftHeart-Ph.Ph', sourceFile:'Structure/LeftHeart/LeftHeart-Ph.DES', role:'left myocardial intracellular pH' }),
  Object.freeze({ symbol:'RightHeart-Ph.Ph', sourceFile:'Structure/RightHeart/RightHeart-Ph.DES', role:'right myocardial intracellular pH' }),
  Object.freeze({ symbol:'LeftHeart-Function.PhEffect', sourceFile:'Structure/LeftHeart/LeftHeart-Function.DES', role:'left myocardial pH function effect' }),
  Object.freeze({ symbol:'RightHeart-Function.PhEffect', sourceFile:'Structure/RightHeart/RightHeart-Function.DES', role:'right myocardial pH function effect' }),
  Object.freeze({ symbol:'LeftHeart-Function.FuelEffect', sourceFile:'Structure/LeftHeart/LeftHeart-Function.DES', role:'left myocardial fuel function effect' }),
  Object.freeze({ symbol:'RightHeart-Function.FuelEffect', sourceFile:'Structure/RightHeart/RightHeart-Function.DES', role:'right myocardial fuel function effect' }),
  Object.freeze({ symbol:'LeftHeart-Function.Effect', sourceFile:'Structure/LeftHeart/LeftHeart-Function.DES', role:'left total myocardial function effect' }),
  Object.freeze({ symbol:'RightHeart-Function.Effect', sourceFile:'Structure/RightHeart/RightHeart-Function.DES', role:'right total myocardial function effect' }),
  Object.freeze({ symbol:'LeftHeart-Function.Failed', sourceFile:'Structure/LeftHeart/LeftHeart-Function.DES', role:'left myocardial failure latch' }),
  Object.freeze({ symbol:'RightHeart-Function.Failed', sourceFile:'Structure/RightHeart/RightHeart-Function.DES', role:'right myocardial failure latch' }),
  Object.freeze({ symbol:'Heart-Asystole.Is_Asystole', sourceFile:'Structure/Heart/Heart-Asystole.DES', role:'native asystole state driven by left-heart failure' }),
  Object.freeze({ symbol:'Heart-Rate.Rate', sourceFile:'Structure/Heart/Heart-Rate.DES', role:'native displayed heart rate' }),
]);

function listV13AutonomicNativeSymbols() {
  return HUMMOD_V13_AUTONOMIC_NATIVE_SYMBOLS.map(entry => entry.symbol);
}

module.exports = {
  HUMMOD_V13_AUTONOMIC_NATIVE_SYMBOLS,
  listV13AutonomicNativeSymbols,
};
