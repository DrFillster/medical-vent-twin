"""Read-only native extraction and elapsed-time comparison; artifact writes only here."""
import pathlib,re,html,json,csv,hashlib,subprocess,math,collections
OUT=pathlib.Path(__file__).resolve().parent
ROOT=OUT.parents[2]
def dump(name,value): (OUT/name).write_text(json.dumps(value,indent=2,allow_nan=False)+'\n')
def parse(name):
    text=(OUT/name).read_text()
    return {html.unescape(n.strip()):[float(x) for x in re.findall(r'<val>\s*(.*?)\s*</val>',b,re.S)] for n,b in re.findall(r'<var>\s*<name>(.*?)</name>(.*?)</var>',text,re.S)}
v=parse('native-step139.SOLN'); fresh=parse('native-fresh-challenge.SOLN'); clock=v['System.X']; origin=fresh['System.X'][-1]; n=len(clock)
unequal={k:{'valueCount':len(a),'clockCount':n,'values':a,'alignment':'unassigned: no variable-specific clock supplied; no padding, truncation, or assumed offset'} for k,a in v.items() if len(a)!=n}
assert len(v)==5156 and n==157 and len(unequal)==14
assert all(len(a)==158 for a in [x['values'] for x in unequal.values()])
M={'hrPerMin':'Heart-Rate.Rate','sourceSaNodeHrPerMin':'SANode-Rate.Rate','mapMmHg':'SystemicArtys.Pressure','cardiacOutputMlPerMin':'CardiacOutput.Flow','arterialO2ContentMlPerMl':'O2Artys.[O2]','pao2MmHg':'PO2Artys.Pressure','paco2MmHg':'CO2Artys.Pressure','pH':'BloodPh.ArtysPh','hematocritFraction':'BloodVol.Hct','totalHgbGPerMl':'HgbConc.[Total]','oxygenCapacityMlPerMl':'HgbConc.[O2Max]','chemoreceptorFiringRate':'Chemoreceptors.FiringRate','chemoreceptorBasicFiringRate':'Chemoreceptors.BasicFiringRate','chemoreceptorPo2Effect':'Chemoreceptors.PO2Effect','chemoreceptorPhEffect':'Chemoreceptors.PhEffect','sympsCnsReflexNa':'SympsCNS.ReflexNA','sympsCnsNa':'SympsCNS.NA','sympsCnsHz':'SympsCNS.NA(Hz)','gangliaHz':'GangliaGeneral.NA(Hz)','vagusHz':'VagusNerve.NA(Hz)','betaPoolEffect':'BetaPool.Effect','saBetaActivity':'SANode-BetaReceptors.Activity','parasympatheticEffectPerMin':'SANode-Rate.ParasympatheticEffect','sympatheticEffectPerMin':'SANode-Rate.SympatheticEffect','brainBloodFlowMlPerMin':'Brain-Flow.BloodFlow','brainPo2MmHg':'Brain-Flow.PO2','brainFunctionEffect':'Brain-Function.Effect'}
assert all(k in v and len(v[k])==n for k in M.values()), [k for k in M.values() if k not in v]
rows=[]
for i,t in enumerate(clock):
    r={'sampleIndex':i,'nativeTimeMin':t,'nativeTimeSec':t*60,'elapsedSinceChallengeBaselineSec':(t-origin)*60}
    r.update({k:v[s][i] for k,s in M.items()});r['oxygenDeliveryMlPerMin']=r['cardiacOutputMlPerMin']*r['arterialO2ContentMlPerMl'];rows.append(r)
