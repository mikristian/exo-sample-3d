from pathlib import Path
from collections import defaultdict, Counter, deque
import re, json, datetime
P=Path(__file__).resolve().parents[2]
OUTPUT=P/'docs/reports'
DATE='2026-11-12'
ROOTS=['src/core','src/data','src/hooks','integrations/clothcraft','integrations/clo_sdk','native_cpp/core','native_cpp/cli','native_backend/src','native_backend/server.mjs','ppf_backend','rust','blender_bridge','techpack-studio/src/model.js','techpack-studio/src/visualModel.js']
UPSTREAM_ROOT='research/oss/clothcraft/src'
SKIP_DIR={'node_modules','target','build','dist','out','output','.git','gridcraft-workbook','vendor','third_party','generated','tests','test','fixtures','__tests__','benchmarks','screenshots','assets','cache','logs','releases','scratch','tmp','downloads','download','reference-repositories','rust-patches','archive','old','backup','examples','prototype'}
SRC_EXT={'.js':'JS','.jsx':'JS','.mjs':'JS','.cjs':'JS','.ts':'JS','.tsx':'JS','.rs':'Rust','.c':'C++','.cc':'C++','.cpp':'C++','.cxx':'C++','.h':'C++','.hpp':'C++','.py':'Python','.swift':'Swift'}
# Features are classified from source file and path names; NOT a claim of equivalent live behavior.
GROUPS=[
 ('01 Project model / source-of-truth','project document;document model;garment document;garment project;project geometry;project utilities;default project;project area;project manifest;project state;canonical;garment template;project schema;project id;project merge;document transaction'),
 ('02 Drafting primitives and snapping','drafting precision;drafting snapping;drafting topology;drafting construction;drafting primitive;draw;point line;line construction;point operations;construction kernel;construction geometry;intersection;polar;angle;chord;cad numeric;numeric drafting;vector craft;guide half;pattern guide;stencil;drafting'),
 ('03 Curves, freehand and geometry','curve;bezier;cubic;vector fit;free hand;freehand;tangent;arc length;geometry kernel;interchange math;precision curve;contour;distance segment'),
 ('04 Topology / split / unfold / mirror','topology;split;unfold;mirror;fold;duplicate;rigid actions;polygon boolean;boolean;crop;transform;affine;unfurl'),
 ('05 Parametric references / formulas','parametric;formula;reference recompute;source relink;point binding;cross piece;dependency;reference piece;reactive;named rule link;equation;constraints graph'),
 ('06 Pattern grading / size runs','grade;grading;size run;size chart;size set;size correspondence;multisize;multi size;rule table;size evolution;size expansion;size distribution'),
 ('07 Measurements / POM / body charts','pom;measurement;measure;body girth;dimension;size metrics;body chart;ruler;anthropometry'),
 ('08 Sewing / seam matching','sewing;seam;stitch;chain station;easing;gather;sewline;sewn;thread;joining'),
 ('09 Darts / pleats / facings','dart;pleat;facing;hem;collar;cuff;waistband'),
 ('10 Allowance / notch / cutline','allowance;notch;cutline;cutting geometry;cut path;cutting path;cut room;laser cut;cut contour;knife path'),
 ('11 Cloth mesh / tessellation','meshing;mesh quality;mesh selection;triangulation;remesh;triangles;mesh topology;mesh fidelity;surface mapping;mesh generator;retopolog'),
 ('12 Cloth physics and solver','physics;solver;xpbd;pbd;ppf;vbd;ogc;verlet;strain;distance constraint;timestep;time step;integrat;residual;energy;spring;bending;cloth simulation;simulation step;cloth analysis'),
 ('13 Collision / contact / penetration','collision;contact;clearance;penetration;broadphase;collider;clash;self collision;body collision;separation'),
 ('14 Garment fit / stage / drape','fitting;fit telemetry;auto fit;drape;staging;placement;scene pose;rest seed;body arrangement;try on;wearable;garment preview;garment assembly;assembly;cloth transfer'),
 ('15 Avatar / pose / animation','avatar;makehuman;glb;gltf;rig;skeletal;walk;pose;character;motion;animation;body landmarks;body measurement;head swap;globe;human model'),
 ('16 Fabric mechanics / materials','fabric calibration;fabric mechanics;fabric property;fabric physical;fabric evidence;fabric model;material coefficient;material physics;textile mechanics;fabric density;fabric'),
 ('17 Fabric visuals / textures / PBR','pbr;texture;optics;wash;scan color;fabric color;surface shader;roughness;material appearance;lighting;procedural textile;color grade;render material;pattern material;shader'),
 ('18 Hardware / fastener / trims','hardware;zipper;buttonhole;button;fastener;trim;eyelet;snap;garment metal;slider;buckle;topstitch'),
 ('19 Garment print graphics / embroidery','print graphic;surface graphic;graphic placement;screen print;decal;logo placement;embroidery;applique;graphic overlay;artwork'),
 ('20 Foam / padding / trapunto','foam;pad compression;padded;trapunto;quilt;fill loft'),
 ('21 3D export and scene assets','obj export;gltf export;glb export;mesh export;scene export;render export;stage preset;scene environment;asset export'),
 ('22 Marker layout / nesting / yield','marker;nesting;nest;fabric repeat;lay plan;yardage;utilization;lay width;single ply;roll plan'),
 ('23 DXF / CAD interop','dxf;astm;aama;modaris;optitex;seamly;valentina;cad interchange;clo sdk;clo operator;clo import;clo export;cad exchange;interop'),
 ('24 SVG / PDF / physical plot','svg;pdf;print layout;plotter;plot;page break;registration ruler;calibration sheet;tiling;vector export;paper size'),
 ('25 Factory preflight / measurement QA','preflight;quality gate;factory calibration;factory safe;factory ruler;source trust;factory verification;manufacturing quality;production QA;receiving;fabric defect;defect;quality flip;quality check'),
 ('26 Production packages / factory orders','factory package;factory zip;production order;order handoff;cutroom intake;factory file;manufacturing package;shipment;postzip;factory download;factory archive;manufacturing order;factory output;verified order;receiving ledger'),
 ('27 Techpacks / BOM / specification','techpack;tech pack;bom;specification;spec sheet;label layout;product spec;material list;bill of materials;techpack spreadsheet'),
 ('28 Cost / pricing / estimates','fabric cost;fabric costing;production cost;cost;pricing;price;budget;quote;yields;material use;production estimate;costing'),
 ('29 Persistence / undo / history / restore','history;undo;redo;persist;serialization;serialize;save;load;restore;revision;recovery;journal;backup;sidecar;workspace transaction;transaction;workspace mirror;migration'),
 ('30 Libraries / templates / presets','catalog;library;template;presets;collection;archive;style system;imported garment;garment code data;garment code;garment codedata'),
 ('31 Image digitizing / vision / references','digitizing;digitize;camera vision;photo vision;image processing;reference image;pattern recognition;scan image;photo digit;image import;pattern tracing;pattern source geometry'),
 ('32 AI assistant / generation / automation','agent;assistant;ai;ml;intelligence;inference;generation;synthetic;automation;pattern synthesis;search embedding;vision semantic;local speech;kokoro;tts'),
 ('33 API / processes / transport','http;endpoint;server;service;client;websocket;web socket;route;rpc;api;bridge;session;protocol;socket;transport;backend registry;spawn;ffi;mcp;health;static host;event stream;sse'),
 ('34 Collaboration / security / sync','collaboration;sync;permission;auth;token;key store;workspace sharing;connection;presence;access control;secret;security;lock owner;mutex'),
 ('40 macOS native host / lifecycle','appkit;swift host;native window;wkwebview;macos'),
 ('39 Workspace commands / tools / preferences','command;tool;property;inspector;workspace menu;settings;theme;keyboard;keybind;gesture;shortcut;cursor;menu;toolbar;profile;layout;customization;palette;mode;preferences;view state'),
 ('35 Diagnostics / performance / misc','diagnostic;trace;benchmark;telemetry;log;status;monitor;health check;profiling;inspect;warnings;assert;check;limits'),
]
PATTERNS=[]
for label,phrases in GROUPS:
 patterns=[p.strip() for p in phrases.split(';') if p.strip()]
 PATTERNS.append((label,patterns))
