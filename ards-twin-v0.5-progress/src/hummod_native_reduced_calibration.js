'use strict';

// Converts a verified native HumMod trajectory into explicit calibration
// targets for the browser-capable reduced HumMod core. This is a bridge,
// not proof of equivalence and not clinical validation.

const fs=require('node:fs');

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}

function lastRow(trajectory){
  if(!trajectory||trajectory.schema!=='vent-hummod-trajectory/v1') throw new Error('canonical native HumMod trajectory required');
  if(!Array.isArray(trajectory.rows)||trajectory.rows.length===0) throw new Error('trajectory rows required');
  return trajectory.rows[trajectory.rows.length-1];
}

function buildNativeReducedCalibrationTarget(trajectory,{targetId='native-hummod-default-baseline'}={}){
  const row=lastRow(trajectory);
  const v=row.values||{};
  const target={
    schema:'vent-native-reduced-hummod-calibration-target/v1',
    targetId,
    nativeTrajectoryId:trajectory.trajectoryId||null,
    source:trajectory.source||null,
    timestampSec:finite(row.timestampSec,'timestampSec'),
    endpoints:Object.freeze({
      pao2MmHg:finite(v['PO2Artys.Pressure'],'native PaO2'),
      paco2MmHg:finite(v['CO2Artys.Pressure'],'native PaCO2'),
      pH:finite(v['BloodPh.ArtysPh'],'native pH'),
      heartRatePerMin:finite(v['Heart-Rate.Rate'],'native heart rate'),
      meanArterialPressureMmHg:finite(v['SystemicArtys.Pressure'],'native systemic arterial pressure'),
      cardiacOutputLPerMin:finite(v['CardiacOutput.Flow(L/Min)'],'native cardiac output'),
    }),
    mapping:Object.freeze({
      circulation:Object.freeze({
        heartRatePerMin:Object.freeze({sourceSymbol:'Heart-Rate.Rate',targetPath:'circulation.boundaries.heartRatePerMin'}),
      }),
      gas:Object.freeze({
        initializationEndpoints:Object.freeze({
          pao2MmHg:'PO2Artys.Pressure',
          paco2MmHg:'CO2Artys.Pressure',
          pH:'BloodPh.ArtysPh',
        }),
      }),
      validationEndpoints:Object.freeze({
        meanArterialPressureMmHg:'SystemicArtys.Pressure',
        cardiacOutputLPerMin:'CardiacOutput.Flow(L/Min)',
      }),
    }),
    applicability:Object.freeze({
      status:'engineering-calibration-target-only',
      fullHumModEquivalent:false,
      berlinArdsCalibration:false,
      clinicalValidation:false,
      note:'Native HumMod endpoint values constrain the reduced core but do not establish structural or dynamic equivalence.',
    }),
  };
  return Object.freeze(target);
}

if(require.main===module){
  const input=process.argv[2],output=process.argv[3];
  if(!input||!output) throw new Error('usage: node src/hummod_native_reduced_calibration.js <native-trajectory.json> <output.json>');
  const target=buildNativeReducedCalibrationTarget(JSON.parse(fs.readFileSync(input,'utf8')));
  fs.writeFileSync(output,JSON.stringify(target,null,2)+'\n');
  console.log(JSON.stringify(target,null,2));
}

module.exports={buildNativeReducedCalibrationTarget};
