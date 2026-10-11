'use strict';

(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){
    module.exports=api;
  }else{
    root.NativeEngineClient=api;
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const HEALTH_SCHEMA='native-engine-health/v1';
  const STATE_SCHEMA='native-engine-state/v1';
  const ACIDOSIS_DIAGNOSTIC_SCHEMA='native-acidosis-diagnostic/v1';

  function normalizeBaseUrl(baseUrl){
    if(typeof baseUrl!=='string'||!baseUrl.trim()){
      throw new Error('baseUrl is required');
    }
    return baseUrl.replace(/\/+$/,'');
  }

  function validateHealth(value){
    if(!value||typeof value!=='object') throw new Error('native health payload must be an object');
    if(value.schema!==HEALTH_SCHEMA) throw new Error('unexpected native health schema');
    if(value.status!=='ok') throw new Error('native engine health is not ok');
    if(value.physiologyAuthority!==false||value.controlAuthority!==false){
      throw new Error('native boundary must not claim authority');
    }
    return Object.freeze({...value});
  }

  function validateState(value){
    if(!value||typeof value!=='object') throw new Error('native state payload must be an object');
    if(value.schema!==STATE_SCHEMA) throw new Error('unexpected native state schema');
    if(value.physiologyAuthority!==false||value.controlAuthority!==false){
      throw new Error('native boundary must not claim authority');
    }
    if(value.status==='boundary-only'&&value.patientState!==null){
      throw new Error('boundary-only native state must not contain patient state');
    }
    return Object.freeze({...value});
  }

  function validateAcidosisDiagnostic(value){
    if(!value||typeof value!=='object'){
      throw new Error('native acidosis diagnostic payload must be an object');
    }
    if(value.schema!==ACIDOSIS_DIAGNOSTIC_SCHEMA){
      throw new Error('unexpected native acidosis diagnostic schema');
    }
    if(value.physiologyAuthority!==false||value.controlAuthority!==false){
      throw new Error('native diagnostic must not claim authority');
    }
    if(value.stateless!==true){
      throw new Error('native acidosis diagnostic must be stateless');
    }
    return Object.freeze({...value});
  }

  function createNativeEngineClient({
    baseUrl,
    fetchImpl,
    staleAfterMs=5000,
  }={}){
    const base=normalizeBaseUrl(baseUrl);
    const doFetch=fetchImpl||(
      typeof fetch==='function'?fetch.bind(globalThis):null
    );
    if(!doFetch) throw new Error('fetch implementation is required');
    if(typeof staleAfterMs!=='number'||!Number.isFinite(staleAfterMs)||staleAfterMs<=0){
      throw new Error('staleAfterMs must be finite and > 0');
    }

    let lastSuccessfulStateAtMs=null;
    let lastState=null;
    let lastError=null;

    async function getJson(path){
      const response=await doFetch(base+path,{
        method:'GET',
        cache:'no-store',
        credentials:'include',
        headers:{Accept:'application/json'},
      });
      if(!response||response.ok!==true){
        const status=response&&typeof response.status==='number'?response.status:'unknown';
        throw new Error('native engine request failed: '+status);
      }
      return response.json();
    }

    async function health(){
      try{
        const value=validateHealth(await getJson('/health'));
        lastError=null;
        return value;
      }catch(error){
        lastError=error;
        throw error;
      }
    }

    async function state(){
      try{
        const value=validateState(await getJson('/state'));
        lastState=value;
        lastSuccessfulStateAtMs=Date.now();
        lastError=null;
        return value;
      }catch(error){
        lastError=error;
        throw error;
      }
    }

    async function acidosisDiagnostic({
      myocardialPco2MmHg,
      lvVolumeMl,
      dtSec,
      steps,
    }={}){
      const values=[
        ['myocardialPco2MmHg',myocardialPco2MmHg],
        ['lvVolumeMl',lvVolumeMl],
        ['dtSec',dtSec],
      ];
      for(const [label,value] of values){
        if(typeof value!=='number'||!Number.isFinite(value)){
          throw new Error(label+' must be finite');
        }
      }
      if(!Number.isInteger(steps)||steps<1){
        throw new Error('steps must be a positive integer');
      }

      const query=[
        'myocardial_pco2_mmhg='+encodeURIComponent(String(myocardialPco2MmHg)),
        'lv_volume_ml='+encodeURIComponent(String(lvVolumeMl)),
        'dt_s='+encodeURIComponent(String(dtSec)),
        'steps='+encodeURIComponent(String(steps)),
      ].join('&');

      return validateAcidosisDiagnostic(
        await getJson('/diagnostics/myocardium/acidosis?'+query)
      );
    }

    function connectionStatus(nowMs=Date.now()){
      if(lastError){
        return Object.freeze({
          status:'unavailable',
          stale:true,
          error:String(lastError.message||lastError),
          lastSuccessfulStateAtMs,
        });
      }
      if(lastSuccessfulStateAtMs==null){
        return Object.freeze({
          status:'not-connected',
          stale:true,
          error:null,
          lastSuccessfulStateAtMs:null,
        });
      }
      const ageMs=nowMs-lastSuccessfulStateAtMs;
      const stale=ageMs>staleAfterMs;
      return Object.freeze({
        status:stale?'stale':'connected',
        stale,
        ageMs,
        error:null,
        lastSuccessfulStateAtMs,
      });
    }

    return Object.freeze({
      baseUrl:base,
      health,
      state,
      acidosisDiagnostic,
      connectionStatus,
      lastState:()=>lastState,
      schemas:Object.freeze({
        health:HEALTH_SCHEMA,
        state:STATE_SCHEMA,
        acidosisDiagnostic:ACIDOSIS_DIAGNOSTIC_SCHEMA,
      }),
      physiologyAuthority:false,
      controlAuthority:false,
    });
  }

  return Object.freeze({
    HEALTH_SCHEMA,
    STATE_SCHEMA,
    ACIDOSIS_DIAGNOSTIC_SCHEMA,
    validateHealth,
    validateState,
    validateAcidosisDiagnostic,
    createNativeEngineClient,
  });
});