RULE_EXPLICIT={
 'src/core/project.js':'01 Project model / source-of-truth',
 'src/core/grading.js':'06 Pattern grading / size runs',
 'src/core/measurements.js':'07 Measurements / POM / body charts',
 'src/core/physics.js':'12 Cloth physics and solver',
 'src/core/nativeGarmentGraphics.js':'19 Garment print graphics / embroidery',
 'src/core/garmentCode.js':'30 Libraries / templates / presets',
 'integrations/clothcraft/workspace.mjs':'29 Persistence / undo / history / restore',
 'integrations/clothcraft/bridge.mjs':'33 API / processes / transport',
 'integrations/clothcraft/server.mjs':'33 API / processes / transport',
 'integrations/clothcraft/agent-api.mjs':'32 AI assistant / generation / automation',
 'integrations/clothcraft/collaboration.mjs':'34 Collaboration / security / sync',
 'integrations/clothcraft/exo-session.rs':'33 API / processes / transport',
 'native_cpp/cli/main.cpp':'33 API / processes / transport',
 'native_cpp/core/garment_document.cpp':'01 Project model / source-of-truth',
 'native_cpp/core/garment_document.hpp':'01 Project model / source-of-truth',
 'src/core/garmentPreviewPaging.js':'37 Native Rust engine shared core',
}
# Special path-root associations before generic lexical matching.
ROOT_OVERRIDE=[('rust/exo_',None)]

