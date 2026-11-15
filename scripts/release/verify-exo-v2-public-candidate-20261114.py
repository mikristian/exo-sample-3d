#!/usr/bin/env python3
"""Read-only verification of an isolated, source-built EXO Studio V2 candidate.

This does NOT qualify a public installer, manufacture-ready CAD output, or
bit-for-bit parity with the user's existing private EXO installation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import plistlib
import re
import subprocess
from pathlib import Path

RUNTIME_BINARIES = (
    'bin/node',
    'native_cpp/build-cmake/garment_cad_cli',
    'research/oss/clothcraft/target/debug/cloth-template',
    'research/oss/clothcraft/target/debug/cloth-fit',
    'research/oss/clothcraft/target/debug/exo-session',
    'integrations/clothcraft/rust-service/target/debug/exo-metadata-validation',
    'integrations/clothcraft/rust-agent-api/target/debug/exo-agent-validator',
    'integrations/clothcraft/rust-static-host/target/debug/exo-rust-static-host',
)
REQUIRED_WASM = ('exo_ui_kernel.wasm', 'exo_geometry_kernel.wasm',
                 'exo_grading_kernel.wasm', 'exo_sewing_kernel.wasm',
                 'exo_fabric_kernel.wasm')
RESTRICTED_MEDIA = re.compile(r'clo-thomas|clo-hardware-converted|\.(?:zpac|zprj)$', re.I)


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open('rb') as fd:
        for chunk in iter(lambda: fd.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def has_pattern(path: Path, pattern: bytes) -> bool:
    overlap = len(pattern) - 1
    previous = b''
    with path.open('rb') as fd:
        for chunk in iter(lambda: fd.read(1024 * 1024), b''):
            combined = previous + chunk
            if pattern in combined:
                return True
            previous = combined[-overlap:] if overlap else b''
    return False


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--app', type=Path, required=True)
    p.add_argument('--out', type=Path)
    args = p.parse_args()
    app = args.app.resolve(strict=True)
    resources = app / 'Contents/Resources'
    if not app.is_dir() or not app.name.endswith('.app'):
        p.error('Candidate must be an existing macOS .app directory')
    if app.is_relative_to(Path.home() / 'Applications') or app.is_relative_to(Path('/Applications')):
        p.error('Refusing to treat an installed application as an isolated staging candidate')
    info = plistlib.loads((app/'Contents/Info.plist').read_bytes())
    assert info.get('CFBundleIdentifier', '').endswith('.public-candidate'), 'Not a public staging bundle'
    assert re.fullmatch(r'EXO-ClothCraft-Studio-V2-Staging-[A-Za-z0-9-]{1,48}',
                        info.get('EXOStagingSupportName', '')), 'No unique staging support folder'
    executable = app/'Contents/MacOS/EXOClothCraft'
    assert executable.is_file() and os.access(executable, os.X_OK), 'Missing native EXO launcher'
    manifest = json.loads((resources/'runtime-provenance.json').read_text())
    assert manifest.get('schema') == 'exo.desktop.runtime-provenance.v3', 'Unexpected manifest schema'
    assert len(manifest['files']) >= 100, 'Manifest is unexpectedly incomplete'
    scanned = 0
    for relative, item in manifest['files'].items():
        assert not relative.startswith('/') and '..' not in Path(relative).parts, 'Unsafe manifest path'
        file = resources/relative
        assert file.is_file() and not file.is_symlink(), f'Missing/nonregular runtime {relative}'
        assert file.stat().st_size == item['bytes'] and sha256_file(file) == item['sha256'], \
            f'Runtime mismatch {relative}'
        scanned += 1
    for relative in RUNTIME_BINARIES:
        file = resources/relative
        assert file.is_file() and not file.is_symlink() and os.access(file, os.X_OK), \
            f'Missing executable runtime {relative}'
    for name in REQUIRED_WASM:
        assert (resources/'web/wasm'/name).is_file(), f'Missing required WASM {name}'
    assert (resources/'web/index.html').is_file(), 'Missing WebKit HTML'
    restricted = []
    username_home_matches = []
    build_path_matches = []
    personal_home = (str(Path.home()) + '/').encode()
    for file in app.rglob('*'):
        if file.is_symlink():
            raise RuntimeError('Symlinks are not allowed in this source-only candidate')
        if not file.is_file():
            continue
        relative = file.relative_to(app).as_posix()
        if RESTRICTED_MEDIA.search(relative):
            restricted.append(relative)
        if has_pattern(file, personal_home):
            username_home_matches.append(relative)
        if has_pattern(file, b'/Volumes/Expansion/'):
            build_path_matches.append(relative)
    assert not restricted, f'Restricted CLO media present: {restricted[:5]}'
    assert not username_home_matches, f'Local user-home path embedded: {username_home_matches[:5]}'
    codesign = subprocess.run(['/usr/bin/codesign','--verify','--deep','--strict',str(app)],
                              capture_output=True,text=True)
    assert codesign.returncode == 0, 'macOS ad-hoc codesign verification failed'
    runtime_script = resources/'integrations/clothcraft/runtime-provenance.mjs'
    assert runtime_script.is_file()
    provenance = subprocess.run(['node',str(runtime_script.resolve()),'--verify',str(resources.resolve())],
                                capture_output=True,text=True,timeout=35)
    assert provenance.returncode == 0 and manifest['identity'] in provenance.stdout and \
        'runtime provenance verified' in provenance.stdout, 'Node runtime provenance failed'
    data = {
        'schema': 'exo.public-staging-candidate-audit.v1',
        'bundleIdentifier': info['CFBundleIdentifier'],
        'sourceRuntimeIdentitySha256': manifest['identity'],
        'runtimeFileHashesVerified': scanned,
        'nativeExecutableCount': len(RUNTIME_BINARIES) + 1,
        'wasmFileCount': len(list((resources/'web/wasm').glob('*.wasm'))),
        'privateCloMediaFound': len(restricted),
        'localPersonalHomePathFileCount': len(username_home_matches),
        'genericExpansionBuildPathFileCount': len(build_path_matches),
        'adHocCodesignVerified': True,
        'selfContainedResourceManifestVerified': True,
        'publicInstallerQualified': False,
        'knownGates': ['exact running-app parity not certified',
                       'clean-machine installation and Apple notarization pending',
                       'WASM and third-party binary provenance/notice review incomplete',
                       'industrial cutter, sample fit and long-run solver parity not certified'],
    }
    if args.out:
        assert not args.out.resolve().is_relative_to(app), 'Audit output must stay outside signed app'
        args.out.write_text(json.dumps(data,indent=2,sort_keys=True)+'\n')
    print('EXO_ISOLATED_PUBLIC_CANDIDATE_AUDIT_PASS')
    print(json.dumps(data,indent=2,sort_keys=True))

if __name__ == '__main__':
    main()
