#!/usr/bin/env python3
"""Render model.json to vector PDF/SVG and a PowerPoint of editable native shapes.

Requirements: Python 3.10+, reportlab, python-pptx. Optional: pymupdf for previews.
Run: python render.py [--output OUTPUT_DIR] [--previews]
Coordinates use a 1280×720 canvas, with a top-left origin.
"""
import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN

BASE=Path(__file__).resolve().parent
W,H=1280,720

def font_setup():
 root=Path('/usr/share/fonts/truetype/dejavu')
 for name,file in [('UML','DejaVuSans.ttf'),('UML-Bold','DejaVuSans-Bold.ttf'),('UML-Italic','DejaVuSans-Oblique.ttf')]:
  path=root/file
  if not path.exists():raise RuntimeError('Install DejaVu Sans fonts to render the PDF reproducibly.')
  pdfmetrics.registerFont(TTFont(name,str(path)))

def pdf_shape(c,s):
 t=s['type']; stroke=s.get('stroke');fill=s.get('fill')
 c.setLineWidth(1)
 if stroke:c.setStrokeColor(HexColor(stroke))
 if fill:c.setFillColor(HexColor(fill))
 c.setDash([5,4] if s.get('dash') else [])
 if t=='rect':c.roundRect(s['x'],H-s['y']-s['h'],s['w'],s['h'],s.get('r',0),stroke=int(bool(stroke)),fill=int(bool(fill)))
 elif t=='ellipse':c.ellipse(s['x'],H-s['y']-s['h'],s['x']+s['w'],H-s['y'],stroke=int(bool(stroke)),fill=int(bool(fill)))
 elif t in ['line','polygon']:
  p=c.beginPath();p.moveTo(s['points'][0][0],H-s['points'][0][1])
  for x,y in s['points'][1:]:p.lineTo(x,H-y)
  if t=='polygon':p.close()
  else:c.setStrokeColor(HexColor(s['color']));c.setLineWidth(s.get('width',1.5))
  c.drawPath(p,stroke=int(bool(stroke)) if t=='polygon' else 1,fill=int(bool(fill)) if t=='polygon' else 0)
 elif t=='text':
  f='UML-Bold' if s.get('bold') else 'UML-Italic' if s.get('italic') else 'UML'
  c.setFont(f,s['size']);c.setFillColor(HexColor(s['color']))
  fn={'left':c.drawString,'center':c.drawCentredString,'right':c.drawRightString}[s['align']]
  fn(s['x'],H-s['y']-s['size']*.83,s['text'])

def svg_shape(s):
 t=s['type']; st=f'fill="{s.get("fill") or "none"}" stroke="{s.get("stroke") or "none"}" stroke-width="1"'
 if s.get('dash'):st+=' stroke-dasharray="5 4"'
 if t=='rect':return f'<rect x="{s["x"]}" y="{s["y"]}" width="{s["w"]}" height="{s["h"]}" rx="{s.get("r",0)}" {st}/>'
 if t=='ellipse':return f'<ellipse cx="{s["x"]+s["w"]/2}" cy="{s["y"]+s["h"]/2}" rx="{s["w"]/2}" ry="{s["h"]/2}" {st}/>'
 if t in ['line','polygon']:
  points=' '.join(f'{x},{y}' for x,y in s['points'])
  if t=='line':st=f'fill="none" stroke="{s["color"]}" stroke-width="{s.get("width",1.5)}"'+(' stroke-dasharray="5 4"' if s.get('dash') else '')
  return f'<{"polyline" if t=="line" else "polygon"} points="{points}" {st}/>'
 if t=='text':
  anchor={'left':'start','center':'middle','right':'end'}[s['align']]
  return f'<text x="{s["x"]}" y="{s["y"]+s["size"]*.83}" font-family="DejaVu Sans, sans-serif" font-size="{s["size"]}" font-weight="{"bold" if s.get("bold") else "normal"}" font-style="{"italic" if s.get("italic") else "normal"}" fill="{s["color"]}" text-anchor="{anchor}">{escape(s["text"])}</text>'

def color(value):return RGBColor.from_string(value.lstrip('#'))
def unit(v):return Inches(v/96)
def ppt_style(shape,s):
 if s.get('fill'):shape.fill.solid();shape.fill.fore_color.rgb=color(s['fill'])
 else:shape.fill.background()
 if s.get('stroke'):shape.line.color.rgb=color(s['stroke']);shape.line.width=Pt(.75)
 else:shape.line.fill.background()

