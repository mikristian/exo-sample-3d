import hashlib
import importlib.util
import sqlite3
import tempfile
from pathlib import Path
import unittest


spec=importlib.util.spec_from_file_location('garment_archive_audit',
    Path(__file__).with_name('audit-garmentcodedata-cached-archives.py'))
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class ArchiveAuditTests(unittest.TestCase):
    def test_hash_and_counts_reject_corrupted_or_missing_archives(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            archive=root/'training/remote-archive-cache/archives/default/batch-00-specifications.tar.gz'
            archive.parent.mkdir(parents=True)
            archive.write_bytes(b'compressed-original-fixture')
            db=sqlite3.connect(root/'pattern-index.sqlite3')
            db.execute('CREATE TABLE patterns(body TEXT,batch INTEGER)')
            db.execute('CREATE TABLE archived_batches(body TEXT,batch INTEGER,archive_sha256 TEXT,archive_bytes INTEGER,specification_count INTEGER)')
            db.execute('INSERT INTO patterns VALUES (?,?)',('default',0))
            db.execute('INSERT INTO archived_batches VALUES (?,?,?,?,?)',
                ('default',0,hashlib.sha256(archive.read_bytes()).hexdigest(),archive.stat().st_size,1))
            db.commit();db.close()
            clean=mod.audit(root)
            self.assertTrue(clean['allArchivesVerified'])
            self.assertEqual(clean['verifiedOriginalSpecificationCount'],1)
            archive.write_bytes(b'garbled-content')
            self.assertFalse(mod.audit(root)['allArchivesVerified'])
            archive.unlink()
            self.assertIn('missing:default/00',mod.audit(root)['issues'])


if __name__=='__main__':unittest.main()
