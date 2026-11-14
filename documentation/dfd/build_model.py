#!/usr/bin/env python3
"""Source-grounded data flow atlas; uses the shared UML vector renderer."""
import json, math, sys
from pathlib import Path
BASE=Path(__file__).resolve().parent
sys.path.insert(0,str(BASE.parent/'uml'))
from render import font_setup
from reportlab.pdfbase.pdfmetrics import stringWidth
font_setup()
COMMIT='f893267d148fc0c3c6fad8bee5caadf6c086a143'
REPO='https://github.com/supracharger/StudentExchange'
INK='#18334B'; NAVY='#12365B'; BLUE='#E8F1FC'; GREEN='#E8F4EC'; GOLD='#FFF4CD'
slides=[];current=None

def shape(kind,**kw): current['shapes'].append(dict(type=kind,**kw))
def rect(x,y,w,h,fill=BLUE,r=0): shape('rect',x=x,y=y,w=w,h=h,fill=fill,stroke='#8BA2B5',r=r)
def text(x,y,value,size=14,width=1100,bold=False,color=INK,align='left'):
 for para in str(value).split('\n'):
  line=''
  for word in para.split():
   proposed=(line+' '+word).strip()
   if line and stringWidth(proposed,'UML-Bold' if bold else 'UML',size)>width*.93:
    shape('text',x=x,y=y,text=line,size=size,color=color,bold=bold,align=align);y+=size*1.45;line=word
   else: line=proposed
  shape('text',x=x,y=y,text=line,size=size,color=color,bold=bold,align=align);y+=size*1.45

def line(points): shape('line',points=points,color=INK,width=1.5)
def flow(points,label,x,y,width=260):
 line(points);a,b=points[-2:];angle=math.atan2(b[1]-a[1],b[0]-a[0]);n=9
 shape('polygon',points=[b,[b[0]-n*math.cos(angle-.45),b[1]-n*math.sin(angle-.45)],[b[0]-n*math.cos(angle+.45),b[1]-n*math.sin(angle+.45)]],fill=INK,stroke=INK)
 text(x,y,label,12,width=width,align='center')

def page(id,title,subtitle,takeaway,sources,kind='Data flow'):
 global current
 current=dict(id=id,title=title,subtitle=subtitle,takeaway=takeaway,source='; '.join(sources),sources=sources,kind=kind,shapes=[]);slides.append(current)
 rect(0,0,1280,720,'#F8FAFC');rect(0,0,1280,101,NAVY)
 text(42,17,'STUDENT EXCHANGE  /  DATA FLOW  /  '+id,11,bold=True,color='#9FD6EA')
 text(42,44,title,26,bold=True,color='#FFFFFF',width=1190)
 text(44,116,subtitle,14,width=1180,color='#65788A')
 rect(42,635,1196,39,GOLD,6);text(56,647,takeaway,12,width=1165,bold=True)
 text(44,689,'StudentExchange @ '+COMMIT[:7]+' | '+ '; '.join(sources),9,width=1170,color='#65788A')

def entity(x,y,w,h,title,body=''):
 rect(x,y,w,h,'#FFFFFF');text(x+w/2,y+14,title,16,width=w-20,bold=True,align='center')
 if body:text(x+w/2,y+45,body,13,width=w-22,align='center')
def process(x,y,w,h,title,body=''):
 rect(x,y,w,h,BLUE,22);text(x+w/2,y+13,title,16,width=w-22,bold=True,align='center')
 if body:text(x+w/2,y+45,body,13,width=w-26,align='center')
def store(x,y,w,h,title,body=''):
 # Open-ended Gane-Sarson store: top, bottom and left divider, no right edge.
 line([(x+w,y),(x,y),(x,y+h),(x+w,y+h)]);line([(x+40,y),(x+40,y+h)])
 text(x+20,y+17,title.split(' | ')[0],13,bold=True,align='center',width=36)
 text(x+55,y+13,title.split(' | ')[1],14,width=w-68,bold=True)
 if body:text(x+55,y+38,body,12,width=w-68)
W='Website/';B='Backend/'
page('00','Student Exchange | data flow atlas','Website + Node adapter + backend + persisted data','Nine DFDs complement the UML atlas; arrows carry data, not control or timing.',['code/Frontend','code/Backend'],'Cover')
text(65,180,'Follow data across the whole marketplace',30,width=1120,bold=True)
text(65,250,'Context → Level 1 → focused Level 2 decompositions',22,width=1100)
for i,(a,b) in enumerate([('Scope','People, application processes, sessions, SQL records and image files.'),('Evidence','Same combined-repository snapshot and visual system as the UML atlas.'),('Deliverables','Vector PDF, editable PowerPoint, individual SVGs and JSON source.')]):
 process(65+i*400,345,370,170,a,b)
