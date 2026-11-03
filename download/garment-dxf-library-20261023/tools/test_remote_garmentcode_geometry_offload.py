import sqlite3
import json
import os
import sys
import tempfile
import unittest
import numpy as np
from train_garmentcode_geometry import FEATURE_NAMES
from pathlib import Path
from unittest.mock import patch

import remote_garmentcode_geometry_offload as offload


class RemoteGeometryOffloadTests(unittest.TestCase):
    def test_geometry_gate_can_use_lightweight_host_when_seam_gate_defers(self):
        fixture={'resourceReady':False,'memoryFreePct':48,'swapUsedMiB':2400,
                 'swapFreeMiB':1696,
                 'fiveMinuteLoad':2.8,'logicalCPUs':8}
        with patch.object(offload,'hardware_health',return_value=fixture):
            self.assertTrue(offload.geometry_hardware_health()['resourceReady'])
        fixture['memoryFreePct']=25
        with patch.object(offload,'hardware_health',return_value=fixture):
            self.assertFalse(offload.geometry_hardware_health()['resourceReady'])

    def test_geometry_needs_spare_swap_even_if_physical_memory_recovered(self):
        fixture={'resourceReady':False,'memoryFreePct':55,'swapUsedMiB':3030,
                 'swapFreeMiB':1066,'fiveMinuteLoad':2.2,'logicalCPUs':8}
        with patch.object(offload,'hardware_health',return_value=fixture):
            self.assertTrue(offload.geometry_hardware_health()['resourceReady'])
        fixture['swapFreeMiB']=800
        with patch.object(offload,'hardware_health',return_value=fixture):
            self.assertFalse(offload.geometry_hardware_health()['resourceReady'])
            self.assertEqual(offload.geometry_hardware_health()['resourceTier'],'deferred')
        fixture['swapFreeMiB']=500
        with patch.object(offload,'hardware_health',return_value=fixture):
            self.assertFalse(offload.geometry_hardware_health()['resourceReady'])

    def test_watchdog_emergency_threshold_and_normal_child(self):
        self.assertFalse(offload.geometry_emergency_pressure({'memoryFreePct':45,'swapFreeMiB':600}))
        self.assertTrue(offload.geometry_emergency_pressure({'memoryFreePct':30,'swapFreeMiB':700}))
        self.assertTrue(offload.geometry_emergency_pressure({'memoryFreePct':70,'swapFreeMiB':390}))
        self.assertTrue(offload.geometry_emergency_pressure({'memoryFreePct':None,'swapFreeMiB':700}))
        out,err=offload.run_geometry_with_watchdog([sys.executable,'-c',
            'print("complete")'],dict(os.environ),interval=1,timeout=5)
        self.assertEqual(out.strip(),'complete')
        self.assertEqual(err,'')

    def test_next_increment_uses_archived_source_count_and_completed_model(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'data').mkdir()
            with sqlite3.connect(root/'data/pattern-index.sqlite3') as db:
                db.execute('CREATE TABLE archived_batches (specification_count INTEGER)')
                db.execute('INSERT INTO archived_batches VALUES (61509)')
            a,done,target,model=offload.determine_next_training(root)
            self.assertEqual((a,done,target,model),(61509,0,60000,None))
            path=root/'training/remote-geometry-60k'
            path.mkdir(parents=True)
            dims=[len(FEATURE_NAMES),64,16,64,len(FEATURE_NAMES)]
            tensors={'featureNames':np.asarray(FEATURE_NAMES),'mean':np.zeros(dims[0]),'std':np.ones(dims[0])}
            for i in range(1,5):
                tensors[f'w{i}']=np.zeros((dims[i-1],dims[i]))
                tensors[f'b{i}']=np.zeros(dims[i])
            np.savez(path/'geometry-encoder-v1.npz',**tensors)
            np.savez(path/'source-embeddings-v1.npz',sourceIds=np.asarray([str(i) for i in range(61509)]),embeddings=np.zeros((61509,16),dtype=np.float32))
            (path/'training-manifest.json').write_text(json.dumps({
                'schema':'exo.garmentcodedata-v2.geometry-training.v1',
                'trainingExamplesVerified':61509}))
            a,done,target,model=offload.determine_next_training(root)
            self.assertEqual((a,done,target,model),(61509,61509,71509,path/'geometry-encoder-v1.npz'))
            (path/'geometry-encoder-v1.npz').write_bytes(b'corrupt')
            self.assertFalse(offload.valid_geometry_checkpoint(path))
            self.assertEqual(offload.determine_next_training(root)[1],0)


if __name__=='__main__':unittest.main()