dump('run07-native-allvariables-numeric.json',{'source':'native-step139.SOLN','sourceSha256':hashlib.sha256((OUT/'native-step139.SOLN').read_bytes()).hexdigest(),'clockVariable':'System.X','clockUnit':'minutes','variables':v,'unequalLengthVariables':unequal})
dump('run07-native-chain-trace.json',{'variableMap':M,'oxygenDeliveryFormula':'CardiacOutput.Flow * O2Artys.[O2] (mL/min * mL O2/mL blood = mL O2/min)','baselineTimeMin':origin,'baselineTimeSec':origin*60,'baselineHr':fresh['Heart-Rate.Rate'][-1],'clockSampleCount':n,'duplicateClockSamplesRetained':sum(clock[i]==clock[i-1] for i in range(1,n)),'unequalLengthVariables':unequal,'rows':rows})
with (OUT/'run07-native-chain-trace.csv').open('w') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
# Nearest sampled elapsed times, no interpolation or extrapolation. Include baseline duplicates.
aligned=[]
traces={label:json.loads((OUT/f'run07-{label}-trace.json').read_text()) for label in ['reduced-source','browser-bundle']}
for nr in rows:
    if nr['elapsedSinceChallengeBaselineSec'] < -1e-9: continue
    pair={'native':nr,'matches':{}}
    for label,trace in traces.items():
        candidates=[trace['initialized']]+trace['rows']; t0=trace['initialized']['tSec']
        br=min(candidates,key=lambda r:abs((r['tSec']-t0)-nr['elapsedSinceChallengeBaselineSec']))
        err=br['tSec']-t0-nr['elapsedSinceChallengeBaselineSec']; assert abs(err)<.001
        delta={k:br[k]-nr[k] for k in M if isinstance(br.get(k),(int,float))}
        if br.get('oxygenDeliveryMlPerMin') is not None:delta['oxygenDeliveryMlPerMin']=br['oxygenDeliveryMlPerMin']-nr['oxygenDeliveryMlPerMin']
        pair['matches'][label]={'snapshot':br,'elapsedSinceInterventionRequestSec':br['tSec']-t0,'timeResidualSec':err,'deltaVsNative':delta}
    aligned.append(pair)
dump('run07-time-aligned-comparison.json',{'method':'Native elapsed = (System.X - last native-fresh-challenge System.X)*60. Browser/reduced elapsed = snapshot.timeSec - initialized.timeSec. Nearest real one-second snapshot, residual <1ms; no interpolation, no extrapolation, no final-versus-peak comparison.','limitations':['Native baseline already has challenge controls set; browser/reduced change request applies at its next mechanical breath boundary, reported pending until then.','Native starts at 9.999996 sec; reduced/bundle initialize at 1 sec, not the same patient baseline. Absolute clocks retained.','Bundle is the unchanged shipped web/engine.js executed in a Node VM; this is not a real-browser UI test.','Native CO0 with nonzero brain flow/PO2 and SA node rate are preserved as exported; not asserted mutually self-consistent.','Unknown/null diagnostics remain null, never substituted from source into bundle.','Observed associations/deltas do not establish first causal divergence.','Native is partial through 2.483324 min, not complete at intended 180 sec. User reported advance144 autopsy error undefined RightHeartInfarction.Area%.'], 'pairs':aligned})
with (OUT/'run07-time-aligned-comparison.csv').open('w') as f:
    flat=[]
    for p in aligned:
        r={**{'native_'+k:val for k,val in p['native'].items()}}
        for label,m in p['matches'].items():
            r.update({label+'_'+k:val for k,val in m['snapshot'].items() if not isinstance(val,(dict,list))});r[label+'_elapsedSec']=m['elapsedSinceInterventionRequestSec'];r[label+'_timeResidualSec']=m['timeResidualSec']
        flat.append(r)
    w=csv.DictWriter(f,fieldnames=list(flat[0]));w.writeheader();w.writerows(flat)
