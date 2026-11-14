#!/usr/bin/env python3
"""Build the source-grounded atlas model. Run before render.py after editing definitions."""
import json, math, textwrap
from pathlib import Path
from reportlab.pdfbase.pdfmetrics import stringWidth
from render import font_setup
font_setup()
BASE=Path(__file__).resolve().parent
COMMIT='f893267d148fc0c3c6fad8bee5caadf6c086a143'
SOURCE_REPO='https://github.com/supracharger/StudentExchange'
NAVY='#12365B'; INK='#18334B'; BLUE='#E8F1FC'; GREEN='#E8F4EC'; GOLD='#FFF4CD'; MUTED='#65788A'
slides=[];sources={};current=None

def shape(kind,**kwargs):current['shapes'].append({'type':kind,**kwargs})
def rect(x,y,w,h,fill=BLUE,dash=False,r=6):shape('rect',x=x,y=y,w=w,h=h,fill=fill,stroke='#8BA2B5',r=r,dash=dash)
def text(x,y,value,size=14,width=1100,bold=False,color=INK,align='left'):
    yy=y
    for paragraph in str(value).split('\n'):
        words=paragraph.split();line=''
        for word in words:
            proposed=(line+' '+word).strip()
            if line and stringWidth(proposed,'UML-Bold' if bold else 'UML',size)>width*.93:
                shape('text',x=x,y=yy,text=line,size=size,color=color,bold=bold,align=align);yy+=size*1.45;line=word
            else:line=proposed
        shape('text',x=x,y=yy,text=line,size=size,color=color,bold=bold,align=align);yy+=size*1.45
    return yy

def page(id,title,subtitle,takeaway,src,kind='Component'):
    global current
    current={'id':id,'title':title,'subtitle':subtitle,'takeaway':takeaway,'source':'; '.join(src),'kind':kind,'shapes':[]}
    slides.append(current);sources[id]=src
    rect(0,0,1280,720,'#F8FAFC',r=0);rect(0,0,1280,101,NAVY,r=0)
    text(42,17,f'STUDENT EXCHANGE  /  {kind.upper()}  /  {id}',11,bold=True,color='#9FD6EA')
    text(42,44,title,26,width=1190,bold=True,color='#FFFFFF')
    text(44,116,subtitle,14,width=1180,color=MUTED)
    rect(42,635,1196,39,GOLD);text(56,647,takeaway,12,width=1165,bold=True)
    text(44,689,'StudentExchange @ '+COMMIT[:7]+' | '+ '; '.join(src),9,width=1170,color=MUTED)

def line(points,dash=False,color=INK):shape('line',points=points,color=color,width=1.5,dash=dash)
def arrow(points,label='',dashed=False,labelpos=None):
    line(points,dashed)
    a,b=points[-2:];angle=math.atan2(b[1]-a[1],b[0]-a[0]);n=9
    shape('polygon',points=[b,[b[0]-n*math.cos(angle-.45),b[1]-n*math.sin(angle-.45)],[b[0]-n*math.cos(angle+.45),b[1]-n*math.sin(angle+.45)]],fill=INK,stroke=INK)
    if label:
        x,y=labelpos or ((points[0][0]+b[0])/2,(points[0][1]+b[1])/2-19)
        text(x,y,label,11,width=260,align='center')

def box(x,y,w,h,title,body='',fill=BLUE,stereo='component'):
    rect(x,y,w,h,fill)
    text(x+w/2,y+10,'«'+stereo+'»',11,width=w-22,color=MUTED,align='center')
    text(x+w/2,y+29,title,15,width=w-20,bold=True,align='center')
    if body:
        line([(x,y+53),(x+w,y+53)],color='#A3B4C3');text(x+12,y+64,body,13,width=w-24)

