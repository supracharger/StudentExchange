#!/usr/bin/env python3
"""Define the DFD hierarchy and preserve boundary data during decomposition.

This is the semantic source. render.py lays it out using Graphviz and produces
the editable slides. validate.py checks structure and boundary conservation.
"""
import json
from pathlib import Path

BASE=Path(__file__).resolve().parent
nodes={}; atoms={}; graphs=[]; counter=0
SOURCE='f91b923f4ec8f1072b3dda07070916459342d7a2'

def node(id,name,kind,group=None,physical=None,status='implemented'):
 nodes[id]=dict(id=id,name=name,kind=kind,group=group,physical=physical,status=status)
 return id
for id,name in [('E1','Visitor / student'),('E2','Administrator'),('E3','Direct listing API client')]:node(id,name,'external')
groups={'G1':'Marketplace preview records','G2':'Account reference records','G3':'Security records','G4':'Website session records','G5':'Runtime service records','G6':'Listing records'}
for id,name in groups.items():node(id,name,'store',status='incomplete' if id=='G6' else 'implemented')
storedefs=[('D1','Sample catalog','G1','src/data/listings.ts · bundled constant'),('D2','Preview conversation','G1','App.tsx · messages[] in browser memory'),('D3','School directory','G2','SQLite Schools'),('D4','User accounts','G2','SQLite User'),('D5','Admin memberships','G3','SQLite Admins'),('D6','Access tokens','G3','SQLite Access_Token'),('D7','User attempt records','G3','SQLite Blocked_Users'),('D8','IP registry','G3','SQLite IP'),('D9','User / IP links','G3','SQLite User_Has_IPs'),('D10','IP attempt records','G3','SQLite Blocked_IPs'),('D11','Website sessions','G4','Node sessions Map · opaque ID → token / expiry'),('D12','Service token cache','G5','Node forwarding-client closure'),('D13','Runtime settings','G5','Server environment + backend Env policy / paths'),('D14','Listing records','G6','Listings table inferred from SQL; missing from DDL'),('D15','Lock metadata','G5','Users._userLock and IP lock dictionaries')]
for id,name,group,physical in storedefs:node(id,name,'store',group,physical,'incomplete' if id=='D14' else 'preview' if id in ['D1','D2'] else 'implemented')