def normalize(s):
 s=re.sub(r'([a-z0-9])([A-Z])',r'\1 \2',s)
 s=re.sub(r'(?<=[a-z])(?=[A-Z])',' ',s)
 s=re.sub(r'([A-Za-z])([0-9])',r'\1 \2',s)
 s=re.sub(r'([0-9])([A-Za-z])',r'\1 \2',s)
 s=re.sub(r'[^a-zA-Z0-9]+',' ',s).lower()
 return ' '.join(s.split())

def is_match(term,norm):
 return (' '+term+' ') in (' '+norm+' ') or (' '+term+'s ') in (' '+norm+' ')

def group(rel):
 if rel in RULE_EXPLICIT:return RULE_EXPLICIT[rel]
 s=Path(rel); base=normalize(s.stem)
 # Rust kernel crates explicitly categorized by crate name. Preserve full word matching.
 if rel.startswith('integrations/clothcraft/macos/') and Path(rel).suffix.lower()=='.swift':
  return '40 macOS native host / lifecycle'
 if rel.startswith('src/core/techpack-spreadsheet/'):return '27 Techpacks / BOM / specification'
 if 'cost' in base or 'pricing' in base:return '28 Cost / pricing / estimates'
 if 'companion' in base or 'intelligence' in base or 'fashion intent' in base or 'synthesis' in base or 'sketch pattern' in base:return '32 AI assistant / generation / automation'
 if 'factory' in base and any(x in base for x in ('release','sample','preflight','qualif','qa','verification')):return '25 Factory preflight / measurement QA'
 if 'photo reference' in base or 'photo digit' in base:return '31 Image digitizing / vision / references'
 if 'physical cut' in base or 'industrial cutter' in base:return '10 Allowance / notch / cutline'
 if 'dxf' in base:return '23 DXF / CAD interop'
 if 'hardware' in base or 'trim' in base:return '18 Hardware / fastener / trims'
 if 'fabric' in base and not ('cost' in base):
  if any(x in base for x in ('color','pbr','texture','wash','scan','procedural','visual','optical')):return '17 Fabric visuals / textures / PBR'
  return '16 Fabric mechanics / materials'
 if rel.startswith('rust/'):
  base=normalize(rel.split('/')[1].replace('exo_',''))+' '+base
 if rel.startswith('research/oss/clothcraft/src/garment/'):
  base=normalize(s.stem)+' '+base
 if any(z in base for z in ('research','study')) and rel.startswith('src/core/backends/'):
  if any(z in base for z in ('contact','collision','penetrat','clearance')):return '13 Collision / contact / penetration'
  return '12 Cloth physics and solver'
 if any(z in base for z in ('cutroom','cut room','cutter','cutting room')):return '26 Production packages / factory orders'
 if any(z in base for z in ('fabric','textile')) and any(z in base for z in ('pbr','texture','wash','scan','procedural','visual','optical')):return '17 Fabric visuals / textures / PBR'
 if 'svg' in base:return '24 SVG / PDF / physical plot'
 if 'print' in base and 'graphic' not in base and 'tech pack' not in base and 'techpack' not in base:return '24 SVG / PDF / physical plot'
 if rel.startswith('src/core/physics/'):
  base=base+' physics'
 scores=[]
 for label,terms in PATTERNS:
  matched=[x for x in terms if is_match(x,base)]
  if matched:scores.append((max(len(x.split())*8+len(x)/9 for x in matched),len(matched),label,matched))
 if scores:
  scores.sort(key=lambda a:(a[0],a[1]),reverse=True)
  return scores[0][2]
 # Last chance: classify role-specific module names from path.
 if rel.startswith('src/data/'):return '30 Libraries / templates / presets'
 if rel.startswith('blender_bridge/'):return '14 Garment fit / stage / drape'
 if rel.startswith('native_cpp/core/'):return '01 Project model / source-of-truth'
 if rel.startswith('research/oss/clothcraft/src/atelier/'):return '36 Native Rust editor / backend UI glue'
 if rel.startswith('research/oss/clothcraft/src/'):return '37 Native Rust engine shared core'
 if rel.startswith('integrations/clothcraft/') or rel.startswith('ppf_backend/') or rel.startswith('native_backend/'):return '33 API / processes / transport'
 if rel.startswith('integrations/clothcraft/macos/') and Path(rel).suffix.lower()=='.swift':
  return '40 macOS native host / lifecycle'
 if rel.startswith('src/core/techpack-spreadsheet/'):return '27 Techpacks / BOM / specification'
 if 'cost' in base or 'pricing' in base:return '28 Cost / pricing / estimates'
 if 'companion' in base or 'intelligence' in base or 'fashion intent' in base or 'synthesis' in base or 'sketch pattern' in base:return '32 AI assistant / generation / automation'
 if 'factory' in base and any(x in base for x in ('release','sample','preflight','qualif','qa','verification')):return '25 Factory preflight / measurement QA'
 if 'photo reference' in base or 'photo digit' in base:return '31 Image digitizing / vision / references'
 if 'physical cut' in base or 'industrial cutter' in base:return '10 Allowance / notch / cutline'
 if 'dxf' in base:return '23 DXF / CAD interop'
 if 'hardware' in base or 'trim' in base:return '18 Hardware / fastener / trims'
 if 'fabric' in base and not ('cost' in base):
  if any(x in base for x in ('color','pbr','texture','wash','scan','procedural','visual','optical')):return '17 Fabric visuals / textures / PBR'
  return '16 Fabric mechanics / materials'
 if rel.startswith('rust/'):return '37 Native Rust engine shared core'
 if rel.startswith('src/core/'):return '38 Unclassified JS business logic'
 return '41 Other backend source'

