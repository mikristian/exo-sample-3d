"""Host health gate for scheduled, memory-intensive EXO training tasks.

Importing source patterns on the Expansion Mac must NOT depend on this gate;
it only delays local training when the user's main Mac is overloaded.
"""
from __future__ import annotations

import os
from pathlib import Path
import re
import shutil
import subprocess


def resource_health(root: Path):
    """Return a conservative readiness signal for a busy 16 GiB macOS host."""
    cpu_count=os.cpu_count() or 1
    load5=os.getloadavg()[1]
    free_gb=shutil.disk_usage(root).free/(1024**3)
    swap_used_mb=None
    try:
        result=subprocess.run(['/usr/sbin/sysctl','-n','vm.swapusage'],
                              capture_output=True,text=True,timeout=5,check=True)
        match=re.search(r'used\s*=\s*([0-9.]+)M',result.stdout)
        if match:
            swap_used_mb=float(match.group(1))
    except (OSError,ValueError,subprocess.SubprocessError):
        pass
    healthy=load5 <= 2.5*cpu_count and free_gb>=6 and \
            (swap_used_mb is None or swap_used_mb<=4096)
    return {'resourceReady':bool(healthy),'fiveMinuteLoad':round(load5,2),
            'logicalCPUs':cpu_count,'availableDiskGiB':round(free_gb,2),
            'swapUsedMiB':swap_used_mb,
            'safetyLimits':'load5 <= 2.5x CPU count, disk free >=6 GiB, swap in use <=4096 MiB'}
