#!/usr/bin/env python3
"""From EXO's primary Mac, recover its expansion-host source importer via SSH.

The expansion Mac cannot run scripts from its external ExFAT volume through a
macOS LaunchAgent without removable-volume privacy permission. SSH execution
already has the user's file access, so the primary Mac can safely check the
actual worker and restart it only when genuinely missing. The running worker
must not be duplicated; incomplete downloads are always resumed.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import sys


REMOTE = r'''set -eu
R=/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2
test -d "$R" && test -f "$R/data/pattern-index.sqlite3" || { echo 'Expansion data not mounted'; exit 2; }
test -f "$R/tools/remote-garmentcode-supervisor.sh"
# The successful deep audit is the only final-completion signal. Never restart
# an already completed import merely because its supervisor has exited.
if test -f "$R/full-dataset-audit.json" && \
   grep -q '"allDataSaved": true' "$R/full-dataset-audit.json" && \
   grep -q '"deepHashVerified": true' "$R/full-dataset-audit.json"; then
  echo 'Full dataset already independently verified; no restart needed'
  exit 0
fi
ensure_awake() {
  pid="$1"
  if ! pgrep -fl 'caffeinate' | grep -q -- "-w $pid"; then
    nohup /usr/bin/caffeinate -i -s -w "$pid" > "$R/caffeinate.log" 2>&1 < /dev/null &
    echo "Enabled AC-power idle-sleep protection for importer pid=$pid"
  fi
}
if test -s "$R/supervisor.pid"; then
  pid="$(cat "$R/supervisor.pid")"
  case "$pid" in *[!0-9]*|'') pid=0;; esac
  if [ "$pid" != 0 ] && kill -0 "$pid" 2>/dev/null && \
     ps -p "$pid" -o command= | grep -q 'remote-garmentcode-supervisor.sh'; then
    ensure_awake "$pid"
    echo "Import supervisor already running pid=$pid"
    exit 0
  fi
fi
nohup /bin/bash "$R/tools/remote-garmentcode-supervisor.sh" \
  > "$R/supervisor-stdout.log" 2>&1 < /dev/null &
echo $! > "$R/supervisor.pid"
ensure_awake "$(cat "$R/supervisor.pid")"
echo "Resumed import supervisor pid=$(cat "$R/supervisor.pid")"
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', help='Known Tailscale address; retries MagicDNS SSH alias if this address changes')
    parser.add_argument('--ssh-alias', default='jarviss-macbook-pro')
    parser.add_argument('--status-file',type=Path,default=Path.home()/'Library/Logs/exo-garmentcodedata-recovery-status.json')
    args = parser.parse_args()
    if args.host and not re.fullmatch(r'[A-Za-z0-9.-]{1,253}', args.host):
        parser.error('Invalid SSH host')
    if not re.fullmatch(r'[A-Za-z0-9._-]{1,253}', args.ssh_alias):
        parser.error('Invalid SSH alias')

    status_file = args.status_file.expanduser()
    prior = {}
    try:
        prior = json.loads(status_file.read_text())
    except (OSError, ValueError):
        pass

    def store(state, description, success=False):
        now=datetime.now(timezone.utc).isoformat()
        data={'schema':'exo.garmentcodedata-v2.recovery-status.v1',
              'state':state,'checkedAt':now,'detail':description,
              'lastSuccessfulConnection':now if success else prior.get('lastSuccessfulConnection')}
        status_file.parent.mkdir(exist_ok=True,parents=True)
        temporary = status_file.with_suffix(status_file.suffix+'.tmp')
        temporary.write_text(json.dumps(data,indent=2)+'\n')
        temporary.replace(status_file)

    # Don't hardcode a single Tailscale address for days-long imports. When
    # the previously mounted WebDAV endpoint goes away, try the configured
    # SSH/MagicDNS alias as well. An offline machine still requires power and
    # network connectivity; this loop can only recover when it reappears.
    errors=[]
    for override in ([args.host,None] if args.host else [None]):
        cmd=['/usr/bin/ssh','-o','BatchMode=yes','-o','ConnectTimeout=8',
             '-o','ServerAliveInterval=8','-o','ServerAliveCountMax=2']
        if override:
            cmd.extend(['-o',f'HostName={override}'])
        cmd.extend([args.ssh_alias,'/bin/bash','-s'])
        try:
            result=subprocess.run(cmd,input=REMOTE,text=True,capture_output=True,timeout=35)
        except subprocess.TimeoutExpired:
            errors.append('SSH attempt timed out')
            continue
        if result.returncode==0:
            detail=result.stdout.strip() or 'SSH recovery check completed'
            store('connected',detail,True)
            print(detail)
            return 0
        if result.returncode==2 and 'Expansion data not mounted' in (result.stdout+result.stderr):
            detail='Expansion Mac reachable, but the /Volumes/Expansion drive is not mounted. Reconnect or mount the original Expansion volume; remote importing will resume on the next scheduled check.'
            store('waiting_for_expansion_volume',detail)
            print(detail,file=sys.stderr)
            return 2
        error=result.stderr.strip().splitlines()
        errors.append(error[-1][:300] if error else f'SSH returned {result.returncode}')

    detail='Expansion Mac is unreachable; recovery checks remain scheduled. '+ ' | '.join(errors)
    store('offline',detail)
    print(detail,file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
