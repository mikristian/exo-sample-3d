#!/usr/bin/env python3
"""Package VERIFIED official ClothCraft CI artifacts for local preview downloads.

Does not sign/notarize or release on GitHub. Use only with the audited upstream
GitHub Actions archives from https://github.com/erythrofr/ClothCraft/actions/runs/39828874228.
"""
from pathlib import Path
from PIL import Image, ImageDraw
from datetime import datetime,timezone
import os,io,subprocess,zipfile,hashlib,shutil,tempfile,json,plistlib

root=Path(__file__).resolve().parents[1]
downloads=root/'downloads'
SOURCE={
  'macos':{'archive':'ClothCraft-macOS-arm64-dev.zip','artifact_id':12448985287,'sha256':'5a2f64eba6224be728a86f28ee23c6455929f8813af47ba797f222b9bfc11301'},
  'windows':{'archive':'ClothCraft-Windows-x64-dev.zip','artifact_id':12447154334,'sha256':'b37740b7c028c4a928effb60750bf2aa0d63e4789f19ca4ce43838560bbf1dd3'},
}

def sha256(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(2**20),b''): h.update(chunk)
 return h.hexdigest()

def unzip_verified(src,out,sha):
 if not src.is_file() or sha256(src)!=sha:raise SystemExit(f'Official upstream archive SHA256 mismatch: {src}')
 with zipfile.ZipFile(src) as z:
  if z.testzip() is not None:raise SystemExit('Damaged artifact: '+str(src))
  for v in z.infolist():
   if v.is_dir():continue
   dest=(out/v.filename).resolve()
   if not dest.is_relative_to(out.resolve()):raise SystemExit('Unsafe ZIP member '+v.filename)
   dest.parent.mkdir(parents=True,exist_ok=True)
   dest.write_bytes(z.read(v))
   # Zip did not preserve Unix mode on file transfer. Keep only known binary executable.
   if dest.name in {'cloth-fit','cloth-template','marvelous-cloth'}:dest.chmod(0o755)

