#!/usr/bin/env python3
"""Install startup recovery for the user's full GarmentCodeData v2 import.

Run ON the Expansion Mac after mounting the dedicated external drive. Each
LaunchAgent checks for a live process and exits if it is already working.
The installer does not stop existing downloads or duplicate their writes.
"""
from pathlib import Path
import plistlib
import shutil

ROOT = Path('/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2')


def main():
    if not (ROOT/'data/pattern-index.sqlite3').is_file():
        raise RuntimeError('Expansion external volume must be mounted before installation')
    agents = Path.home()/'Library/LaunchAgents'
    logs = Path.home()/'Library/Logs'
    # macOS may deny LaunchAgent scripts read/execute permission on removable
    # volumes even though the user's SSH terminal can read them. Keep these
    # tiny execution scripts on the home volume, not on the external disk.
    local_tools = Path.home()/'Library/Application Support/EXOClothCraft/GarmentCodeDataV2/tools'
    local_tools.mkdir(parents=True, exist_ok=True)
    for filename in (
        'ensure-remote-garmentcode-runner.sh',
        'remote-garmentcode-supervisor.sh',
        'remote-garmentcode-random-accelerator.sh',
        'ingest_garmentcodedata_v2.py',
        'prefetch_garmentcodedata_v2.py',
        'audit_garmentcodedata_v2_completion.py',
        'convert_garmentcode.py',
    ):
        source = ROOT/'tools'/filename
        if not source.is_file():
            raise RuntimeError(f'Missing prerequisite for startup recovery: {source}')
        shutil.copy2(source, local_tools/filename)
    agents.mkdir(parents=True, exist_ok=True)
    logs.mkdir(parents=True, exist_ok=True)
    wrapper = str(local_tools/'ensure-remote-garmentcode-runner.sh')
    for mode, seconds in (('import', 600), ('prefetch', 900), ('random', 600)):
        label = 'com.exo.garmentcodedata-full-' + mode
        data = {
            'Label': label,
            'ProgramArguments': ['/bin/bash', wrapper, mode],
            'RunAtLoad': True,
            'StartInterval': seconds,
            'ProcessType': 'Background',
            'StandardOutPath': str(logs/(label+'.log')),
            'StandardErrorPath': str(logs/(label+'.error.log')),
        }
        target = agents/(label+'.plist')
        target.write_bytes(plistlib.dumps(data))
        print('LaunchAgent:', target)


if __name__ == '__main__': main()
