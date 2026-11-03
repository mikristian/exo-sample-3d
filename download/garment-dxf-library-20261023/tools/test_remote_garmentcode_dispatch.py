"""Verify remote dispatch produces strictly ordered training stages."""
import tempfile
import json
import unittest
from pathlib import Path

from remote_garmentcode_dispatch import stage_commands,read_stage_state,verified_final_source_audit


class TrainingDispatchTests(unittest.TestCase):
    def test_waits_for_importer_independent_deep_hash_audit(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            snapshot={'complete':True,'verifiedArchivedPatterns':123456}
            self.assertFalse(verified_final_source_audit(root,snapshot))
            audit={'allDataSaved':True,'deepHashVerified':True,
                   'datasetSourceBatches':40,'completeBatches':40,
                   'fullParquetFileCount':40,
                   'verifiedOriginalSewingSpecifications':123456,'incomplete':[]}
            (root/'full-dataset-audit.json').write_text(json.dumps(audit))
            self.assertTrue(verified_final_source_audit(root,snapshot))
            audit['verifiedOriginalSewingSpecifications']=123455
            (root/'full-dataset-audit.json').write_text(json.dumps(audit))
            self.assertFalse(verified_final_source_audit(root,snapshot))

    def test_resource_deferral_not_misreported_as_finished_training(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp)
            self.assertEqual(read_stage_state(folder,'geometry'),'unreported')
            (folder/'geometry-offload-status.json').write_text(json.dumps({
                'state':'waiting_for_idle_resources'}))
            self.assertEqual(read_stage_state(folder,'geometry'),'waiting_for_idle_resources')
            (folder/'seam-offload-status.json').write_text(json.dumps({
                'state':'trained','trainedGarments':50000}))
            self.assertEqual(read_stage_state(folder,'seam'),'trained')

    def test_geometry_seam_validation_are_serial_and_use_one_source_root(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            stages=stage_commands(root,python='/usr/bin/python3')
            self.assertEqual([name for name,_ in stages],
                             ['geometry','seam','deep_geometry','deep_seam','validation'])
            for name,argv in stages:
                self.assertEqual(argv[0],'/usr/bin/python3')
                self.assertIn('--root',argv)
                self.assertEqual(argv[argv.index('--root')+1],str(root))
                self.assertTrue(argv[1].endswith('.py'))
            self.assertIn('--deep-pass',stages[2][1])
            self.assertIn('--deep-pass',stages[3][1])
            self.assertIn('--max-garments',stages[-1][1])
            self.assertEqual(stages[-1][1][-1],'100')


if __name__=='__main__':unittest.main()
