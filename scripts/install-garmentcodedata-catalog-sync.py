#!/usr/bin/env python3
"""Install a reversible macOS LaunchAgent to refresh EXO's local catalog.

Does not download or modify the original research data. It only reads the
ExpansionCloud SQLite snapshot and safely updates the main Mac's catalog.
"""

from __future__ import annotations

import os
import plistlib
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LABEL = 'com.exo.garmentcodedata-v2-catalog-sync'
AGENT = Path.home() / 'Library' / 'LaunchAgents' / (LABEL + '.plist')


def main():
    # The Tailscale/WebDAV mount URI identifies the same SSH-reachable Mac.
    # Keep its current private IP only in the user's local LaunchAgent, never
    # in a source-controlled script.
    mount_listing = subprocess.check_output(['/sbin/mount'], text=True)
    current_mount = str(Path.home() / 'ExpansionCloud')
    matches = re.findall(r'https?://([A-Za-z0-9.-]+):19080/ on ([^\n]+?) \(webdav', mount_listing)
    address = os.environ.get('EXO_GARMENTCODE_SSH_HOST')
    if not address:
        address = next((host for host, mount in matches if mount == current_mount), None)
    if not address and AGENT.exists():
        # The expansion host may be temporarily offline when recovering a
        # months-long import. Reuse the previously installed trusted target
        # rather than refusing to re-enable the two-minute recovery loop.
        try:
            previous=plistlib.loads(AGENT.read_bytes())
            args=previous.get('ProgramArguments',[])
            address=args[args.index('--host')+1] if '--host' in args else None
        except (OSError, ValueError, IndexError, KeyError):
            address=None
    if not address:
        raise RuntimeError('No mounted ExpansionCloud tunnel or previously configured SSH target available')
    log_folder = Path.home() / 'Library' / 'Logs'
    log_folder.mkdir(exist_ok=True, parents=True)
    AGENT.parent.mkdir(exist_ok=True, parents=True)
    data = {
        'Label': LABEL,
        'ProgramArguments': ['/usr/bin/python3', str(ROOT / 'scripts' / 'pull-garmentcodedata-catalog-ssh.py'), '--host', address],
        'RunAtLoad': True,
        'StartInterval': 300,
        'ProcessType': 'Background',
        'StandardOutPath': str(log_folder / 'exo-garmentcodedata-v2-sync.log'),
        'StandardErrorPath': str(log_folder / 'exo-garmentcodedata-v2-sync-error.log'),
    }
    AGENT.write_bytes(plistlib.dumps(data))
    print('Created:', AGENT)
    print('To load: launchctl bootstrap gui/$(id -u) "{}"'.format(AGENT))
    print('To disable: launchctl bootout gui/$(id -u) "{}"'.format(AGENT))
    recovery_label = 'com.exo.garmentcodedata-v2-remote-recovery'
    recovery = AGENT.parent/(recovery_label+'.plist')
    recovery_data = {
        'Label': recovery_label,
        'ProgramArguments': ['/usr/bin/python3', str(ROOT/'scripts/ensure-garmentcodedata-remote-ssh.py'), '--host', address],
        'RunAtLoad': True,
        'StartInterval': 120,
        'ProcessType': 'Background',
        'StandardOutPath': str(log_folder/(recovery_label+'.log')),
        'StandardErrorPath': str(log_folder/(recovery_label+'.error.log')),
    }
    recovery.write_bytes(plistlib.dumps(recovery_data))
    print('Created remote restart check:', recovery)
    # EXO's geometry encoder trains on actual, SHA-256 checked sewing-panel
    # JSON archives only; the importer keeps operating on the Expansion Mac.
    # This remains lightweight until at least 50,000 archived JSON sources are
    # reachable, then optionally retrains when another 10k examples arrive.
    training_label='com.exo.garmentcodedata-v2-geometry-train'
    training=AGENT.parent/(training_label+'.plist')
    jarvis_offload=(AGENT.parent/'com.exo.garmentcodedata-v2-seam-offload-ssh.plist').exists()
    geometry_args=[sys.executable,str(ROOT/'scripts/train-garmentcodedata-archived-runner.py'),
                   '--root',str(ROOT/'download/garment-dxf-library-20261023/garmentcodedata-v2'),
                   '--host',address,'--minimum-examples','50000']
    if jarvis_offload:
        geometry_args.append('--sync-only')
    training_data={
        'Label': training_label,
        'ProgramArguments':geometry_args,
        'RunAtLoad': True,
        'StartInterval':1800,
        'ProcessType':'Background',
        'StandardOutPath':str(log_folder/(training_label+'.log')),
        'StandardErrorPath':str(log_folder/(training_label+'.error.log')),
    }
    training.write_bytes(plistlib.dumps(training_data))
    print('Created verified JSON source archive mirror' if jarvis_offload else 'Created verified geometry training check',training)
    # Independent one-hour seam-training check. When the Jarvis offload is
    # installed, do not accidentally re-enable the competing local 30K seam
    # job on this already memory-constrained primary Mac. Models and sources
    # remain available; only the scheduled local optimization is suppressed.
    if (AGENT.parent/'com.exo.garmentcodedata-v2-seam-offload-ssh.plist').exists():
        print('Jarvis remote seam offload installed; skipping local seam trainer')
        return
    # Without an offload, local trainer reads only cached verified archives.
    seam_label='com.exo.garmentcodedata-v2-seam-train'
    seam_agent=AGENT.parent/(seam_label+'.plist')
    seam_data={
        'Label':seam_label,
        'ProgramArguments':[sys.executable,str(ROOT/'scripts/train-garmentcodedata-seams-incremental.py'),
                            '--root',str(ROOT/'download/garment-dxf-library-20261023/garmentcodedata-v2')],
        'RunAtLoad':True,
        'StartInterval':3600,
        'ProcessType':'Background',
        'StandardOutPath':str(log_folder/(seam_label+'.log')),
        'StandardErrorPath':str(log_folder/(seam_label+'.error.log')),
    }
    seam_agent.write_bytes(plistlib.dumps(seam_data))
    print('Created incremental seam training check:',seam_agent)


if __name__ == '__main__':
    main()
