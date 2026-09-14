"""Generate manuscript.md, paper.html and manuscript.pdf from verified records.

Build-only dependency: reportlab. Model/application have no external dependencies.
Usage: python build_manuscript.py
"""
from pathlib import Path
import hashlib
import html
import json
import re
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Preformatted, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import reportlab
import lung_reference as M

ROOT=Path(__file__).resolve().parent
def table(headers,rows):
    lines=['| '+' | '.join(headers)+' |','| '+' | '.join(['---']*len(headers))+' |']
    lines += ['| '+' | '.join(map(str,r))+' |' for r in rows]
    return '\n'.join(lines)

def values():
    b=json.loads((ROOT/'results/benchmark.json').read_text())
    a=json.loads((ROOT/'results/audit.json').read_text())
    x=json.loads((ROOT/'results/cross_check.json').read_text())
    v=json.loads((ROOT/'results/verification.json').read_text())
    if v['status']!='pass' or x['status']!='pass':raise RuntimeError('Verification must pass before manuscript generation')
    for p in ROOT.iterdir():
        if p.suffix in ['.py','.js'] and p.name in v['source_sha256']:
            if hashlib.sha256(p.read_bytes()).hexdigest()!=v['source_sha256'][p.name]:
                raise RuntimeError('Verified source changed; rerun verify_release.py: '+p.name)
    pylog=(ROOT/'results/python_tests.txt').read_text()
    jslog=(ROOT/'results/javascript_tests.txt').read_text()
    uilog=(ROOT/'results/ui_tests.txt').read_text()
    py_count=int(re.search(r'Ran (\d+) tests',pylog).group(1))
    js_count=int(re.search(r'passed["\s:=]+(\d+)',jslog).group(1))
    ui=json.loads(uilog.strip().splitlines()[-1])
    summary=(f'{py_count} Python tests, {js_count} JavaScript model tests, '
      f'{ui["passed"]} interface-adapter/input-contract tests, and '
      f'{x["scenario_count"]} complete cross-language scenarios passed.')
    cases=b['cases'];rows=[];params=[];ventparams=[]
    for c in cases:
        o=c['outputs'];r=c['ri'];t=c['peep_trial'];l=c['lung'];ve=c['vent'];g=c['gas']
        rows.append([c['name'],f'{o["pf"]:.1f}',f'{o["pplat"]:.1f}',f'{o["mp_integral_J_min"]:.1f}',f'{o["paco2"]:.1f}',f'{r["ri_signed"]:.3f}',','.join(map(str,t['max_crs_peeps'])),str(t['boundary']).lower()])
        triplet=lambda z:'/'.join(f'{n:.2f}' for n in z)
        params.append([c['name'],triplet(l['tissue']),triplet(l['perfusion']),l['aop'],l['resistance'],g['dead_fraction']])
        ventparams.append([c['name'],f'{ve["vt"]:.3f}',ve['peep'],ve['fio2'],ve['rr']])
    name,l,ve,g=M.illustrative_cases()[-1]
    single=M.evaluate(l,ve,g,[ve.peep]);conditioned=M.evaluate(l,ve,g,[30,ve.peep])
    snap=(f'For Injury C at PEEP {ve.peep} cmH2O, the single-step snapshot gave '
      f'Pplat {single["pplat"]:.2f} cmH2O, MP {single["mp_integral_J_min"]:.2f} J/min '
      f'and P/F {single["pf"]:.1f}. Changing only history to [30, {ve.peep}] gave '
      f'Pplat {conditioned["pplat"]:.2f} cmH2O, MP {conditioned["mp_integral_J_min"]:.2f} J/min '
      f'and P/F {conditioned["pf"]:.1f}; Hb remained 12 g/dL and VCO2 0.200 L/min.')
    power=a['power_resolution'];diff=abs(power[-1]['mp']-power[-2]['mp'])
    powertext=('In that conditioned configuration, 60/120/240/480 work intervals yielded '
      + ' / '.join(f'{r["mp"]:.8f}' for r in power)
      +f' J/min. The absolute 240-to-480 difference was {diff:.3g} J/min. '
      'This is numerical-resolution evidence for this condition, not a clinical accuracy bound.')
    rel=a['relay_resolution'];relaytext=('At 64/128/256/512 relays, the Injury C endpoint index was '
      +' / '.join(f'{r["ri"]["ri_signed"]:.5f}' for r in rel)
      +'. The corresponding sampled compliance-maximum pressures were '
      +' / '.join(','.join(map(str,r['max_crs_peeps'])) for r in rel)+' cmH2O.')
    meta=json.loads((ROOT/'author_metadata.json').read_text())
    def pending(key):return meta.get(key) or 'To be supplied by the author before submission.'
    author=('Author: '+pending('author')+'\n\nAffiliation: '+pending('affiliation')+'\n\nCorrespondence: '+pending('corresponding_email')+' | ORCID: '+pending('orcid')) if meta.get('author') else 'Author, affiliation, correspondence and ORCID: pending owner completion before journal submission.'
    declarations='\n\n'.join('**'+label+':** '+pending(key) for label,key in
      [('Funding','funding_statement'),('Conflicts of interest','conflicts_statement'),('Contributions','contributions_statement')])
    return {'version':M.VERSION,'author_block':author,'test_summary':summary,
      'pf_values':', '.join(f'{c["outputs"]["pf"]:.1f}' for c in cases),
      'plateau_values':', '.join(f'{c["outputs"]["pplat"]:.1f}' for c in cases),
      'parameters_table':table(['Case','Tissue N/R/C','Perfusion N/R/C','AOP','R','VD/VT'],params)+'\n\n'+table(['Case','Vt (L)','PEEP','FiO2','RR'],ventparams),
      'cases_table':table(['Case','P/F','Pplat','MP','PaCO2','R/I*','Max-Crs PEEP','Edge?'],rows),
      'snapshot_comparison':snap,'power_summary':powertext,'relay_summary':relaytext,
      'max_translation_error':f'{max(r["max_abs"] for r in x["cases"]):.3g}',
      'declarations':declarations,'python_sha':hashlib.sha256((ROOT/'lung_reference.py').read_bytes()).hexdigest()}

