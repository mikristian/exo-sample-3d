#!/usr/bin/env python3
"""Render the 43-workstream evidence scorecard; never alter public release files."""
from collections import defaultdict
from html import escape
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
folder = root / "docs/reports"
data = json.loads((folder / "EXO_V2_DEEP_SYSTEM_SCORECARD_20261103.json").read_text())
rows = data["workstreams"]
assert data["schema"] == "exo.v2.deep-audit.evidence-stage.v1"
assert len(rows) == 43 and len({r["id"] for r in rows}) == 43
assert all(type(r["stage"]) is int and 0 <= r["stage"] <= 3 for r in rows)
assert all(r["source"] is None or (root / r["source"]).is_file() for r in rows)
groups = defaultdict(list)
for r in rows:
    groups[r["group"]].append(r)
earned = sum(r["stage"] for r in rows)
possible = 4 * len(rows)
assert (earned, possible) == (85, 172)
pct = lambda a, b: round(100 * a / b, 1)

vendors = [
 ("Editable 2D patterns","D","D","D","D","Tested EXO geometry tools"),
 ("Linked/measurement-based pattern variants","D","D","A","D","Constrained EXO generation"),
 ("Multi-size grading","D","D","D","D","EXO native strict gate open"),
 ("Seam allowances, notches and grainlines","D","D","D","D","EXO RUN106 grainline safety fails"),
 ("Graded print and logo placement","A","D","D","D","EXO artwork source/tests"),
 ("DXF or CAD exchange","D","A","D","D","EXO tested DXF; licensed receiver absent"),
 ("Marker and automatic nesting","A","A","A","D","EXO nesting fixtures, factory ZIP blocked"),
 ("Cutter/plotter production workflow","A","A","A","?","EXO physical cutter not signed off"),
 ("2D/3D linked virtual sampling","D","A","A","D","EXO spatial fixtures; fit unverified"),
 ("Strain, stress and fit inspection","D","A","?","D","EXO uncalibrated quality gates"),
 ("Avatar poses, rig and fitting","D","A","A","D","EXO experimental walking/fit"),
 ("Photorealistic garment views","D","A","A","D","EXO browser visualization present"),
 ("Tech packs / BOM export","D","?","A","D","EXO source-linked print QA"),
 ("Physical fabric property acquisition","A","?","?","A","EXO needs swatch measurements"),
 ("Hosted collaboration / PLM","A","A","A","A","EXO multi-client test absent"),
 ("AI-assisted concepts","?","?","?","D","EXO AI character tested"),
 ("Chat-driven editable garment pattern","?","?","?","?","EXO supported template drafts tested"),
 ("Unrestricted learned seam topology","?","?","?","?","EXO not implemented"),
 ("Native desktop on macOS","?","?","?","D","EXO Mac runs, build update blocked"),
]
workflows = [
 ("Text → conversational design revisions → reviewed native DXF","PASS bounded","Supported garment templates, revision history, native preflight tests"),
 ("Sketch → editable pattern","PASS bounded","Template-conditioned silhouette cues; uncalibrated measurements"),
 ("Isolated photo → editable contour/DXF","PASS bounded","Controlled image and human review; busy photos still uncertain"),
 ("On-body photo → factory certified pattern","BLOCKED","Visible semantic traits only; seam geometry/measurements hidden"),
 ("Novel written design → learned new seam topology","BLOCKED","Trained contour decoder and new topology model absent"),
 ("Graded pattern → persistent size rules → production","PARTIAL","Native grading gate not fully passed; physical receiver absent"),
 ("2D assembly → settled 3D drape → measured fit","PARTIAL","Simulation fixtures pass; no real fabric fit correlation"),
 ("Tech pack → external manufacturer signoff","UNVERIFIED","Internal document tests only"),
 ("Nesting → complete XS–XXL factory CUT ZIP","BLOCKED","XS/S rib-waistband instances/quantities inconsistent"),
 ("Real Optitex/Modaris/AccuMark import → re-export","UNVERIFIED","No licensed third-party accepting witness"),
 ("Walk animation → dynamic sewn-cloth movement","PARTIAL","Skeleton prototype; dynamic cloth and foot lock need proof"),
 ("Source → signed new Mac release → installed app","BLOCKED","Disk/source immutability/native parity gate"),
 ("Two remote accounts → shared editable project","UNVERIFIED","Authenticated collaboration code without two-user live QA"),
]
sources = [
 ("Optitex O/26","https://optitex.com/latest-release/"),
 ("Optitex Marker","https://optitex.com/products/marker/"),
 ("Lectra Modaris","https://www.lectra.com/en/fashion/products/modaris"),
 ("Gerber AccuMark","https://www.lectra.com/en/fashion/products/gerber-accumark-fashion"),
 ("AccuMark V2026.2 regional notice","https://go.lectra.com/gerber-accumark-new-release-es-es.html"),
 ("CLO 2026.1","https://www.clo3d.com/en/about-clo/newsroom/1442"),
 ("CLO DXF interoperability","https://support.clo3d.com/hc/en-us/articles/115000493067-2D-Pattern-DXF-Import-Export"),
 ("CLO fit maps","https://support.clo3d.com/hc/en-us/articles/360000436368-Garment-Fit-Maps"),
 ("CLO production BOM","https://support.clo3d.com/hc/en-us/articles/115000525207-BOM-XML-Export"),
 ("Browzwear VStitcher updates","https://help.browzwear.com/en/articles/13065044-what-s-new"),
 ("Browzwear VStitcher tools","https://browzwear.com/products/v-stitcher"),
 ("Style3D AI Garment documented workflow","https://help.style3d.com/studio/en/c4905/c2c8/7cd2/b61b"),
 ("Style3D V10.0 AI sewing/arrangement","https://www.style3d.com/blog/style3d-studio-v10-0-from-ai3d-output-to-enterprise-value/"),
 ("TUKAcad / TUKAmark editions","https://tukatech.com/products/tukacad"),
]
additional = [
 ("Browzwear VStitcher","2D drafting and grading linked with 3D fabric physics, pressure maps and tech packs; 2026.3 notes describe updated POM and grading workflows.","EXO needs physical drape/fit validation, full size review and stable manufacturer-ready handoff."),
 ("Style3D Studio","Vendor documents AI image/text to 2D pattern plus 3D garment/sewing relationships, and V10.0 AI automatic sewing and arrangement. Trial/enterprise availability varies.","EXO conversation and templates work but unrestricted learned topology and automatic assembly are unfinished."),
 ("Tukatech TUKAcad / TUKAmark","Industrial 2D pattern drafting, grading and marker making, with modules and size/piece limits depending on license.","EXO needs robust graded marker packages, cutter signoff and practical CAD interoperability."),
]
md = [
 "# EXO ClothCraft Studio V2 — 43-system deep competitive audit",
 "",
 "**As of November 3, 2026 (Eastern).** Current active shared source and selected bounded audit tests.",
 "",
 f"**Evidence milestone score: {pct(earned, possible)}% ({earned}/{possible}) across 43 workstreams.**",
 "This is not percentage product completion, certified factory readiness, quality parity, or fraction of a vendor suite implemented.",
 "The website's legacy November 1 score of 31/49 = 63% uses an unrelated rubric.",
 "",
 "## How the new numbers are computed",
 "",
 "Each workstream has four sequential evidence gates: code implemented (25%), passing behavior",
 "tests (50%), passing cross-module integration or real local service (75%), independent",
 "external/physical/production acceptance (100%). No workstream has reached the external gate.",
 "A missing gate may mean untested, not an absent feature. All included source anchors are validated",
 "by this renderer. Selected code tests cannot replace industrial performance acceptance.",
 "",
 "## System score bars",
 "",
 "| System group | Tracked | Evidence gates | Score |",
 "| --- | ---: | ---: | ---: |",
]
for group, subset in groups.items():
    done = sum(r["stage"] for r in subset)
    md.append(f"| {group} | {len(subset)} | {done}/{4*len(subset)} | **{pct(done,4*len(subset))}%** |")
