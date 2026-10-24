#!/usr/bin/env python3
"""Check DFD structure, atomic data conservation and dictionary coverage.

Run `python validate.py` after changing model.json. --self-test also confirms
that the validator rejects an illegal store link and unbalanced child flows.
"""
import argparse,copy,json
from pathlib import Path

BASE=Path(__file__).resolve().parent

def check(data):
 nodes=data['nodes'];atoms=data['atoms'];graphs={g['id']:g for g in data['graphs']};results=[]
 assert len(graphs)==len(data['graphs']),'Duplicate diagram ID'
 for g in graphs.values():
  inside=set(g['inside']);seen=set()
  assert inside and all(nodes[n]['kind']=='process' for n in inside),g['id']+' has non-process contents'
  for e in g['edges']:
   assert e['id'] not in seen,g['id']+' duplicate flow ID';seen.add(e['id'])
   a,b=e['source'],e['target']
   assert a in nodes and b in nodes,'Unknown endpoint'
   assert a!=b,'Flow returns directly to same process'
   assert a in inside or b in inside,'Flow bypasses all internal processes'
   assert nodes[a]['kind']=='process' or nodes[b]['kind']=='process','Direct entity/store link'
   assert e['label'] and e['atoms'],'Unlabeled/undefined data flow'
   assert len(e['atoms'])==len(set(e['atoms'])),'Duplicate data within composite flow'
   for aa in e['atoms']:
    assert aa in atoms and atoms[aa]['fields'],'Missing data dictionary definition'
    for end in [a,b]:
     if nodes[end]['kind']=='store':
      origin=atoms[aa].get('store')
      assert origin, f'{g["id"]}: non-record data linked to store {end}'
      assert origin==end or nodes[origin].get('group')==end,f'{g["id"]}: store mapping mismatch {aa}: {end}'
  for p in inside:
   assert any(e['target']==p for e in g['edges']),g['id']+': miracle process '+p
   assert any(e['source']==p for e in g['edges']),g['id']+': black-hole process '+p
  if g['parent']:
   parent=graphs[g['parent']];pid=g['process']
   incident=[e for e in parent['edges'] if pid in [e['source'],e['target']]]
   refs={e['source'] if e['target']==pid else e['target'] for e in incident}
   def normalize(n):return nodes[n].get('group') if nodes[n].get('group') in refs else n
   expected=set()
   for e in incident:
    incoming=e['target']==pid;other=e['source'] if incoming else e['target']
    expected.update(('in' if incoming else 'out',other,aa) for aa in e['atoms'])
   actual=set()
   for e in g['edges']:
    ain=e['source'] in inside;bin=e['target'] in inside
    if ain!=bin:
     other=e['source'] if bin else e['target'];actual.update(('in' if bin else 'out',normalize(other),aa) for aa in e['atoms'])
   assert actual==expected,f'{g["id"]}: unbalanced; missing={expected-actual}; extra={actual-expected}'
   results.append(dict(diagram=g['id'],parent=g['parent'],process=pid,input_fields=sum(x[0]=='in' for x in actual),output_fields=sum(x[0]=='out' for x in actual),status='PASS'))
 # Context/Level-0 external field conservation; internal stores are hidden at context.
 def external_boundary(g):
  out=set()
  for e in g['edges']:
   for n,dr in [(e['source'],'in'),(e['target'],'out')]:
    if nodes[n]['kind']=='external':out.update((dr,n,aa) for aa in e['atoms'])
  return out
 c=graphs['C0'];r=graphs['L0']
 assert len(c['inside'])==1 and not any(nodes[n]['kind']=='store' for e in c['edges'] for n in [e['source'],e['target']]),'Invalid context diagram'
 assert external_boundary(c)==external_boundary(r),'Context / Level-0 mismatch'
 bd=external_boundary(r);results.insert(0,dict(diagram='L0',parent='C0',process='0',input_fields=sum(x[0]=='in' for x in bd),output_fields=sum(x[0]=='out' for x in bd),status='PASS'))
 return results

def self_test(data):
 # Each corruption exercises a distinct rule against a valid starting model.
 bad=copy.deepcopy(data);bad['graphs'][0]['edges'][0]['source']='D3'
 try:check(bad)
 except AssertionError:pass
 else:raise AssertionError('Failed to detect store on context diagram')
 bad=copy.deepcopy(data);g=next(g for g in bad['graphs'] if g['id']=='P21');g['edges'][0]['atoms'].append('listing_read')
 try:check(bad)
 except AssertionError:pass
 else:raise AssertionError('Failed to detect invented child input')
 bad=copy.deepcopy(data);g=next(g for g in bad['graphs'] if g['id']=='P21');g['edges']=[e for e in g['edges'] if e['target']!='E1']
 try:check(bad)
 except AssertionError:pass
 else:raise AssertionError('Failed to detect missing result')
 bad=copy.deepcopy(data);bad['graphs'][1]['edges'].append(dict(id='BAD',source='D4',target='D6',label='Account data',atoms=['user_rows']))
 try:check(bad)
 except AssertionError:pass
 else:raise AssertionError('Failed to detect direct store link')
 return 4

def main():
 p=argparse.ArgumentParser();p.add_argument('--self-test',action='store_true');a=p.parse_args();d=json.loads((BASE/'model.json').read_text());r=check(d)
 report=dict(diagrams=len(d['graphs']),balanced_relationships=len(r),results=r,self_tests=self_test(d) if a.self_test else None)
 (BASE/'validation-report.json').write_text(json.dumps(report,indent=2))
 print(f'PASS: {len(d["graphs"])} DFDs, {len(r)} balanced parent/child relationships; structural and dictionary checks passed.')
 if a.self_test:print('PASS: all four intentionally invalid models were rejected.')

if __name__=='__main__':main()
