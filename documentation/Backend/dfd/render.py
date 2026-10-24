#!/usr/bin/env python3
"""Lay out semantic DFDs and export PDF/SVG/native editable PowerPoint.

Requires Graphviz (`dot`), DejaVu Sans, reportlab and python-pptx.
Run build_model.py, validate.py, then render.py [--previews].
"""
import argparse,csv,json,math,os,subprocess,textwrap
from collections import defaultdict
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from pptx import Presentation
import vector_export as v
from validate import check

BASE=Path(__file__).resolve().parent
W,H=1440,1080
NAVY='#103B64';INK='#17354C';BLUE='#E7F2FC';GREEN='#E8F5EC';YELLOW='#FFF4D3';PURPLE='#EEEAF7';GRAY='#64798C';BORDER='#87A5BC';RED='#FCEAE6';WHITE='#FFFFFF'

class Page:
 def __init__(self,id,title,subtitle,note,source):
  self.d=dict(id=id,title=title,subtitle=subtitle,takeaway=note,source=source,shapes=[])
  self.rect(0,0,W,H,'#FAFCFD',None);self.rect(0,0,W,123,NAVY,None)
  self.text(45,19,'STUDENT EXCHANGE   /   DATA FLOW DIAGRAMMING   /   '+id,12,'#A5DCF1',True)
  self.text(45,55,title,31,WHITE,True)
  self.wrap(45,141,subtitle,1340,16,22,GRAY)
  self.rect(43,964,1354,64,YELLOW,None,6)
  self.wrap(59,978,note,1320,15,22,INK,True)
  self.wrap(45,1047,source,1270,11,15,GRAY)
 def add(self,type,**kw):self.d['shapes'].append(dict(type=type,**kw))
 def rect(self,x,y,w,h,fill=WHITE,stroke=BORDER,r=0):self.add('rect',x=x,y=y,w=w,h=h,fill=fill,stroke=stroke,r=r)
 def line(self,points,color=BORDER,width=1.5,dash=False):self.add('line',points=points,color=color,width=width,dash=dash)
 def polygon(self,points,fill=INK,stroke=None):self.add('polygon',points=points,fill=fill,stroke=stroke)
 def text(self,x,y,text,size=16,color=INK,bold=False,align='left'):
  self.add('text',x=x,y=y,text=text,size=size,color=color,bold=bold,align=align)
 def wrap(self,x,y,text,width,size=16,gap=24,color=INK,bold=False,align='left'):
  lines=[];part='';font='DFD-Bold' if bold else 'DFD'
  for word in text.split():
   cand=(part+' '+word).strip()
   if pdfmetrics.stringWidth(cand,font,size)>width and part:lines.append(part);part=word
   else:part=cand
  if part:lines.append(part)
  for i,t in enumerate(lines):self.text(x,y+i*gap,t,size,color,bold,align)
  return len(lines)*gap

def graph_edges(g):
 # Merge parallel arrows with the same endpoints for layout only. The semantic
 # model and CSV retain every original flow ID and element.
 result={}
 for e in g['edges']:
  key=(e['source'],e['target'])
  if key not in result:result[key]=dict(e)
  else:
   r=result[key];r['atoms']=list(dict.fromkeys(r['atoms']+e['atoms']));r['id']+=','+e['id']
   if r['label']!=e['label']:
    labels=[a['label'] for a in [r,e]]
    r['label']=' / '.join(labels) if len(' / '.join(labels))<66 else 'Composite record data'
 return list(result.values())

