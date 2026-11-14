#!/usr/bin/env python3
"""Validate atlas source and all export formats. PyMuPDF is required for PDF checks."""
import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile
import fitz
from pptx import Presentation
from reportlab.pdfbase.pdfmetrics import stringWidth
from render import font_setup


def validate(atlas, source_root=None):
    data = json.loads((atlas / 'model.json').read_text())
    pages = data['slides']
    assert len({p['id'] for p in pages}) == len(pages), 'Duplicate page IDs'
    stem = data.get('artifact_stem', 'StudentExchange-UML')
    assert {p.stem for p in (atlas / 'svg').glob('*.svg')} == {p['id'] for p in pages}
    pdf = fitz.open(atlas / f'{stem}.pdf')
    ppt = Presentation(atlas / f'{stem}.pptx')
    assert len(pdf) == len(ppt.slides) == len(pages), 'Page counts differ'
    with ZipFile(atlas / f'{stem}.pptx') as z:
        assert not any(n.startswith('ppt/media/') for n in z.namelist()), 'Rasterized slide media'
    total_shapes = 0
    for i, p in enumerate(pages):
        svg = ET.parse(atlas / 'svg' / f'{p["id"]}.svg').getroot()
        texts = [n.text or '' for n in svg.findall('{http://www.w3.org/2000/svg}text')]
        model_texts = [s['text'] for s in p['shapes'] if s['type'] == 'text']
        assert texts == model_texts, f'{p["id"]}: SVG text differs'
        assert p['title'] in pdf[i].get_text(), f'{p["id"]}: PDF title not searchable'
        assert tuple(pdf[i].rect)[2:] == (data['width'], data['height'])
        assert p['id'] in ppt.slides[i].notes_slide.notes_text_frame.text
        ppt_texts = [s.text for s in ppt.slides[i].shapes if s.has_text_frame and s.text]
        assert ppt_texts == model_texts, f'{p["id"]}: PowerPoint text differs'
        expected = sum(len(s['points'])-1 if s['type']=='line' else 1 for s in p['shapes'])
        assert len(ppt.slides[i].shapes) == expected, f'{p["id"]}: Missing editable shape'
        total_shapes += expected
        for s in p['shapes']:
            if s['type'] == 'text':
                width = stringWidth(s['text'], 'UML-Bold' if s.get('bold') else 'UML', s['size'])
                x = s['x'] - (width/2 if s['align']=='center' else width if s['align']=='right' else 0)
                assert x >= 0 and x+width <= data['width'], f'{p["id"]}: Text outside page'
                assert s['y'] >= 0 and s['y']+s['size'] <= data['height']
            elif 'points' in s:
                assert all(0<=x<=data['width'] and 0<=y<=data['height'] for x,y in s['points'])
            else:
                assert 0<=s['x']<=s['x']+s['w']<=data['width']
                assert 0<=s['y']<=s['y']+s['h']<=data['height']
        if source_root:
            for src in p['source'].split('; '):
                path = src.replace('Website/','code/Frontend/StudentExchange-Website/',1) if src.startswith('Website/') else src.replace('Backend/','code/Backend/StudentExchangeBck/',1) if src.startswith('Backend/') else src
                if not path.startswith('code/') or ' + ' in path:
                    continue
                path = path.split(' (')[0].removesuffix(' schema')
                if '*' in path:
                    path = path.rsplit('/',1)[0]
                assert (source_root/path).exists(), f'{p["id"]}: Missing source {path}'
    print(f'{atlas.name}: {len(pages)} PDF pages, {len(ppt.slides)} editable slides, '
          f'{len(pages)} SVGs, {total_shapes} native PowerPoint objects; all checks passed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--atlas',type=Path,default=Path(__file__).resolve().parent)
    parser.add_argument('--source-root',type=Path)
    args = parser.parse_args()
    font_setup()
    validate(args.atlas,args.source_root)