def atom(id,label,fields,store=None):atoms[id]=dict(id=id,label=label,fields=fields,store=store);return id
ad=[
 ('browse','Browse criteria','query, category, selectedListingId'),('message','Message draft','selectedListingId, messageInput'),('offer','Offer draft','selectedListingId, offerAmount'),
 ('cards','Listing selection view','filtered sample cards, selected detail, empty state'),('messages','Message preview','local message strings, display state'),('offers','Offer preview','formatted local offer string, display state'),
 ('register','Registration fields','email, first_name, last_name, password, school'),('login','Login credentials','email, password'),('read_profile','Profile read request','opaque session cookie'),('edit_profile','Profile change request','opaque cookie, selected nonblank fields'),('logout','Logout request','opaque session cookie or no cookie'),('schools','School lookup request','public directory request'),
 ('registration_result','Registration result','normalized email, created status or validation/conflict/service error'),('login_result','Login result','public profile, opaque cookie or safe error'),('profile_result','Profile view','email, first_name, last_name, school or safe error'),('edit_result','Profile change result','saved notice, public profile or null, validation/conflict/error'),('logout_result','Logout confirmation','expired cookie, qualified sign-out message or safe error'),('school_result','School directory view','school names or safe error'),
 ('admin_status','Membership inquiry','caller cookie'),('admin_users','User management request','caller cookie, target email, optional profile fields, operation'),('admin_schools','School management request','caller cookie, name, short_name, operation'),('admin_roles','Admin assignment request','caller cookie, to_user, level, optional locked, operation'),('admin_attempts','Attempt management request','caller cookie, email XOR ip_addr for clearing, operation'),('admin_logout','Target sign-out request','caller cookie, target email'),
 ('status_result','Membership view','is_admin, level, projected permission flags or safe error'),('users_result','User management result','directory, target profile, saved/deleted confirmation or safe error'),('schools_result','School management result','school directory, mutation confirmation or safe error'),('roles_result','Admin assignment result','target email, granted/changed/removed confirmation or safe error'),('attempts_result','Attempt management result','user/IP observations, cleared row count or safe error'),('signout_result','Target sign-out confirmation','qualified request confirmation or safe error; not deletion proof'),
 ('listing_read','Listing query','optional category'),('listing_create','Listing creation fields','Title, Description, Price, Category, UserId'),('listing_delete','Listing deletion selector','path listing ID'),('listing_view','Listing query result','listing fields and joined user email/name or service error'),('listing_created','Listing creation result','creation confirmation or service error'),('listing_deleted','Listing deletion result','deleted confirmation, not-found result or service error'),
 ('account_access','Account access data','operation, app envelope, verified IP, session token if present, login evidence if applicable'),('account_assessment','Account access assessment','prepared envelope, resolved identity, block/validation result, safe error'),('admin_access','Admin access data','operation, caller token, target selector, server-owned IP/envelope'),('admin_assessment','Admin access assessment','fresh caller membership, eligible target context, block/validation result'),
]
for x in ad:atom(*x)
sd=[
 ('catalog','Sample catalog data','sample ID, title, category, price, school, condition, art fields','D1'),('conversation','Preview conversation data','App.messages[] strings, current draft / display context','D2'),('preview_changes','Preview text updates','appended message or formatted offer text; browser memory only','D2'),
 ('school_rows','School reference data','id, name, short_name','D3'),('user_rows','Account reference data','id, encrypted email/password, names, school_id, datetime','D4'),('new_user','New account record','normalized/encrypted registration fields, school_id, timestamp','D4'),('changed_user','Profile record changes','selected validated fields, selected user ID','D4'),('deleted_user','Account deletion data','selected user ID','D4'),('changed_school','School record changes','normalized name, short_name','D3'),('deleted_school','School deletion data','name and/or short_name selectors','D3'),
 ('admin_rows','Admin membership data','user_id, level, locked','D5'),('token_rows','Access token data','user_id, token, expiry','D6'),('new_token','User token record','user_id, random token, expiry','D6'),('revoked_token','User token revocation data','selected user ID; all tokens for that user','D6'),('admin_changes','Admin membership changes','selected user_id, level, optional locked or removal selector','D5'),('target_revocation','Target token revocation data','selected eligible target user ID','D6'),
 ('user_attempts','User attempt data','user_id, count, expiry','D7'),('ip_registry','IP identity data','id, encrypted IP, datetime','D8'),('ip_links','User / IP relationship data','user_id, ip_id','D9'),('ip_attempts','IP attempt data','ip_id, count, expiry','D10'),('cleared_user_attempts','User attempt removal data','selected user ID','D7'),('cleared_ip_attempts','IP attempt removal data','selected IP ID','D10'),
 ('service_token','Service token record','service user_id, login-issued token, expiry','D6'),('user_attempt_changes','User attempt updates','new count/expiry or first observation','D7'),('ip_identity_changes','IP identity updates','new encrypted IP and timestamp','D8'),('ip_link_changes','User / IP link updates','selected user_id, selected ip_id','D9'),('ip_attempt_changes','IP attempt updates','new count/expiry or first observation','D10'),('blocked_token_removals','Blocked-user revocation data','user ID at count 10; all tokens removed','D6'),
 ('session_rows','Website session data','opaque ID, backend user token, fixed 12-hour expiry','D11'),('session_changes','Website session updates','new opaque ID → user token + expiry','D11'),('session_removals','Website session removal data','old login ID, matching-token IDs or invalid/expired ID','D11'),
 ('settings','Runtime configuration data','app credential, service identity credentials, auth policies, paths; names only','D13'),('service_cache','Cached service identity data','cached admin token and identity context','D12'),('service_cache_changes','Service cache updates','fresh verified admin token or invalidation','D12'),('lock_rows','Lock metadata records','identity ID, last-use timestamp; lock mechanics omitted','D15'),('lock_changes','Lock metadata updates','identity key and usage timestamp','D15'),
 ('expired_tokens','Token expiry records','token record ID, expiry; expiry predicate applied by process','D6'),('expired_users','User attempt expiry records','attempt record ID, expiry','D7'),('expired_ips','IP attempt expiry records','attempt record ID, expiry','D10'),('token_cleanup','Expired token removal data','expired token IDs / expiry predicate','D6'),('user_cleanup','Expired user-attempt removal data','expired user-attempt IDs / expiry predicate','D7'),('ip_cleanup','Expired IP-attempt removal data','expired IP-attempt IDs / expiry predicate','D10'),('lock_cleanup','Stale lock removal data','identity keys meeting stale-lock predicate','D15'),
 ('listing_rows','Stored listing data','id, title, description, price, category, user_id, datetime','D14'),('new_listing','New listing record','validated SQL parameters, supplied UserId, UTC datetime','D14'),('deleted_listing','Listing deletion data','listing ID','D14'),
]
for x in sd:atom(*x)