def include(rel,src):
 p=Path(rel)
 if any(x in SKIP_DIR for x in p.parts[:-1]):return False
 if any(x.startswith('.') for x in p.parts):return False
 if len(p.parts)>10:return False
 if p.suffix.lower() not in SRC_EXT:return False
 f=p.name.lower()
 if f.endswith(('.test.mjs','.test.js','.test.rs','.test.ts','.test.jsx','.spec.js','.spec.ts','.spec.jsx','.spec.mjs','.stories.jsx')):return False
 if f.startswith(('test_','qa_','check_','audit_','bench_','benchmark_','test-','qa-','check-','audit-','bench-','benchmark-')):return False
 if '.bundle.' in f or f.endswith('.min.js'):return False
 if re.search(r'\.test\.|\.spec\.|-test\.|\.fixture\.|\.snap\.',f):return False
 if '2026' in f and ('-qa-' in f or 'qa-' in f or 'check-' in f):return False
 if f.startswith('exo-session-v2-authoritative-') and p.suffix=='.rs':return False # explicit historical variants
 if re.search(r'(^|[/_-])(reference-only|research-only|comparison-copy)([/_-]|$)',rel.lower()):return False
 # Exclude Rust tests anywhere: representative code only
 if 'test' in p.parts[:-1]:return False
 if p.stat().st_size >1500000:return False
 return True

sources=[]
for root in ROOTS+[UPSTREAM_ROOT]:
 path=P/root
 if not path.exists():continue
 hits=[path] if path.is_file() else path.rglob('*')
 for file in hits:
  if not file.is_file():continue
  rel=file.relative_to(P).as_posix()
  if not include(rel,file):continue
  try:
   raw=file.read_text('utf-8',errors='replace');n=raw.count('\n')+(not raw.endswith('\n'))
  except OSError:continue
  if not n:continue
  lang=SRC_EXT[file.suffix.lower()]
  tier='upstream-derived-native-Rust-engine' if rel.startswith(UPSTREAM_ROOT+'/') else 'EXO-code-scope'
  prototype=bool(re.search(r'(Research|Study|Prototype|Candidate|Experiment|Audit|Probe|Witness|Sandbox|Demo|TestHarness|Reference)',file.name,re.I))
  sources.append(dict(path=rel,lang=lang,lines=n,subsystem=group(rel),tier=tier,prototype=prototype))

