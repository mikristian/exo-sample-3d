#!/usr/bin/env python3
"""Verify local EXO V3 hybrid React and native ClothCraft Rust bridge without altering projects."""
import argparse, hashlib, json, urllib.request
from pathlib import Path

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--reference',type=Path,default=Path.home()/'Applications/EXO ClothCraft Studio V2.app')
p.add_argument('--ui',default='http://127.0.0.1:5486/')
p.add_argument('--health',default='http://127.0.0.1:5485/health')
a=p.parse_args()
with urllib.request.urlopen(a.ui,timeout=8) as response:
    assert response.status==200
    ui=response.read()
original=(a.reference/'Contents/Resources/web/index.html').read_bytes()
assert hashlib.sha256(ui).digest()==hashlib.sha256(original).digest(), 'React UI not identical'
with urllib.request.urlopen(a.health,timeout=8) as response:
    assert response.status==200
    health=json.load(response)
assert health.get('ok') and health.get('nativeReady'), 'Rust service unavailable'
assert health.get('backend')=='clothcraft-exo-local'
assert health.get('workspaceBridgeProtocol')=='exo.workspace.bridge.v2'
assert health.get('runtimeProvenance',{}).get('verified') is True
session=health.get('nativeSession',{})
assert session.get('loaded') is True and session.get('nativeProcessRunning') is True
print('PASS: exact installed React UI index; SHA-256:',hashlib.sha256(ui).hexdigest())
print('PASS: Rust/ClothCraft bridge, signed runtime provenance and live native garment session')
print('NOTE: JS/C++ button migration and physical fit are not certified by this smoke test')
