"""Regression tests for incremental, SHA-verified seam training scheduling."""
import hashlib
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import garmentcode_training_resources as resource_module


file=Path(__file__).with_name('train-garmentcodedata-seams-incremental.py')
spec=importlib.util.spec_from_file_location('exo_seam_training_schedule',file)
runner=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class IncrementalSeamScheduleTests(unittest.TestCase):
    def test_resource_guard_blocks_high_cpu_load_or_swap(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            with patch.object(resource_module.os,'cpu_count',return_value=8), \
                 patch.object(resource_module.os,'getloadavg',return_value=(30.,30.,30.)), \
                 patch.object(resource_module.shutil,'disk_usage',return_value=type('D',(),{'free':12*1024**3})()), \
                 patch.object(resource_module.subprocess,'run',return_value=type('R',(),{'stdout':'total = 10240.0M used = 9000.0M free = 1240.0M'})()):
                result=runner.resource_health(root)
                self.assertFalse(result['resourceReady'])
                self.assertEqual(result['swapUsedMiB'],9000)
            with patch.object(resource_module.os,'cpu_count',return_value=8), \
                 patch.object(resource_module.os,'getloadavg',return_value=(3.,3.,3.)), \
                 patch.object(resource_module.shutil,'disk_usage',return_value=type('D',(),{'free':12*1024**3})()), \
                 patch.object(resource_module.subprocess,'run',return_value=type('R',(),{'stdout':'total = 10240.0M used = 1024.0M free = 9216.0M'})()):
                self.assertTrue(runner.resource_health(root)['resourceReady'])

    def fixture(self,root):
        root.mkdir(parents=True,exist_ok=True)
        with sqlite3.connect(root/'pattern-index.sqlite3') as db:
            db.execute('CREATE TABLE patterns (source_path TEXT)')
            db.execute('''CREATE TABLE archived_batches (
                body TEXT,batch INTEGER,archive_sha256 TEXT,archive_bytes INTEGER,
                specification_count INTEGER)''')
            raw=b'test archive 1234'
            archive=root/'training/remote-archive-cache/archives/default/batch-00-specifications.tar.gz'
            archive.parent.mkdir(parents=True)
            archive.write_bytes(raw)
            db.execute('INSERT INTO archived_batches VALUES (?,?,?,?,?)',
                ('default',0,hashlib.sha256(raw).hexdigest(),len(raw),4000))
            db.execute('INSERT INTO patterns VALUES (?)',('source fixture',))
            db.commit()
        return archive

    def test_dry_run_requires_verified_archives_not_only_index(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'data'
            archive=self.fixture(root)
            self.assertEqual(runner.main(['--root',str(root),'--first-target','2000',
                                          '--increment','1000','--dry-run']),0)
            status=json.loads((root/'training/seam-auto-training-status.json').read_text())
            self.assertEqual(status['state'],'ready_to_train')
            self.assertEqual(status['verifiedSourcePatterns'],4000)
            archive.write_bytes(b'corrupt')
            self.assertEqual(runner.main(['--root',str(root),'--first-target','2000',
                                          '--increment','1000','--dry-run']),0)
            status=json.loads((root/'training/seam-auto-training-status.json').read_text())
            self.assertEqual(status['state'],'waiting_for_more_archives')
            self.assertEqual(status['verifiedSourcePatterns'],0)

    def test_existing_model_sets_next_increment_without_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'data'
            self.fixture(root)
            old=root/'training/seam-compatibility-2k'
            old.mkdir()
            (old/'seam-compatibility-v1.npz').write_bytes(b'placeholder')
            (old/'training-manifest.json').write_text(json.dumps({
                'schema':'exo.garmentcodedata-v2.seam-compatibility.v1',
                'verifiedGarmentsRead':2000}))
            self.assertEqual(runner.existing_checkpoints(root),[(2000,old/'seam-compatibility-v1.npz')])
            runner.main(['--root',str(root),'--first-target','1000',
                         '--increment','1000','--dry-run'])
            status=json.loads((root/'training/seam-auto-training-status.json').read_text())
            self.assertEqual(status['nextTrainingTarget'],3000)
            self.assertTrue((old/'seam-compatibility-v1.npz').exists())


if __name__=='__main__':unittest.main()