# Build best-effort statically-resolved ES import graph for app backend JS reachability.
JSPATHS=set(x['path'] for x in sources if x['lang']=='JS')
IMPORT=re.compile(r'(?:\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?|\bimport\s*\(\s*|\brequire\s*\(\s*)[\x22\x27]([^\x22\x27]+)[\x22\x27]',re.M)
ROOT_LINKS=['src/App.jsx','src/main.jsx','integrations/clothcraft/server.mjs','integrations/clothcraft/workspace.mjs','integrations/clothcraft/bridge.mjs','integrations/clothcraft/agent-api.mjs','integrations/clothcraft/mcp-server.mjs','integrations/clothcraft/collaboration.mjs','ppf_backend/server.mjs','native_backend/server.mjs','techpack-studio/src/App.jsx']
seen=set();todo=deque(x for x in ROOT_LINKS if (P/x).exists())
while todo:
 rel=todo.popleft()
 if rel in seen:continue
 seen.add(rel)
 try:code=(P/rel).read_text(errors='replace')
 except OSError:continue
 for item in IMPORT.findall(code):
  if not item.startswith('.'):continue
  possible=(P/rel).parent/item
  for cand in [possible, *(possible.parent/(possible.name+x) for x in ['.js','.jsx','.mjs','.ts','.tsx']), *(possible/('index'+x) for x in ['.js','.jsx','.mjs','.ts','.tsx'])]:
   if cand.exists() and cand.is_file():
    pr=cand.relative_to(P).as_posix()
    if pr not in seen:todo.append(pr)
    break
for x in sources:x['staticEsmReachable']=x['path'] in seen

agg=defaultdict(lambda:{'lines':Counter(),'files':Counter(),'reachableLines':Counter(),'prototypeLines':Counter(),'source':[]})
for x in sources:
 d=agg[x['subsystem']];d['lines'][(x['tier'],x['lang'])]+=x['lines'];d['files'][(x['tier'],x['lang'])]+=1
 if x['staticEsmReachable']:d['reachableLines'][(x['tier'],x['lang'])]+=x['lines']
 if x['prototype']:d['prototypeLines'][(x['tier'],x['lang'])]+=x['lines']
 d['source'].append(x)
records=[]
for cat in sorted(agg):
 row=agg[cat]
 first=Counter({lang:v for (tier,lang),v in row['lines'].items() if tier=='EXO-code-scope'})
 ext=Counter({lang:v for (tier,lang),v in row['lines'].items() if tier!='EXO-code-scope'})
 total=sum(first.values());pureRust=first.get('Rust',0)
 shares={l:round(first.get(l,0)*100/total,1) if total else 0 for l in ('JS','Rust','C++','Python','Swift')}
 samples=sorted(row['source'],key=lambda x:(-x['lines'],x['path']))
 records.append({'system':cat,'fileCount':sum(1 for x in row['source'] if x['tier']=='EXO-code-scope'),'firstPartyLines':total,'rustSourceLines':pureRust,'sourceSharePercent':shares,'rustEngineReferenceLines':ext.get('Rust',0),'sourceExamples':[x['path'] for x in samples if x['tier']=='EXO-code-scope'][:7],'nativeEngineExamples':[x['path'] for x in samples if x['tier']!='EXO-code-scope'][:3], 'reachableJS':row['reachableLines'].get(('EXO-code-scope','JS'),0),'prototypeFlaggedLines':sum(v for (tier,lang),v in row['prototypeLines'].items() if tier=='EXO-code-scope')})
allfirst=Counter()
for x in sources:
 if x['tier']=='EXO-code-scope':allfirst[x['lang']]+=x['lines']