md.append(f"| **Overall** | **43** | **{earned}/{possible}** | **{pct(earned,possible)}%** |")
md += ["", "## All 43 engineering systems", "", "| ID | System | Score | Audit evidence | Unfinished acceptance |", "| --- | --- | ---: | --- | --- |"]
for r in rows:
    md.append(f"| {r['id']} | {r['name']} | {25*r['stage']}% | {r['evidence']} | {r['gap']} |")
md += ["", "## Whole workflow verification", "", "| Workflow | Status | What the check supports |", "| --- | --- | --- |"]
for a,b,c in workflows:
    md.append(f"| {a} | **{b}** | {c} |")
md += [
 "",
 "## Competitor capability matrix",
 "",
 "**D** = vendor documentation describes feature; **A** = add-on, optional or related module;",
 "**?** = not established by reviewed official sources. These are NOT vendor test scores.",
 "The required modules, licensing and workflow depth must be checked on the actual product configuration.",
 "",
 "| Feature | Optitex | Modaris | AccuMark | CLO 3D | EXO status |",
 "| --- | :---: | :---: | :---: | :---: | --- |",
]
for row in vendors:
    md.append("| " + " | ".join(row) + " |")
md += [
 "",
 "## Additional professional tools reviewed",
 "",
 "| Platform | Documented workflow | EXO benchmark gap |",
 "| --- | --- | --- |",
]
for a,b,c in additional:
    md.append(f"| {a} | {b} | {c} |")