def grid(items,cols=3):
    w=(1180-(cols-1)*22)/cols
    for i,(title,body,*rest) in enumerate(items):box(50+(i%cols)*(w+22),167+(i//cols)*215,w,190,title,body,rest[0] if rest else BLUE,'table' if current['id'] in ['D08','D31','D32'] else 'class' if current['kind']=='Class' else 'component')

def sequence(id,title,subtitle,takeaway,participants,steps,src):
    page(id,title,subtitle,takeaway,src,'Sequence')
    n=len(participants);xs=[130+i*(1020/(n-1)) for i in range(n)]
    for x,label in zip(xs,participants):
        rect(x-91,162,182,52,BLUE);text(x,174,label,14,width=174,bold=True,align='center');line([(x,214),(x,615)],True,color='#8BA2B5')
    spacing=min(45,375/max(1,len(steps)-1))
    for i,(a,b,label,*rest) in enumerate(steps):
        y=243+i*spacing
        if a==b:
            x=xs[a];direction=-1 if x>900 else 1
            arrow([(x,y),(x+28*direction,y),(x+28*direction,y+19),(x,y+19)])
            text(x+40*direction,y-12,f'{i+1}. '+label,11,width=300,align='right' if direction<0 else 'left')
        else:
            arrow([(xs[a],y),(xs[b],y)],dashed=bool(rest and rest[0]))
            text((xs[a]+xs[b])/2,y-24,f'{i+1}. '+label,12,width=abs(xs[b]-xs[a])-20,align='center')

def activity(id,title,steps,src,takeaway):
    page(id,title,'Activity view: main workflow with implementation guards noted.',takeaway,src,'Activity')
    shape('ellipse',x=634,y=154,w=12,h=12,fill=INK,stroke=INK)
    for i,(label,note) in enumerate(steps):
        y=182+i*80;rect(330,y,620,53,GREEN,r=18);text(640,y+15,label,15,width=590,bold=True,align='center')
        if i==0:arrow([(640,166),(640,y)])
        else:arrow([(640,y-27),(640,y)])
        if note:text(970,y+10,note,12,width=250,color=MUTED)
    y=182+(len(steps)-1)*80+53;arrow([(640,y),(640,y+18)])
    shape('ellipse',x=630,y=y+18,w=20,h=20,fill='#FFFFFF',stroke=INK);shape('ellipse',x=635,y=y+23,w=10,h=10,fill=INK,stroke=INK)

W='Website/';B='Backend/'
page('00','Student Exchange | whole-system UML atlas','React website + Node adapter + ASP.NET Core + SQLite','32 diagrams model both applications and their end-to-end collaboration.', ['code/Frontend + code/Backend'],'Design atlas')
text(65,180,'From browser interaction to persisted state',30,width=1120,bold=True)
text(65,250,'Current code, not historical preview behavior. Each view identifies its evidence.',20,width=1100)
for i,(heading,body_) in enumerate([('Frontend','Routes, account/seller/admin components, API clients and persistent messenger.'),('Integration','Opaque cookie sessions; JSON GET forwarding; validated messages and listing edits.'),('Backend','Controllers, shared authorization, transaction helpers, schema and maintenance.')]):
    box(65+i*390,330,365,218,heading,body_,[BLUE,GREEN,GOLD][i])

page('D01','System context and trust boundaries','Browser requests the website; only the Node adapter talks to the backend.','Visitor tokens stay in the server session; photos are also proxied on the website origin.',[W+'src/App.tsx',W+'server/app.mjs',B+'Program.cs'])
box(55,195,330,150,'React website','Visitor / student / administrator\nSame-origin fetch /api/*')
box(475,195,330,150,'Node website server','Static SPA + request adapter\nOpaque-cookie session Map',GREEN)
box(895,195,330,150,'ASP.NET Core API','Account, listing and message controllers\nAppAuthJson + Sql',BLUE)
arrow([(385,270),(475,270)],'HTTPS + cookie',labelpos=(430,248));arrow([(805,270),(895,270)],'JSON + tokens',labelpos=(850,248))
box(685,440,250,125,'SQLite database','Sql.Read / Write / Trans',GOLD,'database')
box(980,440,245,125,'Uploads directory','PNG / JPEG / WebP files',GOLD,'artifact')
arrow([(1045,345),(1045,390),(810,390),(810,440)]);arrow([(1120,345),(1120,440)])

# Use-case diagrams, with actors and system boundaries.
def usecases(id,title,cases,admin=False):
    page(id,title,'Actors are roles; privileged goals remain enforced by the adapter and backend.','Accounts, live listings and messages are integrated workflows, not local previews.',[W+'src/App.tsx',W+'src/components',W+'server/admin.mjs'],'Use case')
    rect(260,157,930,450,'#FFFFFF',dash=True)
    text(280,169,'Student Exchange website + backend',14,bold=True)
    for i,name in enumerate(['Visitor','Signed-in student'] if not admin else ['Administrator','Level 10+ / 20+ / 30+']):
        x=132;y=243+i*220
        shape('ellipse',x=x-12,y=y-38,w=24,h=24,fill='#FFFFFF',stroke=INK)
        line([(x,y-14),(x,y+25)]);line([(x-24,y),(x+24,y)]);line([(x,y+25),(x-22,y+60)]);line([(x,y+25),(x+22,y+60)])
        text(x,y+70,name,13,width=200,align='center')
    for i,(label,actor) in enumerate(cases):
        col=i%2;row=i//2;x=310+col*435;y=210+row*116
        shape('ellipse',x=x,y=y,w=365,h=76,fill=GREEN if actor else BLUE,stroke='#8BA2B5')
        text(x+182,y+22,label,14,width=330,align='center')
        line([(156,243+actor*220),(x,y+38)],color='#8BA2B5')
usecases('D02','Visitor and student goals', [('Browse / search public listings',0),('Inspect listing + seller collection',0),('Register / log in',0),('Edit own profile / copy seller URL',1),('Create / edit / deactivate listing',1),('Message, offer and renew listing',1)])
usecases('D03','Administrator goals and role levels',[('Inspect own admin membership',0),('Grant / change lower admin access',0),('Manage users, listings and schools',1),('Review login attempts (20+)',1),('Inspect levels (27+)',1),('Change locked admin status (30+)',1)],True)

page('D04','Website component collaboration','React function components and hooks are modeled as components, not C# classes.','App owns navigation and pending seller contact; Messenger survives navigation while signed in.',[W+'src/App.tsx',W+'src/components',W+'src/hooks'],'Component')
grid([('App','Routes / selected listing\nuseAccount + useAdmin\nPending message target'),('Marketplace / ListingDetail','Search + seller collections\nGallery / Message seller\nPublic seller-page link'),('AccountPanel','Login / registration\nProfileForm null-safe fields\nCredentials remain in form state'),('SellerPortal / ListingEditor','Inventory + Mark as Sold\nEdit photos / status / renew\nCopy public seller URL'),('AdminPage','AdminMarketplace / SchoolsPanel\nAdminAccessPanel\nPer-action authorization'),('Messenger','Conversation list / history\nMessages, offers, drafts\nPolling / unread badges')])

arrow([(429,250),(451,250)])
arrow([(239,167),(239,150),(1041,150),(1041,167)])
line([(239,357),(239,369),(1041,369)])
for x in [239,640,1041]:arrow([(x,369),(x,382)])

page('D05','Node adapter responsibilities','Validated browser fields are separated from the server-owned auth envelope.','Browser routes do not accept credentials, sender IDs or arbitrary forwarded targets.',[W+'server/api.mjs',W+'server/marketplace.mjs',W+'server/messages.mjs'],'Component')
grid([('createWebsiteServer','Serve dist + SPA fallback\nCSP / nosniff / no-cache API\nProcess-only /healthz'),('createApiHandler','Route + method allowlists\nOrigin checks on mutations\nSession Map / safe errors'),('createForwardingClient','Bootstrap service login\nVerify admin membership\nShare token refresh promise'),('handleMarketplace','Public + private listing DTOs\nPATCH statuses / image edits\nSame-origin image proxy'),('handleMessages','api/Message GET / POST\nParticipant token + safe projection\nMessage / offer validation'),('admin + clientIp','Permission matrix / projections\nExact target email selectors\nTrusted Render IP or socket')])

arrow([(429,250),(451,250)]);arrow([(829,250),(851,250)])
line([(640,357),(640,369),(239,369)]);line([(640,369),(1041,369)])
for x in [239,640,1041]:arrow([(x,369),(x,382)])

page('D06','Backend controller classes','HTTP paths are controller-relative, except Message uses the api/ prefix.','Controllers call shared authorization and Sql rather than browser components.',[B+'Controllers/*.cs',B+'Components/AppAuthJson.cs'],'Class')
grid([('Register','+ Post / Get / Patch\n+ Delete (admin target)\n+ ValidateFormatInfo()'),('LogIn / Admin','+ LogIn.Post / Delete\n+ Admin.Get/Post/Patch/Delete\nAccessToken.Generate()'),('Listing','+ GetListings / GetOne\n+ CreateListing / UpdateListing\n+ DeleteListing (backend only)'),('Message','+ GetConversations / GetUnread\n+ GetMessages / SendMessage\n+ FindOrCreateConversation'),('Schools / Category / Condition','+ Schools.Get/Post/Delete\n+ Category.Get/Post/Delete\n+ Condition.Get'),('Users / Blocked','+ Users.Get\n+ Blocked.Get/Delete\n+ tracking / cleanup helpers')])

page('D07','Request DTO inheritance','AppAuthJson carries application, visitor and forwarding identities.','Website allowlists prevent callers from supplying the shared security envelope.',[B+'Components/AppAuthJson.cs',B+'Controllers/Listing.cs',B+'Controllers/Message.cs'],'Class')
box(440,155,400,155,'AppAuthJson','+ app_access: string?\n+ access_token: string?\n+ ip / admin_token / to_user: string?',GOLD,'class')
for x,title,body_ in [(45,'Info / auth requests','Register.Info: user/location/profile\nSchools.Info: name / short_name\nAdmin.Info: level / locked'),(455,'Listing DTOs','GetListingsJson: search, user_page\nListingCreateModel: ImageBase64[]\nUpdate: status, Imgs[]'),(865,'MessageSendModel','listing_id OR conversation_id\nkind / text / amount\nSender derived from token')]:
    box(x,405,370,175,title,body_,BLUE,'class');line([(x+185,405),(x+185,350),(640,350),(640,310)])
    shape('polygon',points=[[640,310],[633,322],[647,322]],fill='#FFFFFF',stroke=INK)
text(640,365,'generalization to the common request base',12,width=440,align='center',color=MUTED)

page('D08','Core marketplace persistence classes','Schema metadata from checked-in Data.db; no user rows are read.','Listings own associations to an owner, category, condition, status, optional book and photos.', ['code/Backend/Data.db (schema only)',B+'Controllers/Listing.cs'],'Class')
for x,y,w,h,title,fields in [
    (55,170,290,140,'User','id / user_name / email\nschool_id / location'),
    (55,465,290,120,'Schools','id / name / short_name'),
    (505,310,280,155,'Listings','id / user_id / title / price\ncategory / condition / status\ndatetime / expiry'),
    (495,160,300,115,'Listings_Category','id / name / visable'),
    (935,170,290,140,'Img','id / list_id / name\nAPI limit: 8 photos'),
    (935,465,290,120,'Books','list_id / isbn'),
    (425,505,260,100,'Condition','id / name'),
    (710,505,190,100,'Status','id / name / lvl')]:box(x,y,w,h,title,fields,BLUE,'table')
line([(345,240),(405,240),(405,355),(505,355)])
text(385,286,'owner 1; listings 0..*',11,width=250)
line([(200,310),(200,465)]);text(220,378,'school 1; users 0..*',11,width=250)
line([(645,275),(645,310)]);text(665,286,'category 1',11,width=150)
line([(785,355),(860,355),(860,240),(935,240)]);text(793,316,'images 0..*',11,width=180)
line([(785,420),(860,420),(860,525),(935,525)]);text(795,443,'book 0..1',11,width=150)
line([(590,465),(590,488),(555,488),(555,505)]);text(425,477,'condition 1',11,width=140)
line([(740,465),(740,488),(805,488),(805,505)]);text(765,477,'status 1',11,width=140)

page('D09','Listing summaries versus full details','The website integrates both contracts and forwards the viewer token on detail reads.','Search preserves backend order; full details are fetched separately, with all image URLs.',[W+'server/marketplace.mjs',B+'Controllers/Listing.cs'],'Class')
for x,title,body_ in [(45,'Listing summary','id / title / price\ncategory / condition / user\nstatus / location / isbn\nimage_url / datetime\ndays (private inventory)'),(455,'GET Listing/{id}','description / seller identity\nemail (not a mailto action)\nimages_url: ordered array\nstatus / user / price\nViewer token when signed in'),(865,'ListingUpdate','id in website request\nPATCH Listing/{id}\nOnly changed nonblank fields\nstatus / imgs operations\nNo website listing DELETE')]:box(x,190,370,350,title,body_,[BLUE,GREEN,GOLD][x//410],'DTO')
text(70,575,'Backend computes hit-based ranking, then removes hit from summary output in this snapshot.',15,width=1140,color=MUTED)

sequence('D10','Login: browser cookie, backend token','The opaque cookie does not contain the backend access token.','Only a validated profile creates a session; failures never create a partial signed-in session.', ['AccountPanel','Node api handler','ASP.NET API','SQLite'],[(0,1,'POST /api/login: email + password'),(1,2,'POST LogIn + server envelope'),(2,3,'Validate credentials / find or issue token'),(3,2,'Token row / account data',True),(2,1,'access_token',True),(1,2,'GET Register with visitor token'),(2,1,'Validated profile',True),(1,0,'HttpOnly se_session cookie + profile',True)],[W+'src/hooks/useAccount.ts',W+'server/api.mjs',B+'Controllers/LogIn.cs'])
sequence('D11','Registration: normalize and persist','Registration and login are intentionally separate operations.','The backend generates the username; signup does not accept user/location or issue a session.', ['AccountPanel','Node adapter','Register controller','Sql / database'],[(0,1,'POST /api/register: profile + password'),(1,2,'POST Register + forwarding envelope'),(2,3,'Validate school / duplicate email / username'),(3,2,'School ID / uniqueness result',True),(2,3,'Insert normalized User with encrypted fields'),(3,2,'Commit / constraint outcome',True),(2,1,'201 email; 400 / 409 on invalid input',True),(1,0,'Show account-created; switch to login',True)],[W+'src/components/AccountPanel.tsx',B+'Controllers/Register.cs'])
sequence('D12','Profile update and read-back failure','Nullable location is safely omitted from blank changes; only changed fields are submitted.','A failed follow-up read does not repeat an already committed password/profile write.', ['ProfileForm','Node adapter','Register controller','Sql'],[(0,1,'PATCH /api/profile: changed nonblank fields'),(1,2,'PATCH Register with visitor token'),(2,3,'Normalize + update selected fields'),(3,2,'Committed',True),(2,1,'Update success',True),(1,2,'GET Register: read normalized profile'),(2,1,'Profile OR failed read',True),(1,0,'200 profile OR profile:null + reload notice',True)],[W+'src/components/AccountPanel.tsx',W+'server/api.mjs',B+'Controllers/Register.cs'])
sequence('D13','Targeted administration: caller versus target','Account deletion remains a privileged operation; listing removal is not account deletion.','Admin actions recheck membership and preserve caller sessions on target-rank denials.', ['AdminPage','Node adapter','AppAuthJson','Register / Sql'],[(0,1,'DELETE /api/admin/users: exact target'),(1,2,'GET Admin with caller token'),(2,1,'Current membership / permission',True),(1,2,'DELETE Register: caller token + to_user'),(2,3,'Resolve target; check rank / locked status'),(3,2,'Allowed target OR denial',True),(2,3,'Delete target account when eligible'),(3,1,'Deleted rows OR safe 403',True),(1,0,'Result; do not expire caller on target denial',True)],[W+'server/api.mjs',B+'Components/AppAuthJson.cs',B+'Controllers/Register.cs'])
sequence('D14','Forwarding token renewal','The service token is separate from the visitor token.','Only forwarding-expiry rejection before the operation can trigger one safe retry.', ['Website operation','Forwarding client','LogIn / Admin','API controller'],[(0,1,'call(route, method, fields, visitor IP)'),(1,2,'Bootstrap service login + membership check'),(2,1,'Shared service token',True),(1,3,'Visitor fields + app_access + ip + admin_token'),(3,1,'[forwarding expired] rejection',True),(1,2,'Coalesced service-token refresh'),(2,1,'Fresh token',True),(1,3,'Retry exactly once with same visitor fields'),(3,0,'Result; no retries of ordinary failures',True)],[W+'server/api.mjs',B+'Components/AppAuthJson.cs'])
sequence('D15','Logout and messenger cleanup','User-token revocation and local-cookie clearing are distinct steps.','Failed logout keeps the account; confirmed logout unmounts private conversations and drafts.', ['AccountPanel','useAccount / App','Node adapter','LogIn controller'],[(0,1,'Log out'),(1,2,'POST /api/logout + opaque cookie'),(2,3,'DELETE LogIn with visitor token'),(3,2,'Revoke backend user tokens / response',True),(2,1,'Remove local matching sessions; clear cookie',True),(1,0,'Profile becomes null; show sign-out notice',True),(1,1,'Unmount Messenger; abort reads and sends')],[W+'src/hooks/useAccount.ts',W+'src/components/Messenger.tsx',W+'server/api.mjs'])
activity('D16','Browse, search and inspect live listings',[('Submit title search + optional category / ISBN','Public seller pages retain user_page.'),('Adapter validates; backend GET Listing with JSON body','user_page and for_user are exclusive.'),('Rank by popularity and fuzzy word relevance','More than 2,000 candidates: basic pre-rank.'),('Render results; select a listing for full details','Condition/location/sort/pagination in browser.'),('Message seller or open public seller collection','Guest contact prompts login; own listing disabled.')],[W+'src/components/Marketplace.tsx',B+'Controllers/Listing.cs'],'Marketplace results and contacts use the backend; no local sample-message delivery is claimed.')
activity('D17','Authorization and target forwarding',[('Validate application key and forwarding admin token','Reject invalid forwarding before execution.'),('Resolve visitor access token and expiry','Visitor token remains the caller identity.'),('If to_user: caller must be an administrator','Ordinary browser fields cannot inject to_user.'),('Resolve target and enforce rank / locked rules','Admin target lower than caller; locked needs 30+.'),('Apply controller-specific ownership / level checks','Denied target does not impersonate another user.')],[B+'Components/AppAuthJson.cs',W+'server/admin.mjs'],'IP forwarding and user forwarding are different mechanisms and use different fields.')
activity('D18','Attempt windows and temporary blocking',[('Read user/IP attempt record under its lock','User and IP counters remain separate.'),('Expired record? Reset window and count','A successful new window records count -1.'),('On failure: upsert count and expiry','Escalation uses configured attempt/window rules.'),('At threshold: reject access; user tokens revoked','Snapshot defaults: 10 attempts / 5 minutes.'),('Scheduled cleanup removes expired records','A successful record is not itself a block.')],[B+'Controllers/Users.cs',B+'Components/IP.cs',B+'Components/Env.cs'],'The counter model includes successful observations, failed attempts and expired windows.')

# Common state view: nodes and guarded transitions, without claiming all are terminal.
def states(id,title,nodes,edges,src,takeaway):
    page(id,title,'State view: transitions have events/guards; labels describe observable state.',takeaway,src,'State machine')
    positions=[(55,185),(490,185),(925,185),(55,445),(490,445),(925,445)]
    for i,(name,body_) in enumerate(nodes):
        x,y=positions[i];box(x,y,300,140,name,body_,GREEN,'state')
    for a,b,label in edges:
        ax,ay=positions[a];bx,by=positions[b]
        if ay==by:arrow([(ax+300,ay+70),(bx,by+70)],label,labelpos=((ax+300+bx)/2,ay+44))
        elif ax==bx:arrow([(ax+150,ay+140),(bx+150,by)],label,labelpos=(ax+150,(ay+140+by)/2-15))
        else:arrow([(ax+300,ay+110),(bx+150,ay+210),(bx+150,by)],label,labelpos=(bx+150,ay+190))
states('D19','Website session lifecycle',[('Anonymous','No valid local session\nPublic browse still works'),('Signed in','Map: token + expires\nHttpOnly opaque cookie'),('Restored','GET profile confirms token\nMessenger starts collapsed'),('Expired / revoked','Local or backend expiry\nClear cookie + private UI'),('Logged out','Backend logout succeeded\nMatching local entries removed'),('Server restarted','Process-memory Map lost\nVisitors must sign in again')],[(0,1,'validated login'),(1,2,'profile restore'),(0,3,'invalid session'),(1,4,'logout success'),(2,5,'process restart')],[W+'src/hooks/useAccount.ts',W+'server/api.mjs'],'Local session: 12 hours; backend token clocks are independent (21 days student, 3 days admin).')
states('D20','Website routes and public navigation',[('Browse /','Live cards + filters\nSelected listing is React state'),('Listing details','GET Listing/{id}\nGallery + Message seller'),('Public seller page','/sellers/{username}\nGET Listing user_page'),('Account panel','Inline login/profile UI\nNullable fields safe'),('Seller portal','/seller; login gate\nCreate/edit/status/photos'),('Admin console','/admin; membership gate\nScoped privileged actions')],[(0,1,'select card'),(1,2,'seller collection'),(0,3,'account button'),(1,4,'seller portal nav'),(2,5,'admin nav + permission')],[W+'src/App.tsx',W+'src/components'],'Listing details do not have a dedicated URL in this source; seller pages do.')

page('D21','Deployment and runtime artifacts','Checked-in deployment configuration is modeled, not a verified production topology.','The website needs its Node API adapter; static dist hosting alone is insufficient.',[W+'render.yaml',W+'server/index.mjs',B+'Program.cs'],'Deployment')
box(45,180,350,350,'Browser execution','«artifact» React / CSS assets\nSame-origin /api fetch\nCookie: se_session\nNo app keys / visitor tokens\nClipboard: public seller URL',BLUE,'device')
box(465,180,350,350,'Render Node service','Node 24.19.0 / one instance\n«artifact» dist/ + server/*.mjs\nEnvironment: backend + credentials\nProcess-memory session Map\nHTTPS + trusted edge-IP setting',GREEN,'executionEnvironment')
box(885,180,350,350,'ASP.NET host','net9.0 controller application\n«artifact» SQLite database file\n«artifact» public/uploads\nForwarded headers / HTTPS\nDaily maintenance worker',GOLD,'executionEnvironment')
arrow([(395,370),(465,370)],'HTTPS',labelpos=(430,345));arrow([(815,370),(885,370)],'HTTPS',labelpos=(850,345))
text(75,565,'No deployment action or production mutation was performed to create these diagrams.',15,width=1130,color=MUTED)

page('D22','Package and module dependencies','Dashed arrows represent compile-time/module dependencies; API calls cross runtime boundaries.','Browser API modules depend on same-origin requests, not the ASP.NET implementation.',[W+'src/api',W+'server',B+'Controllers',B+'Components'],'Package')
for x,y,title,body_ in [(60,180,'React components','App / AccountPanel / Marketplace\nSellerPortal / ListingEditor\nAdminPage / Messenger'),(490,180,'Browser API clients','accounts.ts / admin.ts\nmarketplace.ts / messages.ts\nrequest<T>()'),(920,180,'Node adapter modules','api.mjs / admin.mjs\nmarketplace.mjs / messages.mjs\nclient-ip.mjs'),(60,445,'Backend controllers','Register / LogIn / Admin / Users\nListing / Message\nSchools / Category / Condition'),(490,445,'Shared backend helpers','AppAuthJson / IP / Users\nEnv / AccessToken / Utilz\nDeterministicEncryption'),(920,445,'Sql + Sql.Trans','Microsoft.Data.Sqlite\nReader/writer locking\nParameterized persistence')]:box(x,y,300,145,title,body_,BLUE,'package')
arrow([(360,250),(490,250)],'imports',True,labelpos=(425,227));arrow([(790,250),(920,250)],'HTTP /api',True,labelpos=(855,227));arrow([(360,515),(490,515)],'calls',True,labelpos=(425,493));arrow([(790,515),(920,515)],'calls',True,labelpos=(855,493))

sequence('D23','Startup and maintenance collaboration','The initial Task.Run and scheduled worker can overlap host startup.','Maintenance behavior comes from Program.cs, not an assumed migration or message-cleanup job.', ['Program','Env / filesystem','Maitenance','Cleanup / Sql'],[(0,1,'Load backend environment; ensure uploads folder'),(0,3,'Task.Run(Schedule): asynchronous initial cleanup'),(0,2,'Construct daily worker at 03:24'),(0,0,'Build app / map controllers / run host'),(2,3,'Schedule: LogIn, Users, IP, Listing cleanup'),(3,3,'Expire tokens and attempts; update listing states'),(3,3,'Aggregate IP/user hit tallies; inspect orphan images')],[B+'Program.cs',B+'Components/Maitenance.cs',B+'Controllers/Listing.cs'])
sequence('D24','Edit or deactivate a seller listing','The website sends PATCH, including when the user chooses Set Inactive.','No website removal action calls backend DELETE Listing; inventory and photos are retained.', ['SellerPortal / editor','Node marketplace','Listing controller','Sql.Trans / uploads'],[(0,1,'GET detail and catalog for editing'),(1,2,'GET Listing/{id} with visitor token'),(2,1,'Full details + ordered photos',True),(0,1,'PATCH: id + changed fields / status / imgs'),(1,2,'PATCH Listing/{id} + visitor identity'),(2,3,'Check ownership/status; validate; transact edits'),(3,2,'Commit; remove superseded photo files',True),(2,1,'Update success / safe failure',True),(1,0,'Keep inventory; refresh saved status',True)],[W+'src/components/ListingEditor.tsx',W+'server/marketplace.mjs',B+'Controllers/Listing.cs'])

page('D25','Communication diagram: login collaborators','Numbered messages show the same login collaboration as D10.','The browser receives a cookie/profile; the backend token remains a Node-side session value.',[W+'server/api.mjs',B+'Controllers/LogIn.cs'],'Communication')
for x,y,title,body_ in [(60,190,'AccountPanel','Visitor enters email/password'),(490,190,'createApiHandler','Validate Origin + input\nCreate / rotate local session'),(920,190,'createForwardingClient','Service token + visitor IP'),(490,440,'LogIn + Register','Issue visitor token\nRead normalized profile'),(920,440,'Sql','Users / Access_Token')]:box(x,y,300,140,title,body_,BLUE,'object')
arrow([(360,250),(490,250)],'1: login',labelpos=(425,225));arrow([(790,250),(920,250)],'2: call',labelpos=(855,225));arrow([(1045,330),(1045,387),(640,387),(640,440)],'3: authenticate',labelpos=(805,365));arrow([(790,510),(920,510)],'4: read/write',labelpos=(855,485));arrow([(490,510),(210,510),(210,330)],'5: safe profile + cookie',labelpos=(350,486))

sequence('D26','End-to-end messages and offers','One conversation per listing and buyer; Node mediates every browser/API exchange.','No local fake send or email contact: messages and offers are persisted through api/Message.', ['Messenger','Node messages','Message controller','Sql'],[(0,1,'POST listing_id OR conversation_id + text/offer'),(1,2,'POST api/Message + participant visitor token'),(2,3,'Validate participant/rate; find/create; insert'),(3,2,'Commit message',True),(2,1,'201 conversation_id',True),(1,0,'Confirmed send',True),(0,1,'GET thread?conversation_id=&after='),(1,2,'GET api/Message/{id}?after='),(2,1,'Read history; mark incoming messages read',True),(1,0,'Projected message history',True)],[W+'src/components/Messenger.tsx',W+'server/messages.mjs',B+'Controllers/Message.cs'])
sequence('D27','Public seller page: user_page filter','Public seller pages are different from authenticated seller inventory.','user_page never combines with for_user, a visitor token, or an admin target selector.', ['Visitor / App','Marketplace client','Node marketplace','Listing controller'],[(0,1,'Open /sellers/{username} or detail seller link'),(1,2,'GET /api/listings?user_page=username'),(2,3,'GET Listing JSON: user_page + optional filters'),(3,2,'Only this seller; Active / Sold records',True),(2,1,'Projected public summaries',True),(1,0,'Render seller heading + collection',True),(0,1,'Search / clear filters, retaining seller scope')],[W+'src/App.tsx',W+'server/marketplace.mjs',B+'Controllers/Listing.cs'])

page('D28','Listing status lifecycle','Common paths shown; the backend enforces permissions for every edit.','Inactive is retained, not deleted. Sold remains public; Blocked requires administrator intervention.',[B+'Controllers/Listing.cs',B+'Components/Env.cs',W+'src/components/SellerPortal.tsx'],'State machine')
for x,y,title,body_ in [(50,215,'Active','Public listing\nDefault created status'),(490,215,'Inactive','Hidden from browse\nRecord + photos retained'),(930,215,'Sold','Visible; unavailable\nExisting chats remain'),(50,460,'Expired','Expiry elapsed\nRenew when eligible'),(930,460,'Blocked','Admin-only target status\nNo seller edits')]:box(x,y,300,130,title,body_,GREEN,'state')
arrow([(350,280),(490,280)],'Set Inactive',labelpos=(420,255))
arrow([(200,215),(200,174),(1080,174),(1080,215)],'Mark as Sold',labelpos=(640,154))
arrow([(200,345),(200,460)],'expiry elapsed',labelpos=(270,391))
arrow([(100,460),(100,345)],'Renew',labelpos=(92,391))
arrow([(490,320),(420,320),(420,372),(200,372),(200,345)],'reactivate',labelpos=(420,350))
arrow([(350,310),(375,310),(375,420),(1225,420),(1225,460)],'admin moderation',labelpos=(900,397))
text(435,474,'Renew: within 14 days of expiry/check deadline.\nStudent targets: Active / Inactive / Sold / Renew.\nSetting Expired / Blocked, or editing Blocked: admin ≥ 10.\nAdmin may transition between all stored statuses.',14,width=455)

sequence('D29','Photo creation and incremental edits','At most eight photos per listing; each decoded file is at most 2 MiB.','Image operations use original zero-based locations; the first photo remains the cover.', ['Seller / editor','Node adapter','Listing controller','Database + files'],[(0,1,'Create: imageBase64[]; PATCH: imgs[]'),(1,2,'Validate size/type; forward visitor identity'),(2,3,'Read original image order for edits'),(3,2,'Image IDs / names',True),(2,2,'Validate insert / replace / delete locations'),(2,3,'Save new files + transactional photo rows'),(3,2,'Commit rows',True),(2,3,'Delete superseded files after commit'),(2,0,'Success via adapter; gallery uses proxied URLs',True)],[W+'src/components/ListingEditor.tsx',W+'server/marketplace.mjs',B+'Controllers/Listing.cs'])
states('D30','Messenger UI and delivery states',[('Signed out','No messenger rendered\nNo private polling'),('Collapsed','Mounted after login\nUnread badge / 15s poll'),('Inbox open','Conversation previews\n15s refresh while visible'),('Listing draft','Message seller target\nLogin first when needed'),('Thread open','History cursor / 10s poll\nRead marks incoming messages'),('Send outcome','Success: reload confirmed rows\nFailure: keep draft + error')],[(0,1,'login'),(1,2,'open'),(0,3,'contact + login'),(2,4,'select conversation'),(3,4,'existing/new conversation'),(4,5,'message / offer')],[W+'src/App.tsx',W+'src/components/Messenger.tsx'],'Minimize preserves drafts; route navigation preserves the widget; logout aborts and unmounts private state.')

page('D31','Messaging and engagement persistence','Runtime schema metadata complements the incomplete DB_Schema.txt snapshot.','Message sender and conversation participants reference User; hit tallies are ranking inputs.', ['code/Backend/Data.db (schema only)',B+'Controllers/Message.cs',B+'Controllers/Listing.cs'],'Class')
grid([('Conversations','id / listing_id / buyer_id / seller_id\nUser 1 → 0..* as buyer or seller\nListing 1 → 0..* conversations'),('Messages','id / conversation_id / sender_id\nkind / body / amount / datetime\nread_datetime nullable'),('Check_Active','list_id / expiry\nListing 1 → 0..1 pending check\nRenew may clear check'),('Hit_Count','list_id / count\nListing 1 → 0..1 aggregate\nComputed in cleanup'),('Hit_Count_Tally','list_id / ip / size\nListing + IP association\nAnonymous detail engagement'),('Hit_Count_Tally_User','list_id / user / size\nListing + User association\nSigned-in views + buyer messages')])
line([(429,250),(451,250)])
text(60,608,'Conversations 1 → 0..* Messages; User 1 → 0..* Messages as sender.',12,width=1140,color=MUTED)
page('D32','Identity and access persistence','These table classes describe stored records, not an ORM entity layer.','The in-memory website session Map is separate from backend Access_Token rows.', ['code/Backend/Data.db (schema only)',B+'Components/AppAuthJson.cs',B+'Controllers/Users.cs'],'Class')
grid([('Access_Token','id / user_id / token / expiry\nUser 1 → 0..* tokens\nBackend revocation affects all clients'),('Admins','user_id / level / locked\nUser 1 → 0..1 membership\nTarget rank rules use membership'),('IP','id / encrypted ip / datetime\nIP 1 → 0..* user associations'),('User_Has_IPs','user_id / ip_id\nMany-to-many association\nUser + IP identities remain distinct'),('Blocked_Users','id / user_id / count / expiry\nUser 1 → 0..1 current window\nThreshold may revoke tokens'),('Blocked_IPs','id / ip_id / count / expiry\nIP 1 → 0..1 current window\nSuccessful count may equal -1')])

# Support pages replace old findings rather than preserving outdated preview claims.
page('KEY','Notation and reading key','UML views separate goals, structure, interaction, states and deployment.','Modeled table classes are not asserted to be C# entities; React functions are components.',['Atlas notation / renderer'],'Notation')
grid([('«component» / «package»','Responsibility or module boundary\nArrow: uses / sends a request\nDashed arrow: dependency'),('«class» / «DTO»','Name / fields / operations\nHollow triangle: inheritance\n+ denotes public member'),('«table» / multiplicity','Stored record / keys / associations\n1, 0..1, 0..* refer to cardinality\nAPI constraints labeled separately'),('Sequence lifeline','Top: collaborating participant\nDownward order: time\nDashed arrow: reply'),('Activity / state','Rounded box: action or state\nGuard/event text on transitions\nCommon paths, not all permutations'),('«executionEnvironment»','Host/runtime boundary\nArtifacts: code, DB, files\nConfig is not runtime verification')])
page('ACCESS','Authorization matrix and token lifetimes','Permissions come from adapter checks plus controller-specific backend rules.','IP forwarding is not user impersonation; messaging always uses the participant visitor token.',[W+'server/admin.mjs',B+'Components/AppAuthJson.cs',B+'Components/Env.cs'],'Reference')
text(65,165,'Role / level',16,bold=True);text(380,165,'Permitted goals and limitations',16,bold=True)
rows=[('Visitor','Public browse / details / seller pages; register / log in.'),('Student','Own profile / inventory; messages and offers as participant.'),('Admin 0','Admin membership and eligible session sign-out.'),('Admin > 0','Grant / change / remove lower-ranked admin membership.'),('Admin 10+','Users, profiles, schools, listing moderation and categories.'),('Admin 20+ / 27+','Attempt records (20); directory admin levels (27).'),('Admin 30+','Locked-admin controls and additional target eligibility.'),('Session clocks','Website 12h; ordinary backend 21d; admin backend 3d.')]
for i,(a,b) in enumerate(rows):
 y=205+i*46;rect(55,y-4,1170,41,BLUE if i%2==0 else '#FFFFFF');text(65,y+4,a,13,width=290,bold=True);text(380,y+4,b,13,width=815)
page('GAPS','Evidence limits and integration findings','Document the implementation faithfully without inventing missing features.','Historical sample-only claims are removed; remaining findings are tied to this source snapshot.', ['code/Frontend', 'code/Backend/Data.db schema',B+'Controllers/Listing.cs'],'Review')
grid([('Schema snapshot is stale','DB_Schema.txt omits messaging and\nengagement tables and newer columns.\nData.db schema + SQL are evidence.'),('Summary hit output','Listing.GetListings ranks by hits\nbut removes hit before output.\nUI metrics remain optional.'),('Source versus deployment','Render config / backend code show\nintended boundaries, not verified\nproduction instances or credentials.'),('Supported offer scope','Offers are persisted proposals.\nNo acceptance / payment / purchase\ntransaction endpoint is modeled.'),('Website removal policy','Backend DELETE Listing still exists.\nWebsite rejects listing DELETE and\nPATCHes status Inactive instead.'),('Maintenance caveat','Listing.CleanUp checks !Directory.Exists\nbefore enumerating upload files.\nOrphan cleanup is not guaranteed.')])
page('TRACE','Evidence and reproducibility','All source references resolve inside the combined StudentExchange repository.','Source commit pins the modeled code; validation does not claim production behavior.', ['docs/uml/build_model.py', 'model.json', 'render.py'],'Traceability')
text(65,175,'Implementation snapshot: '+COMMIT,16,width=1140,bold=True)
text(65,225,'Website/ = code/Frontend/StudentExchange-Website/\nBackend/ = code/Backend/StudentExchangeBck/\nSchema = code/Backend/Data.db (metadata only, read-only)\nModel generation = build_model.py → model.json\nRendering = render.py → editable PPTX + vector PDF + individual SVGs\nDetailed file links and diagram responsibilities = TRACEABILITY.md\nChecks, rendered review and scope limits = VALIDATION.md',19,width=1110)

# Insert index after cover, retain stable IDs used by existing links.
page('GUIDE','Diagram index','Follow one flow across structural and behavioral views.','32 diagrams + six reference pages; view all exports or open an individual SVG.',['See README.md + TRACEABILITY.md'],'Index')
for i,p in enumerate([p for p in slides if p['id'].startswith('D')]):
 x=55+(i//16)*600;y=164+(i%16)*27
 text(x,y,p['id']+'  '+p['title'],13,width=575)
index=slides.pop();slides.insert(1,index)
model={'version':1,'width':1280,'height':720,'source_commit':COMMIT,'source_repository':'https://github.com/supracharger/StudentExchange','source_roots':{'Website':'code/Frontend/StudentExchange-Website','Backend':'code/Backend/StudentExchangeBck'},'slides':slides}
(BASE/'model.json').write_text(json.dumps(model,indent=2,ensure_ascii=False)+'\n')
# Full source paths belong in Markdown rather than tiny diagram footnotes.
lines=['# Diagram source traceability','',f'Modeled source: `supracharger/StudentExchange` at `{COMMIT}`. Only repository source and SQLite schema metadata were inspected; no application records were read.','', '`Website/` means `code/Frontend/StudentExchange-Website/`; `Backend/` means `code/Backend/StudentExchangeBck/`.','', '| ID | View | Evidence |','| --- | --- | --- |']
for p in slides:
 links=[]
 for src in sources[p['id']]:
  path=src.replace('Website/','code/Frontend/StudentExchange-Website/').replace('Backend/','code/Backend/StudentExchangeBck/') if src.startswith(('Website/','Backend/')) else src
  if path.startswith('code/'):
   clean=path.split(' (')[0]
   if '*' in clean:clean=clean.rsplit('/',1)[0]
   links.append(f'[{src}]({SOURCE_REPO}/tree/{COMMIT}/{clean})')
  elif path in ['model.json','render.py','build_model.py']:links.append(f'[{src}]({path})')
  else:links.append(f'`{src}`')
 lines.append(f'| [{p["id"]}](svg/{p["id"]}.svg) | {p["title"]} | '+ '<br>'.join(links)+' |')
(BASE/'TRACEABILITY.md').write_text('\n'.join(lines)+'\n')
print(f'Built {len(slides)} slides from {COMMIT}.')
