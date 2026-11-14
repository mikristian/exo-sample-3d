"""Tests for the persistent Mac-to-Expansion import recovery watchdog."""
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


module_path=Path(__file__).with_name('ensure-garmentcodedata-remote-ssh.py')
spec=importlib.util.spec_from_file_location('exo_garmentcode_remote_recovery',module_path)
recovery=importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class RecoveryWatchdogTests(unittest.TestCase):
    def test_online_host_without_original_expansion_volume_reports_drive_blocker(self):
        with tempfile.TemporaryDirectory() as directory:
            state=Path(directory)/'status.json'
            failed=subprocess.CompletedProcess([],2,'Expansion data not mounted\n','')
            args=['recovery','--host','100.82.90.101','--status-file',str(state)]
            with patch.object(sys,'argv',args),patch.object(recovery.subprocess,'run',return_value=failed) as remote:
                self.assertEqual(recovery.main(),2)
                self.assertEqual(remote.call_count,1)
            stored=json.loads(state.read_text())
            self.assertEqual(stored['state'],'waiting_for_expansion_volume')
            self.assertIn('not mounted',stored['detail'])

    def test_falls_back_to_magicdns_when_pinned_address_is_offline(self):
        with tempfile.TemporaryDirectory() as directory:
            state=Path(directory)/'status.json'
            failed=subprocess.CompletedProcess([],255,'','connect timeout')
            success=subprocess.CompletedProcess([],0,'Import supervisor already running pid=40\n','')
            args=['recovery','--host','100.82.90.101','--status-file',str(state)]
            with patch.object(sys,'argv',args),patch.object(recovery.subprocess,'run',side_effect=[failed,success]) as mock_run:
                self.assertEqual(recovery.main(),0)
            self.assertEqual(mock_run.call_count,2)
            self.assertIn('HostName=100.82.90.101',mock_run.call_args_list[0].args[0])
            self.assertNotIn('HostName=100.82.90.101',mock_run.call_args_list[1].args[0])
            stored=json.loads(state.read_text())
            self.assertEqual(stored['state'],'connected')
            self.assertTrue(stored['lastSuccessfulConnection'])

    def test_offline_never_reports_a_successful_import(self):
        with tempfile.TemporaryDirectory() as directory:
            state=Path(directory)/'status.json'
            failed=subprocess.CompletedProcess([],255,'','ssh: connect to host: timed out')
            args=['recovery','--host','100.82.90.101','--status-file',str(state)]
            with patch.object(sys,'argv',args),patch.object(recovery.subprocess,'run',return_value=failed):
                self.assertEqual(recovery.main(),1)
            result=json.loads(state.read_text())
            self.assertEqual(result['state'],'offline')
            self.assertIsNone(result['lastSuccessfulConnection'])


if __name__=='__main__':
    unittest.main()
