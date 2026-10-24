#!/usr/bin/env python3
"""Render authored review slides to editable PPTX and searchable PDF."""
import argparse,json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pptx import Presentation
import vector_export as v

BASE=Path(__file__).resolve().parent

def main():
 p=argparse.ArgumentParser();p.add_argument('--previews',action='store_true');a=p.parse_args();v.font_setup()
 d=json.loads((BASE/'slide-model.json').read_text());slides=d['slides']
 pdf=canvas.Canvas(str(BASE/'StudentExchange-Progress-Review.pdf'),pagesize=(1600,900),pageCompression=1);pdf.setTitle('Student Exchange — Technical Progress Review');pdf.setAuthor('Student Exchange project team')
 prs=Presentation();prs.slide_width=v.unit(1600);prs.slide_height=v.unit(900)
 for i,s in enumerate(slides):
  pdf.bookmarkPage(s['id']);pdf.addOutlineEntry(s['id']+' | '+s['title'],s['id'],0)
  sl=prs.slides.add_slide(prs.slide_layouts[6]);sl.notes_slide.notes_text_frame.text=s['notes']+'\n\nEvidence: '+s['source']
  for sh in s['shapes']:
   if sh['type']=='image':
    path=BASE/sh['path'];crop=sh.get('crop')
    if crop:
     left,top,right,bottom=crop;rw=sh['w']/(1-left-right);rh=sh['h']/(1-top-bottom)
     pdf.saveState();clip=pdf.beginPath();clip.rect(sh['x'],900-sh['y']-sh['h'],sh['w'],sh['h']);pdf.clipPath(clip,stroke=0,fill=0)
     pdf.drawImage(ImageReader(path),sh['x']-left*rw,900-sh['y']-sh['h']-bottom*rh,rw,rh,preserveAspectRatio=False,mask='auto');pdf.restoreState()
     pic=sl.shapes.add_picture(str(path),v.unit(sh['x']),v.unit(sh['y']),width=v.unit(sh['w']),height=v.unit(sh['h']));pic.crop_left=left;pic.crop_top=top;pic.crop_right=right;pic.crop_bottom=bottom
    else:
     pdf.drawImage(ImageReader(path),sh['x'],900-sh['y']-sh['h'],sh['w'],sh['h'],preserveAspectRatio=False,mask='auto');sl.shapes.add_picture(str(path),v.unit(sh['x']),v.unit(sh['y']),width=v.unit(sh['w']),height=v.unit(sh['h']))
   else:
    v.pdf_shape(pdf,sh);v.ppt_shape(sl,sh)
    if sh['type']=='text' and 'https://studentexchange.onrender.com' in sh['text']:
     # Keep the deployed website directly accessible from the deck and PDF.
     for run in sl.shapes[-1].text_frame.paragraphs[0].runs:run.hyperlink.address='https://studentexchange.onrender.com'
     size=sh['size'];width=v.pdfmetrics.stringWidth(sh['text'],'Review-Bold' if sh.get('bold') else 'Review',size)
     pdf.linkURL('https://studentexchange.onrender.com',(sh['x'],900-sh['y']-size*1.2,sh['x']+width,900-sh['y']),relative=0,thickness=0)
  pdf.showPage()
 pdf.save();prs.save(BASE/'StudentExchange-Progress-Review.pptx')
 (BASE/'PRESENTER-NOTES.md').write_text('# Presenter notes\n\n'+ '\n\n'.join(f'## {i+1}. {s["title"]}\n\n{s["notes"]}\n\nEvidence: {s["source"]}' for i,s in enumerate(slides))+'\n')
 if a.previews:
  import fitz
  out=BASE/'previews';out.mkdir(exist_ok=True);doc=fitz.open(BASE/'StudentExchange-Progress-Review.pdf')
  for p,s in zip(doc,slides):p.get_pixmap(matrix=fitz.Matrix(.8,.8)).save(out/(s['id']+'.png'))
 print(f'Created {len(slides)} editable slides and vector PDF pages.')

if __name__=='__main__':main()