def edge(a,b,label,aa,id=None):
 global counter
 counter+=1
 return dict(id=id or f'F{counter:03}',source=a,target=b,label=label,atoms=list(aa))
def proc(id,name):node(id,name,'process');return id
for id,name in [('1.0','Present marketplace previews'),('2.0','Manage accounts and sessions'),('3.0','Manage administration'),('4.0','Prepare and assess access'),('5.0','Maintain security records'),('6.0','Manage direct listings')]:proc(id,name)
root=dict(id='L0',title='Level-0 | Student Exchange data flows',level='Level-0',scope='Website, Node adapter, backend and logical storage',parent=None,process=None,inside=[f'{i}.0' for i in range(1,7)],edges=[],source='Website/src/App.tsx; server/api.mjs, admin.mjs; Backend/Controllers/*, Components/*',note='Grouped stores are expanded into named primitive stores below. Listing API access is independent of the website.')
def re(a,b,label,*aa):root['edges'].append(edge(a,b,label,aa))
re('E1','1.0','Marketplace intent','browse','message','offer');re('1.0','E1','Marketplace preview','cards','messages','offers')
re('E1','2.0','Account requests','register','login','read_profile','edit_profile','logout','schools');re('2.0','E1','Account results','registration_result','login_result','profile_result','edit_result','logout_result','school_result')
re('E2','3.0','Admin requests','admin_status','admin_users','admin_schools','admin_roles','admin_attempts','admin_logout');re('3.0','E2','Admin results','status_result','users_result','schools_result','roles_result','attempts_result','signout_result')
re('E3','6.0','Direct listing requests','listing_read','listing_create','listing_delete');re('6.0','E3','Direct listing results','listing_view','listing_created','listing_deleted')
re('G1','1.0','Preview records','catalog','conversation');re('1.0','G1','Preview text updates','preview_changes')
re('2.0','4.0','Account access data','account_access');re('4.0','2.0','Account assessment','account_assessment')
re('3.0','4.0','Admin access data','admin_access');re('4.0','3.0','Admin assessment','admin_assessment')
re('G2','2.0','Account references','user_rows','school_rows');re('2.0','G2','Account mutations','new_user','changed_user')
re('G3','2.0','Token eligibility data','admin_rows','token_rows');re('2.0','G3','Token mutations','new_token','revoked_token')
re('G4','2.0','Session records','session_rows');re('2.0','G4','Session mutations','session_changes','session_removals')
re('G2','3.0','User / school references','user_rows','school_rows');re('3.0','G2','Managed record changes','changed_user','deleted_user','changed_school','deleted_school')
re('G3','3.0','Admin / attempt references','admin_rows','token_rows','user_attempts','ip_registry','ip_links','ip_attempts');re('3.0','G3','Security record changes','admin_changes','cleared_user_attempts','cleared_ip_attempts','target_revocation')
re('G2','4.0','Identity references','user_rows');re('G3','4.0','Security reference data','admin_rows','token_rows','user_attempts','ip_registry','ip_links','ip_attempts')
re('4.0','G3','Security observations','service_token','user_attempt_changes','ip_identity_changes','ip_link_changes','ip_attempt_changes','blocked_token_removals')
re('G5','4.0','Runtime service data','settings','service_cache','lock_rows');re('4.0','G5','Runtime cache updates','service_cache_changes','lock_changes')
re('G3','5.0','Expiry records','expired_tokens','expired_users','expired_ips');re('5.0','G3','Expired-record removals','token_cleanup','user_cleanup','ip_cleanup')
re('G5','5.0','Lock metadata','lock_rows');re('5.0','G5','Stale lock removals','lock_cleanup')
re('G6','6.0','Listing records','listing_rows');re('6.0','G6','Listing mutations','new_listing','deleted_listing');re('G2','6.0','Listing owner references','user_rows')

