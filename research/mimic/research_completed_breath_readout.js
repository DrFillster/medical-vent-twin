'use strict';
// Research-only readout. Keep source summary and provenance explicit.
const {summarizeSimulationMeasurements}=require('../../ards-twin-v1.0/src/bedside_measurements');
function completedBreathReadout(sim){
 const summary=summarizeSimulationMeasurements(sim),b=summary.lastValidDeliveredBreath;
 return {source:'last-valid-completed-delivered-breath',breathIndex:b?b.breathIndex:null,peakPressureCmH2O:b&&Number.isFinite(b.Ppeak)?b.Ppeak:null,breathPeepCmH2O:b&&Number.isFinite(b.PEEP)?b.PEEP:null,inspiredVolumeL:b&&Number.isFinite(b.VtInspired)?b.VtInspired:null,rawOpenBreathPeakPressureCmH2O:summary.peakPressureCmH2O};
}
module.exports={completedBreathReadout};
