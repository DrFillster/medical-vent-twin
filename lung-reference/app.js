/* UI adapter: real model calls; independent protocol panels; no retained stale outputs. */
(function (root) {
  'use strict';
  const L = typeof module !== 'undefined' && module.exports ? require('./lung.js') : root.LungRef;
  const fields = {
    vent: {peep:'PEEP (cmH2O)',vt:'Tidal volume (L)',rr:'Respiratory rate (/min)',
      fio2:'FiO2 (fraction)',flow:'Inspiratory flow (L/s)',pbw:'Predicted body weight (kg)'},
    gas: {hb:'Hemoglobin (g/dL)',svo2:'Imposed SvO2 (fraction)',dead_fraction:'VD/VT (fraction)',
      vco2:'VCO2 (L/min STPD)',bicarbonate:'Fixed bicarbonate (mmol/L)',rq:'Respiratory quotient',
      barometric:'Barometric pressure (mmHg)',water_vapor:'Water vapor pressure (mmHg)',p50:'Fixed P50 (mmHg)'},
    lung: {c_specific:'Specific C0 (L/cmH2O)',k_normal:'Normal stiffening K (cmH2O)',
      k_recruit:'Recruitable stiffening K (cmH2O)',aop:'AOP offset (cmH2O)',
      resistance:'Lumped resistance (cmH2O/(L/s))',opening_mid:'Opening midpoint above AOP (cmH2O)',
      closing_mid:'Closing midpoint above AOP (cmH2O)',threshold_width:'Threshold width (cmH2O)',
      units:'Relay count (integer, 8-4096)',residual_normal:'Normal residual shunt (fraction)',
      residual_recruit:'Recruited residual shunt (fraction)'}
  };
  function number(text, label) {
    if (String(text).trim() === '' || !Number.isFinite(Number(text)))
      throw new Error(label + ': enter a finite number');
    return Number(text);
  }
  function historyFrom(text, peep) {
    if (!text.trim()) return [peep];
    const parts=text.trim().split(/[\s,]+/);
    return parts.map(s=>number(s,'History'));
  }
  function attempt(fn) {try{return {ok:true,data:fn()};}catch(e){return {ok:false,error:e.message};}}
  function configuration(c) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error('Configuration must be an object');
    for(const key of Object.keys(c)) if(!['lung','vent','gas','history'].includes(key))
      throw new Error('Unknown configuration key: '+key);
    const lung=new L.Lung(c.lung),vent=new L.Vent(c.vent),gas=new L.Gas(c.gas);
    const history=c.history == null ? [vent.cfg.peep] : c.history;
    if(!Array.isArray(history) || history.some(x=>!Number.isFinite(x)))
      throw new Error('History must be an array of finite numbers');
    if(!history.length || history[history.length-1]!==vent.cfg.peep)
      throw new Error('History must end at set PEEP');
    return {lung,vent,gas,history};
  }
  function runScenario(c) {
    const {lung,vent,gas,history}=configuration(c);
    return {version:L.VERSION,scope:'Educational model outputs; not clinical recommendations',
      configuration:{lung:lung.cfg,vent:vent.cfg,gas:gas.cfg,history:[...history]},
      protocols:{snapshot:{history:[...history]},ri:{conditioning:30,high:15,low:5},
        trial:{conditioning:30,steps:[20,18,16,14,12,10,8,6,4]}},
      snapshot:attempt(()=>L.evaluate(lung,vent,gas,history)),
      ri:attempt(()=>L.riAnalogue(lung,vent.cfg.vt)),
      trial:attempt(()=>L.peepTrial(lung,vent))};
  }
  function caseConfig(name) {
    const c=L.illustrativeCases().find(x=>x.name===name);
    if(!c)throw new Error('Unknown case: '+name);
    return {lung:c.lung.cfg,vent:c.vent.cfg,gas:c.gas.cfg,history:[c.vent.cfg.peep]};
  }
  function mount(doc) {
    let lastResult=null;
    const get=id=>doc.getElementById(id);
    const panels=['metrics','snapshot-table','ri-table','trial-table','snapshot-error','ri-error',
      'trial-error','snapshot-context','trial-summary'];
    function clear(message='Settings changed. Compute to see results for these inputs.') {
      lastResult=null;get('export').disabled=true;
      for(const id of panels)get(id).replaceChildren();
      get('status').textContent=message;
    }
    function element(tag,text) {const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
    function addField(group,key,label) {
      const wrap=element('div');wrap.className='field';
      const id=group+'-'+key,lab=element('label',label);lab.htmlFor=id;
      const input=element('input');input.id=id;input.type='number';input.step='any';
      input.addEventListener('input',()=>clear());wrap.append(lab,input);get(group+'-fields').append(wrap);
    }
    for(const [group,items] of Object.entries(fields))
      for(const [key,label] of Object.entries(items))addField(group,key,label);
    for(const key of ['tissue','perfusion'])for(let i=0;i<3;i++)
      addField('lung',key+'-'+i,(key==='tissue'?'Tissue ':'Perfusion ')+['normal','recruitable','consolidated'][i]+' (fraction)');
    for(const c of L.illustrativeCases()){const o=element('option',c.name);o.value=c.name;get('case').append(o);}
    function fill(c) {
      for(const [group,items] of Object.entries(fields))for(const key of Object.keys(items))
        get(group+'-'+key).value=String(c[group][key]);
      for(const key of ['tissue','perfusion'])for(let i=0;i<3;i++)get('lung-'+key+'-'+i).value=String(c.lung[key][i]);
      get('history').value=c.history.join(', ');clear('Case loaded. Compute to evaluate.');
    }
    function read() {
      const c={lung:{},vent:{},gas:{}};
      for(const [group,items] of Object.entries(fields))for(const [key,label] of Object.entries(items))
        c[group][key]=number(get(group+'-'+key).value,label);
      for(const key of ['tissue','perfusion'])c.lung[key]=[0,1,2].map(i=>number(get('lung-'+key+'-'+i).value,key));
      c.history=historyFrom(get('history').value,c.vent.peep);return c;
    }
    const f=(x,d=3)=>typeof x==='number'&&Number.isFinite(x)?x.toFixed(d):String(x);
    function table(id,headers,rows) {
      const t=element('table'),head=element('thead'),hr=element('tr');
      for(const s of headers){const h=element('th',s);h.scope='col';hr.append(h);}head.append(hr);t.append(head);
      const body=element('tbody');for(const row of rows){const tr=element('tr');for(const s of row)tr.append(element('td',s));body.append(tr);}t.append(body);get(id).replaceChildren(t);
    }
    function render(result) {
      const c=result.configuration;
      get('snapshot-context').textContent='Snapshot history: '+c.history.join(' → ')+' cmH2O. Hb '+f(c.gas.hb,1)+' g/dL; VCO2 '+f(c.gas.vco2)+' L/min.';
      if(!result.snapshot.ok)get('snapshot-error').textContent=result.snapshot.error;
      else {
        const o=result.snapshot.data;
        for(const [label,key,unit] of [['Plateau pressure','pplat','cmH2O'],['P/F','pf','mmHg'],['Inspiratory power','mp_integral_J_min','J/min'],['Open fraction','open_fraction','of recruitable tissue']]){
          const box=element('div');box.className='metric';box.append(element('span',label),element('strong',f(o[key],key==='open_fraction'?3:1)),element('span',unit));get('metrics').append(box);
        }
        const items=[['Peak pressure','ppeak','cmH2O'],['Driving pressure','driving_pressure','cmH2O'],['Tidal compliance','crs_tidal_ml_cmH2O','mL/cmH2O'],['Tangent compliance at PEEP','crs_tangent_ml_cmH2O','mL/cmH2O'],['Elastic EELV above reference','elastic_eelv_above_reference_L','L'],['Vt / PBW','vt_ml_kg','mL/kg'],['Linear power approximation','mp_linear_estimate_J_min','J/min'],['Alveolar ventilation','alveolar_ventilation_L_min','L/min'],['PaCO2','paco2','mmHg'],['pH, fixed bicarbonate','ph_fixed_bicarbonate',''],['Alveolar PO2','alveolar_po2','mmHg'],['PaO2','pao2','mmHg'],['Modeled SaO2','sao2','fraction'],['Effective shunt','effective_shunt','fraction'],['End-capillary O2 content','cc_o2','mL/dL'],['Venous O2 content','cv_o2','mL/dL'],['Arterial O2 content','ca_o2','mL/dL']];
        table('snapshot-table',['Quantity','Model output','Unit'],items.map(([label,key,unit])=>[label,f(o[key]),unit]));
      }
      if(!result.ri.ok)get('ri-error').textContent=result.ri.error;
      else if(!result.ri.data.valid)get('ri-error').textContent='Undefined: '+result.ri.data.reason;
      else {
        const r=result.ri.data;
        const items=[['Signed R/I*','ri_signed','dimensionless'],['Change in model EELV','delta_eelv_L','L'],['Expected linear inflation','expected_inflation_L','L'],['Signed excess volume','excess_volume_signed_L','L'],['Effective low pressure','effective_low','cmH2O'],['Effective pressure difference','delta_p','cmH2O'],['Low-endpoint tidal compliance','clow_tidal_ml_cmH2O','mL/cmH2O'],['Model recruitment volume','model_recruitment_volume_L','L'],['Nonlinear inflation volume','nonlinear_inflation_volume_L','L'],['Recruitment component','recruitment_component','dimensionless'],['Nonlinear reference bias','nonlinear_baseline_component','dimensionless'],['High open fraction','high_open','fraction'],['Low open fraction','low_open','fraction']];
        table('ri-table',['Quantity','Model output','Unit'],items.map(([label,key,unit])=>[label,f(r[key],5),unit]));
      }
      if(!result.trial.ok)get('trial-error').textContent=result.trial.error;
      else {
        const t=result.trial.data;
        get('trial-summary').textContent=t.max_crs_peeps.length?'Sampled compliance maximum at PEEP '+t.max_crs_peeps.join(', ')+' cmH2O. At an edge of the valid sampled domain: '+String(t.boundary)+'. Not a PEEP recommendation.':'No valid sweep points; no compliance maximum.';
        table('trial-table',['Step','PEEP (cmH2O)','Pplat (cmH2O)','Tidal Crs (mL/cmH2O)','Status / reason'],t.rows.map((r,i)=>[String(i+1),f(r.peep,1),r.valid?f(r.pplat,2):'—',r.valid?f(r.crs_tidal_ml_cmH2O,2):'—',r.valid?'Computed':r.reason]));
      }
      const complete=result.snapshot.ok&&result.ri.ok&&result.ri.data.valid&&result.trial.ok&&result.trial.data.rows.every(r=>r.valid);
      get('status').textContent=complete?'Computed. All sampled outputs are defined.':'Computed with undefined outputs. Read the panel messages; undefined values are not zero.';
    }
    function compute() {
      clear('Computing...');
      try{const r=runScenario(read());render(r);lastResult=r;get('export').disabled=false;}
      catch(e){clear('Input error: '+e.message);}
    }
    get('history').addEventListener('input',()=>clear());
    get('case').addEventListener('change',()=>clear('Case selection changed. Press Load case to apply it.'));
    get('load-case').addEventListener('click',()=>{fill(caseConfig(get('case').value));compute();});
    get('compute').addEventListener('click',compute);
    get('reset-history').addEventListener('click',()=>{get('history').value=get('vent-peep').value;clear('Single-step history selected. Compute to evaluate.');});
    get('condition-history').addEventListener('click',()=>{get('history').value='30, '+get('vent-peep').value;clear('Conditioned history selected. Compute to evaluate.');});
    get('export').addEventListener('click',()=>{
      if(!lastResult)return;
      const blob=new Blob([JSON.stringify(lastResult,null,2)+'\n'],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=element('a');a.href=url;a.download='lung-experiment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    get('case').value='Injury C';fill(caseConfig('Injury C'));compute();
    return {compute,read,fill,clear,getResult:()=>lastResult};
  }
  const api={runScenario,caseConfig,configuration,historyFrom,number,mount};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else {root.LungApp=api;root.addEventListener('DOMContentLoaded',()=>mount(root.document));}
})(typeof window!=='undefined'?window:globalThis);