def blocks(md):
    lines=md.splitlines();i=0
    while i<len(lines):
        s=lines[i]
        if not s.strip():i+=1;continue
        if s.startswith('```'):
            i+=1;chunk=[]
            while i<len(lines) and not lines[i].startswith('```'):chunk.append(lines[i]);i+=1
            yield 'code','\n'.join(chunk);i+=1;continue
        if s.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].startswith('|'):
                cells=[x.strip() for x in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?',c) for c in cells):rows.append(cells)
                i+=1
            yield 'table',rows;continue
        if s.startswith('#'):
            level=len(s)-len(s.lstrip('#'));yield 'h'+str(level),s[level:].strip();i+=1;continue
        chunk=[s];i+=1
        while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','```','|')):
            chunk.append(lines[i]);i+=1
        yield 'p',' '.join(chunk)

def inline(s,pdf=False):
    s=html.escape(s)
    s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'\[([^\]]+)\]\((https://[^)]+)\)',
      (lambda m:f'<link href="{m[2]}" color="#096b68">{m[1]}</link>') if pdf
      else (lambda m:f'<a href="{m[2]}">{m[1]}</a>'),s)
    return s

def render(md):
    items=list(blocks(md));parts=[]
    for kind,val in items:
        if kind=='table':parts.append('<div class="table-wrap"><table><thead><tr>'+''.join('<th>'+inline(c)+'</th>' for c in val[0])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+inline(c)+'</td>' for c in row)+'</tr>' for row in val[1:])+'</tbody></table></div>')
        elif kind=='code':parts.append('<pre>'+html.escape(val)+'</pre>')
        else:parts.append(f'<{kind}>'+inline(val)+f'</{kind}>')
    (ROOT/'paper.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lung Reference - Development and Computational Verification</title><link rel="stylesheet" href="style.css"></head><body><article class="paper"><nav><a href="index.html">Open simulator</a> | <a href="manuscript.pdf">Manuscript PDF</a></nav>'+''.join(parts)+'</article></body></html>')
    # Embed fonts: do not depend on PDF-reader font substitution.
    system=Path('/usr/share/fonts/truetype/dejavu')
    bundled=Path(reportlab.__file__).parent/'fonts'
    font_specs=[('BodySans','DejaVuSans.ttf','Vera.ttf'),('BodySansBold','DejaVuSans-Bold.ttf','VeraBd.ttf'),('CodeMono','DejaVuSansMono.ttf','Vera.ttf')]
    for name,preferred,fallback in font_specs:
        path=system/preferred if (system/preferred).is_file() else bundled/fallback
        pdfmetrics.registerFont(TTFont(name,str(path)))
    pdfmetrics.registerFontFamily('BodySans',normal='BodySans',bold='BodySansBold',italic='BodySans',boldItalic='BodySansBold')
    styles=getSampleStyleSheet()
    styles.add(ParagraphStyle(name='BodyReview',fontName='BodySans',fontSize=9,leading=13.2,spaceAfter=8,allowWidows=0,allowOrphans=0,textColor=colors.HexColor('#173344')))
    styles.add(ParagraphStyle(name='CellReview',fontName='BodySans',fontSize=6.8,leading=9,spaceAfter=0))
    styles.add(ParagraphStyle(name='CodeReview',fontName='CodeMono',fontSize=7.1,leading=10,spaceBefore=5,spaceAfter=10))
    styles['Title'].fontName='BodySansBold';styles['Title'].fontSize=19;styles['Title'].leading=25;styles['Title'].alignment=TA_LEFT
    for h in ['Heading1','Heading2']:
        styles[h].fontName='BodySansBold';styles[h].textColor=colors.HexColor('#096b68');styles[h].spaceBefore=13;styles[h].spaceAfter=7;styles[h].keepWithNext=True
    flow=[]
    for kind,val in items:
        if kind=='table':
            rows=[[Paragraph(inline(c,True),styles['CellReview']) for c in row] for row in val]
            widths=[516/len(val[0])]*len(val[0])
            t=Table(rows,colWidths=widths,repeatRows=1,hAlign='LEFT')
            t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e4efee')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#cbd9de')),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
            flow.append(KeepTogether([t,Spacer(1,10)]))
        elif kind=='code':flow.append(KeepTogether([Preformatted(val,styles['CodeReview'])]))
        else:
            sty=styles['Title'] if kind=='h1' else styles['Heading1'] if kind=='h2' else styles['Heading2'] if kind=='h3' else styles['BodyReview']
            flow.append(Paragraph(inline(val,True),sty))
    def page(canvas,doc):
        canvas.saveState();canvas.setFillColor(colors.HexColor('#526875'));canvas.setFont('BodySans',7)
        canvas.drawString(48,766,'LUNG REFERENCE / '+M.VERSION+' / DEVELOPMENT REPORT')
        canvas.drawString(48,27,'Computational verification only. Not for clinical decisions.')
        canvas.drawRightString(564,27,str(doc.page));canvas.restoreState()
    doc=SimpleDocTemplate(str(ROOT/'manuscript.pdf'),pagesize=(612,792),rightMargin=48,leftMargin=48,topMargin=46,bottomMargin=45,title='A Browser-Based Three-Compartment Lung Simulator: Development and Computational Verification',author='Author details pending')
    doc.build(flow,onFirstPage=page,onLaterPages=page)

def main():
    md=(ROOT/'manuscript_template.md').read_text()
    for key,val in values().items():md=md.replace('{{'+key+'}}',val)
    if re.search(r'\{\{[^}]+\}\}',md):raise RuntimeError('Unresolved manuscript variable')
    (ROOT/'manuscript.md').write_text(md)
    render(md)
    print('Generated manuscript.md, paper.html and manuscript.pdf')

if __name__=='__main__':main()