proc('0','Student Exchange')
context=dict(id='C0',title='Context | Student Exchange',level='Context',scope='Entire implemented system, with preview and listing limitations stated',parent=None,process=None,inside=['0'],edges=[],source='Website/src/App.tsx; server/api.mjs; Backend/Controllers/Listing.cs',note='One system process, external entities and boundary data only. Internal stores do not appear.')
for ent,ins,outs in [('E1',['1.0','2.0'],['1.0','2.0']),('E2',['3.0'],['3.0']),('E3',['6.0'],['6.0'])]:
 for incoming,pp in [(True,ins),(False,outs)]:
  es=[e for e in root['edges'] if (e['source']==ent and e['target'] in pp) if incoming] if incoming else [e for e in root['edges'] if e['target']==ent and e['source'] in pp]
  aa=[a for e in es for a in e['atoms']]
  label=('Marketplace + account requests' if ent=='E1' else 'Administration requests' if ent=='E2' else 'Direct listing requests') if incoming else ('Marketplace + account results' if ent=='E1' else 'Administration results' if ent=='E2' else 'Direct listing results')
  context['edges'].append(edge(ent if incoming else '0','0' if incoming else ent,label,aa))
graphs.extend([context,root])

def decompose(parent,pid,id,title,children,routes,internal=(),note='',source=None):
 """Copy parent boundary fields exactly; optionally fan/split fields by child.

 Store groups expand using each field's physical store mapping. Repeated
 boundary fields preserve alternative operations, not additional information.
 """
 for cid,name in children:proc(cid,name)
 g=dict(id=id,title=title,level='Level-1' if pid.endswith('.0') else 'Level-2',scope='Decomposition of process '+pid,parent=parent['id'],process=pid,inside=[c[0] for c in children],edges=[],source=source or parent['source'],note=note)
 for e in parent['edges']:
  if pid not in [e['source'],e['target']]:continue
  incoming=e['target']==pid; other=e['source'] if incoming else e['target'];pieces={}
  for a in e['atoms']:
   dest=routes.get(a)
   if dest is None:raise ValueError(f'{id}: no route for {a}')
   if isinstance(dest,str):dest=[dest]
   for cid in dest:
    outside=atoms[a].get('store') if other.startswith('G') and atoms[a].get('store') else other
    pieces.setdefault((cid,outside),[]).append(a)
  for (cid,outside),aa in pieces.items():
   label=atoms[aa[0]]['label'] if len(aa)==1 else e['label']
   g['edges'].append(edge(outside if incoming else cid,cid if incoming else outside,label,aa,id=e['id']+'.'+str(len(g['edges'])+1)))
 for a,b,key,label,fields in internal:
  if key not in atoms:atom(key,label,fields)
  g['edges'].append(edge(a,b,label,[key]))
 graphs.append(g);return g

p1=decompose(root,'1.0','P1','1.0 | Marketplace preview data',[
 ('1.1','Filter sample catalog'),('1.2','Prepare listing detail'),('1.3','Append message preview'),('1.4','Append offer preview')],{
 'browse':['1.1','1.2'],'message':'1.3','offer':'1.4','cards':['1.1','1.2'],'messages':'1.3','offers':'1.4','catalog':['1.1','1.2'],'conversation':['1.3','1.4'],'preview_changes':['1.3','1.4']},[
 ('1.2','1.3','message_context','Selected listing context','selectedListingId, sample title; no seller identity'),('1.2','1.4','offer_context','Selected offer context','selectedListingId, listed sample price')],note='D1 is bundled sample data. D2 is one App-level array, not a per-listing persisted conversation.',source='Website/src/App.tsx: visibleListings and message/offer handlers; src/data/listings.ts')
