#!/usr/bin/env python3
"""Rebuild the EXO source-composition audit, 41-system dashboard and task board.

Reads only immutable Git objects. Does not inspect personal installed apps,
uncommitted worktrees, private media or Git credentials. Does not infer feature
completion from language percentages. Requires Python 3.9+ and git.
"""
from __future__ import annotations

import argparse
import collections
import csv
import heapq
import html
import io
import json
import re
import subprocess
from pathlib import Path

BASELINE_PATH = 'docs/reports/EXO_V2_RUST_ALL_SYSTEMS_PLAN_20261114.json'
PRIORITY_SETS = {
    'P0': {37, 1, 33, 29},
    'P1': {3, 2, 4, 5, 7, 6, 10, 8, 11, 16, 15, 23},
    'P2': {9, 12, 13, 14, 18, 21, 22, 24, 25, 27, 30, 31, 34, 39, 36},
}
PRIORITY_ORDER = [37,1,33,29,3,5,7,2,4,6,10,8,11,16,23,15,12,13,14,22,24,25,27,18,9,21,30,39,31,34,36,20,17,19,26,28,32,35,38,40,41]
PREFIXES = ('src/','integrations/clothcraft/','rust/','native_cpp/','native_backend/','native_app/','ppf_backend/','blender_bridge/','techpack-studio/src/','apps/','research/oss/clothcraft/src/')
LANGUAGE_EXT = {
 '.rs':'Rust','.js':'JavaScript / TypeScript','.jsx':'JavaScript / TypeScript',
 '.mjs':'JavaScript / TypeScript','.cjs':'JavaScript / TypeScript',
 '.ts':'JavaScript / TypeScript','.tsx':'JavaScript / TypeScript',
 '.cpp':'C / C++','.cc':'C / C++','.cxx':'C / C++','.c':'C / C++',
 '.hpp':'C / C++','.h':'C / C++','.hh':'C / C++','.mm':'C / C++',
 '.swift':'Swift','.py':'Python','.css':'CSS',
}
STATUS = 'Proposed: no agent claim or verified migration completion'
PROPOSED_PR = {
 37:'Pin clean upstream ClothCraft SHA in EXO adapter and prove clean upstream Cargo tests; isolate all EXO patches outside upstream-owned files.',
 1:'Introduce serde-versioned ExoGarmentV2 read/validate-only adapter; roundtrip one tee with stable panel/edge IDs and explicit mm/SI conversion.',
 33:'Create strict versioned Rust RPC envelope (revision, command-id, origin, auth, errors); shadow current Node bridge on representative fixture.',
 29:'Implement atomic edit + undo/redo Rust journal for one curve-control transaction; verify crash/reopen, stale revision and no partial commits.',
 3:'Implement cubic Bézier arc-length/tangent and offset golden fixtures in existing Rust geometry kernel, compare JS/C++ at declared tolerances.',
 5:'Build Rust formula DAG cycle/unit detection for a sleeve-to-armhole cross-piece dependency; preserve stable object links.',
 7:'Port one POM curve measurement formula with named-size values and reject orphan references and invalid units.',
 2:'Route one interactive snap/measure command through Rust geometry to React while leaving rendering and pointer input in JS.',
 4:'Implement reversible split/mirror on a curved panel with preserved seam/notch links across undo/reopen.',
 6:'Connect one six-size graded tee to native Rust grading via UI RPC; compare each control point, grade rule and saved size.',
 10:'Move one edge-linked seam allowance and notch offset operation into Rust and verify 100-mm printed scale.',
 8:'Implement an authoritative Rust seam-pair command with directed partial intervals and malformed edge rejection.',
 11:'Compile a named-size seam-linked tee panel to stable Rust mesh IDs/UV; compare triangle area, winding and seam endpoints.',
 16:'Create typed mechanical fabric schema (density, warp/weft, bending, thickness, friction) with SI normalization and cross-API tests.',
 23:'Roundtrip one known DXF/AAMA/ASTM multi-size pattern with units, curves, grain, notches and seam IDs; external viewer check.',
 15:'Add public-license neutral avatar landmark and pose proxy transfer to Rust with metric scale and normal/orientation checks.',
 12:'Use upstream Rust VBD CPU reference with GPU feature-gated comparison and deterministic multi-frame strain/energy telemetry.',
 13:'Implement two moving-body contact fixtures with penetration depth/CCD negative cases and verified solver provenance.',
 14:'Persist and replay native garment pose/drape initialization; invalidate stale mesh on controlled 2D change.',
 22:'Build one deterministic marker nesting job with 6-size ratios, grain and fabric-width nonoverlap constraints.',
 24:'Generate one externally measurable 100-mm plot/SVG/PDF from canonical Rust pattern; check clipping and scale.',
 25:'Fail closed on invalid size, cutter, marker or seam audit; signed readiness only after independent geometry and export evidence.',
 27:'Export a Rust-backed spec/BOM/POM for the same pattern revision, with no missing sizes or orphan material links.',
 18:'Model one zipper/trim anchor in the Rust garment document; verify shift under grading, mesh and reopening.',
 9:'Port one dart transfer and mirrored pleat/facing state with panel graph links and reversible undo.',
 21:'Port one canonical-mesh OBJ/glTF exporter path and independently validate normals/UV/units in an external reader.',
 30:'Create rights-aware Rust library index for one public template with hash, provenance, missing-file states and explicit schema.',
 39:'Map one tool preference/shortcut and command dispatch through typed Rust actions while retaining React inspector UI.',
 31:'Digitize one calibration ruler image to metric pattern points with error envelope and manual user confirmation.',
 34:'Require revision-aware, permission-checked Rust collaboration merge for two conflicting editing sessions; reject stale ops.',
 36:'Prototype one upstream egui 2D authoring tool against the same Rust document with mouse/snap/screenshot parity.',
 20:'Port one foam/trapunto loft and compression record as Rust parametric layer with seam-linked thickness semantics.',
 17:'Share one Rust material parameter/PBR record with existing Three frontend and upstream wgpu preview without solver reset.',
 19:'Attach one artwork/embroidery placement to pattern IDs and verify projection after grade and remeshing.',
 26:'Produce one revision-locked, fail-closed multi-size factory package with every file referenced by content hash.',
 28:'Generate material yield + quantity cost estimates from verified Rust marker/BOM records, handle units and invalid pricing.',
 32:'Route one AI draft proposal through Rust preview/diff/approve; prove refusal of untrusted factory/FS commands.',
 35:'Capture structured per-stage Rust simulation and export telemetry; differentiate safety failure from test pass.',
 38:'Classify every currently-unmapped JS core module as Rust-authoritative, presentation-only or dead-with-proof, with import evidence.',
 40:'Produce a source-built egui/wgpu macOS lifecycle prototype in isolation, comparing WebKit parity; no production app replacement.',
 41:'Inventory remaining techpack/SDK integration scripts, source rights and tests before moving any operation to a Rust API.',
}


