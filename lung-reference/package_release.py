"""Create a manifest and sibling release ZIP; never edits supplied originals."""
from pathlib import Path
import hashlib
import json
import zipfile
ROOT=Path(__file__).resolve().parent

def included():
    return sorted(p for p in ROOT.rglob('*') if p.is_file()
      and '__pycache__' not in p.parts and not p.name.startswith('.')
      and p.name!='SHA256.json' and p.suffix!='.zip')

def main():
    check=json.loads((ROOT/'results/verification.json').read_text())
    if check['status']!='pass':raise RuntimeError('Verification must pass first')
    for name,expected in check['source_sha256'].items():
        p=ROOT/name
        # paper.html is generated after verification; other code must match.
        if name!='paper.html' and hashlib.sha256(p.read_bytes()).hexdigest()!=expected:
            raise RuntimeError('Verified source changed; rerun verification: '+name)
    required=['index.html','lung.js','lung_reference.py','app.js','style.css',
      'manuscript.pdf','paper.html','manuscript.md','results/benchmark.json',
      'results/cross_check.json','PUBLICATION_CHECKLIST.md','LICENSE_STATUS.md']
    for name in required:
        if not(ROOT/name).is_file():raise RuntimeError('Missing '+name)
    files=included()
    manifest={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    (ROOT/'SHA256.json').write_text(json.dumps(manifest,indent=2)+'\n')
    dest=ROOT.parent/(ROOT.name+'.zip')
    with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
        for p in files+[ROOT/'SHA256.json']:z.write(p,str(Path(ROOT.name)/p.relative_to(ROOT)))
    with zipfile.ZipFile(dest) as z:
        if z.testzip() is not None:raise RuntimeError('ZIP integrity error')
        for name,expected in manifest.items():
            if hashlib.sha256(z.read(ROOT.name+'/'+name)).hexdigest()!=expected:raise RuntimeError('ZIP hash mismatch: '+name)
    print('Created',dest,'with',len(files)+1,'files')

if __name__=='__main__':main()