p2=decompose(root,'2.0','P2','2.0 | Accounts and website sessions',[
 ('2.1','Register account'),('2.2','Authenticate and create session'),('2.3','Retrieve profile'),('2.4','Update profile and read back'),('2.5','Revoke user sessions'),('2.6','Publish school directory')],{
 'register':'2.1','login':'2.2','read_profile':'2.3','edit_profile':'2.4','logout':'2.5','schools':'2.6','registration_result':'2.1','login_result':'2.2','profile_result':'2.3','edit_result':'2.4','logout_result':'2.5','school_result':'2.6',
 'account_access':['2.1','2.2','2.3','2.4','2.5','2.6'],'account_assessment':['2.1','2.2','2.3','2.4','2.5','2.6'],'user_rows':['2.2','2.3','2.4'],'school_rows':['2.1','2.3','2.4','2.6'],'new_user':'2.1','changed_user':'2.4','admin_rows':'2.2','token_rows':'2.2','new_token':'2.2','revoked_token':'2.5','session_rows':['2.2','2.3','2.4','2.5'],'session_changes':'2.2','session_removals':['2.2','2.3','2.4','2.5']},note='Shared access flows contain an operation discriminator; parallel-looking arrows represent alternative requests, not execution order.',source='Website/server/api.mjs: account routes; Backend/Register.cs, LogIn.cs, Schools.cs')

adminreq=['admin_status','admin_users','admin_schools','admin_roles','admin_attempts','admin_logout']
p3routes={a:'3.1' for a in adminreq};p3routes.update({'status_result':'3.1','users_result':'3.2','schools_result':'3.3','roles_result':'3.4','attempts_result':'3.5','signout_result':'3.6','admin_access':'3.1','admin_assessment':'3.1','user_rows':['3.2','3.5'],'school_rows':['3.2','3.3'],'changed_user':'3.2','deleted_user':'3.2','changed_school':'3.3','deleted_school':'3.3','admin_rows':['3.2','3.4'],'token_rows':'3.6','user_attempts':'3.5','ip_registry':'3.5','ip_links':'3.5','ip_attempts':'3.5','admin_changes':'3.4','cleared_user_attempts':'3.5','cleared_ip_attempts':'3.5','target_revocation':'3.6'})
p3=decompose(root,'3.0','P3','3.0 | Administration data',[
 ('3.1','Assess caller permissions'),('3.2','Manage target user records'),('3.3','Manage school records'),('3.4','Manage admin assignments'),('3.5','Inspect and clear attempts'),('3.6','Request target sign-out')],p3routes,[('3.1',f'3.{i}',f'scoped_admin_{i}',label,'caller identity, fresh permission data, operation, exact target selectors and relevant request fields') for i,label in [(2,'Scoped user request'),(3,'Scoped school request'),(4,'Scoped assignment request'),(5,'Scoped attempt request'),(6,'Scoped sign-out request')]],note='Fresh membership data qualifies every operation. Target rank/lock checks remain enforced by backend auth.',source='Website/server/admin.mjs, api.mjs; Backend/Admin.cs, Register.cs, Schools.cs, Blocked.cs, Users.cs')

p4=decompose(root,'4.0','P4','4.0 | Access and forwarding data',[
 ('4.1','Prepare operation envelope'),('4.2','Establish service identity'),('4.3','Assess application and IP data'),('4.4','Assess user and target data'),('4.5','Publish access assessment')],{
 'account_access':'4.1','admin_access':'4.1','account_assessment':'4.5','admin_assessment':'4.5','user_rows':['4.2','4.4'],'admin_rows':['4.2','4.4'],'token_rows':['4.2','4.4'],'user_attempts':'4.4','ip_registry':'4.3','ip_links':'4.4','ip_attempts':'4.3','service_token':'4.2','user_attempt_changes':'4.4','ip_identity_changes':'4.3','ip_link_changes':'4.4','ip_attempt_changes':'4.3','blocked_token_removals':'4.4','settings':['4.1','4.2','4.3'],'service_cache':'4.2','lock_rows':['4.3','4.4'],'service_cache_changes':'4.2','lock_changes':['4.3','4.4']},[
 ('4.1','4.2','prepared_access','Prepared operation data','operation, server-owned IP, selected public fields, caller token'),('4.2','4.3','forwarding_identity','Forwarding identity data','service admin token, operation envelope, caller token'),('4.3','4.4','app_ip_context','Application / IP assessment','application validity, effective IP identity, selected operation'),('4.4','4.5','user_context','Resolved user context','caller level, selected user ID, sudo_id, target eligibility, attempt result'),('4.3','4.5','ip_rejection','Application / IP rejection data','safe validation/block response or forwarding-expiry marker')],note='This logical transformation spans the Node adapter and backend helpers; it is not a separate deployed service.',source='Website/server/api.mjs: forwarding client, upstream; Backend/AppAuthJson.cs, Users.cs, IP.cs')