def layout(g,data,out):
 ns=data['nodes'];edges=graph_edges(g);inside=set(g['inside']);used=sorted({x for e in edges for x in [e['source'],e['target']]})
 # Rank constraints give the reference's entity → numbered process → store
 # structure; opposite directional arrows retain their own labels and heads.
 left=[n for n in used if n not in inside and ns[n]['kind']!='store' and n!='4.0'];right=[n for n in used if ns[n]['kind']=='store' or (n=='4.0' and n not in inside)]
 dot=['digraph DFD {','graph [rankdir=LR, bgcolor="transparent", splines=polyline, nodesep=0.42, ranksep=1.4, pad=0.12, outputorder=edgesfirst];','node [shape=box, fontname="DejaVu Sans", fontsize=19, margin="0.15,0.12"];','edge [fontname="DejaVu Sans", fontsize=16, arrowsize=0.75, penwidth=1.25, color="#276A96"];']
 for n in used:
  nd=ns[n];label=n+'\n'+'\n'.join(textwrap.wrap(nd['name'],22));width=3.0 if nd['kind']=='store' else 2.7;height=.84 if nd['kind']=='store' else 1.12
  dot.append(json.dumps(n)+' [label='+json.dumps(label)+f',width={width},height={height}];')
 if left:dot.append('{rank=same; '+';'.join(json.dumps(n) for n in left)+';}')
 dot.append('{rank=same; '+';'.join(json.dumps(n) for n in g['inside'])+';}')
 if right:dot.append('{rank=same; '+';'.join(json.dumps(n) for n in right)+';}')
 # Stable order helps comparisons and places processes in numeric order.
 for group in [left,g['inside'],right]:
  for a,b in zip(group,group[1:]):dot.append(json.dumps(a)+' -> '+json.dumps(b)+' [style=invis,weight=30];')
 if left:dot.append(json.dumps(left[0])+' -> '+json.dumps(g['inside'][0])+' [style=invis,weight=100];')
 if right:dot.append(json.dumps(g['inside'][0])+' -> '+json.dumps(right[0])+' [style=invis,weight=100];')
 for i,e in enumerate(edges):
  label='\n'.join(textwrap.wrap(e['label'],24))
  dot.append(json.dumps(e['source'])+' -> '+json.dumps(e['target'])+' [label='+json.dumps(label)+',constraint=false,id='+json.dumps('edge'+str(i))+'];')
 dot.append('}');src='\n'.join(dot)
 if len(inside)==1:src=src.replace('nodesep=0.42','nodesep=0.2')
 (out/'dot'/f'{g["id"]}.dot').write_text(src)
 env=dict(os.environ);env['XDG_CACHE_HOME']=str(out/'previews'/'.cache');Path(env['XDG_CACHE_HOME']).mkdir(parents=True,exist_ok=True)
 r=subprocess.run(['dot','-Tjson'],input=src,text=True,capture_output=True,check=True,env=env)
 return json.loads(r.stdout)

def bezier_polyline(points):
 if len(points)<4:return points
 result=[points[0]]
 for i in range(1,len(points)-2,3):
  a=result[-1];b,c,d=points[i:i+3]
  for k in range(1,13):
   t=k/12;u=1-t;result.append([u*u*u*a[j]+3*u*u*t*b[j]+3*u*t*t*c[j]+t*t*t*d[j] for j in [0,1]])
 # Graphviz encodes straight polyline segments as collinear cubic points.
 # Collapse those samples so PowerPoint retains a manageable number of lines.
 simple=[]
 for q in result:
  while len(simple)>=2:
   a,b=simple[-2:];cross=(b[0]-a[0])*(q[1]-b[1])-(b[1]-a[1])*(q[0]-b[0])
   forward=(b[0]-a[0])*(q[0]-b[0])+(b[1]-a[1])*(q[1]-b[1])
   if abs(cross)<1e-5 and forward>=0:simple.pop()
   else:break
  simple.append(q)
 return simple

