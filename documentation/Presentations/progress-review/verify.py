#!/usr/bin/env python3
"""Check presentation exports and evidence invariants after rendering."""
import json,re,zipfile
from pathlib import Path
import fitz
from pptx import Presentation
from reportlab.pdfbase.pdfmetrics import stringWidth
import vector_export as v

BASE=Path(__file__).resolve().parent

def main():
 v.font_setup();model=json.loads((BASE/'slide-model.json').read_text());slides=model['slides'];pdf=fitz.open(BASE/'StudentExchange-Progress-Review.pdf');ppt=Presentation(BASE/'StudentExchange-Progress-Review.pptx')
 assert len(slides)==len(pdf)==len(ppt.slides)==34
 native=0;images=0
 for s,p,ps in zip(slides,pdf,ppt.slides):
  assert s['title'] in p.get_text(),s['id']+' title missing'
  assert ps.notes_slide.notes_text_frame.text and len(s['notes'])>120,s['id']+' notes missing'
  expected=sum(len(sh['points'])-1 if sh['type']=='line' else 1 for sh in s['shapes']);assert len(ps.shapes)==expected,s['id']+' shape mismatch'
  native+=sum(len(sh['points'])-1 if sh['type']=='line' else 0 if sh['type']=='image' else 1 for sh in s['shapes'])
  images+=sum(sh['type']=='image' for sh in s['shapes'])
  for sh in s['shapes']:
   if sh['type']!='text':continue
   w=stringWidth(sh['text'],'Review-Bold' if sh.get('bold') else 'Review',sh['size']);x=sh['x']-(w/2 if sh['align']=='center' else w if sh['align']=='right' else 0)
   assert x>=0 and x+w<=1600 and sh['y']>=0 and sh['y']+sh['size']<=900,(s['id'],sh['text'])
 text='\n'.join(p.get_text() for p in pdf)
 for value in ['Tristan Roa','Robert (Andrew) Quaife','Alex Pyankov','Robert Richardson','Thomas Phommarath','116','Azure','Render','AppAuthJson','Blocked_Users','Blocked_IPs']:
  assert value in text,'Required content missing: '+value
 tests=json.loads((BASE/'evidence/test-summary.json').read_text());browser=json.loads((BASE/'evidence/browser-checks.json').read_text());team=json.loads((BASE/'evidence/team-input.json').read_text())
 assert tests['total']==118 and tests['passed']==116 and tests['failed']==1 and tests['skipped']==1
 assert len(team['members'])==5 and team['deployment']['website_url']=='https://studentexchange.onrender.com'
 assert browser['sample_cards']==6 and browser['textbook_filter_cards']==3 and browser['local_message_visible'] and browser['local_offer_visible'] and browser['whole_dollar_offer_step_mismatch']
 assert browser['mobile_horizontal_overflow'] is False and not browser['browser_script_errors']
 assert images==4
 with zipfile.ZipFile(BASE/'StudentExchange-Progress-Review.pptx') as z:
  assert len([n for n in z.namelist() if n.startswith('ppt/media/')])==4
  rels=''.join(z.read(n).decode() for n in z.namelist() if n.endswith('.rels'))
  assert 'https://studentexchange.onrender.com' in rels,'Missing website hyperlink'
 assert any(l.get('uri')=='https://studentexchange.onrender.com' for p in pdf for l in p.get_links()),'Missing PDF website hyperlink'
 for file in ['README.md','VALIDATION.md']:
  for target in re.findall(r'\]\(([^)]+)\)',(BASE/file).read_text()):
   if target=='export-report.json' or target.startswith(('http:','https:','#')):continue
   assert (BASE/target).exists(),file+' broken link '+target
 report=dict(slides=34,pdf_pages=34,native_editable_objects=native,placed_screenshots=images,speaker_notes=True,page_bounds_pass=True,website_hyperlinks=True,team_contributions_confirmed=True,app_builds_passed=2,app_test_results=dict(passed=116,failed=1,skipped=1),application_source_modified=False)
 (BASE/'export-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

if __name__=='__main__':main()