summary={'date':DATE,'sourceRoot':str(P),'gitHEAD':'53041a6','method':'Filename/path primary-domain mapping, one backend source file assigned once. EXO production-like source excludes tests, generated outputs, imported Gridcraft, reference roots and Rust session version copies. A subset of research prototypes may be present and marked; src/App.jsx/src/components omitted despite business logic embedded in UI. Rust native engine under research/oss/clothcraft/src counted separately as upstream-derived/modified dependent Rust, not first-party converted lines. Statically reachable ES imports are indicative only and not a runtime execution proof. Percentages are LANGUAGE LINE SHARES only and NOT functional conversion percentages. No programs executed and no files modified outside new reports.','counts':dict(allfirst),'sourceFiles':len([x for x in sources if x['tier']=='EXO-code-scope']),'nativeEngineReferenceLines':sum(x['lines'] for x in sources if x['tier']!='EXO-code-scope'),'sourceOnlyRustPercent':round(allfirst['Rust']/sum(allfirst.values())*100,2),'systems':records,'files':sources}
OUTPUT.mkdir(parents=True,exist_ok=True)
jsonfile=OUTPUT/f'EXO_V2_BACKEND_SYSTEM_SOURCE_MAP_{DATE.replace("-", "")}.json'
jsonfile.write_text(json.dumps(summary,indent=2)+'\n')
mdfile=OUTPUT/f'EXO_V2_BACKEND_SYSTEM_INVENTORY_{DATE.replace("-", "")}.md'
lines=[f'# EXO ClothCraft Studio V2 — Backend source-language inventory ({DATE})','',f'Working-tree HEAD: `53041a6` (dirty/uncommitted source is included). Backend-related first-party code-like scope: {len(summary["files"])} mapped source files including upstream-derived native Rust engine, {sum(allfirst.values()):,} EXO-code-scope lines; native engine separately {summary["nativeEngineReferenceLines"]:,} Rust lines.','','## Important interpretation','','This is a file-path/name-based **source composition inventory** only. It does not prove runtime ownership, feature completion, or Rust implementation parity. Native Rust engine under `research/oss/clothcraft` is separately listed; it may be upstream-derived. `src/App.jsx`, `src/components/`, and other UI-side application logic are excluded intentionally. A dated research/prototype module may not be active. Browser import reachability is only a proxy; dynamic/injected modules need follow-up.','',f'First-party-like scoped source shares: '+', '.join(f'{k} {v:,} lines ({v/sum(allfirst.values())*100:.1f}%)' for k,v in sorted(allfirst.items()))+'.','','## Breakdown','','| # | Backend system | Files | JS % | Rust % | C/C++ % | Python % | EXO-scoped source lines | Additional native Rust engine lines |','|---|---|---:|---:|---:|---:|---:|---:|---:|']
for x in records:
 a=x['sourceSharePercent'];lines.append(f'| {x["system"].split(" ")[0]} | {x["system"].split(" ",1)[1]} | {x["fileCount"]} | {a["JS"]:.1f}% | {a["Rust"]:.1f}% | {a["C++"]:.1f}% | {a["Python"]:.1f}% | {x["firstPartyLines"]:,} | {x["rustEngineReferenceLines"]:,} |')
lines+=['','## Per-system source file evidence','']
for x in records:
 lines.append('### '+x['system']);lines.append(f'EXO code-like files: {x["fileCount"]}; code lines: {x["firstPartyLines"]:,}; static-linked JS lines: {x["reachableJS"]:,}; filename-flagged exploratory/review lines: {x["prototypeFlaggedLines"]:,}.')
 if x['sourceExamples']:lines.append('Representative source: '+', '.join('`'+p+'`' for p in x['sourceExamples']))
 if x['nativeEngineExamples']:lines.append('Native Rust engine dependency: '+', '.join('`'+p+'`' for p in x['nativeEngineExamples']))
 lines.append('')
lines+=['## Known omissions','- React UI logic and state across `src/App.jsx` and `src/components/` (not separable by source file name); converting all backend requires extracting relevant actions from these components.','- Tests, QA, generated WASM, vendor assets, subrepo clones and dated historical Rust-session snapshots deliberately excluded from percentages.','- Several systems contain many exploratory implementations whose presence should not be treated as production ownership.','- Line counts count header declarations and duplicate implementations; they do not weight capability complexity or identify the deployed process.','- A conversion-completion percentage requires execution-trace provenance, accepted semantic contracts and regression tests, not just source language.','']
mdfile.write_text('\n'.join(lines))
print(json.dumps({k:v for k,v in summary.items() if k not in ('systems','files')},indent=2));print('REPORT_MD',mdfile);print('REPORT_JSON',jsonfile)
for x in records:
 print('%-48s files=%3d lines=%6d JS=%5.1f Rust=%5.1f Cpp=%5.1f Py=%5.1f nativeEngineRust=%5d' %(x['system'],x['fileCount'],x['firstPartyLines'],x['sourceSharePercent']['JS'],x['sourceSharePercent']['Rust'],x['sourceSharePercent']['C++'],x['sourceSharePercent']['Python'],x['rustEngineReferenceLines']))
print('TOTAL SYSTEMS',len(records))

