#!/usr/bin/env python3
"""Offline release-asset integrity and launcher layout tests.
Does not claim a successful Windows GUI boot or notarization.
"""
from __future__ import annotations
import hashlib,json,plistlib,platform,subprocess,sys,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
folder=root/'downloads'
manifest_path=folder/'manifest.json'
manifest=json.loads(manifest_path.read_text())
errors=[]
def check(ok,label):
 if not ok:errors.append(label)
check(manifest.get('repo')=='erythrofr/ClothCraft','repository identity')
check(manifest.get('workflow_run')==39828874228,'workflow run provenance')
check(manifest.get('type')=='unnotarized-development-preview','preview-type disclosure')
items=manifest.get('files',[])
check(len(items)==2,'exactly two platform archives')
for item in items:
 name=item.get('filename','');target=folder/name
 check(name in {'ClothCraft-macOS-AppleSilicon-Preview.dmg','ClothCraft-Windows-x64-Portable-Preview.zip'},f'{name} unexpected filename')
 check(item.get('path')=='/downloads/'+name,f'{name} url path')
 check(item.get('signed_release') is False and item.get('notarized') is False,f'{name} unsiged/unnotarized disclosure')
 check(target.is_file(),f'{name} missing');
 if not target.is_file():continue
 h=hashlib.sha256();
 with target.open('rb') as f:
  for block in iter(lambda:f.read(2**20),b''):h.update(block)
 check(h.hexdigest()==item.get('sha256'),f'{name} SHA256 mismatch')
 check(target.stat().st_size==item.get('bytes'),f'{name} size mismatch')
 print(f"{item.get('platform')} · {name} · {target.stat().st_size/1024/1024:.2f} MiB · SHA256 verified")
 if item.get('platform')=='windows':
  with zipfile.ZipFile(target) as z:
   check(z.testzip() is None,'Windows ZIP CRC integrity')
   paths=set(z.namelist())
   for fn in ['ClothCraft/Start ClothCraft.cmd','ClothCraft/cloth-fit.exe','ClothCraft/examples/templates/tshirt.json','ClothCraft/assets/makehuman/mannequin.obj','ClothCraft/README - START HERE.txt','ClothCraft/ClothCraft.ico']:
    check(fn in paths,'Windows missing '+fn)
   if 'ClothCraft/cloth-fit.exe' in paths:
    check(z.read('ClothCraft/cloth-fit.exe')[:2]==b'MZ','Windows native PE magic')
   if 'ClothCraft/Start ClothCraft.cmd' in paths:
    script=z.read('ClothCraft/Start ClothCraft.cmd').decode('ascii')
    check('cd /d "%~dp0"' in script and 'cloth-fit.exe --steps 0 --view' in script,'Windows launcher relative working directory')
 elif item.get('platform')=='macos' and platform.system()=='Darwin':
  cp=subprocess.run(['hdiutil','verify',str(target)],capture_output=True,text=True)
  check(cp.returncode==0,'Mac DMG image CRC verification')
sha_lines=(folder/'SHA256SUMS.txt').read_text().splitlines()
for item in items:check(f"{item['sha256']}  {item['filename']}" in sha_lines,item['platform']+' SHA256SUMS line')
if errors:
 print('FAIL:',*errors,sep='\n- ',file=sys.stderr)
 sys.exit(1)
print('PASS: Official ClothCraft preview packages are internally consistent. Not a Windows GUI or notarization test.')
