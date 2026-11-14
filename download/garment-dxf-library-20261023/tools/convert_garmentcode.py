#!/usr/bin/env python3
"""Convert published GarmentCode 2D pattern-spec panels into generic R12 DXF.

The result is sampled, not exact curves, and never AAMA/ASTM or factory approved.
The complete source JSON (including sewing relations) is retained unchanged.
No changes are made to any existing EXO clothing templates.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'sources' / 'GarmentCode-ethz'
OUTPUT = ROOT / 'dxf' / 'github-garmentcode-derived'
MANIFEST = ROOT / 'reports' / 'garmentcode-derived-files.json'
SPECS = ('dress_pencil', 'hoody_mean', 'js_mean_all', 'shirt_mean')


def finite_point(p):
    if (not isinstance(p, (list, tuple)) or len(p) != 2 or
            not all(isinstance(v, (int, float)) and math.isfinite(v) for v in p)):
        raise ValueError(f'Invalid pattern coordinate: {p}')
    return (float(p[0]), float(p[1]))


def control_point(a, b, p):
    """GarmentCode relative control: unit X along chord, unit Y left normal."""
    fx, fy = finite_point(p)
    vx, vy = b[0] - a[0], b[1] - a[1]
    return (a[0] + fx*vx - fy*vy, a[1] + fx*vy + fy*vx)


def bezier(a, b, controls, t):
    if len(controls) == 1:
        c, = controls
        return ((1-t)**2*a[0]+2*(1-t)*t*c[0]+t*t*b[0],
                (1-t)**2*a[1]+2*(1-t)*t*c[1]+t*t*b[1])
    if len(controls) == 2:
        c, d = controls
        return (((1-t)**3)*a[0]+3*((1-t)**2)*t*c[0]+3*(1-t)*t*t*d[0]+(t**3)*b[0],
                ((1-t)**3)*a[1]+3*((1-t)**2)*t*c[1]+3*(1-t)*t*t*d[1]+(t**3)*b[1])
    raise ValueError('Only quadratic and cubic curves supported')


def arc_points(a, b, params):
    """SVG circular Arc semantics as emitted by GarmentCode CircleEdge.assembly()."""
    if len(params) != 3:
        raise ValueError('Expected [radius, large_arc, sweep]')
    # GarmentCode stores the last flag as `right`, inverse of SVG sweep.
    radius, large_arc, right = params
    sweep = not bool(right)
    if not isinstance(radius, (int, float)) or not math.isfinite(radius) or radius <= 0:
        raise ValueError('Invalid circular arc radius')
    if large_arc not in (0, 1, False, True) or right not in (0, 1, False, True):
        raise ValueError('Invalid SVG arc flags')
    xmid, ymid = (a[0]+b[0])/2, (a[1]+b[1])/2
    dx, dy = (a[0]-b[0])/2, (a[1]-b[1])/2
    halfchord = math.hypot(dx,dy)
    if halfchord < 1e-9:
        raise ValueError('Zero-length circular arc not supported')
    radius = max(float(radius), halfchord)
    multiplier = math.sqrt(max(0., radius**2/halfchord**2-1.))
    multiplier *= -1 if bool(large_arc) == bool(sweep) else 1
    cx = xmid + multiplier*dy
    cy = ymid - multiplier*dx
    start = math.atan2(a[1]-cy,a[0]-cx)
    end = math.atan2(b[1]-cy,b[0]-cx)
    delta = (end-start+math.pi)%(math.tau)-math.pi
    if sweep and delta < 0: delta += math.tau
    elif not sweep and delta > 0: delta -= math.tau
    if bool(large_arc) and abs(delta) < math.pi-1e-7: raise ValueError('Large arc geometry ambiguous')
    n = min(512, max(12,math.ceil(abs(radius*delta)/0.25)))
    return [(cx+radius*math.cos(start+delta*i/n),cy+radius*math.sin(start+delta*i/n))
            for i in range(n+1)]


def sampled_edge(a, b, spec):
    curve = spec.get('curvature')
    if not curve:
        return [a,b]
    typ, params = curve.get('type'),curve.get('params')
    if typ == 'circle':
        result = arc_points(a,b,params)
    elif typ in ('quadratic','cubic'):
        expected = 1 if typ == 'quadratic' else 2
        if not isinstance(params,list) or len(params) != expected:
            raise ValueError('Unexpected Bezier control count')
        controls = [control_point(a,b,p) for p in params]
        # At most 3.5 mm parameterwise chord length on the uncurved segment.
        n = min(512,max(24,math.ceil(math.dist(a,b)/0.35)))
        result = [bezier(a,b,controls,i/n) for i in range(n+1)]
    else: raise ValueError('Unsupported curve type '+repr(typ))
    result[0],result[-1] = a,b
    return result


def sample_panel(panel):
    vertices = [finite_point(v) for v in panel['vertices']]
    edges = panel['edges']
    if len(vertices)<3 or len(edges)<3 or len(edges)>2000:
        raise ValueError('Invalid panel topology')
    points=[]
    for i,e in enumerate(edges):
        ends=e['endpoints']
        if len(ends)!=2 or not all(isinstance(v,int) and 0<=v<len(vertices) for v in ends):
            raise ValueError('Invalid directed edge endpoints')
        a,b = vertices[ends[0]],vertices[ends[1]]
        if points and math.dist(points[-1],a)>1e-6:
            raise ValueError('Panel edge loop not contiguous')
        seg = sampled_edge(a,b,e)
        points.extend(seg if i==0 else seg[1:])
    if math.dist(points[0],points[-1])>1e-6:
        raise ValueError('Open garment panel loop')
    points=points[:-1]
    if len(points)<3 or any(not all(math.isfinite(c) for c in p) for p in points):
        raise ValueError('Invalid sampled panel')
    return points


def dxf_bytes(panels, panel_names):
    """panels is ordered list of (name, sampled 2D points in cm)."""
    if not panels: raise ValueError('Empty garment')
    parts=[]
    def pair(code,value):parts.extend([str(code),str(value)])
    pair(999,'EXO reference-only generic R12 DXF, measurements mm, curves approximated by sampled points')
    pair(0,'SECTION');pair(2,'HEADER');pair(9,'$ACADVER');pair(1,'AC1009');pair(0,'ENDSEC')
    pair(0,'SECTION');pair(2,'ENTITIES')
    for (name, points) in panels:
        name=str(name).replace('\n',' ').replace('\r',' ')[:80]
        layer='PANEL_'+''.join(ch if ch.isalnum() or ch=='_' else '_' for ch in name.upper())[:26]
        xs=[p[0] for p in points];ys=[p[1] for p in points]
        if max(xs)-min(xs)<.01 or max(ys)-min(ys)<.01:
            raise ValueError('Collapsed source panel '+name)
        pair(0,'POLYLINE');pair(8,layer);pair(66,1);pair(70,1)
        for p in points:
            pair(0,'VERTEX');pair(8,layer);pair(10,f'{p[0]*10:.6f}');pair(20,f'{p[1]*10:.6f}');pair(30,0)
        pair(0,'SEQEND');pair(8,layer)
        pair(0,'TEXT');pair(8,'PANEL_LABEL');pair(10,f'{min(xs)*10:.6f}');pair(20,f'{(max(ys)+1)*10:.6f}');pair(30,0)
        pair(40,5);pair(1,name.replace('%','').replace('\\','')[:60])
    pair(0,'ENDSEC');pair(0,'EOF')
    return ('\n'.join(parts)+'\n').encode('ascii')


def convert_spec(spec_path, output_dir):
    doc=json.loads(Path(spec_path).read_text())
    source_panels=doc['pattern']['panels']
    if not isinstance(source_panels,dict) or not 1<=len(source_panels)<=400:
        raise ValueError('Bad GarmentCode panel list')
    all_panels=[];offset_x=0.; offset_y=0.; row_height=0.
    panel_outputs=[]
    output_dir=Path(output_dir)
    output_dir.mkdir(parents=True,exist_ok=True)
    for i,(name,panel) in enumerate(source_panels.items()):
        sample=sample_panel(panel)
        minx=min(v[0] for v in sample);maxx=max(v[0] for v in sample)
        miny=min(v[1] for v in sample);maxy=max(v[1] for v in sample)
        translated=[(x-minx+offset_x,y-miny+offset_y) for x,y in sample]
        if not all(math.isfinite(k) for pt in translated for k in pt):raise ValueError('Invalid translation')
        all_panels.append((name,translated))
        dest=output_dir/(f'{i+1:02d}-{name}.dxf')
        dest.write_bytes(dxf_bytes([(name,[(x-minx,y-miny) for x,y in sample])],set()))
        panel_outputs.append(dest)
        row_height=max(row_height,maxy-miny)
        offset_x+=maxx-minx+10
        if (i+1)%3==0:
            offset_x=0
            offset_y+=row_height+14
            row_height=0
    full=output_dir/(Path(spec_path).stem.replace('_specification','')+'-whole-garment.dxf')
    full.write_bytes(dxf_bytes(all_panels,set(source_panels)))
    return [full,*panel_outputs]


def main():
    entries=[]
    for name in SPECS:
        src=SOURCES/(name+'_specification.json')
        raw=src.read_bytes();source_hash=hashlib.sha256(raw).hexdigest()
        outputs=convert_spec(src,OUTPUT/name)
        for file in outputs:
            blob=file.read_bytes()
            entries.append({'filename':str(file.relative_to(ROOT)),
                            'source':'https://github.com/maria-korosteleva/GarmentCode',
                            'upstreamPath':f'assets/Patterns/{src.name}',
                            'sourceJsonSha256':source_hash,
                            'license':'MIT source repository; these are derived reference patterns, attribution retained',
                            'attribution':'GarmentCode contributors (Korosteleva et al., ETH Zurich)',
                            'derivation':'Sampled curves (quadratic, cubic, SVG circular arc), converted cm to generic R12 DXF mm; not AAMA/ASTM',
                            'group':name,'panelCount':len(json.loads(raw)['pattern']['panels']),
                            'unit':'mm','sha256':hashlib.sha256(blob).hexdigest(),
                            'bytes':len(blob),'factoryApproved':False,'trainingPermissionVerified':False})
    MANIFEST.write_text(json.dumps(entries,indent=2)+'\n')
    print(json.dumps({'derivedDXF':len(entries),'sourceSpecifications':len(SPECS),
                      'panelBlocks':len(entries)-len(SPECS),'bytes':sum(i['bytes'] for i in entries),
                      'distinctHashes':len({i['sha256'] for i in entries})},indent=2))


if __name__=='__main__': main()