def git(repo: Path, *args: str, input_bytes: bytes | None = None) -> bytes:
    cmd=['git','-C',str(repo),*args]
    p=subprocess.run(cmd,input=input_bytes,capture_output=True,check=True)
    return p.stdout


def source_paths(repo: Path, sha: str) -> list[tuple[str,str,str]]:
    entries=git(repo,'ls-tree','-rz','--long',sha)
    output=[]
    for item in entries.split(b'\0'):
        if not item: continue
        meta,p=item.split(b'\t',1)
        tok=meta.decode().split()
        if tok[1]!='blob': continue
        name=p.decode('utf-8','replace')
        suffix=Path(name).suffix.lower()
        if suffix not in LANGUAGE_EXT or not name.startswith(PREFIXES):continue
        # Exclude tests, generated source clones and validation fixtures from
        # production source mix; report this subset rather than "all app code".
        lower=name.lower(); filename=Path(lower).name
        if any(s in lower for s in ('/node_modules/','/target/','/vendor/','/fixtures/','/__tests__/','/tests/','/test/','/qa/','/dist/','/build/')): continue
        if re.search(r'(?:^|[._-])(?:test|spec|fixture)(?:[._-]|$)',filename):continue
        if filename.startswith(('test_','qa-','qa_')):continue
        output.append((name,tok[2],LANGUAGE_EXT[suffix]))
    return output


