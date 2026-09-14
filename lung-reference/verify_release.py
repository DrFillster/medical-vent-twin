"""Regenerate all records and fail if any verification command fails.

Run from any directory: python /path/to/verify_release.py
Writes only this release's results directory. No network requests.
"""
from pathlib import Path
import hashlib
import json
import platform
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parent
def main():
    results=ROOT/'results';results.mkdir(exist_ok=True)
    commands=[
      ('python_tests',[sys.executable,'-m','unittest','-v','test_lung_reference.py','test_release.py']),
      ('javascript_tests',['node','test_lung_reference.js']),
      ('ui_tests',['node','test_ui.js']),
      ('benchmark',[sys.executable,'lung_reference.py','--out','results']),
      ('audit_python',[sys.executable,'audit_reference.py']),
      ('audit_javascript',['node','audit_lung_reference.js']),
      ('cross_check',[sys.executable,'cross_check.py']),
      ('cli',['node','harness.js','--case','Injury C']),
    ]
    rows=[]
    for name,args in commands:
        start=time.monotonic()
        p=subprocess.run(args,cwd=ROOT,capture_output=True,text=True,timeout=240)
        (results/(name+'.txt')).write_text(p.stdout+p.stderr)
        rows.append({'name':name,'command':args,'exit_code':p.returncode,
                     'seconds':round(time.monotonic()-start,3)})
        print(name,'PASS' if p.returncode==0 else 'FAIL',flush=True)
        if p.returncode:
            print(p.stdout+p.stderr);break
    ok=len(rows)==len(commands) and all(r['exit_code']==0 for r in rows)
    metadata={'status':'pass' if ok else 'fail','python':platform.python_version(),
      'node':subprocess.check_output(['node','--version'],text=True).strip(),
      'commands':rows,'browser_rendering_tested':False,
      'ui_test_scope':'In-memory DOM adapter tests; not real-browser rendering or download checks',
      'source_sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest()
                       for p in ROOT.iterdir() if p.suffix in ['.py','.js','.html','.css']}}
    (results/'verification.json').write_text(json.dumps(metadata,indent=2)+'\n')
    if not ok:sys.exit(1)

if __name__=='__main__':main()