p5=decompose(root,'5.0','P5','5.0 | Retained security data maintenance',[
 ('5.1','Select expired token records'),('5.2','Select expired user attempts'),('5.3','Select expired IP attempts'),('5.4','Select stale lock metadata')],{'expired_tokens':'5.1','token_cleanup':'5.1','expired_users':'5.2','user_cleanup':'5.2','expired_ips':'5.3','ip_cleanup':'5.3','lock_rows':'5.4','lock_cleanup':'5.4'},note='Timing is a process specification, not a data-flow arrow: asynchronous startup cleanup and daily 03:24 Mountain work.',source='Backend/Program.cs; LogIn.CleanUp; Users.CleanUp; IP.CleanUp; Maitenance.cs')
p6=decompose(root,'6.0','P6','6.0 | Direct listing API data',[
 ('6.1','Retrieve listing records'),('6.2','Create listing record'),('6.3','Delete listing record')],{'listing_read':'6.1','listing_create':'6.2','listing_delete':'6.3','listing_view':'6.1','listing_created':'6.2','listing_deleted':'6.3','listing_rows':['6.1','6.3'],'new_listing':'6.2','deleted_listing':'6.3','user_rows':'6.1'},note='Direct API client only. No website listing adapter route, shared auth/ownership checks or supplied Listings DDL.',source='Backend/Controllers/Listing.cs; DB_Schema.txt; Website/server/api.mjs route inventory')

decompose(p2,'2.1','P21','2.1 | Registration data transformation',[
 ('2.1.1','Assess registration access'),('2.1.2','Normalize fields and resolve school'),('2.1.3','Encode and store account'),('2.1.4','Project registration outcome')],{'register':'2.1.1','account_access':'2.1.1','account_assessment':'2.1.1','school_rows':'2.1.2','new_user':'2.1.3','registration_result':'2.1.4'},[
 ('2.1.1','2.1.2','registration_accessed','Assessed registration fields','submitted fields, application/IP assessment'),('2.1.2','2.1.3','normalized_registration','Normalized registration data','validated email/names/password, resolved school_id or validation errors'),('2.1.3','2.1.4','registration_persistence','Registration persistence outcome','normalized email, insert success, duplicate-email conflict or error')],note='Registration does not issue an access token or create a website session.')
decompose(p2,'2.2','P22','2.2 | Login token and cookie data',[
 ('2.2.1','Compare credentials and admission'),('2.2.2','Select or issue user token'),('2.2.3','Project public profile'),('2.2.4','Rotate website session ID')],{'login':'2.2.1','account_access':'2.2.1','account_assessment':'2.2.1','user_rows':['2.2.1','2.2.3'],'admin_rows':'2.2.2','token_rows':'2.2.2','new_token':'2.2.2','session_rows':'2.2.4','session_changes':'2.2.4','session_removals':'2.2.4','login_result':'2.2.4'},[
 ('2.2.1','2.2.2','login_identity','Admitted login identity','matched user ID, credential comparison, block assessment'),('2.2.2','2.2.3','visitor_token','Visitor token data','selected or newly generated token, user ID, eligibility result'),('2.2.3','2.2.4','profile_session_seed','Projected profile and token','public profile plus backend token for server-side session storage')],note='Backend token lifetime: 21 days, or 3 for admins. Website session: fixed 12 hours. Browser sees only an opaque ID.')
