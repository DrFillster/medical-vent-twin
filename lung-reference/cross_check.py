"""Strict complete-record Python/JavaScript verification, not clinical validation.

Numerics: abs(a-b) <= max(1e-9, 1e-9*max(abs(a),abs(b))).
Schemas, strings, booleans, nulls, list lengths and relay states match exactly.
Unexpected non-finite numbers fail, including NaN compared with itself.
Requires Python 3.10+ and Node 18+. Does not round before comparing.
"""
from dataclasses import asdict
import copy
import json
import math
from pathlib import Path
import random
import subprocess
import sys
import lung_reference as M

HERE=Path(__file__).resolve().parent
ATOL=RTOL=1e-9

def compare(a,b,path='root',stats=None):
    stats=stats if stats is not None else {'numeric':0,'max_abs':0.0}
    if isinstance(a,bool) or isinstance(b,bool):
        if type(a) is not bool or type(b) is not bool or a!=b:
            raise AssertionError(f'{path}: boolean mismatch {a!r}, {b!r}')
    elif isinstance(a,(int,float)) and isinstance(b,(int,float)):
        if not(math.isfinite(a) and math.isfinite(b)):
            raise AssertionError(f'{path}: non-finite output')
        err=abs(a-b); stats['numeric']+=1
        stats['max_abs']=max(stats['max_abs'],err)
        if err>max(ATOL,RTOL*max(abs(a),abs(b))):
            raise AssertionError(f'{path}: numeric mismatch {a!r}, {b!r}')
    elif isinstance(a,dict) and isinstance(b,dict):
        if set(a)!=set(b):raise AssertionError(f'{path}: key mismatch {set(a)^set(b)}')
        for key in a:compare(a[key],b[key],f'{path}.{key}',stats)
    elif isinstance(a,(list,tuple)) and isinstance(b,(list,tuple)):
        if len(a)!=len(b):raise AssertionError(f'{path}: list length mismatch')
        for i,(x,y) in enumerate(zip(a,b)):compare(x,y,f'{path}[{i}]',stats)
    elif type(a) is not type(b) or a!=b:
        raise AssertionError(f'{path}: mismatch {a!r}, {b!r}')
    return stats

def capture(fn):
    try:return {'ok':True,'data':fn()}
    except ValueError as e:return {'ok':False,'error':str(e)}

def record(req):
    c=req['config'];lung=M.Lung(**c['lung']);vent=M.Vent(**c['vent']);gas=M.Gas(**c['gas'])
    history=c['history'];state=M.empty_state(lung);states=[]
    for p in history:state=M.step_peep(lung,state,p);states.append(list(state))
    hi=M.state_after(lung,[30,15]);lo=M.step_peep(lung,hi,max(5,lung.aop))
    ts=M.state_after(lung,[30]);trial_states=[]
    for p in [20,18,16,14,12,10,8,6,4]:ts=M.step_peep(lung,ts,p);trial_states.append(list(ts))
    return {'snapshot':capture(lambda:M.evaluate(lung,vent,gas,history)),
      'mechanics':capture(lambda:M.mechanics(lung,vent,state,n=req.get('work_n',240),trace=req.get('trace',False))),
      'gas':capture(lambda:M.gas_exchange(lung,vent,state,gas)),
      'ri':capture(lambda:M.ri_analogue(lung,vt=vent.vt)),
      'trial':capture(lambda:M.peep_trial(lung,vent)),
      'states':states,'ri_states':[list(hi),list(lo)],'trial_states':trial_states}