page('F00','Context DFD: marketplace boundary','Level 0: the complete website and backend are one process.','Backend infrastructure is inside process 0; no external email or payment service is implied.',[W+'src/App.tsx',W+'server/api.mjs',B+'Controllers/*.cs'])
entity(55,235,260,200,'Visitor / student','Search, account, inventory\nMessages and offers')
process(475,245,330,210,'0 | Student Exchange','Website + Node adapter\nASP.NET Core backend\nDatabase + image storage')
entity(965,235,260,200,'Administrator','Directory, moderation\nAccess and attempt records')
flow([(315,280),(475,280)],'Queries / edits / credentials',395,218,290)
flow([(475,400),(315,400)],'Listings / profile / messages',395,456,290)
flow([(965,280),(805,280)],'Admin queries / changes',885,218,290)
flow([(805,400),(965,400)],'Records / operation results',885,456,290)
page('F01','Level 1: processes and data stores','Decomposition of process 0; the website runtime mediates browser-to-backend exchanges.','D1 is Node memory; D2/D3/D4 are SQLite groups; D5 is the backend upload filesystem.',[W+'server/api.mjs',W+'server/marketplace.mjs',W+'server/messages.mjs',W+'server/admin.mjs',B+'Controllers/*.cs'])
entity(50,170,250,95,'Visitor / student')
entity(50,365,250,95,'Administrator')
process(445,170,330,110,'1.0 | Website runtime','React UI + Node API adapter')
process(445,340,330,125,'2.0 | Backend services','Auth / listings / messaging\nAdmin / maintenance')
store(930,165,300,80,'D1 | Website sessions','Opaque ID → token / profile')
store(930,280,300,85,'D2 | Identity / access','User, token, admin, IP, blocks')
store(930,390,300,85,'D3 | Marketplace','Listings, Img, Books, lookups\nCheck_Active + hit tables')
store(930,500,300,85,'D4 | Conversations','Conversations + Messages')
store(445,535,330,75,'D5 | Photo files','Decoded listing images')
flow([(300,195),(445,195)],'Requests',370,172,140)
flow([(445,246),(300,246)],'UI results',370,220,140)
flow([(300,390),(360,390),(360,268),(445,268)],'Admin input',355,305,155)
flow([(445,260),(405,260),(405,440),(300,440)],'Admin results',345,468,175)
flow([(775,191),(930,191)],'Session writes',850,169,150)
flow([(930,230),(775,230)],'Session data',850,208,150)
flow([(555,280),(555,340)],'Authorized JSON',490,294,170)
flow([(680,340),(680,280)],'Backend results',735,300,170)
flow([(775,361),(855,361),(855,307),(930,307)],'Identity reads/writes',850,285,240)
flow([(930,345),(885,345),(885,389),(775,389)],'Identity data',850,369,165)
flow([(775,420),(930,420)],'Listing edits',850,398,150)
flow([(930,454),(775,454)],'Listing records',850,433,150)
flow([(775,440),(815,440),(815,524),(930,524)],'Messages / read marks',840,487,235)
flow([(930,558),(795,558),(795,460),(775,460)],'Inbox / history',850,580,190)
flow([(555,465),(555,535)],'Image bytes',485,490,145)
flow([(680,535),(680,465)],'Stored image bytes',740,510,190)

# Every Level 2 sheet uses the same sparse topology. Each process explicitly combines
# its React/Node surface with the corresponding controller so the parent balance is visible.
def detail(id,title,number,who,input_,output,proc,body,db,write,read,note,sources,secondary=None):
 page(id,title,'Level 2 of process 2.0, with its website entry/exit shown for traceability.',note,sources)
 entity(50,235,265,165,who,'Via React + Node adapter')
 process(490,225,320,190,number+' | '+proc,body)
 store(975,225,270,150,db[0],db[1])
 flow([(315,265),(490,265)],input_,400,183,300)
 flow([(490,373),(315,373)],output,400,438,305)
 flow([(810,265),(975,265)],write,891,183,290)
 flow([(975,342),(810,342)],read,891,438,290)
 if secondary:
  store(490,535,420,72,secondary[0],secondary[1])
  flow([(580,415),(580,535)],secondary[2],443,489,240)
  flow([(735,535),(735,415)],secondary[3],854,491,240)

