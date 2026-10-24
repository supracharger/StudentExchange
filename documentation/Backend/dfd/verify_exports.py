#!/usr/bin/env python3
"""Validate generated exports after render.py (PyMuPDF needed for PDF checks)."""
import json,re,zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
import fitz
from pptx import Presentation
from reportlab.pdfbase.pdfmetrics import stringWidth
import vector_export as v
from validate import check,self_test

BASE=Path(__file__).resolve().parent

def main():
 data=json.loads((BASE/'model.json').read_text());sheets=json.loads((BASE/'sheet-manifest.json').read_text());slides=json.loads((BASE/'slide-model.json').read_text())['slides']
 balances=check(data);negative=self_test(data);v.font_setup()
 pdf=fitz.open(BASE/'StudentExchange-DFD.pdf');ppt=Presentation(BASE/'StudentExchange-DFD.pptx')
 assert len(pdf)==len(ppt.slides)==len(slides)==len(sheets)+6
 assert len(data['graphs'])==18 and len(balances)==17
 for g in data['graphs']:
  ss=[s for s in sheets if s['diagram']==g['id']]
  assert set(g['inside'])=={n for s in ss for n in s['inside']}
  assert {e['id'] for e in g['edges']}=={e for s in ss for e in s['flow_ids']}
 svg_expected={s['id'] for s in slides}|{g['id'] for g in data['graphs']}
 assert {f.stem for f in (BASE/'svg').glob('*.svg')}==svg_expected
 for id in svg_expected:ET.parse(BASE/'svg'/f'{id}.svg')
 objects=0
 for p,ps,model in zip(pdf,ppt.slides,slides):
  assert model['title'] in p.get_text(),model['id']+' missing title'
  assert ps.notes_slide.notes_text_frame.text,model['id']+' missing notes'
  count=sum(len(s['points'])-1 if s['type']=='line' else 1 for s in model['shapes'])
  assert len(ps.shapes)==count,model['id']+' incorrect native-object count'
  objects+=count
  if 'layout_metrics' in model:assert model['layout_metrics']['collision_free_labels']
  for s in model['shapes']:
   if s['type']!='text':continue
   width=stringWidth(s['text'],'DFD-Bold' if s.get('bold') else 'DFD',s['size']);x=s['x']-(width/2 if s['align']=='center' else width if s['align']=='right' else 0)
   assert x>=0 and x+width<=1440 and s['y']>=0 and s['y']+s['size']<=1080,(model['id'],s['text'])
 with zipfile.ZipFile(BASE/'StudentExchange-DFD.pptx') as z:assert not [n for n in z.namelist() if n.startswith('ppt/media/')],'Raster media found'
 for doc in ['README.md','DATA-DICTIONARY.md','PROCESS-SPECS.md','VALIDATION.md']:
  for target in re.findall(r'\]\(([^)]+)\)',(BASE/doc).read_text()):
   # The report is written at the end of this successful verification.
   if target=='export-report.json':continue
   if not target.startswith(('http:','https:','#')):assert (BASE/target).exists(),doc+' broken link: '+target
 report=dict(diagrams=len(data['graphs']),pages=len(pdf),editable_slides=len(ppt.slides),native_editable_objects=objects,svg_files=len(svg_expected),balanced_relationships=len(balances),negative_tests=negative,complete_sheet_coverage=True,no_raster_slides=True,no_page_bound_text_overflows=True,no_flow_label_node_collisions=True)
 (BASE/'export-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

if __name__=='__main__':main()
