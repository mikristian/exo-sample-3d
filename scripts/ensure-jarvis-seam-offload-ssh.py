#!/usr/bin/env python3
"""Trigger serial EXO garment-model training on Jarvis via trusted SSH.

On this macOS host, user LaunchAgents cannot open files on external Expansion
because of privacy permissions. SSH sessions can; trigger from the primary Mac
through the existing authenticated tunnel instead. The remote subprocess
detaches and remains on Jarvis, with a worker-held exclusive lock.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import re
import subprocess
import sys


REMOTE_SCRIPT=r'''#!/bin/bash
set -eu
root=/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2
if [ ! -f "$root/data/pattern-index.sqlite3" ] || [ ! -f "$root/tools/remote_garmentcode_dispatch.py" ]; then
  echo 'Jarvis Expansion source unavailable; retry on next primary-Mac check'
  exit 0
fi
# Opportunistically prefetch only the nine source Parquets AFTER random/10.
# This is read-only with respect to the SQLite catalog and has one low-priority
# network worker. The existing sole importer continues and reuses fully
# SHA256-verified original Parquet files after atomic publication. Relaunch
# after a Tailscale interruption only when source files are still missing.
if [ -f "$root/tools/prefetch_garmentcodedata_v2.py" ] && \
   ! /usr/bin/pgrep -f '[p]refetch_garmentcodedata_v2.py --output .* --first-batch 11 --last-batch 19' >/dev/null; then
  need_prefetch=0
  for n in 11 12 13 14 15 16 17 18 19; do
    if [ ! -s "$root/data/original-parquet/random_body/batch-$n.parquet" ]; then
      need_prefetch=1
      break
    fi
  done
  if [ "$need_prefetch" = 1 ]; then
    if /usr/bin/python3 - <<'PY'
import os,re,shutil,subprocess,sys
try:
    pressure=subprocess.run(['/usr/bin/memory_pressure','-Q'],
        capture_output=True,text=True,timeout=8)
    match=re.search(r'System-wide memory free percentage:\s*(\d+)',pressure.stdout)
    ready=(match is not None and int(match.group(1))>=45
           and os.getloadavg()[0]<6
           and shutil.disk_usage('/Volumes/Expansion').free>=50*1024**3)
except (OSError,ValueError,subprocess.TimeoutExpired):
    ready=False
sys.exit(0 if ready else 1)
PY
    then
      prefetch_log="$HOME/Library/Logs/com.exo.garmentcodedata-v2-remaining-random-prefetch.log"
      mkdir -p "$HOME/Library/Logs"
      nohup /usr/bin/nice -n 19 /usr/bin/python3 -u \
        "$root/tools/prefetch_garmentcodedata_v2.py" --output "$root/data" \
        --only-body random --first-batch 11 --last-batch 19 \
        --workers 1 --reserve-gb 12 >> "$prefetch_log" 2>&1 </dev/null &
      echo "Triggered low-priority original Parquet prefetch PID=$!"
    else
      echo 'Remaining-source prefetch deferred for Jarvis RAM/load/disk safety'
    fi
  fi
fi
# Only ONE background dispatcher checks geometry, seam and validation, in
# sequence. Independent workers still hold the same exclusive compute lock.
# Do not start another dispatcher while one is running; the dispatcher also
# has its own nonblocking kernel flock for trigger races.
if /usr/bin/pgrep -f '[r]emote_garmentcode_dispatch.py --root' >/dev/null; then
  echo 'Jarvis serial model dispatcher is already active'
else
  log="$HOME/Library/Logs/com.exo.garmentcodedata-v2-dispatch-ssh.log"
  mkdir -p "$HOME/Library/Logs"
  nohup /usr/bin/python3 -u "$root/tools/remote_garmentcode_dispatch.py" \
    --root "$root" \
    >> "$log" 2>&1 </dev/null &
  echo "Triggered Jarvis serial model dispatcher PID=$!"
fi
echo 'Original archive importer remains independent'
'''


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--host',default='100.82.90.101')
    p.add_argument('--ssh-alias',default='jarviss-macbook-pro')
    args=p.parse_args(argv)
    if not re.fullmatch('[A-Za-z0-9.-]{1,253}',args.host) or not re.fullmatch('[A-Za-z0-9._-]{1,253}',args.ssh_alias):
        p.error('Invalid SSH host')
    # Recover code changes after temporary Tailscale outages without writing
    # to a missing /Volumes/Expansion mount or the source dataset itself.
    # Avoid launching work from a stale, less conservative memory gate.
    deployment=Path(__file__).with_name('push-jarvis-offload-code-ssh.py')
    if deployment.is_file():
        try:
            update=subprocess.run([sys.executable,str(deployment),
                '--host',args.host,'--ssh-alias',args.ssh_alias],
                capture_output=True,text=True,timeout=160)
        except subprocess.TimeoutExpired:
            print('Jarvis code update timed out; offload retry retained',file=sys.stderr)
            return 0
        if update.returncode:
            print(update.stderr.strip() or update.stdout.strip() or
                  'Jarvis code version could not be verified; offload retry retained',
                  file=sys.stderr)
            return 0
        if update.stdout.strip():print(update.stdout.strip())
    try:
        result=subprocess.run(['/usr/bin/ssh','-o',f'HostName={args.host}',
            '-o','BatchMode=yes','-o','ConnectTimeout=8',
            '-o','ServerAliveInterval=8','-o','ServerAliveCountMax=2',
            args.ssh_alias,'/bin/bash','-s'],input=REMOTE_SCRIPT,
            capture_output=True,text=True,timeout=35)
    except subprocess.TimeoutExpired:
        print('Jarvis unreachable; scheduled retry retained',file=sys.stderr)
        return 0
    if result.returncode:
        print(result.stderr[-1000:] or 'Remote SSH launch failed',file=sys.stderr)
        return 1
    print(result.stdout.strip())
    return 0


if __name__=='__main__':sys.exit(main())
