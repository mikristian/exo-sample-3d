"""Disposable crash-lifecycle check for the staging Swift launcher watchdog."""

import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import time
import unittest


SWIFT = Path(__file__).resolve().parents[1] / "EXOClothCraftWorkspaceV2.swift"


class StagingWatchdogTest(unittest.TestCase):
    def test_parent_sigkill_reaps_node_and_rust_grandchild_but_not_unrelated(self):
        source = SWIFT.read_text()
        match = re.search(r'private static let stagingWatchdogScript = #"""\n(.*?)\n    """#', source, re.S)
        self.assertIsNotNone(match)
        script = "\n".join(line.removeprefix("    ") for line in match.group(1).splitlines())
        with tempfile.TemporaryDirectory(prefix="exo-staging-grandchild-") as directory:
            watchdog_file = Path(directory) / "watchdog.sh"
            watchdog_file.write_text(script)
            node_file = Path(directory) / "node.py"
            node_file.write_text('''import subprocess, time
rust = subprocess.Popen(["/bin/sleep", "60"])
print(rust.pid, flush=True)
time.sleep(60)
''')
            parent_code = '''import os, subprocess, sys, time
node = subprocess.Popen([sys.executable, sys.argv[2]], stdout=subprocess.PIPE, text=True)
rust = int(node.stdout.readline())
watchdog = subprocess.Popen(["/bin/sh", sys.argv[1], str(os.getpid()), str(node.pid)])
print(node.pid, rust, watchdog.pid, flush=True)
time.sleep(60)
'''
            unrelated = subprocess.Popen(["/bin/sleep", "60"])
            parent = subprocess.Popen([sys.executable, "-c", parent_code, str(watchdog_file), str(node_file)],
                                      stdout=subprocess.PIPE, text=True)
            tracked = []
            try:
                node_pid, rust_pid, watchdog_pid = map(int, parent.stdout.readline().split())
                tracked = [node_pid, rust_pid, watchdog_pid]
                os.kill(parent.pid, signal.SIGKILL)
                parent.wait(timeout=3)
                deadline = time.monotonic() + 8
                while time.monotonic() < deadline:
                    alive = []
                    for pid in [node_pid, rust_pid]:
                        result = subprocess.run(["/bin/ps", "-p", str(pid), "-o", "stat="],
                                                capture_output=True, text=True)
                        if result.returncode == 0 and result.stdout.strip() and not result.stdout.strip().startswith("Z"):
                            alive.append(pid)
                    if not alive:
                        break
                    time.sleep(0.1)
                else:
                    self.fail(f"staging descendants still alive: {alive}")
                self.assertIsNone(unrelated.poll(), "unrelated process must survive watchdog cleanup")
            finally:
                if parent.poll() is None:
                    parent.kill()
                    parent.wait(timeout=3)
                parent.stdout.close()
                for pid in tracked:
                    try:
                        os.kill(pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                unrelated.terminate()
                unrelated.wait(timeout=3)

    def test_parent_sigkill_reaps_staging_child(self):
        source = SWIFT.read_text()
        match = re.search(r'private static let stagingWatchdogScript = #"""\n(.*?)\n    """#', source, re.S)
        self.assertIsNotNone(match, "Swift watchdog script must remain extractable")
        script = "\n".join(line.removeprefix("    ") for line in match.group(1).splitlines())
        with tempfile.TemporaryDirectory(prefix="exo-staging-supervision-") as directory:
            script_file = Path(directory) / "watchdog.sh"
            script_file.write_text(script)
            parent_code = '''
import os, subprocess, sys, time
child = subprocess.Popen(["/bin/sleep", "60"])
watchdog = subprocess.Popen(["/bin/sh", sys.argv[1], str(os.getpid()), str(child.pid)])
print(child.pid, watchdog.pid, flush=True)
time.sleep(60)
'''
            parent = subprocess.Popen([sys.executable, "-c", parent_code, str(script_file)],
                                      stdout=subprocess.PIPE, text=True)
            child_pid = None
            watchdog_pid = None
            try:
                line = parent.stdout.readline().strip()
                child_pid, watchdog_pid = map(int, line.split())
                os.kill(parent.pid, signal.SIGKILL)
                parent.wait(timeout=3)
                deadline = time.monotonic() + 8
                while time.monotonic() < deadline:
                    # macOS retains no zombie for orphaned sleep children.
                    result = subprocess.run(["/bin/ps", "-p", str(child_pid), "-o", "stat="],
                                            capture_output=True, text=True)
                    if result.returncode != 0 or not result.stdout.strip() or result.stdout.strip().startswith("Z"):
                        break
                    time.sleep(0.1)
                else:
                    self.fail(f"watchdog did not terminate orphaned child {child_pid}")
            finally:
                if parent.poll() is None:
                    parent.kill()
                    parent.wait(timeout=3)
                parent.stdout.close()
                if child_pid is not None:
                    try:
                        os.kill(child_pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                if watchdog_pid is not None:
                    try:
                        os.kill(watchdog_pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass


if __name__ == "__main__":
    unittest.main()