def render_graph(g,data,out):
 p=Page(g['id'],g['title'],g['level']+' • '+g['scope'],g['note'],'Evidence: '+g['source'])
 j=layout(g,data,out);bb=[float(x) for x in j['bb'].split(',')];gw,gh=bb[2]-bb[0],bb[3]-bb[1]
 scale=min(1338/gw,735/gh,1.65);ox=(W-gw*scale)/2;oy=202+(735-gh*scale)/2
 def pt(q):return [ox+(q[0]-bb[0])*scale,oy+(bb[3]-q[1])*scale]
 # Draw edges behind symbols, using Graphviz's exact label positions.
 minfont=999;edge_labels=[];objects={o['_gvid']:o for o in j.get('objects',[]) if '_gvid' in o}
 for e in j.get('edges',[]):
  if e.get('style')=='invis':continue
  for cmd in e.get('_draw_',[]):
   if cmd['op'] in ['b','B','L']:
    pts=bezier_polyline(cmd['points']) if cmd['op'] in ['b','B'] else cmd['points'];p.line([pt(q) for q in pts],'#276A96',max(1.0,1.3*scale))
  for cmd in e.get('_hdraw_',[]):
   if cmd['op'] in ['P','p']:p.polygon([pt(q) for q in cmd['points']],'#276A96')
  fs=16*scale;label=[]
  for cmd in e.get('_ldraw_',[]):
   if cmd['op']=='F':fs=cmd['size']*scale
   elif cmd['op']=='T':
    x,y=pt(cmd['pt']);label.append(dict(x=x,y=y-fs*.83,text=cmd['text'],size=fs,align={'c':'center','l':'left','r':'right'}[cmd['align']]));minfont=min(minfont,fs)
  if label:
   a,b=objects.get(e.get('tail'),{}),objects.get(e.get('head'),{})
   if a.get('name') in g['inside'] and b.get('name') in g['inside'] and a.get('pos','').split(',')[0]==b.get('pos','').split(',')[0] and any(q['source']==b.get('name') and q['target']==a.get('name') for q in g['edges']):
    width=max(pdfmetrics.stringWidth(t['text'],'DFD',t['size']) for t in label)
    sign=-1 if g['inside'].index(a['name'])<g['inside'].index(b['name']) else 1
    for t in label:t['x']+=sign*(width/2+14*scale)
   edge_labels.append(label)
 # Render labels after all edge strokes, with small white halos. Reject node
 # and label collisions by moving a label group into a nearby free position.
 obstacles=[]
 for nd in j.get('objects',[]):
  if 'pos' not in nd:continue
  cx,cy=pt([float(x) for x in nd['pos'].split(',')]);ww=float(nd['width'])*72*scale;hh=float(nd['height'])*72*scale
  obstacles.append((cx-ww/2-2,cy-hh/2-2,cx+ww/2+2,cy+hh/2+2))
 def bounds(t,dx=0,dy=0):
  ww=pdfmetrics.stringWidth(t['text'],'DFD',t['size']);xx=t['x']-(ww/2 if t['align']=='center' else ww if t['align']=='right' else 0)
  return (xx+dx-2,t['y']+dy-2,xx+dx+ww+2,t['y']+dy+t['size']*1.08)
 def intersects(a,b):return a[0]<b[2] and a[2]>b[0] and a[1]<b[3] and a[3]>b[1]
 placed=[];moves=[]
 for label in edge_labels:
  choices=sorted([(dx,dy) for dx in [0,-14,14,-28,28,-45,45,-70,70,-100,100] for dy in [0,-12,12,-24,24,-38,38,-55,55,-75,75]],key=lambda z:abs(z[0])*1.5+abs(z[1]))
  selected=None
  for dx,dy in choices:
   boxes=[bounds(t,dx,dy) for t in label]
   if all(b[0]>=43 and b[2]<=1397 and b[1]>=195 and b[3]<=947 and not any(intersects(b,o) for o in obstacles+placed) for b in boxes):selected=(dx,dy,boxes);break
  if selected is None:raise RuntimeError(g['id']+': no collision-free label position: '+str(label))
  dx,dy,boxes=selected;placed.extend(boxes);moves.append((dx,dy))
  for t,b in zip(label,boxes):
   p.rect(b[0],b[1],b[2]-b[0],b[3]-b[1],WHITE,None)
   p.text(t['x']+dx,t['y']+dy,t['text'],t['size'],INK,False,t['align'])
 for nd in j.get('objects',[]):
  if 'pos' not in nd:continue
  n=data['nodes'][nd['name']];cx,cy=pt([float(x) for x in nd['pos'].split(',')]);w=float(nd['width'])*72*scale;h=float(nd['height'])*72*scale;x=cx-w/2;y=cy-h/2;fs=19*scale
  fill=GREEN if n['kind']=='external' else YELLOW if n['kind']=='store' else BLUE
  if n.get('status')=='incomplete':fill=RED
  context=n['kind']=='process' and nd['name'] not in g['inside']
  if context:fill=PURPLE
  if n['kind']=='store':
   p.rect(x,y,w,h,fill,None);p.line([[x+w,y],[x,y],[x,y+h],[x+w,y+h]],BORDER,max(1,1.2*scale));p.line([[x+40*scale,y],[x+40*scale,y+h]],BORDER)
   p.text(x+20*scale,cy-fs*.5,n['id'],fs*.83,INK,True,'center')
   ls=textwrap.wrap(n['name'],19);sfs=fs*.9
   while any(pdfmetrics.stringWidth(t,'DFD',sfs)>w-49*scale for t in ls):sfs*=.97
   ty=cy-len(ls)*sfs*.61
   for i,t in enumerate(ls):p.text(x+40*scale+(w-40*scale)/2,ty+i*sfs*1.22,t,sfs,INK,False,'center')
  elif n['kind']=='process':
   p.rect(x,y,w,h,fill,BORDER,9*scale);p.line([[x,y+27*scale],[x+w,y+27*scale]],BORDER)
   p.text(cx,y+7*scale,n['id']+(' · context' if context else ''),fs*.82,GRAY,True,'center')
   ls=textwrap.wrap(n['name'],22)
   while any(pdfmetrics.stringWidth(t,'DFD-Bold',fs)>w-12*scale for t in ls):fs*=.97
   ty=y+27*scale+(h-27*scale-len(ls)*fs*1.22)/2
   for i,t in enumerate(ls):p.text(cx,ty+i*fs*1.22,t,fs,INK,True,'center')
  else:
   p.rect(x,y,w,h,fill,BORDER);ls=textwrap.wrap(n['name'],22);ty=cy-(len(ls)*fs*1.22+fs*.85)/2
   p.text(cx,ty,n['id'],fs*.8,GRAY,True,'center')
   for i,t in enumerate(ls):p.text(cx,ty+fs*1.1+i*fs*1.22,t,fs,INK,True,'center')
  minfont=min(minfont,fs*.8)
 p.d['layout_metrics']=dict(scale=scale,minimum_diagram_font=round(minfont,2),graph_width=gw,graph_height=gh,collision_free_labels=True,adjusted_label_groups=sum(dx!=0 or dy!=0 for dx,dy in moves))
 return p