md += [
 "",
 "## New and outstanding engineering findings",
 "",
 "- Current AI, native and 3D worker suite: **86/86 passing** targeted cases; CAD and tech-pack suite: **29/29 passing**.",
 "- Additional November 3 2D construction, darts, seam trueing, polygon nesting and physical-scale print tests: **24/24 passing**.",
 "- Current seam allowance adversarial gate RUN104: **9/9 passing**; buttonhole RUN105: **11/11 passing** (previous historical failures have been repaired).",
 "- Current factory grainline safety RUN106: **3/8 passing and 5 failing**. Nonfinite or malformed angles and outside/crossing physical CUT remain unsafe.",
 "- Current check-factory: **fails closed** for XS/S rib-waistband marker instance and 2/3 rib placement quantity.",
 "- Strict native grading gate recently **25/30**, earlier bounded gate **27/30**: different revisions/fixture runs; neither establishes vendor parity.",
 "- Older RUN97 3/7 contains stale expected success cases: source now blocks linked-graph factory package export, so record the gap as unavailable rather than silently corrupted.",
 "- Live Mac backend health was **ready** on Nov 3 but reports **fitCertified:false**; app installed Oct 31 is not proven current.",
 "- Nov 3 release preflight remains **blocked**: roughly 1.75 GiB free, 3,693 dirty/untracked paths and pinned/live Rust source mismatch.",
 "- Local Ollama vision responded on one synthetic PNG; this is not real-photo accuracy proof or autonomous fit-ready pattern construction.",
 "- Trained pattern synthesis picks known donors with learned retrieval and deterministic interpolation; no verified new topology decoder.",
 "- Previous separate Nov 3 selected-suite audit reported **164/164** passes; some paths overlap current runs. Totals are not de-duplicated.",
 "",
 "## Greatest remaining gaps",
 "",
 "1. Fix the grainline containment and angle validation defect; retain fail-closed CUT geometry policy.",
 "2. Repair factory rib-waistband marker/quantity parity and rerun all required size combinations.",
 "3. Complete Rust-native grading history and dependency consistency, then real arbitrary-size external receiving.",
 "4. Obtain licensed Modaris/AccuMark/Optitex roundtrip witnesses for graded seams, notches, holes and units.",
 "5. Calibrate cloth properties against measured swatches and real sewn garment fit under multiple poses.",
 "6. Train and validate genuinely new contour and seam topology generation beyond template or donor geometry.",
 "7. Stabilize immutable source, disk headroom, native source pinning and signed installed Mac release.",
 "8. Validate two-user collaboration, Windows/Linux portability and production handoff security.",
 "",
 "## Current competitor versions",
 "",
 "Official English Lectra pages state 2026.1 for Modaris and AccuMark, while a Lectra regional",
 "notice records AccuMark V2026.2 on October 29. The correct installed licensed release should",
 "be inspected directly. Optitex advertises O/26, with a customer portal showing O/26.1;",
 "CLO's current public release is 2026.1. Module availability differs by purchased edition.",
 "",
 "## Official vendor documentation",
 "",
]
md += [f"- [{name}]({url})" for name,url in sources]
md += [
 "",
 "## Provenance",
 "",
 "The active worktree HEAD was 53041a64b9d5b176234e47ca51f48b0127e7bf5d and",
 "the Nov 2 published source snapshot was fcd605a75976cd29eaad11082d687b74cb925390.",
 "The active source is extensively modified. No clean build, physical test, or licensed competitor",
 "installation was performed for this scorecard. This renderer changes only its local audit outputs;",
 "it does not alter the site's November 1 progress dashboard or any installed application.",
 "",
]
out_md = folder / "EXO_V2_DEEP_COMPETITIVE_AUDIT_20261103.md"
out_md.write_text("\n".join(md), encoding="utf-8")