detail('F02','Authentication and account data', '2.1','Visitor / student','Credentials / profile changes','Profile / backend token / errors','Authenticate / profile','LogIn / Register / Users\nValidate account eligibility\nIssue or revoke backend token',('D2 | Identity / access','User + Access_Token\nIP / blocks'), 'Validated account/token writes','Profile / token / eligibility','Registration does not log in. Website sessions expire after 12h; backend token expiry is independent.',[W+'server/api.mjs',W+'server/client-ip.mjs',B+'Controllers/LogIn.cs',B+'Controllers/Register.cs',B+'Controllers/Users.cs'])
detail('F03','Listing discovery, details and seller pages','2.2','Visitor / student','Search / ISBN / category / user_page / ID','Summaries / detail / image references','Read marketplace','Node forwards JSON GET body\nOptional visitor detail token\nPublic seller scope: user_page',('D3 | Marketplace','Listings + owner / lookups\nImg + Books + hit tallies'),'Detail engagement tallies','Filtered records / photos','Public seller queries return Active/Sold; user_page never combines with for_user or a visitor token.',[W+'server/marketplace.mjs',W+'src/api/marketplace.ts',B+'Controllers/Listing.cs'])
detail('F04','Seller listing changes and photos','2.3','Seller / moderator','Fields / photo operations / status','Saved listing / validation errors','Maintain listing','Validate owner/admin + status\nCreate or PATCH listing\nDecode / order ≤ 8 photos',('D3 | Marketplace','Listings / Img / Books\nCheck_Active'),'Transactional row edits','Original listing + photo order','Website removal PATCHes Inactive. Sold is easy to set; image edits retain original zero-based locations.',[W+'server/marketplace.mjs',W+'src/components/ListingEditor.tsx',B+'Controllers/Listing.cs'],('D5 | Photo files','Listing upload directory','New files / superseded file removal','Retained image files'))
detail('F05','Messaging, offers and read receipts','2.4','Buyer / seller','Text / offer / thread ID / after cursor','Inbox / history / unread / send result','Exchange messages','Node → api/Message\nParticipant token + rate checks\nRead marks incoming rows read',('D4 | Conversations','Conversations + Messages'),'Conversation / message / read time','Participant inbox / message history','Offers are proposals: no acceptance, payment, attachments or email delivery endpoint is modeled.',[W+'server/messages.mjs',W+'src/components/Messenger.tsx',B+'Controllers/Message.cs'],('D3 | Marketplace','Listing ownership/status; hit tallies','Message engagement tally','Listing / seller / eligibility'))
detail('F06','Administrator data and moderation','2.5','Administrator','Target IDs / filters / proposed changes','Directory / attempt data / results','Administer records','Node permission + target checks\nController rank/lock enforcement\nIP forwarding uses service token',('D2 | Identity / access','User / Admins / tokens\nIP / block records'),'Eligible changes / token revocation','Directory / rank / attempt records','Admin levels vary by operation. Deleting an account differs from deactivating a listing.',[W+'server/admin.mjs',B+'Controllers/Admin.cs',B+'Controllers/Blocked.cs',B+'Controllers/Users.cs',B+'Controllers/Schools.cs',B+'Controllers/Category.cs'],('D3 | Marketplace','Listings / Schools / categories','Moderation / lookup edits','Listings / school / category rows'))
page('F07','Scheduled maintenance data flow','Level 2 of process 2.0: startup/background housekeeping is internal to the backend.','Schedule starts asynchronously and runs daily at 03:24 Mountain time; no Message.CleanUp implementation is modeled.',[B+'Program.cs',B+'Controllers/LogIn.cs',B+'Controllers/Users.cs',B+'Controllers/Listing.cs',B+'Components/IP.cs'])
process(485,240,320,180,'2.6 | Maintain records','Schedule → cleanup routines\nTokens / accounts / IP / listings\nExpiry and hit-count aggregation')
store(45,225,285,140,'D2 | Identity / access','Token expiry / IP activity\nAccount retention records')
store(950,225,285,140,'D3 | Marketplace','Listing expiry / checks\nHit tally / aggregate rows')
store(485,535,400,70,'D5 | Photo files','Upload filesystem')
flow([(330,263),(485,263)],'Expiry / eligibility rows',407,179,270)
flow([(485,345),(330,345)],'Cleanup changes',407,424,270)
flow([(950,263),(805,263)],'Expiry / hit tally rows',878,179,270)
flow([(805,345),(950,345)],'Statuses / aggregate changes',878,424,290)
flow([(590,420),(590,535)],'Attempted orphan removals',475,482,260)
flow([(745,535),(745,420)],'Directory entries',860,486,220)
text(52,540,'Source caveat: Listing.CleanUp tests\n!Directory.Exists before file enumeration.\nSuccessful orphan cleanup is not assumed.',13,width=380)
page('F08','Session, forwarding and logout data','Level 2 of process 1.0: the Node adapter owns the browser/backend identity boundary.','Raw backend tokens and service credentials stay server-side; no browser localStorage credential store.',[W+'server/api.mjs',W+'server/client-ip.mjs',B+'Components/AppAuthJson.cs'])
entity(50,245,260,160,'Browser','Same-origin cookie\nRoute + API input')
process(485,230,330,180,'1.1 | Resolve / forward','Origin + session validation\nVisitor IP + app credential\nSafe response projection')
entity(975,245,260,160,'ASP.NET backend','From process 1.0 boundary\nProcess 2.0 in F01')
store(485,535,410,72,'D1 | Website sessions','Opaque ID → token / profile / expiry')
flow([(310,275),(485,275)],'Cookie / API input',397,189,290)
flow([(485,372),(310,372)],'Projected data / Set-Cookie',397,443,300)
flow([(815,275),(975,275)],'app_access / token / trusted IP',895,189,300)
flow([(975,372),(815,372)],'Backend result / renewal result',895,443,305)
flow([(585,410),(585,535)],'Session changes / logout deletion',430,490,280)
flow([(740,535),(740,410)],'Token / profile / expiry',900,490,280)
page('KEY','DFD notation, balance and evidence','Gane-Sarson-inspired processes and stores; the visual palette matches the UML atlas.','These are data dependencies; request/response order belongs in the UML sequence diagrams.',['docs/dfd/build_model.py','docs/uml/TRACEABILITY.md'],'Notation')
entity(65,175,300,105,'External entity','Person or boundary peer')
process(475,175,330,105,'N.n | Process','Transforms or validates data')
store(920,175,300,105,'Dn | Data store','Persistent or session data')
text(65,340,'Arrow labels name payloads or records. Each process has an input and output.\nThere are no direct entity-to-store or store-to-store flows.\nStore IDs repeat across sheets; SQL stores group tables by responsibility.\nF00 process 0 expands into F01 processes 1.0 and 2.0.\nF02–F07 decompose 2.0; F08 decomposes 1.0.\nFor legibility, unchanged routing/session checks and lookup reads are abstracted.\nThe scheduler is internal; timing is not drawn as an external data entity.',18,width=1140)
text(65,564,'Source: '+COMMIT+' (not a verification of deployed production behavior).',13,width=1140)
page('GUIDE','Data flow diagram index','Read F00/F01 first; use the focused views to follow one class of data.','Nine diagrams + three reference pages; immutable source links are in TRACEABILITY.md.',['See README.md + TRACEABILITY.md'],'Index')
for i,p in enumerate([s for s in slides if s['id'].startswith('F')]):text(65,177+i*43,p['id']+'  '+p['title'],18,width=1140)
index=slides.pop();slides.insert(1,index)
model=dict(version=1,width=1280,height=720,source_commit=COMMIT,source_repository=REPO,artifact_stem='StudentExchange-DFD',title='Student Exchange — Data Flow Atlas',slides=slides)
(BASE/'model.json').write_text(json.dumps(model,indent=2,ensure_ascii=False)+'\n')
lines=['# Data flow source traceability','',f'Source: [{COMMIT}]({REPO}/tree/{COMMIT}). Website/ = code/Frontend/StudentExchange-Website/; Backend/ = code/Backend/StudentExchangeBck/.','', '| ID | Diagram | Evidence |','| --- | --- | --- |']
for p in slides:
 links=[]
 for src in p['sources']:
  path=src.replace('Website/','code/Frontend/StudentExchange-Website/',1) if src.startswith('Website/') else src.replace('Backend/','code/Backend/StudentExchangeBck/',1) if src.startswith('Backend/') else src
  if path.startswith('code/'):
   if '*' in path:path=path.rsplit('/',1)[0]
   links.append(f'[{src}]({REPO}/tree/{COMMIT}/{path})')
  else:links.append('`'+src+'`')
 lines.append(f'| [{p["id"]}](svg/{p["id"]}.svg) | {p["title"]} | '+ '<br>'.join(links)+' |')
(BASE/'TRACEABILITY.md').write_text('\n'.join(lines)+'\n')
print(f'Built {len(slides)} DFD pages from {COMMIT}.')
