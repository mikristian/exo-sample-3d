"""Check remote offload intentionally defers during memory/CPU pressure."""
import unittest
from unittest.mock import patch
import tempfile
import pathlib
import json
import os
import sys
import numpy as np
from train_garmentcode_seams import FEATURE_NAMES

import remote_garmentcode_seam_offload as offload


class RemoteResourceGateTests(unittest.TestCase):
    def test_existing_seam_checkpoint_requires_real_finite_weights_and_source_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder)
            base={'schema':'exo.garmentcodedata-v2.seam-compatibility.v1','verifiedGarmentsRead':2,
                  'verifiedSourceIDsXorSha256':'a'*64,'actualPairExamples':12}
            (root/'training-manifest.json').write_text(json.dumps(base))
            self.assertFalse(offload.valid_seam_checkpoint(root,2,'a'*64))
            n=len(FEATURE_NAMES)
            arrays={'featureNames':np.asarray(FEATURE_NAMES),'mean':np.zeros(n),'std':np.ones(n),
                    'w1':np.zeros((n,32)),'b1':np.zeros(32),'w2':np.zeros((32,1)),'b2':np.zeros(1)}
            np.savez(root/'seam-compatibility-v1.npz',**arrays)
            self.assertTrue(offload.valid_seam_checkpoint(root,2,'a'*64))
            self.assertFalse(offload.valid_seam_checkpoint(root,2,'b'*64))
            self.assertFalse(offload.valid_seam_checkpoint(root,3,'a'*64))
            arrays['std'][0]=np.nan
            np.savez(root/'seam-compatibility-v1.npz',**arrays)
            self.assertFalse(offload.valid_seam_checkpoint(root,2,'a'*64))

    def test_clean_only_interrupted_feature_cache_preserving_checkpoint(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder)
            scratch=root/'.seam-features-abcd'
            scratch.mkdir()
            (scratch/'x.bin').write_bytes(b'partial')
            (root/'training-manifest.json').write_text('keep')
            (root/'seam-compatibility-v1.npz').write_bytes(b'keep')
            self.assertEqual(offload.clean_interrupted_feature_cache(root),1)
            self.assertFalse(scratch.exists())
            self.assertEqual((root/'training-manifest.json').read_text(),'keep')
            self.assertEqual(offload.clean_interrupted_feature_cache(root),0)
    def test_child_completes_under_resource_watchdog(self):
        output,error=offload.run_with_memory_watchdog(
            [sys.executable,'-c','print("completed")'],dict(os.environ),interval=2,timeout=10)
        self.assertEqual(output.strip(),'completed')
        self.assertEqual(error,'')
    def test_emergency_watchdog_only_triggers_on_critical_memory_shortage(self):
        self.assertFalse(offload.severe_memory_pressure({'memoryFreePct':42,'swapFreeMiB':1050}))
        self.assertFalse(offload.severe_memory_pressure({'memoryFreePct':30,'swapFreeMiB':450}))
        self.assertTrue(offload.severe_memory_pressure({'memoryFreePct':19,'swapFreeMiB':1500}))
        self.assertTrue(offload.severe_memory_pressure({'memoryFreePct':45,'swapFreeMiB':300}))
    def test_prefer_only_validated_local_checkpoint_for_weight_continuation(self):
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder);weights=root/'remote-seam-40k/seam-compatibility-v1.npz'
            weights.parent.mkdir()
            weights.write_bytes(b'placeholder')
            (weights.parent/'training-manifest.json').write_text('{}')
            (root/'best-seam-model.json').write_text(json.dumps({
                'schema':'exo.garmentcodedata-v2.seam-model-selection.v1',
                'checkpoint':str(weights),'trainedGarments':40000}))
            self.assertIsNone(offload.best_previous_weights(root,[30000,40000]))
            n=len(FEATURE_NAMES)
            np.savez(weights,featureNames=np.asarray(FEATURE_NAMES),mean=np.zeros(n),std=np.ones(n),
                     w1=np.zeros((n,32)),b1=np.zeros(32),w2=np.zeros((32,1)),b2=np.zeros(1))
            (weights.parent/'training-manifest.json').write_text(json.dumps({
                'schema':'exo.garmentcodedata-v2.seam-compatibility.v1',
                'verifiedGarmentsRead':40000,'verifiedSourceIDsXorSha256':'0'*64,
                'actualPairExamples':100}))
            self.assertEqual(offload.best_previous_weights(root,[30000,40000]),weights.resolve())
            self.assertIsNone(offload.best_previous_weights(root,[30000]))
            (root/'best-seam-model.json').write_text(json.dumps({
                'schema':'exo.garmentcodedata-v2.seam-model-selection.v1',
                'checkpoint':'/tmp/outside/checkpoint.npz','trainedGarments':40000}))
            self.assertIsNone(offload.best_previous_weights(root,[40000]))
    def test_low_memory_or_busy_cpu_defers_without_training(self):
        def result(text):
            return type('R',(),{'stdout':text})()
        memory=result('System-wide memory free percentage: 25%')
        swap=result('vm.swapusage: total = 4096.00M  used = 2100.0M free = 1996.0M')
        with patch.object(offload.os,'cpu_count',return_value=8), \
             patch.object(offload.os,'getloadavg',return_value=(2,3,4)), \
             patch.object(offload.subprocess,'run',side_effect=[memory,swap]):
            self.assertFalse(offload.hardware_health()['resourceReady'])
        memory=result('System-wide memory free percentage: 45%')
        with patch.object(offload.os,'cpu_count',return_value=8), \
             patch.object(offload.os,'getloadavg',return_value=(2,2,2)), \
             patch.object(offload.subprocess,'run',side_effect=[memory,swap]):
            self.assertTrue(offload.hardware_health()['resourceReady'])

    def test_high_swap_without_free_headroom_defers_but_recovered_ram_can_run(self):
        def result(text):return type('R',(),{'stdout':text})()
        memory=result('System-wide memory free percentage: 49%')
        limited=result('vm.swapusage: total = 4096.00M used = 3170.0M free = 926.0M')
        recovered=result('vm.swapusage: total = 4096.00M used = 2700.0M free = 1396.0M')
        with patch.object(offload.os,'cpu_count',return_value=8), \
             patch.object(offload.os,'getloadavg',return_value=(2,3,4)), \
             patch.object(offload.subprocess,'run',side_effect=[memory,limited]):
            self.assertFalse(offload.hardware_health()['resourceReady'])
        with patch.object(offload.os,'cpu_count',return_value=8), \
             patch.object(offload.os,'getloadavg',return_value=(2,2,3)), \
             patch.object(offload.subprocess,'run',side_effect=[memory,recovered]):
            self.assertTrue(offload.hardware_health()['resourceReady'])


if __name__=='__main__':unittest.main()