first_zero=next((r for r in rows if r['hrPerMin']==0),None)
summary={'verifiedGitHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'nativeVariableCount':len(v),'nativeClockSamples':n,'unequalTimerCount':len(unequal),'alignedPairCount':len(aligned),'nativeBaseline':rows[17],'firstObservedZeroHrSample':first_zero,'nativeEndpoint':rows[-1],'endpointAlignedPair':aligned[-1],'sourceAndBundleProbeTests':json.loads((OUT/'run07-browser-probe-tests.json').read_text()),'nativeChallengeEndpoint':{k:v[k][-1] for k in ['Ventilator.Switch','Ventilator.Rate','Ventilator.TidalVolume','AirSupply-GasTanks.Switch','AirSupply-GasTanks.O2(%)','AirSupply-GasTanks.N2(%)']}}
assert summary['verifiedGitHead']=='7ab9cd7818ba4705b71c4082040add0ceb57ac59'
assert summary['nativeBaseline']['hrPerMin']==71.6791447478653
assert rows[-1]['nativeTimeMin']==2.483324 and rows[-1]['hrPerMin']==0 and rows[-1]['oxygenDeliveryMlPerMin']==0
assert len(aligned)==146
summary['extractionAlignmentTestsPassed']=True
dump('run07-independent-comparison-summary.json',summary)
report=f'''# Run07 independent native / source / shipped bundle comparison

Partial native export: {n} clock samples, {len(v)} variables, {len(unequal)} timer arrays with 158 values against 157 clock samples. Full numeric arrays retained, mismatched arrays explicitly unassigned. No physiological/model files changed.

Native challenge baseline at {origin*60:.6f} sec: HR {rows[17]['hrPerMin']:.12f}/min. Endpoint {rows[-1]['nativeTimeSec']:.6f} sec absolute, {rows[-1]['elapsedSinceChallengeBaselineSec']:.6f} sec elapsed: HR 0, CO 0, CaO2 {rows[-1]['arterialO2ContentMlPerMl']:.12f} mL/mL, convective DO2 0 mL/min. First sampled HR0 at {first_zero['nativeTimeSec']:.6f} sec absolute; not a proven causal transition time.

{len(aligned)} genuine elapsed-time matched pairs (duplicate native baseline clocks retained); nearest 1-second samples, residual <1ms, no extrapolation or final-vs-peak relabeling. Reduced and bundle initialized clocks are 1 sec and native baseline is ~10 sec. Native challenge is already set at baseline; reduced/bundle mechanically defer intervention until next breath. This is shared FiO2 .20 / RR4 / VT .10L, not identical full-model conditions.

Source and shipped bundle are NOT equivalent: at elapsed180 source HR {traces['reduced-source']['rows'][-1]['hrPerMin']:.12f}, bundle HR {traces['browser-bundle']['rows'][-1]['hrPerMin']:.12f}. Bundle lacks exposed convective DO2, CaO2, chemoreceptor, brain PO2/function diagnostics; these remain null. Both default snapshots lack Hct/Hgb/brain-flow diagnostics; source capacity is its fixed .201mL/mL boundary, unlike native exported Hct/Hgb/capacity. Bundle was executed in Node VM, not browser UI. Do not use reduced-source output as browser output.

Native has PaCO2 {rows[-1]['paco2MmHg']:.12f} / pH {rows[-1]['pH']:.12f} at endpoint while reduced/bundle develop hypercapnia/acidemia; the shared settings do not guarantee an equivalent challenge path. Native CO0 but nonzero brain flow/PO2/SA-node rate is retained without repair. No first causal divergence claim.

Verification: JS executions/assertions and Python parsing/formula/alignment/count/HEAD assertions passed. Parent owns manifest/status/postprocess; those files untouched. Native completion beyond this export remains blocked by reported advance144 autopsy failure undefined RightHeartInfarction.Area%.
'''
(OUT/'run07-independent-comparison.md').write_text(report)
print(json.dumps({'passed':True,'alignedPairs':len(aligned),'nativeEndpoint':rows[-1],'firstZeroHr':first_zero,'endpointReduced':aligned[-1]['matches']['reduced-source']['snapshot'],'endpointBrowser':aligned[-1]['matches']['browser-bundle']['snapshot']},indent=2))
