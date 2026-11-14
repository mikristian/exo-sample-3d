#!/usr/bin/env python3
"""Deploy EXO's low-memory seam offload worker to the trusted Jarvis Mac.

The installer changes only remote EXO tools and this user's LaunchAgent;
never touches the ongoing GarmentCodeData Parquet importer/supervisor.
"""
from __future__ import annotations

import argparse
import hashlib
import plistlib
import re
import subprocess
from pathlib import Path


ROOT=Path(__file__).resolve().parents[1]
TOOLS=ROOT/'download/garment-dxf-library-20261023/tools'
REMOTE='/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2'
FILES=[
    'train_garmentcode_geometry.py',
    'train_garmentcode_seams.py',
    'train_garmentcode_seams_streaming.py',
    'garmentcode_checkpoint_io.py',
    'remote_garmentcode_seam_offload.py',
    'remote_garmentcode_geometry_offload.py',
    'remote_garmentcode_dispatch.py',
    'remote_garmentcode_seam_select.py',
    'suggest_garmentcode_seams.py',
]


def ssh_options(host):
    return ['-o',f'HostName={host}','-o','BatchMode=yes',
            '-o','ConnectTimeout=8','-o','ServerAliveInterval=8']


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host',default='100.82.90.101')
    parser.add_argument('--ssh-alias',default='jarviss-macbook-pro')
    parser.add_argument('--skip-copy',action='store_true')
    parser.add_argument('--audit-only',action='store_true',
                        help='Install only the local half-hour full-corpus coverage audit')
    args=parser.parse_args(argv)
    if args.audit_only:
        import os
        label='com.exo.garmentcodedata-v2-full-training-audit'
        agent=Path.home()/'Library/LaunchAgents'/(label+'.plist')
        agent.parent.mkdir(parents=True,exist_ok=True)
        logs=Path.home()/'Library/Logs'
        logs.mkdir(parents=True,exist_ok=True)
        data={'Label':label,
              'ProgramArguments':['/usr/bin/python3',str(ROOT/'scripts/audit-garmentcodedata-full-training.py')],
              'RunAtLoad':True,'StartInterval':1800,'ProcessType':'Background',
              'StandardOutPath':str(logs/(label+'.log')),
              'StandardErrorPath':str(logs/(label+'.error.log'))}
        agent.write_bytes(plistlib.dumps(data))
        destination='gui/'+str(os.getuid())
        subprocess.run(['/bin/launchctl','bootout',destination,str(agent)],capture_output=True)
        subprocess.run(['/bin/launchctl','bootstrap',destination,str(agent)],check=True)
        print('INSTALLED FULL-SOURCE MODEL COVERAGE AUDIT:',agent)
        return 0
    if not re.fullmatch('[A-Za-z0-9.-]{1,253}',args.host) or not re.fullmatch('[A-Za-z0-9._-]{1,253}',args.ssh_alias):
        parser.error('Invalid SSH host')
    option=ssh_options(args.host)
    connection=[args.ssh_alias]
    # Never create a bogus /Volumes/Expansion folder on the internal disk.
    check=subprocess.run(['/usr/bin/ssh',*option,*connection,'/bin/test','-f',
        REMOTE+'/data/pattern-index.sqlite3'],timeout=25)
    if check.returncode:
        raise RuntimeError('Original Expansion dataset is not mounted; no remote writes performed')
    if not args.skip_copy:
        sources=[str(TOOLS/file) for file in FILES]
        subprocess.run(['/usr/bin/scp',*option,*sources,
                        f'{args.ssh_alias}:{REMOTE}/tools/'],check=True,timeout=120)
        original_model=ROOT/'download/garment-dxf-library-20261023/garmentcodedata-v2/training/geometry-encoder-full-archive/geometry-encoder-v1.npz'
        if original_model.is_file():
            # Transfer only the existing validated 50K model. Exact SHA256 is
            # checked on Jarvis before atomic placement, with no source-data
            # changes. This is a warm-start, not evidence of 60K training.
            checksum=hashlib.sha256(original_model.read_bytes()).hexdigest()
            remote_temp=REMOTE+'/training/geometry-50k-initial-checkpoint.npz.download'
            subprocess.run(['/usr/bin/scp',*option,str(original_model),
                            f'{args.ssh_alias}:{remote_temp}'],check=True,timeout=90)
            validate='''import hashlib,os,pathlib,sys
path=pathlib.Path(sys.argv[1]);expected=sys.argv[2];destination=path.with_suffix('')
if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=expected:
 raise SystemExit('Refusing invalid geometry checkpoint transfer')
os.replace(path,destination)
print('Verified 50K warm-start geometry model on Jarvis')
'''
            transfer=subprocess.run(['/usr/bin/ssh',*option,*connection,
                '/usr/bin/python3','-',remote_temp,checksum],input=validate,
                capture_output=True,text=True,timeout=55)
            if transfer.returncode:
                raise RuntimeError('Geometry source checkpoint not verified on Jarvis: '+transfer.stderr)
            print(transfer.stdout.strip())
    # Older remote agent is disabled: macOS LaunchAgent TCC cannot access
    # source files on external /Volumes/Expansion. SSH sessions with this
    # user's approved key can. The PRIMARY Mac schedules a light SSH trigger
    # while computation itself remains exclusively on the remote Jarvis Mac.
    script=r'''import os,plistlib,subprocess,sys
from pathlib import Path
root=Path('/Volumes/Expansion/EXO-ClothCraft/GarmentCodeData-v2')
if not (root/'data/pattern-index.sqlite3').is_file():
  sys.exit('Missing original source volume')
uid=os.getuid()
label='com.exo.garmentcodedata-v2-remote-seam-offload'
agent=Path.home()/'Library/LaunchAgents'/f'{label}.plist'
agent.parent.mkdir(parents=True,exist_ok=True)
log=Path.home()/'Library/Logs'
log.mkdir(parents=True,exist_ok=True)
data={'Label':label,'ProgramArguments':['/usr/bin/python3',str(root/'tools/remote_garmentcode_seam_offload.py'),
       '--root',str(root),'--first-target','30000','--increment','10000','--epochs','18'],
      'RunAtLoad':True,'StartInterval':3600,'ProcessType':'Background','Nice':15,
      'EnvironmentVariables':{'OPENBLAS_NUM_THREADS':'1','VECLIB_MAXIMUM_THREADS':'1',
                              'OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1'},
      'StandardOutPath':str(log/(label+'.log')),
      'StandardErrorPath':str(log/(label+'.error.log'))}
agent.write_bytes(plistlib.dumps(data))
destination='gui/'+str(uid)
subprocess.run(['/bin/launchctl','bootout',destination,str(agent)],capture_output=True)
agent.unlink(missing_ok=True)
print('DISABLED TCC-blocked remote LaunchAgent; SSH trigger will be scheduled on primary Mac')
'''
    # SSH does not preserve argv boundaries for a remote `python -c` string.
    # Send the complete known Python script on stdin instead of interpolating
    # source into remote-shell syntax.
    result=subprocess.run(['/usr/bin/ssh',*option,*connection,
        '/usr/bin/python3','-'],input=script,capture_output=True,text=True,timeout=55)
    if result.returncode:
        raise RuntimeError('Remote agent installer failed: '+result.stderr[-1800:])
    print(result.stdout.strip())
    label='com.exo.garmentcodedata-v2-seam-offload-ssh'
    agent=Path.home()/'Library/LaunchAgents'/(label+'.plist')
    agent.parent.mkdir(parents=True,exist_ok=True)
    logs=Path.home()/'Library/Logs'
    logs.mkdir(parents=True,exist_ok=True)
    plist={
        'Label':label,
        'ProgramArguments':['/usr/bin/python3',str(ROOT/'scripts/ensure-jarvis-seam-offload-ssh.py'),
                            '--host',args.host,'--ssh-alias',args.ssh_alias],
        # The tiny SSH eligibility check can run more frequently than an
        # actual heavy model: the remote shared lock and RAM/swap gates still
        # permit at most one Jarvis compute worker. 15-minute checks catch
        # resource headroom as source Parquet scans finish.
        'RunAtLoad':True,'StartInterval':900,'ProcessType':'Background',
        'StandardOutPath':str(logs/(label+'.log')),
        'StandardErrorPath':str(logs/(label+'.error.log')),
    }
    agent.write_bytes(plistlib.dumps(plist))
    destination='gui/'+str(__import__('os').getuid())
    subprocess.run(['/bin/launchctl','bootout',destination,str(agent)],capture_output=True)
    subprocess.run(['/bin/launchctl','bootstrap',destination,str(agent)],check=True)
    print('INSTALLED PRIMARY-MAC SSH TRIGGER:',agent)
    mirror_label='com.exo.garmentcodedata-v2-seam-mirror-ssh'
    mirror=agent.parent/(mirror_label+'.plist')
    mirror_data={
        'Label':mirror_label,
        'ProgramArguments':['/usr/bin/python3',str(ROOT/'scripts/pull-jarvis-seam-models-ssh.py'),
                            '--host',args.host,'--ssh-alias',args.ssh_alias],
        'RunAtLoad':True,'StartInterval':1800,'ProcessType':'Background',
        'StandardOutPath':str(logs/(mirror_label+'.log')),
        'StandardErrorPath':str(logs/(mirror_label+'.error.log')),
    }
    mirror.write_bytes(plistlib.dumps(mirror_data))
    subprocess.run(['/bin/launchctl','bootout',destination,str(mirror)],capture_output=True)
    subprocess.run(['/bin/launchctl','bootstrap',destination,str(mirror)],check=True)
    print('INSTALLED PRIMARY-MAC MODEL MIRROR:',mirror)
    geometry_label='com.exo.garmentcodedata-v2-geometry-mirror-ssh'
    geometry=agent.parent/(geometry_label+'.plist')
    geometry_data={
        'Label':geometry_label,
        'ProgramArguments':['/usr/bin/python3',str(ROOT/'scripts/pull-jarvis-geometry-models-ssh.py'),
                            '--host',args.host,'--ssh-alias',args.ssh_alias],
        'RunAtLoad':True,'StartInterval':1800,'ProcessType':'Background',
        'StandardOutPath':str(logs/(geometry_label+'.log')),
        'StandardErrorPath':str(logs/(geometry_label+'.error.log')),
    }
    geometry.write_bytes(plistlib.dumps(geometry_data))
    subprocess.run(['/bin/launchctl','bootout',destination,str(geometry)],capture_output=True)
    subprocess.run(['/bin/launchctl','bootstrap',destination,str(geometry)],check=True)
    print('INSTALLED PRIMARY-MAC GEOMETRY MIRROR:',geometry)
    coverage_label='com.exo.garmentcodedata-v2-full-training-audit'
    coverage=agent.parent/(coverage_label+'.plist')
    coverage_data={
        'Label':coverage_label,
        'ProgramArguments':['/usr/bin/python3',str(ROOT/'scripts/audit-garmentcodedata-full-training.py')],
        'RunAtLoad':True,'StartInterval':1800,'ProcessType':'Background',
        'StandardOutPath':str(logs/(coverage_label+'.log')),
        'StandardErrorPath':str(logs/(coverage_label+'.error.log')),
    }
    coverage.write_bytes(plistlib.dumps(coverage_data))
    subprocess.run(['/bin/launchctl','bootout',destination,str(coverage)],capture_output=True)
    subprocess.run(['/bin/launchctl','bootstrap',destination,str(coverage)],check=True)
    print('INSTALLED FULL-SOURCE MODEL COVERAGE AUDIT:',coverage)
    # The previous local seam model trainer fights for the primary Mac's
    # already stressed RAM/CPU. Leave its implementation available for manual
    # operation, but remove its competing scheduled job once offloading works.
    local_label='com.exo.garmentcodedata-v2-seam-train'
    local_agent=agent.parent/(local_label+'.plist')
    if local_agent.exists():
        subprocess.run(['/bin/launchctl','bootout',destination,str(local_agent)],capture_output=True)
        local_agent.unlink()
        print('DISABLED competing primary-Mac seam trainer (code and saved models preserved)')
    return 0


if __name__=='__main__':raise SystemExit(main())
