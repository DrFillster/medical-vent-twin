'use strict';

const {
  shimayoshiEquivalentCo2PercentFromPco2MmHg,
}=require('./shimayoshi_hummod_co2_bridge.js');
const {
  createAcidosisGridSurrogateFromTable,
}=require('./shimayoshi_acidosis_grid_surrogate.js');

function evaluateHumModToShimayoshiAcidosisShadow({
  myocardialPco2MmHg,
  sourceProtocolTimeS,
  sourceGridTable,
}={}){
  const bridge=shimayoshiEquivalentCo2PercentFromPco2MmHg({
    myocardialPco2MmHg,
  });
  const surrogate=createAcidosisGridSurrogateFromTable(sourceGridTable);

  let sourcePrediction;
  try{
    sourcePrediction=surrogate.evaluate({
      sourceChallengeCo2Percent:bridge.sourceEquivalentCo2Percent,
      sourceTimeS:sourceProtocolTimeS,
    });
  }catch(error){
    if(/outside validated source grid|outside validated source trajectory/.test(error.message)){
      return Object.freeze({
        status:'outside-validated-Shimayoshi-acidosis-source-domain',
        myocardialPco2MmHg,
        sourceProtocolTimeS,
        sourceEquivalentCo2Percent:bridge.sourceEquivalentCo2Percent,
        sourcePrediction:null,
        fittedGain:false,
        closedLoopAuthority:false,
        reason:error.message,
      });
    }
    throw error;
  }

  return Object.freeze({
    status:'HumMod-to-Shimayoshi-acidosis-shadow-evaluated',
    myocardialPco2MmHg,
    sourceProtocolTimeS,
    sourceEquivalentCo2Percent:bridge.sourceEquivalentCo2Percent,
    sourcePrediction,
    fittedGain:false,
    closedLoopAuthority:false,
  });
}

module.exports=Object.freeze({
  evaluateHumModToShimayoshiAcidosisShadow,
});