def requests():
    rows=[]
    def add(label,c,**kw):rows.append({'label':label,'config':copy.deepcopy(c),**kw})
    for name,l,v,g in M.illustrative_cases():
        c={'lung':asdict(l),'vent':asdict(v),'gas':asdict(g),'history':[v.peep]}
        add(name+' / snapshot',c,trace=True)
        c['history']=[30,v.peep];add(name+' / conditioned',c,trace=True)
    base=copy.deepcopy(rows[7]['config'])
    for group,key,vals in [('lung','units',[64,128,256,512]),
       ('lung','aop',[0,2,4,6,8,10,12,14,15,16]),
       ('vent','vt',[.20,.28,.36,.42,.50]),
       ('vent','fio2',[.21,.30,.40,.60,.80,1.0])]:
        for val in vals:
            c=copy.deepcopy(base);c[group][key]=val;add(f'{key}={val}',c)
    for n in [60,120,240,480]:add(f'work_n={n}',base,work_n=n)
    rng=random.Random(20260914)
    for i in range(12):
        c=copy.deepcopy(base)
        fn=rng.uniform(.25,.8);fr=rng.uniform(.05,.95-fn)
        c['lung']['tissue']=[fn,fr,1-fn-fr]
        qn=rng.uniform(.25,.8);qr=rng.uniform(.05,.95-qn)
        c['lung']['perfusion']=[qn,qr,1-qn-qr]
        c['lung'].update(aop=rng.uniform(0,8),resistance=rng.uniform(0,20))
        c['vent'].update(peep=rng.uniform(8,18),vt=rng.uniform(.2,.45),fio2=rng.uniform(.3,1))
        c['gas'].update(hb=rng.uniform(8,16),dead_fraction=rng.uniform(.25,.65))
        c['history']=[30,20,c['vent']['peep']]
        add(f'seeded multifactor {i+1}',c)
    return rows

def main():
    # Verify actual JS presets too: passing Python configurations alone would
    # miss a drift in the browser's independently encoded canonical cases.
    preset_cmd="const M=require('./lung.js');console.log(JSON.stringify(M.illustrativeCases().map(c=>({name:c.name,lung:c.lung.cfg,vent:c.vent.cfg,gas:c.gas.cfg,history:[c.vent.cfg.peep]}))))"
    presets_js=json.loads(subprocess.check_output(['node','-e',preset_cmd],cwd=HERE,text=True))
    presets_py=[{'name':name,'lung':asdict(l),'vent':asdict(v),'gas':asdict(g),'history':[v.peep]}
                for name,l,v,g in M.illustrative_cases()]
    preset_stats=compare(presets_py,presets_js,'canonical_presets')
    req=requests()
    p=subprocess.run(['node',str(HERE/'harness.js'),'--batch'],input=json.dumps(req),
      text=True,capture_output=True,cwd=HERE,timeout=180)
    if p.returncode:raise RuntimeError(p.stderr)
    js=json.loads(p.stdout)
    if len(js)!=len(req):raise AssertionError('Batch result count mismatch')
    results=[]
    for r,j in zip(req,js):
        stats=compare(record(r),j,r['label'])
        results.append({'scenario':r['label'],**stats,'pass':True})
        print('PASS',r['label'],flush=True)
    audit_py=HERE/'results/audit.json';audit_js=HERE/'results/audit.js.json'
    audit_stats=None
    if audit_py.exists() and audit_js.exists():
        audit_stats=compare(json.loads(audit_py.read_text()),json.loads(audit_js.read_text()),'audit')
    else:raise AssertionError('Generate both audit JSON files before cross_check.py')
    out={'status':'pass','scenario_count':len(req),'atol':ATOL,'rtol':RTOL,
      'criterion':'abs(a-b) <= max(atol, rtol*max(abs(a),abs(b)))',
      'comparison':'complete records, traces where requested, all trial rows, explicit errors, all relay states',
      'seed':20260914,'cases':results,'complete_audit_comparison':audit_stats}
    out['canonical_preset_comparison']=preset_stats
    (HERE/'results/cross_check.json').write_text(json.dumps(out,indent=2,allow_nan=False)+'\n')
    print(f'PASS: {len(req)} complete scenarios and complete audit records')

if __name__=='__main__':main()