def count_lines(repo: Path, entries: list[tuple[str,str,str]]) -> dict[str,dict]:
    tally=collections.defaultdict(lambda:{'files':0,'lines':0,'bytes':0})
    proc=subprocess.Popen(['git','-C',str(repo),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    try:
        assert proc.stdin and proc.stdout
        for path,oid,lang in entries:
            proc.stdin.write((oid+'\n').encode());proc.stdin.flush()
            header=proc.stdout.readline().decode().strip().split()
            if len(header)!=3 or header[0]!=oid or header[1]!='blob':
                raise RuntimeError('Unexpected Git object header '+str(header))
            length=int(header[2]);blob=proc.stdout.read(length)
            if proc.stdout.read(1)!=b'\n':raise RuntimeError('Invalid Git batch boundary')
            # Only text source extensions are inventoried, binary source is not
            # counted by extension. Lossy decoding only influences line ends.
            loc=blob.count(b'\n') + (1 if blob and not blob.endswith(b'\n') else 0)
            population='upstream_clothcraft_source' if path.startswith('research/oss/clothcraft/src/') else 'first_party_scoped_source'
            rec=tally[(population,lang)];rec['files']+=1;rec['lines']+=loc;rec['bytes']+=length
        proc.stdin.close()
    finally:
        if proc.stdin and not proc.stdin.closed:proc.stdin.close()
        proc.wait(timeout=15)
    return {pop:{lang:val for (p,lang),val in sorted(tally.items()) if p==pop} for pop in ('first_party_scoped_source','upstream_clothcraft_source')}


def priority(system_id: int) -> str:
    return next((name for name,values in PRIORITY_SETS.items() if system_id in values),'P3')


def order_tasks(systems: list[dict]) -> list[dict]:
    by_id={s['id']:s for s in systems}
    assert len(by_id)==len(systems)==41
    assert {x for v in PRIORITY_SETS.values() for x in v}.issubset(by_id)
    parents={x['id']:set(x['dependencies']) for x in systems}
    assert all(p.issubset(by_id) for p in parents.values())
    priority_idx={v:i for i,v in enumerate(('P0','P1','P2','P3'))}
    rank_hint={n:i for i,n in enumerate(PRIORITY_ORDER)}
    order=[];completed=set()
    while len(order)<len(systems):
        ready=[k for k in by_id if k not in completed and parents[k].issubset(completed)]
        if not ready: raise RuntimeError('Cycle in migration dependency graph')
        chosen=min(ready,key=lambda k:(priority_idx[priority(k)],rank_hint.get(k,999),k))
        s=dict(by_id[chosen]);s['priority']=priority(chosen);s['rank']=len(order)+1
        s['status']=STATUS;s['trackedExamples']=0;s['missingExamples']=[]
        s['issueId']='EXO-RUST-'+str(chosen).zfill(3)
        s['firstPrSlice']=PROPOSED_PR[chosen]
        order.append(s);completed.add(chosen)
    assert len({x['id'] for x in order})==41
    return order


def mark_examples(systems: list[dict], existing: set[str]) -> None:
    for s in systems:
        examples=s.get('sourceExamples',[])
        s['trackedExamples']=sum(x in existing for x in examples)
        s['missingExamples']=[x for x in examples if x not in existing]


def percent(a: int, b: int) -> float:
    return round(100*a/b,2) if b else 0.0


def build(repo: Path, sha: str, destination: Path) -> None:
    old=json.loads(git(repo,'show',sha+':'+BASELINE_PATH))
    tasks=order_tasks(old['systems'])
    tree=git(repo,'ls-tree','-rz','--name-only',sha)
    existing={x.decode('utf-8','replace') for x in tree.split(b'\0') if x}
    mark_examples(tasks,existing)
    code=source_paths(repo,sha)
    measured=count_lines(repo,code)
    by_pop={}
    for population,detail in measured.items():
        total_lines=sum(v['lines'] for v in detail.values())
        rust_lines=detail.get('Rust',{}).get('lines',0)
        by_pop[population]={
            'totalProductionSourceFiles':sum(v['files'] for v in detail.values()),
            'totalProductionSourceLines':total_lines,
            'rustLines':rust_lines,
            'rustSharePercent':percent(rust_lines,total_lines),
            'byLanguage':detail,
        }
    baseline={'mappedSystems':len(tasks),'backendMappedLines':sum(s['sourceLines'] for s in tasks),
              'backendMappedRustLines':sum(s['rustSourceLines'] for s in tasks),
              'backendMappedRustSharePercent':percent(sum(s['rustSourceLines'] for s in tasks),sum(s['sourceLines'] for s in tasks)),
              'mappedFileAssignments':sum(s['files'] for s in tasks),
              'uiJsLines':old['ui']['jsLines'],'uiCssLines':old['ui']['cssLines'],
              'uiRustPercent':0,'method':'Prior 2026-11-14 mapped system baseline; percentages are source-language share, not functionality migrated or validated'}
    by_priority={p:sum(s['priority']==p for s in tasks) for p in ('P0','P1','P2','P3')}
    stats={'schema':'exo.rust-migration-dashboard.v1','exoGitCommit':sha,
           'upstreamRepo':'https://github.com/erythrofr/ClothCraft',
           'systemBaselineSource':BASELINE_PATH,
           'baseline':baseline,'currentGitProductionSourceAudit':by_pop,
           'sourceClassificationMethod':{'roots':list(PREFIXES),'languages':LANGUAGE_EXT,
             'excludes':['tests','fixtures','vendor','generated builds','public media','docs'],
             'count':'physical lines from Git blob content, independent of local worktree',
             'note':'Current Git source audit and legacy mapped 41-system baseline have different populations/denominators. Do not compare them as identical measures.'},
           'priorityCounts':by_priority,
           'allSystemsMigrationCompletionPercent':None,
           'functionalParityVerifiedPercent':None,
           'warning':'Code-language percentages are not proof of running Rust authority, migration completion, tests or factory-ready quality.',
           'systems':tasks}
    destination.mkdir(parents=True,exist_ok=True)
    (destination/'dashboard-data.json').write_text(json.dumps(stats,indent=2,sort_keys=True,ensure_ascii=False)+'\n')
    with (destination/'systems.csv').open('w',newline='') as f:
        fieldnames=['rank','issueId','priority','name','phase','sourceLines','rustSourceLines','rustSourcePercent','otherSourcePercent','files','trackedExamples','totalExamples','dependencies','status']
        writer=csv.DictWriter(f,fieldnames=fieldnames,lineterminator='\n');writer.writeheader()
        for s in tasks:
            writer.writerow({'rank':s['rank'],'issueId':s['issueId'],'priority':s['priority'],'name':s['name'],'phase':s['phase'],
             'sourceLines':s['sourceLines'],'rustSourceLines':s['rustSourceLines'],'rustSourcePercent':s['rustSourcePercent'],
             'otherSourcePercent':round(100-s['rustSourcePercent'],1),'files':s['files'],
             'trackedExamples':s['trackedExamples'],'totalExamples':len(s['sourceExamples']),
             'dependencies':','.join('EXO-RUST-'+str(i).zfill(3) for i in s['dependencies']),'status':s['status']})
    make_board(destination,tasks,stats)
    make_system_plan(destination,tasks,stats)
    make_markdown_dashboard(destination,stats)
    make_dashboard(destination,stats)
    print('MIGRATION_DASHBOARD_GENERATED',sha,len(tasks),'systems; first-party source',by_pop['first_party_scoped_source']['totalProductionSourceLines'],'LOC')
    print('PRIORITY_COUNTS',by_priority)
    print('MAPPED_BASELINE_RUST_PERCENT',baseline['backendMappedRustSharePercent'])
    print('FIRST_PARTY_RUST_PERCENT_CURRENT_SCOPED',by_pop['first_party_scoped_source']['rustSharePercent'])
    print('EXAMPLE_PATHS_MISSING',sum(len(x['missingExamples']) for x in tasks))


def make_board(dest: Path,tasks: list[dict],stats: dict) -> None:
    lines=['# EXO Rust migration — dependency-ranked task board','',
       '> **Planning board, not a live GitHub assignment system.** Status is proposed/unclaimed until a maintained issue records acceptance. Start small PRs. Do not claim upstream ClothCraft ownership from this EXO-only board.','',
       '**Snapshot:** EXO Git `'+stats['exoGitCommit']+'`; 41 legacy mapped systems; '+str(stats['baseline']['backendMappedRustSharePercent'])+'% Rust *source lines in that mapped backend scope*. No valid repository-wide **migration completion %** is known.','',
       '| Order | Priority | Task | System | Rust code / mapped LOC | Dependencies |',
       '|---:|:---:|---|---|---:|---|']
    for s in tasks:
        id=s['issueId']; deps=', '.join('`%02d`'%i for i in s['dependencies']) or '—'
        lines.append(f'| {s["rank"]} | **{s["priority"]}** | [{id}](SYSTEM_PLANS.md#sys-{s["id"]:02d}) | {s["name"]} | **{s["rustSourcePercent"]:.1f}%** ({s["rustSourceLines"]:,}/{s["sourceLines"]:,}) | {deps} |')
    lines+=['','## Working rules','',
      '- **P0:** pin upstream and establish Rust document/IPC/edit authority before rewriting features. **P1:** prove a complete graded tee workflow and DXF interchange. **P2:** simulation, materials and manufacturing validation. **P3:** secondary features, AI, collaboration and optional Rust-native UI replacement.',
      '- Read [SYSTEM_PLANS.md](SYSTEM_PLANS.md) for each system’s current code, precise first PR slice, upstream attachment, dependencies and positive/negative acceptance requirements.',
      '- The board order is *dependency-aware*: all listed parents appear earlier. A proposed priority does not make a task eligible for implementation if its dependency tests have not passed.',
      '- For **upstream ClothCraft work**, read its [COORDINATION.md](https://github.com/erythrofr/ClothCraft/blob/main/COORDINATION.md) and use its actual registered issue: post `/coord claim <agent-id>` and wait for **accepted** coordinator assignment *before editing upstream files*.',
      '- For **EXO work**, create a narrowly scoped issue/PR referencing an ID here; include a source baseline SHA, allowed files, fixtures, tests and a handoff. This Markdown file does not reserve GitHub issues.',
      '- Keep the running personal app, project files, CLO3D private assets, credentials and local machine paths out of all PRs and evidence packs.',
      '- Code % is **not** an amount complete. Move status from proposed only on reviewable tests and a merged, source-pinned implementation. Keep legacy JS/C++ parity harnesses until removal is independently verified.',
      '', '## Release/acceptance gates','',
      '1. Clean ClothCraft upstream baseline + EXO adapter tests; no unreviewed patches to upstream checkout.',
      '2. Typed Rust document/RPC, explicit SI/mm conversions, stable IDs and crash-safe undo/reopen.',
      '3. A traced six-size tee edit → grade → seam → mesh → solver → DXF → save/reopen in real desktop UI.',
      '4. Validated native-service/WASM hashes, dependency licenses, no private media/home paths, signed isolated bundle and clean-Mac rollback.',
      '5. Separate external CAD/printer and measured cloth-fit acceptance. Compiler pass and screenshot alone are not industrial certification.',
      '', 'Read [METHODOLOGY.md](METHODOLOGY.md) before interpreting percentages.']
    (dest/'TASK_BOARD.md').write_text('\n'.join(lines)+'\n')


def make_system_plan(dest: Path,tasks:list[dict],stats:dict) -> None:
    lines=['# System-by-system Rust migration plans (41 systems)','',
      'These plans extend the [existing 2026-11-14 full-system audit](../reports/EXO_V2_RUST_ALL_SYSTEMS_PLAN_20261114.md). They are *reviewable proposed work*, not finished migrations. The first-PR slice is deliberately smaller than the long-term migration target.','',
      '**Source:** Git '+stats['exoGitCommit']+'. **Numbers:** legacy mapped production-code LOC, not functional implementation or accepted upstream coverage.','']
    for s in tasks:
        tag=s['issueId'];d=', '.join('[%s](#sys-%02d)'%('EXO-RUST-'+str(x).zfill(3),x) for x in s['dependencies']) or 'None'
        sources='; '.join('`'+f+'`' for f in s['sourceExamples']) or 'No EXO first-party source mapped in legacy audit'
        lines.extend([
          f'<a id="sys-{s["id"]:02d}"></a>',
          f'## {s["rank"]:02d}. {tag} — {s["name"]} ({s["priority"]})','',
          f'**Legacy code composition:** {s["rustSourcePercent"]:.1f}% Rust = {s["rustSourceLines"]:,} Rust LOC / {s["sourceLines"]:,} mapped LOC across {s["files"]} file assignments. This does not measure runtime authority or feature completeness.','',
          f'**Dependency gates:** {d}. **Phase:** {s["phase"]}.','',
          f'**Concrete EXO files to inspect first:** {sources}.',
          f'**Tracked examples:** {s["trackedExamples"]}/{len(s["sourceExamples"])} at the referenced public Git revision.' + ((' Missing/stale examples: '+', '.join('`'+x+'`' for x in s['missingExamples'])+'.') if s['missingExamples'] else ''),'',
          f'**Proposed upstream ClothCraft attachment:** `{s["upstream"]}`. This is a mapping hypothesis, not an upstream-approved integration.','',
          '**First reviewable PR slice:** '+s['firstPrSlice'],'',
          '**Full migration target:** '+s['work'],'',
          '**Required positive and negative tests:** '+s['acceptance'],'',
          '**Done only when:** the real EXO UI or CLI invokes the source-pinned Rust implementation; a golden fixture and malformed-input rejection pass; both native and WASM paths (where relevant) are checked; Undo/Redo and cold reopen preserve IDs; old authority is removed only after parity.','',
          '**Claim state:** Proposed/unclaimed. See [board](TASK_BOARD.md) and [coordination rules](RESEARCH_AND_COORDINATION.md).','',
        ])
    (dest/'SYSTEM_PLANS.md').write_text('\n'.join(lines).rstrip()+'\n')



def make_markdown_dashboard(dest:Path,stats:dict) -> None:
    baseline=stats['baseline'];systems=stats['systems'];code=stats['currentGitProductionSourceAudit']
    current=code['first_party_scoped_source']
    lines=['# EXO — Rust percentage dashboard (GitHub-readable)','',
       '**EXO first-party production-source Rust share: '+format(current['rustSharePercent'],'.2f')+'%** ('+format(current['rustLines'],',')+' of '+format(current['totalProductionSourceLines'],',')+' tracked production-source lines across '+format(current['totalProductionSourceFiles'],',')+' files). **Separate mapped backend Rust share: '+format(baseline['backendMappedRustSharePercent'],'.2f')+'%** (7,128 of 138,170 lines across 41 systems). The denominators differ. Both measure *source language*, not completed functionality.','',
       '**Pinned public source:** `'+stats['exoGitCommit']+'`. Verified Rust ownership and feature migration completion remain **unknown**, not zero or 100. See [methodology](METHODOLOGY.md) before comparing percentages.','',
       '## System-by-system Rust source share','',
       '| Priority order | Task | System | Rust source mix (visual) | Rust / total mapped LOC |',
       '|---:|---|---|---|---:|']
    for s in systems:
        fill=round(s['rustSourcePercent']/5)
        bar='▓'*fill+'░'*(20-fill)
        lines.append(f'| {s["rank"]:02d} · {s["priority"]} | [{s["issueId"]}](SYSTEM_PLANS.md#sys-{s["id"]:02d}) | {s["name"]} | `{bar}` **{s["rustSourcePercent"]:.1f}%** | {s["rustSourceLines"]:,} / {s["sourceLines"]:,} |')
    lines+=['','## Prior mapped backend source by phase','',
     '| Phase | Mapped lines | Rust lines | Rust code mix |',
     '|---|---:|---:|---:|']
    phases=collections.defaultdict(lambda:[0,0])
    for s in systems:
        phases[s['phase']][0]+=s['sourceLines']; phases[s['phase']][1]+=s['rustSourceLines']
    for phase,(total,rust) in sorted(phases.items()):
        lines.append(f'| {phase} | {total:,} | {rust:,} | {percent(rust,total):.2f}% |')
    lines+=['','## Separate current Git production-source audit','',
     'This second measurement has different inclusion rules. It includes presentation/source integrations absent from the legacy mapped backend, so the percentages **must not be averaged**. Upstream-derived ClothCraft Rust is kept separate.','',
     '| Language | EXO first-party production files | Physical lines | Share |',
     '|---|---:|---:|---:|']
    current=code['first_party_scoped_source']
    for lang,d in sorted(current['byLanguage'].items(),key=lambda it:-it[1]['lines']):
        lines.append(f'| {lang} | {d["files"]:,} | {d["lines"]:,} | {percent(d["lines"],current["totalProductionSourceLines"]):.2f}% |')
    lines+=['',f'**EXO scoped source:** {current["totalProductionSourceFiles"]:,} tracked production files, {current["totalProductionSourceLines"]:,} physical lines; {current["rustLines"]:,} Rust lines (**{current["rustSharePercent"]:.2f}%**).','']
    upstream=code['upstream_clothcraft_source']
    lines+=[f'**Upstream-derived ClothCraft (separate):** {upstream["totalProductionSourceFiles"]:,} `.rs` files, {upstream["totalProductionSourceLines"]:,} lines, 100% Rust within that **selected source directory**, not proof of EXO integration.','',
      '## Critical interpretation','',
      '- A Rust file may be compiled but unused by the installed EXO app; this audit does not know active-call percentages or feature completion.',
      '- Legacy mapped system percentages come from the prior 41-system baseline; the current Git tracked source audit uses an independently declared set of roots/extensions.',
      '- **Correct prioritization follows dependencies**, not the percentage. A 95% Rust shared core still needs source-ownership and interface verification; a 0% Rust exporter may depend on unfinished geometry.',
      '- Source links, concrete first PR deliverables and acceptance tests: [SYSTEM_PLANS.md](SYSTEM_PLANS.md). For methodology and limitations: [METHODOLOGY.md](METHODOLOGY.md).',
      '- To interactively filter/search, download [dashboard.html](dashboard.html) and open locally. GitHub code view may show its HTML source unless Pages hosting is separately enabled.',
      '']
    (dest/'CODE_DASHBOARD.md').write_text('\n'.join(lines).rstrip()+'\n')


def make_dashboard(dest:Path,stats:dict) -> None:
    b=stats['baseline'];sys=stats['systems'];by=stats['currentGitProductionSourceAudit']
    current=by['first_party_scoped_source']
    rows=[]
    for s in sys:
        rows.append('<tr data-priority="'+s['priority']+'" data-search="'+html.escape((s['name']+' '+s['phase']+' '+s['issueId']).lower(),quote=True)+'"><td>'+str(s['rank'])+'</td><td><strong>'+s['priority']+'</strong></td><td><a href="SYSTEM_PLANS.md#sys-'+str(s['id']).zfill(2)+'">'+html.escape(s['issueId'])+'</a></td><td>'+html.escape(s['name'])+'</td><td class="num">'+format(s['sourceLines'],',')+'</td><td class="num">'+format(s['rustSourceLines'],',')+'</td><td class="mix"><span style="--pct:'+str(s['rustSourcePercent'])+'%" class="bar"></span><span>'+format(s['rustSourcePercent'],'.1f')+'%</span></td><td>'+str(len(s['dependencies']))+'</td></tr>')
    rust_groups=[]
    for population in ('first_party_scoped_source','upstream_clothcraft_source'):
        x=by[population];label='EXO first-party scoped production source' if population.startswith('first') else 'Upstream-derived ClothCraft source (separate)'
        rust_groups.append('<div class="panel"><h3>'+label+'</h3><p><strong>'+format(x['rustSharePercent'],'.2f')+'%</strong> Rust by physical lines, '+format(x['totalProductionSourceLines'],',')+' total production-code lines across '+format(x['totalProductionSourceFiles'],',')+' tracked files.</p><div class="stack">'+''.join('<div><span>'+html.escape(k)+'</span><b>'+format(v['lines'],',')+' lines ('+format(percent(v['lines'],x['totalProductionSourceLines']),'.1f')+'%)</b></div>' for k,v in sorted(x['byLanguage'].items(),key=lambda kv:-kv[1]['lines']))+'</div></div>')
    page='''<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>EXO Rust Migration Dashboard — Git-Pinned Audit</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:#0b1017;color:#e8edf5;line-height:1.5}*{box-sizing:border-box}
body{margin:0;padding:0 16px 80px}.wrap{max-width:1400px;margin:0 auto}a{color:#90c3ff}a:hover{color:white}
header{padding:55px 0 34px;border-bottom:1px solid #293748}small,.muted{color:#a5b2c4}h1{font-size:clamp(32px,5vw,54px);margin:10px 0}h2{margin-top:44px;font-size:23px}
.pill{display:inline-block;padding:6px 12px;border:1px solid #557191;border-radius:20px;color:#c7e1ff;font-size:12px;letter-spacing:.05em}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:30px 0}.card,.panel{border:1px solid #243143;background:#121a25;padding:23px;border-radius:14px}
.big{display:block;font-size:38px;font-weight:760;letter-spacing:-.035em;color:#eaf4ff}.card p{margin:0;color:#b6c7d9;font-size:13px}.crit{font-size:13px;max-width:920px;color:#d4ddea}
.warning{border-left:3px solid #d2a75f;padding:12px 16px;background:#2a261f;margin:23px 0;color:#f0dfbf;font-size:14px}
.controls{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}input,select{border:1px solid #394a60;background:#162232;color:#f1f5fd;border-radius:9px;padding:12px 15px;font:inherit}input{flex:1;min-width:230px}
.tablewrap{overflow-x:auto;border:1px solid #253446;border-radius:14px}table{width:100%;border-collapse:collapse;min-width:780px}thead{background:#182334;text-align:left}th,td{padding:12px 13px;border-bottom:1px solid #263442;font-size:13px}th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#adc1da}tr:hover td{background:#172131}td.num{text-align:right;font-variant-numeric:tabular-nums}td.mix{white-space:nowrap}.bar{display:inline-block;width:100px;height:9px;background:linear-gradient(to right,#5fa8ff var(--pct),#35465b var(--pct));border-radius:6px;margin-right:10px}
.phase{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}.stack>div{display:flex;align-items:center;justify-content:space-between;gap:15px;border-bottom:1px solid #263441;padding:9px 0;font-size:12px}.stack b{font-weight:550;color:#d3e1f4;text-align:right}
footer{margin-top:40px;border-top:1px solid #273448;padding-top:20px;color:#99aabe;font-size:12px}
</style></head><body><div class="wrap"><header><span class="pill">EXO SOURCE AUDIT • PUBLIC GIT PINNED</span><h1>Rust migration dashboard</h1>
<p class="muted">41 engineering systems. Dependency-ordered implementation priority. Source-composition evidence, not simulated product readiness.</p></header>
<div class="grid"><div class="card"><span class="big">'''+format(current['rustSharePercent'],'.2f')+'''%</span><p>EXO Rust share of selected first-party production source ('''+format(current['rustLines'],',')+''' / '''+format(current['totalProductionSourceLines'],',')+''' lines)</p></div><div class="card"><span class="big">'''+format(b['backendMappedRustSharePercent'],'.2f')+'''%</span><p>Separate Rust share of legacy mapped backend (7,128 / 138,170 lines)</p></div><div class="card"><span class="big">41</span><p>audited engineering systems</p></div><div class="card"><span class="big">unverified</span><p>actual functional migration completion</p></div></div>
<div class="warning"><strong>Two independent code measurements:</strong> The headline '''+format(current['rustSharePercent'],'.2f')+'''% is based on '''+format(current['rustLines'],',')+''' / '''+format(current['totalProductionSourceLines'],',')+''' lines across selected tracked first-party production source. The '''+format(b['backendMappedRustSharePercent'],'.2f')+'''% backend figure and the per-system bars use the older 41-system mapping. Their denominators differ, and <strong>neither is an estimate of feature migration completion</strong>. Upstream ClothCraft Rust source is counted separately; screenshots and source files do not prove runtime or industrial readiness.</div>
<h2>Priority-ranked systems</h2><p class="crit">P0 = safe shared core and transactions; P1 = real 2D→3D workflow; P2 = simulation and industrial integration; P3 = secondary systems and optional Rust-native UI. Tasks are topologically sorted: dependencies always precede dependants.</p>
<div class="controls"><input id="search" aria-label="Search systems" placeholder="Find system, ID, or phase…"/><select id="prio" aria-label="Priority filter"><option value="all">All priorities</option><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select><span class="muted" id="count"></span></div>
<div class="tablewrap"><table><thead><tr><th>Order</th><th>Priority</th><th>Task</th><th>System</th><th>Mapped LOC</th><th>Rust LOC</th><th>Rust code share</th><th>Deps</th></tr></thead><tbody>'''+''.join(rows)+'''</tbody></table></div>
<h2>Git-tracked production-source language breakdown</h2><p class="muted">This is a second audit with different source-inclusion rules: selected tracked production-code roots, excluding test files/vendor/media. It must not be added to or compared 1:1 with the legacy 41-system mapping.</p><section class="phase">'''+''.join(rust_groups)+'''</section>
<h2>Research and actionable engineering plan</h2><p>Open <a href="TASK_BOARD.md">task board</a>, <a href="SYSTEM_PLANS.md">41 precise system plans</a>, <a href="PRIORITY_ROADMAP.md">migration phases and first PRs</a>, <a href="RESEARCH_AND_COORDINATION.md">upstream contributor protocol</a>, <a href="dashboard-data.json">JSON</a>, <a href="systems.csv">CSV</a> or <a href="METHODOLOGY.md">methods and limitations</a>.</p>
<footer>Source SHA: <code>'''+stats['exoGitCommit']+'''</code> • Data: EXO existing 2026-11-14 41-system mapped audit plus independent Git object count. No external scripts, trackers, asset requests or private repository files.</footer></div>
<script>const rows=[...document.querySelectorAll('tbody tr')],input=document.getElementById('search'),priority=document.getElementById('prio'),count=document.getElementById('count');function filter(){const q=input.value.toLowerCase().trim(),p=priority.value;let n=0;for(const row of rows){const show=(p==='all'||row.dataset.priority===p)&&row.dataset.search.includes(q);row.hidden=!show;if(show)n++;}count.textContent=n+' / '+rows.length+' systems';}input.addEventListener('input',filter);priority.addEventListener('change',filter);filter();</script></body></html>'''
    (dest/'dashboard.html').write_text(page)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo',type=Path,default=Path.cwd())
    parser.add_argument('--ref',default=None,help='Immutable full 40-hex Git SHA; never defaults to dirty HEAD')
    parser.add_argument('--out',type=Path,default=Path('docs/rust-migration'))
    args=parser.parse_args()
    repo=args.repo.resolve(strict=True)
    if not args.ref or not re.fullmatch(r'[0-9a-f]{40}',args.ref):
        parser.error('--ref is required and must be an immutable 40-character Git commit')
    commit=git(repo,'rev-parse',args.ref+'^{commit}').decode().strip()
    assert commit==args.ref
    build(repo,commit,args.out)

if __name__=='__main__':main()