def support_pages(data,balances):
 pages=[]
 p=Page('COVER','Student Exchange | DFD design atlas','Logical context, Level-0 and balanced lower-level views • website + adapter + API','18 discrete DFDs, 17 checked decomposition relationships and a full data dictionary.','Source commit: '+data['source_commit']+' | Reference: DFD (1).pdf, 32 pages')
 p.text(65,233,'Follow the data, one boundary at a time.',34,INK,True)
 p.wrap(65,303,'Prepared from the supplied PowerPoint design and the implemented Student Exchange website and backend. The model separates browser previews, server-owned identity data, persistent records and the independent listing API.',1280,22,34)
 for y,title,body,c in [(457,'01 / Context and decomposition','A single context process expands into six major processes, then focused account, administration, access and maintenance views.',BLUE),(606,'02 / Exact boundary accounting','Named data packages are preserved across every parent/child boundary. Composite flows split without adding or losing information.',GREEN),(755,'03 / Editable and reproducible','Native editable PowerPoint objects, searchable vector PDF, separate SVGs, semantic JSON, Graphviz sources and automated structural checks.',PURPLE)]:
  p.rect(65,y,1310,119,c,None,5);p.text(84,y+17,title,21,INK,True);p.wrap(84,y+54,body,1260,18,28)
 pages.append(p)
 p=Page('GUIDE','Diagram index and reading path','The context uses process 0; Level-0 uses 1.0–6.0; child numbers identify their parent.','Use the focused child views to inspect details. Numbering identifies decomposition, not execution order.','Reference: DFD (1).pdf, pp. 6–9 and 15–23; README.md includes the complete index.')
 for i,g in enumerate(data['graphs']):
  col=i//9;row=i%9;x=49+col*695;y=207+row*78
  p.rect(x,y,655,64,BLUE if not g['parent'] else GREEN if g['level']=='Level-1' else PURPLE,None,4)
  p.text(x+12,y+11,g['id'],14,GRAY,True);p.wrap(x+87,y+10,g['title'].split(' | ')[-1],550,17,24,INK,True);p.text(x+87,y+40,g['level']+(' · parent '+g['process'] if g['process'] else ''),12,GRAY)
 pages.append(p)
 p=Page('NOTATION','Four symbols, one consistent notation','Gane–Sarson style follows the reference: numbered rounded processes, entities, open-ended stores and arrows.','Arrows carry noun-phrase data; they do not represent time, control, decisions, API call order or lifecycle transitions.','Reference: DFD (1).pdf, pp. 2–5, 10–14 and 24–29.')
 rows=[(212,'External entity',GREEN,'A person or outside system supplying or receiving data. Only E1, E2 and E3 are external to this whole-system model.'),(381,'Numbered process',BLUE,'A verb phrase describes a transformation. Each internal process has data input and output. Parent numbers expand into child numbers.'),(550,'Data store',YELLOW,'A noun phrase names retained data. D1/D2 are browser preview records; D11/D12/D15 are process memory; SQLite stores are separate.'),(719,'Directed data flow',PURPLE,'One arrow has one direction. Separate arrows represent reads and writes. Named composite packages are defined in the data dictionary.')]
 for y,title,c,body in rows:
  p.rect(368,y,1005,135,c,None,5);p.text(388,y+14,title,21,INK,True);p.wrap(388,y+51,body,965,18,27)
  if title=='External entity':p.rect(65,y+21,257,87,GREEN,BORDER);p.text(193,y+47,'E1  Visitor / student',19,INK,True,'center')
  elif title=='Numbered process':p.rect(65,y+15,257,103,BLUE,BORDER,9);p.line([[65,y+46],[322,y+46]]);p.text(193,y+23,'2.1',17,INK,True,'center');p.text(193,y+66,'Register account',19,INK,True,'center')
  elif title=='Data store':p.rect(65,y+21,257,87,YELLOW,None);p.line([[322,y+21],[65,y+21],[65,y+108],[322,y+108]]);p.line([[109,y+21],[109,y+108]]);p.text(87,y+51,'D4',16,INK,True,'center');p.text(214,y+51,'User accounts',19,INK,False,'center')
  else:p.line([[65,y+70],[322,y+70]],'#276A96',2);p.polygon([[322,y+70],[309,y+64],[309,y+76]],'#276A96');p.text(193,y+35,'Registration fields',17,INK,False,'center')
 pages.append(p)
 return pages