decompose(p2,'2.4','P24','2.4 | Saved profile and readback data',[
 ('2.4.1','Validate selected profile changes'),('2.4.2','Persist normalized changes'),('2.4.3','Project saved profile outcome')],{'edit_profile':'2.4.1','account_access':'2.4.1','account_assessment':'2.4.1','session_rows':'2.4.1','session_removals':'2.4.1','school_rows':'2.4.1','user_rows':['2.4.1','2.4.3'],'changed_user':'2.4.2','edit_result':'2.4.3'},[
 ('2.4.1','2.4.2','validated_profile_change','Validated profile changes','selected user ID, nonblank normalized changes or validation error'),('2.4.2','2.4.3','saved_profile_change','Profile persistence outcome','write committed flag, normalized email, conflict/validation/service result')],note='A committed write plus failed readback yields a saved notice and null profile; it does not imply a failed write.')
decompose(p2,'2.5','P25','2.5 | Logout and revocation data',[
 ('2.5.1','Resolve logout identity'),('2.5.2','Prepare token revocation'),('2.5.3','Prepare local session removal'),('2.5.4','Project logout confirmation')],{'logout':'2.5.1','account_access':'2.5.1','account_assessment':'2.5.1','session_rows':['2.5.1','2.5.3'],'revoked_token':'2.5.2','session_removals':'2.5.3','logout_result':'2.5.4'},[
 ('2.5.1','2.5.2','logout_identity','Assessed logout identity','selected user/token if valid; idempotent no-session case'),('2.5.2','2.5.3','logout_backend_result','Backend logout outcome','confirmation including masked token-validation cases; submitted visitor token'),('2.5.3','2.5.4','logout_local_result','Local logout outcome','cookie expiry data, matching local session IDs, qualified notice')],note='Backend 200 can mask token-validation failure. A confirmation is not evidence that target tokens existed or were deleted.')

decompose(p3,'3.2','P32','3.2 | Target user record management',[
 ('3.2.1','Resolve permitted target operation'),('3.2.2','Project user management result'),('3.2.3','Persist target profile changes'),('3.2.4','Prepare target account deletion')],{'scoped_admin_2':'3.2.1','user_rows':['3.2.1','3.2.2','3.2.3'],'school_rows':['3.2.2','3.2.3'],'admin_rows':'3.2.2','changed_user':'3.2.3','deleted_user':'3.2.4','users_result':'3.2.2'},[
 ('3.2.1','3.2.2','target_read','Selected user read data','permitted directory/profile query, exact selected user ID'),('3.2.1','3.2.3','target_change','Selected target changes','eligible target ID, profile fields, caller context'),('3.2.1','3.2.4','target_delete','Selected target deletion','eligible target ID, caller level and authorization result'),('3.2.3','3.2.2','target_saved','Target profile persistence result','saved flag, normalized identity, readback/validation/error result'),('3.2.4','3.2.2','target_deleted','Account deletion result','affected row count, target email, error result')],note='Caller access_token remains the admin token. to_user selects the target and must match the stored normalized email exactly.')
decompose(p3,'3.4','P34','3.4 | Admin membership changes',[
 ('3.4.1','Validate assignment fields'),('3.4.2','Assess target membership operation'),('3.4.3','Persist and project assignment')],{'scoped_admin_4':'3.4.1','admin_rows':'3.4.2','admin_changes':'3.4.3','roles_result':'3.4.3'},[
 ('3.4.1','3.4.2','assignment_fields','Validated assignment data','to_user, operation, integer level below caller, optional 0/1 locked'),('3.4.2','3.4.3','assignment_change','Permitted membership changes','selected user_id, operation, requested level/locked, eligibility result')],note='Admin management needs caller level > 0; explicitly setting locked needs level ≥ 30. Target admins must have lower rank.')
decompose(p3,'3.5','P35','3.5 | Attempt inspection and clearing',[
 ('3.5.1','Validate attempt selectors'),('3.5.2','Project attempt observations'),('3.5.3','Prepare selected attempt removals')],{'scoped_admin_5':'3.5.1','user_rows':'3.5.2','user_attempts':['3.5.2','3.5.3'],'ip_registry':['3.5.2','3.5.3'],'ip_links':'3.5.2','ip_attempts':['3.5.2','3.5.3'],'cleared_user_attempts':'3.5.3','cleared_ip_attempts':'3.5.3','attempts_result':'3.5.2'},[
 ('3.5.1','3.5.2','attempt_query','Permitted attempt inquiry','caller level, directory request or validated selectors'),('3.5.1','3.5.3','attempt_selection','Permitted attempt selection','email XOR ip_addr, resolved identity context'),('3.5.3','3.5.2','attempt_cleared','Attempt removal outcome','deleted row count, selector type, not-found/error result')],note='Rows include observations below the block threshold; clearing records does not recreate revoked access tokens.')