def ppt_shape(slide,s):
 t=s['type']
 if t in ['rect','ellipse']:
  typ=MSO_SHAPE.OVAL if t=='ellipse' else MSO_SHAPE.ROUNDED_RECTANGLE if s.get('r') else MSO_SHAPE.RECTANGLE
  sh=slide.shapes.add_shape(typ,unit(s['x']),unit(s['y']),unit(s['w']),unit(s['h']));ppt_style(sh,s)
  if t=='rect' and s.get('r'):
   try:sh.adjustments[0]=min(.05,s['r']/max(1,min(s['w'],s['h'])))
   except (ValueError,IndexError):pass
 elif t=='text':
  f='UML-Bold' if s.get('bold') else 'UML'
  width=max(8,pdfmetrics.stringWidth(s['text'],f,s['size'])+12)
  x=s['x']-(width/2 if s['align']=='center' else width if s['align']=='right' else 0)
  sh=slide.shapes.add_textbox(unit(x),unit(s['y']-1),unit(width),unit(s['size']*1.65))
  tf=sh.text_frame;tf.clear();tf.word_wrap=False;tf.margin_left=tf.margin_right=tf.margin_top=tf.margin_bottom=0;tf.vertical_anchor=MSO_ANCHOR.TOP
  p=tf.paragraphs[0];p.alignment={'left':PP_ALIGN.LEFT,'center':PP_ALIGN.CENTER,'right':PP_ALIGN.RIGHT}[s['align']]
  r=p.add_run();r.text=s['text'];r.font.name='DejaVu Sans';r.font.size=Pt(s['size']*.75);r.font.bold=s.get('bold',False);r.font.italic=s.get('italic',False);r.font.color.rgb=color(s['color'])
 elif t=='line':
  from pptx.enum.dml import MSO_LINE_DASH_STYLE
  for a,b in zip(s['points'],s['points'][1:]):
   sh=slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT,unit(a[0]),unit(a[1]),unit(b[0]),unit(b[1]));sh.line.color.rgb=color(s['color']);sh.line.width=Pt(s.get('width',1.5)*.75)
   if s.get('dash'):sh.line.dash_style=MSO_LINE_DASH_STYLE.DASH
 elif t=='polygon':
  pts=s['points'];builder=slide.shapes.build_freeform(round(unit(pts[0][0])),round(unit(pts[0][1])))
  builder.add_line_segments([(round(unit(x)),round(unit(y))) for x,y in pts[1:]],close=True)
  sh=builder.convert_to_shape();ppt_style(sh,s)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=BASE);parser.add_argument('--previews',action='store_true');args=parser.parse_args()
 out=args.output;out.mkdir(parents=True,exist_ok=True);(out/'svg').mkdir(exist_ok=True)
 data=json.loads((BASE/'model.json').read_text());font_setup()
 c=canvas.Canvas(str(out/'StudentExchange-UML.pdf'),pagesize=(W,H),pageCompression=1)
 c.setTitle('Student Exchange — UML Design Atlas');c.setAuthor('Student Exchange design documentation')
 prs=Presentation();prs.slide_width=unit(W);prs.slide_height=unit(H)
 warnings=[]
 for page in data['slides']:
  c.bookmarkPage(page['id']);c.addOutlineEntry(page['id']+' | '+page['title'],page['id'],0)
  sl=prs.slides.add_slide(prs.slide_layouts[6]);sl.notes_slide.notes_text_frame.text=f'{page["id"]} — {page["title"]}\n{page["subtitle"]}\n\n{page["takeaway"]}\n\n{page["source"]}\nSource commit: {data["source_commit"]}'
  svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img">',f'<title>{escape(page["id"]+" | "+page["title"])}</title>',f'<desc>{escape(page["subtitle"]+" "+page["takeaway"])}</desc>']
  for s in page['shapes']:
   pdf_shape(c,s);ppt_shape(sl,s);svg.append(svg_shape(s))
   if s['type']=='text':
    f='UML-Bold' if s.get('bold') else 'UML';w=pdfmetrics.stringWidth(s['text'],f,s['size']);x=s['x']-(w/2 if s['align']=='center' else w if s['align']=='right' else 0)
    if x<0 or x+w>W or s['y']+s['size']>H:warnings.append(f'{page["id"]}: text extends beyond page: {s["text"]}')
  svg.append('</svg>');(out/'svg'/f'{page["id"]}.svg').write_text('\n'.join(svg));c.showPage()
 c.save();prs.save(out/'StudentExchange-UML.pptx')
 if warnings:raise RuntimeError('\n'.join(warnings))
 if args.previews:
  import fitz
  (out/'previews').mkdir(exist_ok=True)
  doc=fitz.open(out/'StudentExchange-UML.pdf')
  for i,p in enumerate(doc):p.get_pixmap(matrix=fitz.Matrix(1,1)).save(out/'previews'/f'{data["slides"][i]["id"]}.png')
 print(f'Rendered {len(data["slides"])} pages, editable PowerPoint slides and SVGs. No page-bound violations.')

if __name__=='__main__':main()