def appendices(data,balances):
 pages=[]
 p=Page('BALANCE','Boundary conservation audit','Automated comparison of directional data-package sets, including grouped-store expansions.','Balancing preserves external information, not the number of arrows. Internal flows may be added within a child.','Reference: DFD (1).pdf, pp. 19–23; validation-report.json contains the machine-readable results.')
 p.text(50,199,'Child view',16,INK,True);p.text(290,199,'Parent process',16,INK,True);p.text(580,199,'Input packages',16,INK,True);p.text(846,199,'Output packages',16,INK,True);p.text(1165,199,'Result',16,INK,True)
 for i,r in enumerate(balances):
  y=235+i*39;p.rect(45,y,1347,37,BLUE if i%2==0 else WHITE,None)
  for x,t in [(57,r['diagram']),(295,r['process']),(610,str(r['input_fields'])),(882,str(r['output_fields'])),(1172,r['status'])]:p.text(x,y+9,t,15,INK,x==1172)
 pages.append(p)
 p=Page('STORES','Logical and physical data store dictionary','Grouped Level-0 stores are refined into primitive subject stores on child diagrams.','Open-ended stores represent retained information, including process memory; they do not all imply database tables.','Reference: DFD (1).pdf, pp. 3–4, 15–23 and 27; full fields and retention notes in DATA-DICTIONARY.md.')
 leaves=[n for n in data['nodes'].values() if n['id'].startswith('D') and n['kind']=='store']
 for i,n in enumerate(leaves):
  y=211+i*47;p.rect(45,y,1347,45,RED if n['status']=='incomplete' else YELLOW if n['status']=='preview' else BLUE if i%2==0 else WHITE,None)
  p.text(58,y+12,n['id'],15,INK,True);p.text(112,y+12,n['name'],16,INK,True);p.text(447,y+12,n['group'],14,GRAY,True);p.text(510,y+12,n['physical'],14,INK)
 pages.append(p)
 p=Page('FINDINGS','Current data boundaries and implementation gaps','The diagrams describe existing behavior and clearly qualify incomplete listing storage.','No payment, completed order, seller delivery or persisted offer acceptance is invented in these DFDs.','Evidence: Website/App.tsx, data/listings.ts, server/api.mjs; Backend/Listing.cs, Sql.cs, Env.cs.')
 findings=[('Preview data stays in the browser','Messages and offer strings update one App-level array. They are not sent to sellers and are not isolated by listing.',YELLOW),('Two identities cross the adapter boundary','Service admin_token enables server-owned IP forwarding; visitor access_token identifies the acting user. The browser receives an opaque cookie ID.',BLUE),('Listing storage is a qualified expectation','ListingController uses ../Data.db and expects Listings, which is absent from supplied DDL. The website has no listing adapter route.',RED),('Retention is not a scheduling arrow','Node sessions disappear on restart. Security maintenance uses expiry data. Startup cleanup is unawaited; daily cleanup is at 03:24 Mountain.',PURPLE),('Logical processes span implementation modules','Process 4.0 centralizes access-related data transformations across Node and ASP.NET. It does not assert a separate physical service.',GREEN)]
 for i,(t,b,c) in enumerate(findings):
  y=207+i*145;p.rect(48,y,1344,124,c,None,5);p.text(67,y+17,t,21,INK,True);p.wrap(67,y+54,b,1302,18,28)
 pages.append(p)
 return pages