decompose(p4,'4.2','P42','4.2 | Forwarding identity data',[
 ('4.2.1','Select service identity source'),('4.2.2','Authenticate configured service user'),('4.2.3','Verify and retain admin proof')],{'prepared_access':'4.2.1','settings':['4.2.1','4.2.2'],'service_cache':'4.2.1','user_rows':'4.2.2','token_rows':'4.2.2','service_token':'4.2.2','admin_rows':'4.2.3','service_cache_changes':'4.2.3','forwarding_identity':['4.2.1','4.2.3']},[
 ('4.2.1','4.2.2','service_credentials','Configured service credential data','service email/password, app credential, rejected/missing cache context'),('4.2.2','4.2.3','service_token_candidate','Service token candidate','login-issued token, selected service user ID, login outcome')],note='Service admin_token and visitor access_token are different data. Only explicit forwarding-expiry rejection permits one renewal retry.')
decompose(p4,'4.3','P43','4.3 | Application and IP observations',[
 ('4.3.1','Compare application credentials'),('4.3.2','Resolve effective IP identity'),('4.3.3','Assess IP attempt window'),('4.3.4','Project IP admission data')],{'forwarding_identity':'4.3.1','settings':'4.3.1','ip_registry':'4.3.2','ip_identity_changes':'4.3.2','ip_attempts':'4.3.3','ip_attempt_changes':'4.3.3','lock_rows':'4.3.3','lock_changes':'4.3.3','app_ip_context':'4.3.4','ip_rejection':'4.3.4'},[
 ('4.3.1','4.3.2','app_comparison','Application credential assessment','validity, forwarded-IP eligibility, operation and caller context'),('4.3.2','4.3.3','effective_ip','Effective IP identity','connection/forwarded IP ID, failed-credential observation'),('4.3.3','4.3.4','ip_window_result','IP window assessment','count, expiry, blocked status, IP ID, operation context')],note='IP rows contain encrypted addresses. Forwarded-IP trust is server-owned; browser fields cannot replace the security envelope.')
decompose(p4,'4.4','P44','4.4 | User identity and attempt observations',[
 ('4.4.1','Resolve caller credential evidence'),('4.4.2','Assess selected target scope'),('4.4.3','Transform user attempt window'),('4.4.4','Project resolved user context')],{'app_ip_context':'4.4.1','user_rows':['4.4.1','4.4.2'],'token_rows':'4.4.1','admin_rows':['4.4.1','4.4.2'],'user_attempts':'4.4.3','user_attempt_changes':'4.4.3','blocked_token_removals':'4.4.3','lock_rows':'4.4.3','lock_changes':'4.4.3','ip_links':'4.4.4','ip_link_changes':'4.4.4','user_context':'4.4.4'},[
 ('4.4.1','4.4.2','caller_identity','Resolved caller evidence','operation, caller ID/level, optional token validity or login-match evidence'),('4.4.2','4.4.3','target_admission','Target scope assessment','selected target ID, caller rank, target rank/locked, validation result'),('4.4.3','4.4.4','user_window_result','User admission assessment','login-specific attempt count/expiry, token revocation selectors, resolved identity')],note='Attempt blocking is applied to login admission; ordinary token validation does not itself consult Blocked_Users.')

data=dict(version=1,source_commit=SOURCE,branch_base='bea1e03b0cd36010ac61a4d400fb267a104a283a',reference='DFD (1).pdf · 32 pages',nodes=nodes,atoms=atoms,graphs=graphs,context_child='L0')
(BASE/'model.json').write_text(json.dumps(data,indent=2,ensure_ascii=False))
print(f'{len(graphs)} DFDs; {len(nodes)} nodes; {len(atoms)} dictionary elements')

if __name__=='__main__':pass