# Human-reviewed functional interpretation and migration objectives. Descriptions do not certify runtime ownership.
DETAILS={
'01':('Canonical garment/project schema','Define panels, fabrics, seams, stable IDs and authoritative edits.','Finish one Rust document schema, transactions and compatibility reader. Retire duplicate JS/C++ model writes.','P0'),
'02':('2D CAD arithmetic','Points, straight lines, rulers, projections, snapping and numeric construction.','Move exact arithmetic and validation into Rust; retain display and pointer events in React.','P1'),
'03':('Vector and Bézier mathematics','Control points, cubic curves, freehand fitting and material-length measurements.','Unify curve, intersection and length calculations in Rust, audit WASM fallback paths and parity.','P1'),
'04':('Topology-edit transactions','Split, mirror, unfold, boolean edits and transformations of pattern pieces.','Make Rust own topology changes and preserve seam/measurement references, Undo and reopen.','P1'),
'05':('Parametric reference graph','Formula dependencies, cross-piece constructions, and automatic recomputation.','One versioned Rust dependency graph, cycle checking, invalidation and atomic recalculation.','P1'),
'06':('Multi-size garment grading','Rules, point deltas, size correspondence, chart and pattern size runs.','Finish canonical Rust grade operations, per-size persistence, Rust/EXO UI routing and independent production fixtures.','P1'),
'07':('Points of measure','Named garment/body measurements, rulers, size charts and measurement history.','Rust owns physical units, stable targets, referenced points and per-size recalculation.','P1'),
'08':('Sewing graph','Connects boundaries with direction, easing, notches and partial seams.','Single Rust sewing contract and compiler; eliminate alternate JS/C++ sewing authorities.','P1'),
'09':('Construction features','Darts, pleats, facings, folds, tucks and sewing-related transformations.','Add validated Rust construction operations and separate visual annotations from physically cut geometry.','P2'),
'10':('Cutline preparation','Seam allowances, notches, drill holes, cutter boundaries, sewing-line offsets.','Move precise cutting geometry, joins and boundary references into Rust with negative cases.','P1'),
'11':('Simulation meshes','Panel tessellation, quality metrics, remeshing and particle mapping.','One Rust meshing/compilation path; preserve material IDs, constraints and drape invalidation.','P1'),
'12':('Cloth dynamics','VBD/OGC, PBD/XPBD research, constraints, stiffness, stepping and time state.','Keep a validated Rust production solver; remove competing browser/C++ authority only after equivalent collision tests.','P0'),
'13':('Contacts and self-collision','Body penetrations, swept contacts, exclusions, inter-panel and self intersections.','Qualify Rust OGC/contact for multi-frame garments, identical fixtures and CPU/GPU parity.','P0'),
'14':('Fitting and placement','Initial panel stage positions, auto-fit, cloth drape transfer, fitting scenes.','Move reproducible garment fitting transforms/state ownership to Rust; optional Blender Python remains external.','P1'),
'15':('Avatar simulation inputs','OBJ/glTF/GLB import, landmarks, collider identity, body poses and motion.','Rust validates geometry and physics ownership; keep presentation animation in Three.js, Blender helpers optional.','P1'),
'16':('Physical fabric properties','Directional stiffness, density, thickness, stretch, bending and calibration data.','Rust canonical mechanics and unit conversion; physically calibrate on measured fabrics.','P1'),
'17':('Textile optical calculations','Texture data, fabric scan color, normal/roughness, optical/pixel transforms.','Rust only for expensive deterministic processing; Three.js shader/visual display remains UI.','P3'),
'18':('Construction hardware','Zippers, buttons, buttonholes, fasteners, trim definitions and placement metadata.','Persist placement and geometry in Rust; keep 3D decorative rendering in Three.js.','P2'),
'19':('Garment graphic authoring','Print graphics, logos, surface placement and persistence.','Rust stores anchored, editable print geometry and history; React/Three paints final surface.','P2'),
'20':('Padding/foam mechanics','Quilted padding, foam response, loft and compression.','Port validated manufacturing geometry/mechanics when actually used; keep UI preview separate.','P3'),
'21':('3D asset interchange','OBJ/glTF/GLB exports, mesh assets and scene interchange.','Rust owns reproducible output geometry/format checking; Three.js continues rendering.','P2'),
'22':('Marker/nesting optimizer','Lays graded cutting pieces on rolls by grain, size, repeat and quantity.','Rust deterministic nesting/yardage optimizer and constraint validation with independent cutter fixtures.','P1'),
'23':('Industrial CAD interfaces','DXF and AAMA/ASTM-style CAD exchange; Modaris, Optitex, Seamly, Valentina experiments.','Rust import/export model and strict units/layers/ref validation; independently round-trip in compatible CAD.','P1'),
'24':('Plots, vector exports','SVG, print/PDF tiling, physical scale, registration and page layout.','Rust authoritative output geometry and PDF/plot protocol; physical measurement validation.','P1'),
'25':('Factory readiness gates','Validates dimensions, cutting geometry, source trust and production qualification.','Rust fail-closed manufacturing validators; preserve traceable error diagnostics and physical gates.','P1'),
'26':('Production handoff','Factory package/ZIP manifest, cutting order, roll plan, outputs and provenance.','Rust immutable source manifests, content hashes, size/fabric quantities and safe packaged exports.','P1'),
'27':('Tech packs / BOM','Construction specification, BOM, POM, techpack sheets and factory technical data.','Rust owns calculations and schema/export; React retains editable page and board presentation.','P2'),
'28':('Costing','Material quantities, fabrication estimates, production costs and price formulas.','Rust deterministic, versioned costing inputs/output; avoid migrating purely cosmetic price UI.','P2'),
'29':('Save/recover/history','Revision, save/open, undo/redo, file schema migration, journal recovery.','Finish Rust transaction/state ownership, exact binary ABI and rollback; do not corrupt legacy projects.','P0'),
'30':('Template and content catalogs','Garment presets, reusable pattern libraries, fabric/material catalogs and file selection.','Rust owns validated persistence/index/search when needed; static UI catalogs can remain JS/JSON.','P2'),
'31':('Photos and pattern digitization','Interprets reference images, extracted contours, markers and physical scale.','Keep optional ML pipeline where appropriate; send validated vector geometry and identity to Rust.','P3'),
'32':('AI and agent orchestration','Pattern assistants, generated drafts, workflows, voice and local model clients.','Rust-validate every proposed garment edit; retain external AI model/tool adapters as supported services.','P3'),
'33':('Runtime APIs and IPC','Node HTTP routes, Rust session process, local RPC, native bridge and MCP.','One bounded versioned Rust service/IPC contract; migrate Node business routes incrementally.','P0'),
'34':('Collaboration and permissions','Sharing, synchronization, permissions, optimistic conflict checks and SSE.','Rust authoritative revisions, access checks and sync protocol; validate adversarial cases.','P2'),
'35':('Runtime validation/diagnostics','Performance counters, quality reporting, source provenance and error paths.','Keep testing harnesses cross-language; integrate Rust operational metrics and release gates.','P2'),
'36':('Native egui editor (parallel product)','Existing independent Rust/egui workspace and tool handling.','NOT required for Rust-first EXO; avoid rewriting the preserved React editor in Phase 1.','Keep'),
'37':('Rust engine foundation','Shared Rust fitting, model, solver and authoring modules already under development.','Stabilize API, source provenance, tests and authoritative integration rather than automatically translating again.','P0'),
'38':('Unmapped backend JS','Other unassigned business logic whose ownership cannot safely be inferred from names.','Audit imports and feature actions manually; then assign exact authority or explicitly remove unused code.','Audit'),
'39':('Command and workspace semantics','Tool command registry, inspector actions, preferences, keyboard operations and state.','Rust owns persisted commands and Undo; React remains responsible for display and transient UI state.','P1'),
'40':('macOS window/host','Swift/AppKit/WKWebView launch, permissions, process lifecycle and platform shell.','Keep as thin, reviewed OS adapter in Rust-first phase; a later Rust-native shell is optional.','Keep'),
'41':('Specialized misc integration','Additional integration files without reliable primary classification.','Review individually before assigning migration or deleting duplicates.','Audit')
}
for row in summary['systems']:
 key=row['system'].split(' ',1)[0]
 descr=DETAILS.get(key)
 if descr:row.update(dict(function=descr[0],functionality=descr[1],requiredMigration=descr[2],priority=descr[3]))
jsonfile.write_text(json.dumps(summary,indent=2)+'\n')
extra=['','## Conversion work ordered by system','', 'Items tagged `Keep` are excluded from the initial Rust-first backend conversion. This is an engineering work inventory, not a certified percentage-complete measurement.','']
for row in summary['systems']:
 extra.extend(['### '+row['system'], '**Purpose:** '+row.get('functionality','Manual classification required.'), '**Rust-first action:** '+row.get('requiredMigration','Manual classification required.'), '**Priority:** '+row.get('priority','Audit'), ''])
mdfile.write_text(mdfile.read_text()+'\n'.join(extra)+'\n')
print('ENRICHED_REPORT',mdfile,'bytes',mdfile.stat().st_size)