def dictionary(data,out):
 ns=data['nodes'];aa=data['atoms'];lines=['# Data dictionary','',f'Source application commit: `{data["source_commit"]}`. Each element is a named data package; its fields define its information content. Alternatives and error variants belong to the same documented package.','', '## External entities','']
 for n in ns.values():
  if n['kind']=='external':lines.append(f'- **{n["id"]} — {n["name"]}**')
 lines+=['','## Store groups and primitive stores','', '| ID | Subject | Group | Implementation | Status |','| --- | --- | --- | --- | --- |']
 for n in ns.values():
  if n['kind']=='store':lines.append(f'| {n["id"]} | {n["name"]} | {n.get("group") or "—"} | {n.get("physical") or "Logical aggregate; expanded in lower-level views"} | {n["status"]} |')
 lines+=['','## Named data packages','', '| Key | Diagram noun phrase | Information content | Primitive store, if applicable |','| --- | --- | --- | --- |']
 for k,a in aa.items():lines.append(f'| `{k}` | {a["label"]} | {a["fields"]} | {a.get("store") or "—"} |')
 lines+=['','## Read/write interpretation','','An arrow into a store carries inserted/updated record values or deletion-selection data. An arrow out carries retrieved record/reference data. A removal arrow is a noun-phrase representation of record mutation, not a control command. All data movement between stores, entities and retained records is mediated by a process.','','Grouped stores G1–G6 preserve logical subjects at Level-0. D1–D15 refine those subjects at lower levels. The balance validator maps each primitive store to its declared group only when that group is the parent boundary endpoint. No new external information is introduced by this expansion.','','Dictionary counts on the BALANCE page count directional `(outside endpoint, named package)` tuples, not individual JSON properties or the count of arrows. A package repeated on several operation-specific branches is the same information, selected by its operation discriminator; it is not additional boundary data.']
 (out/'DATA-DICTIONARY.md').write_text('\n'.join(lines)+'\n')
 with (out/'flow-register.csv').open('w',newline='') as f:
  w=csv.writer(f);w.writerow(['diagram','flow_id','source','target','label','packages','fields'])
  for g in data['graphs']:
   for e in g['edges']:w.writerow([g['id'],e['id'],e['source'],e['target'],e['label'],'; '.join(e['atoms']),' | '.join(aa[a]['fields'] for a in e['atoms'])])

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=BASE);parser.add_argument('--previews',action='store_true');a=parser.parse_args();out=a.output
 out.mkdir(parents=True,exist_ok=True)
 for d in ['svg','dot','previews']:(out/d).mkdir(exist_ok=True)
 v.font_setup();data=json.loads((BASE/'model.json').read_text());balances=check(data)
 # Four dense semantic diagrams are displayed as readable same-level
 # sheets. Their complete SVGs and DOT sources are also retained. A sheet is
 # a projection of one diagram, never a new decomposition boundary.
 diagrams=[];full_views=[];sheet_manifest=[]
 for g in data['graphs']:
  if g['id'] in ['L0','P2','P3','P4']:
   full_views.append(render_graph(g,data,out))
   chunks=[g['inside'][st:st+2] for st in range(0,len(g['inside']),2)]
   if g['id']=='P3':chunks=[['3.1'],['3.2'],['3.3','3.4'],['3.5','3.6']]
   if g['id']=='P4':chunks=[['4.1','4.2'],['4.3'],['4.4'],['4.5']]
   count=len(chunks)
   for sheet_index,chosen in enumerate(chunks):
    sid=g['id']+'_S'+str(sheet_index+1)
    es=[e for e in g['edges'] if e['source'] in chosen or e['target'] in chosen]
    view=dict(g,id=sid,inside=chosen,edges=es,title=g['title']+' | '+str(sheet_index+1)+'/'+str(count),scope=g['scope']+' • same-level sheet for '+', '.join(chosen),note='Same-level sheet: purple context processes refer to unchanged IDs elsewhere. '+g['note'])
    diagrams.append(render_graph(view,data,out));sheet_manifest.append(dict(sheet=sid,diagram=g['id'],inside=chosen,flow_ids=[e['id'] for e in es]))
  else:diagrams.append(render_graph(g,data,out));sheet_manifest.append(dict(sheet=g['id'],diagram=g['id'],inside=g['inside'],flow_ids=[e['id'] for e in g['edges']]))
 # Check that splitting for presentation preserves every node and every flow.
 for g in data['graphs']:
  ss=[x for x in sheet_manifest if x['diagram']==g['id']]
  assert set(g['inside'])=={n for s in ss for n in s['inside']}
  assert {e['id'] for e in g['edges']}=={f for s in ss for f in s['flow_ids']}
 (out/'sheet-manifest.json').write_text(json.dumps(sheet_manifest,indent=2))
 pages=support_pages(data,balances)+diagrams+appendices(data,balances)
 dictionary(data,out)
 c=canvas.Canvas(str(out/'StudentExchange-DFD.pdf'),pagesize=(W,H),pageCompression=1);c.setTitle('Student Exchange — DFD Design Atlas');c.setAuthor('Student Exchange design documentation')
 prs=Presentation();prs.slide_width=v.unit(W);prs.slide_height=v.unit(H)
 for i,page in enumerate(pages):
  p=page.d;p['shapes'].append(dict(type='text',x=1392,y=1050,text=f'{i+1:02}',size=11,color=GRAY,bold=False,align='right'))
  c.bookmarkPage(p['id']);c.addOutlineEntry(p['id']+' | '+p['title'],p['id'],0)
  sl=prs.slides.add_slide(prs.slide_layouts[6]);sl.notes_slide.notes_text_frame.text=p['title']+'\n'+p['subtitle']+'\n\n'+p['takeaway']+'\n\n'+p['source']+'\nSource application commit: '+data['source_commit']
  svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1080" viewBox="0 0 1440 1080" role="img">',f'<title>{escape(p["title"])}</title>',f'<desc>{escape(p["subtitle"]+" "+p["takeaway"])}</desc>']
  for s in p['shapes']:v.pdf_shape(c,s);v.ppt_shape(sl,s);svg.append(v.svg_shape(s))
  svg.append('</svg>');(out/'svg'/f'{p["id"]}.svg').write_text('\n'.join(svg));c.showPage()
 c.save();prs.save(out/'StudentExchange-DFD.pptx')
 for page in full_views:
  p=page.d
  svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1080" viewBox="0 0 1440 1080" role="img">',f'<title>{escape(p["title"])}</title>',f'<desc>{escape(p["subtitle"]+" "+p["takeaway"])}</desc>']
  svg += [v.svg_shape(s) for s in p['shapes']];svg.append('</svg>');(out/'svg'/f'{p["id"]}.svg').write_text('\n'.join(svg))
 (out/'slide-model.json').write_text(json.dumps(dict(width=W,height=H,source_commit=data['source_commit'],slides=[p.d for p in pages]),ensure_ascii=False,indent=2))
 if a.previews:
  import fitz
  doc=fitz.open(out/'StudentExchange-DFD.pdf')
  for p,pd in zip(doc,pages):p.get_pixmap(matrix=fitz.Matrix(.9,.9)).save(out/'previews'/f'{pd.d["id"]}.png')
 print(f'Rendered {len(pages)} pages / editable slides; {len(data["graphs"])} DFDs.')
 print(json.dumps({p.d['id']:p.d.get('layout_metrics') for p in pages if 'layout_metrics' in p.d},indent=2))

if __name__=='__main__':main()