header = """<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EXO ClothCraft V2 | 43-System Audit</title><style>
:root{color-scheme:dark;font:15px system-ui,sans-serif;background:#090909;color:#f3f3f3}
*{box-sizing:border-box}main{width:min(1350px,calc(100% - 40px));margin:auto;padding:60px 0}
h1{font-size:clamp(36px,5.5vw,76px);line-height:1.05;letter-spacing:-.06em}
h2{font-size:30px;margin-top:65px;letter-spacing:-.04em}p,small{color:#a9a9a9}
.hero{display:flex;justify-content:space-between;align-items:center;gap:24px}
.big{font-size:clamp(52px,9vw,120px);font-weight:750;letter-spacing:-.08em}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
article{border:1px solid #303030;background:#141414;border-radius:12px;padding:20px}
article h3{font-size:17px;line-height:1.3}.line{display:flex;justify-content:space-between;gap:10px}
.rail{background:#292929;height:9px;border-radius:12px;overflow:hidden;margin:15px 0}
.rail span{display:block;height:100%;background:linear-gradient(90deg,#888,#f3f3f3)}
.system p{font-size:12px;line-height:1.55}.score{font-weight:700;font-size:21px}
.tag{color:#888;font:12px ui-monospace,monospace}.table-wrap{overflow:auto;border:1px solid #333;border-radius:12px}
table{border-collapse:collapse;width:100%;min-width:760px}td,th{padding:14px;text-align:left;border-bottom:1px solid #2e2e2e;font-size:13px}
th{background:#202020}a{color:#eee}li{margin:10px 0;color:#aaa}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:630px){.grid{grid-template-columns:1fr}.hero{display:block}main{width:calc(100% - 24px)}}
</style><main><small>EXO / CLOTHCRAFT STUDIO V2 / NOVEMBER 3 2026</small>
<div class="hero"><div><h1>43 systems.<br>Deep evidence audit.</h1>
<p>Against Optitex, Lectra Modaris, Gerber AccuMark and CLO 3D.</p></div><div class="big">"""
html = [header, f"{pct(earned,possible)}%</div></div>",
 f'<div class="rail" role="progressbar" aria-valuenow="{pct(earned,possible)}" aria-valuemin="0" aria-valuemax="100" aria-label="Evidence-stage coverage"><span style="width:{pct(earned,possible)}%"></span></div>',
 f"<p>{earned}/{possible} evidence milestones. This is a four-level evidence ladder, not app completion or competitor parity. The Nov 1 63% dashboard measures something different.</p>",
 "<h2>Five engineering groups</h2><div class='grid'>"]
for group,sub in groups.items():
    got=sum(r["stage"] for r in sub)
    q=pct(got,4*len(sub))
    html.append(f'<article><div class="line"><strong>{escape(group)}</strong><b>{q}%</b></div><div class="rail"><span style="width:{q}%"></span></div><small>{got}/{4*len(sub)} evidence milestones</small></article>')
html += ["</div><h2>All 43 systems</h2><p>25% source implemented · 50% bounded passing tests · 75% integrated test/service · 100% independently accepted (none yet).</p><div class='grid'>"]
for r in rows:
    q=r["stage"]*25
    html.append(f'<article class="system"><div class="line"><span class="tag">{escape(r["id"])}</span><strong class="score">{q}%</strong></div><h3>{escape(r["name"])}</h3><div class="rail" role="progressbar" aria-valuenow="{q}" aria-valuemin="0" aria-valuemax="100" aria-label="{escape(r["name"])}"><span style="width:{q}%"></span></div><p><b>Evidence:</b> {escape(r["evidence"])}</p><p><b>Gap:</b> {escape(r["gap"])}</p><small>{escape(r["source"] or "No implemented source")}</small></article>')
html += ["</div><h2>Complete workflows</h2><div class='table-wrap'><table><thead><tr><th>Workflow</th><th>Status</th><th>Evidence</th></tr></thead><tbody>"]
for a,b,c in workflows:
    html.append("<tr>"+"".join(f"<td>{escape(v)}</td>" for v in (a,b,c))+"</tr>")
html += ["</tbody></table></div><h2>Professional CAD capabilities</h2><p>D = documented by vendor; A = optional/add-on ecosystem; ? = not established from reviewed official sources. Vendor cells are not performance results.</p><div class='table-wrap'><table><thead><tr><th>Capability</th><th>Optitex</th><th>Modaris</th><th>AccuMark</th><th>CLO</th><th>EXO finding</th></tr></thead><tbody>"]
for row in vendors:
    html.append("<tr>"+"".join(f"<td>{escape(v)}</td>" for v in row)+"</tr>")
html += ["</tbody></table></div><h2>Additional competitor suites</h2><div class='table-wrap'><table><thead><tr><th>Platform</th><th>Documented workflow</th><th>EXO benchmark gap</th></tr></thead><tbody>"]
for row in additional:
    html.append("<tr>"+"".join(f"<td>{escape(v)}</td>" for v in row)+"</tr>")
html += ["</tbody></table></div><h2>Official source documentation</h2><ul>"]
for name,url in sources:
    html.append(f'<li><a href="{escape(url)}" target="_blank" rel="noopener noreferrer">{escape(name)}</a></li>')
html += ["</ul><p>Read the complete adjacent Markdown report for blockers, release versions, detailed limits and test command evidence.</p></main></html>"]
out_html = folder / "EXO_V2_DEEP_COMPETITIVE_DASHBOARD_20261103.html"
out_html.write_text("\n".join(html), encoding="utf-8")
print("Evidence score",earned,"/",possible,"=",pct(earned,possible),"%")
print("Wrote",out_md.relative_to(root),out_md.stat().st_size,"bytes")
print("Wrote",out_html.relative_to(root),out_html.stat().st_size,"bytes")