with tempfile.TemporaryDirectory(prefix='clothcraft-public-preview-') as tmp:
 tmp=Path(tmp)
 mac=tmp/'mac';win=tmp/'windows';mac.mkdir();win.mkdir()
 for osname,folder in [('macos',mac),('windows',win)]:
  obj=SOURCE[osname];unzip_verified(root/'tools/release-input'/obj['archive'],folder,obj['sha256'])
  for expected in (['cloth-fit','cloth-template','marvelous-cloth'] if osname=='macos' else ['cloth-fit.exe','cloth-template.exe','marvelous-cloth.exe']):
   assert (folder/expected).is_file(),f'Missing {osname} binary: {expected}'
  assert (folder/'assets/makehuman/mannequin.obj').is_file(),f'Missing avatar assets for {osname}'
  assert (folder/'examples/templates/tshirt.json').is_file(),f'Missing template for {osname}'

 # Mac application package containing upstream binary and its relative assets.
 app=tmp/'ClothCraft.app';contents=app/'Contents';macos=contents/'MacOS';res=contents/'Resources';payload=res/'clothcraft'
 macos.mkdir(parents=True);res.mkdir(parents=True)
 shutil.copytree(mac,payload)
 (macos/'ClothCraft').write_text('#!/bin/sh\nset -eu\nAPP_ROOT="$(cd "$(dirname "$0")/../Resources/clothcraft" && pwd)"\ncd "$APP_ROOT"\nexec "$APP_ROOT/cloth-fit" --steps 0 --view "$@"\n')
 (macos/'ClothCraft').chmod(0o755)
 (contents/'Info.plist').write_bytes(plistlib.dumps({'CFBundleDevelopmentRegion':'en','CFBundleExecutable':'ClothCraft','CFBundleIconFile':'ClothCraft','CFBundleIdentifier':'org.clothcraft.development.preview','CFBundleInfoDictionaryVersion':'6.0','CFBundleName':'ClothCraft','CFBundleDisplayName':'ClothCraft Development Preview','CFBundlePackageType':'APPL','CFBundleShortVersionString':'0.1.0-dev','CFBundleVersion':'39828874228','LSMinimumSystemVersion':'13.0','NSHighResolutionCapable':True,'LSApplicationCategoryType':'public.app-category.graphics-design'}))

 # Draw small original ClothCraft-inspired glyph; derived from no third-party logo/font.
 sizes=[16,32,64,128,256,512]
 iconset=tmp/'ClothCraft.iconset';iconset.mkdir()
 for size in sizes:
  for ratio in (1,2):
   side=size*ratio
   if side>1024:continue
   im=Image.new('RGBA',(side,side),(0,0,0,0));d=ImageDraw.Draw(im)
   m=int(side*.06);r=int(side*.18)
   d.rounded_rectangle((m,m,side-m,side-m),radius=r,fill='#101b2b')
   # Three open garment pattern shapes, like folded fabric panels.
   lw=max(2,int(side*.048)); blue='#62a9ff'; light='#e4f2ff'
   from math import sin,cos,pi
   for angle in (0,120,240):
    x0=side/2;y0=side/2;axis=angle*pi/180
    pts=[]
    for t in (.10,.24,.36):
     x=x0+side*t*cos(axis);y=y0+side*t*sin(axis)
     pts.append((x,y))
    d.line(pts,fill=light if angle==0 else blue,width=lw,joint='curve')
    x,y=pts[-1];rr=max(2,lw//2);d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=light)
   im.save(iconset/f'icon_{size}x{size}{"@2x" if ratio==2 else ""}.png')
 subprocess.run(['iconutil','-c','icns',str(iconset),'-o',str(res/'ClothCraft.icns')],check=True)
 subprocess.run(['codesign','--force','--deep','--sign','-',str(app)],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['codesign','--verify','--deep',str(app)],check=True,stdout=subprocess.DEVNULL)
 subprocess.run([str(payload/'cloth-template'),'validate',str(payload/'examples/templates/two-panel.json')],check=True,stdout=subprocess.DEVNULL)
 # DMG drag to Applications for standard Mac desktop entry point.
 staging=tmp/'dmg';staging.mkdir();shutil.copytree(app,staging/'ClothCraft.app')
 (staging/'Applications').symlink_to('/Applications',target_is_directory=True)
 (staging/'READ ME FIRST.txt').write_text('CLOTHCRAFT DEVELOPMENT PREVIEW / macOS APPLE SILICON\n\nDrag ClothCraft.app into Applications. This app is ad-hoc signed but NOT Developer ID signed or notarized. macOS may block it. Download and run at your own risk; do not disable system-wide protections.\n\nBuilt from official erythrofr/ClothCraft GitHub Actions run 39828874228, artifact 12448985287.\nEarly research prototype; not a validated production garment tool. For support, consult GitHub project README and issues.\n')
 dmg=downloads/'ClothCraft-macOS-AppleSilicon-Preview.dmg'
 if dmg.exists():dmg.unlink()
 subprocess.run(['hdiutil','create','-volname','ClothCraft Preview','-srcfolder',str(staging),'-ov','-format','UDZO','-imagekey','zlib-level=6',str(dmg)],check=True,stdout=subprocess.DEVNULL)

 # Windows portable double-click launcher for the upstream compiled exe.
 (win/'Start ClothCraft.cmd').write_text('@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\ncloth-fit.exe --steps 0 --view\r\nif errorlevel 1 (echo. & echo ClothCraft was unable to start. Read README.md for system requirements. & pause)\r\n',encoding='ascii')
 # Include a separate, original high-resolution icon for Windows desktop shortcuts.
 Image.open(iconset/'icon_512x512.png').save(win/'ClothCraft.ico',format='ICO',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
 (win/'README - START HERE.txt').write_text('CLOTHCRAFT DEVELOPMENT PREVIEW / WINDOWS x64\n\nExtract the ZIP to a folder. Double-click "Start ClothCraft.cmd" to open the native editor. Keep the assets/ and examples/ directories next to the executable. To make a desktop shortcut, right-click Start ClothCraft.cmd, choose Create shortcut, move the shortcut to your Desktop; use ClothCraft.ico as the icon through shortcut Properties > Change Icon if desired.\n\nNot a signed, certified installer. Windows SmartScreen may warn. Do not disable protections system-wide. This is an early research prototype, not professional fit simulation software.\n\nBuilt from official erythrofr/ClothCraft GitHub Actions run 39828874228, artifact 12447154334.\nLicense: MIT original source; bundled MakeHuman assets retain their notice.\n')
 windows=downloads/'ClothCraft-Windows-x64-Portable-Preview.zip'
 with zipfile.ZipFile(windows,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for file in win.rglob('*'):
   if file.is_file():z.write(file,arcname=str(Path('ClothCraft')/file.relative_to(win)))

 manifest={'schema':1,'repo':'erythrofr/ClothCraft','type':'unnotarized-development-preview','workflow_run':39828874228,'source_sha':'991b4754e3','files':[]}
 for platform,fp,label in [('macos',dmg,'Apple silicon · macOS development preview'),('windows',windows,'Windows 64-bit · portable development preview')]:
  manifest['files'].append({'platform':platform,'filename':fp.name,'path':'/downloads/'+fp.name,'display':label,'bytes':fp.stat().st_size,'sha256':sha256(fp),'build_artifact_id':SOURCE[platform]['artifact_id'],'verified_zip_sha256':SOURCE[platform]['sha256'],'developer_preview':True,'signed_release':False,'notarized':False})
 (downloads/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 (downloads/'SHA256SUMS.txt').write_text(''.join(f'{item["sha256"]}  {item["filename"]}\n' for item in manifest['files']))
 print(json.dumps({'files':[{'filename':f['filename'],'bytes':f['bytes'],'sha256':f['sha256']} for f in manifest['files']],'run':manifest['workflow_run']},indent=2))
