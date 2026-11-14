#!/usr/bin/env python3
"""Verified one-time offload of an obsolete QA candidate to physical Expansion.

This never touches installed apps, pinned Rust sources, the run41 PREINSTALL
ORIGINAL application, or personal-workspace-before-install. Uses the existing
full-member SHA/streamed remote readback helper and releases ONLY this candidate
after confirming the SSH-hosted archive is durable and the source is unchanged.
"""
import importlib.util
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / 'integrations/clothcraft/output/qa-packaged-run41-20261029'
NAME = 'EXO ClothCraft Studio V2.app'
SRC = QA / NAME
DEST = '/Volumes/Expansion/EXO-Engineering/verified-backups/EXO-V2-QA-20261030'

def main():
    if not SRC.is_dir() or SRC.is_symlink() or SRC.resolve().parent != QA.resolve():
        raise RuntimeError('REFUSE_INVALID_QA_APP_SOURCE')
    if not (SRC / 'Contents/MacOS/EXOClothCraft').is_file():
        raise RuntimeError('REFUSE_NOT_EXPECTED_INACTIVE_APP')
    app = Path.home() / 'Applications/EXO ClothCraft Studio V2.app'
    if SRC.resolve() == app.resolve():
        raise RuntimeError('REFUSE_ACTIVE_INSTALLED_APP')
    # No open handles / launched processes from the QA app being archived.
    probe = subprocess.run(['/usr/sbin/lsof', '+D', str(SRC)],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=90)
    if probe.stdout.strip():
        raise RuntimeError('REFUSE_QA_APP_WITH_OPEN_FILE_HANDLES')
    process_lines = subprocess.check_output(['ps','-axo','command='],text=True)
    if str(SRC) in process_lines:
        raise RuntimeError('REFUSE_QA_APP_REFERENCED_BY_RUNNING_PROCESS')
    source_script = ROOT / 'scripts/engineering/exo-direct-expansion-offload-20261021.py'
    spec = importlib.util.spec_from_file_location('exo_verified_expansion_offload', source_script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.SOURCES = QA
    module.ALLOW = (NAME,)
    module.DEST = DEST
    module.AUDIT = ROOT / 'docs/qa/expansion-offload-20261030'
    mount_check = (
        'mount | grep -F " on /Volumes/Expansion (exfat," >/dev/null && '
        'test -w /Volumes/Expansion && '
        'mkdir -p /Volumes/Expansion/EXO-Engineering/verified-backups/EXO-V2-QA-20261030'
    )
    module.ssh(mount_check)
    module.archive_and_verify(NAME)

if __name__ == '__main__':
    main()
