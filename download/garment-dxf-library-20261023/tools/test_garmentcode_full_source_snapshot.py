import sqlite3
import tempfile
import unittest
from pathlib import Path

from garmentcode_full_source_snapshot import full_source_snapshot


class FullSourceSnapshotTests(unittest.TestCase):
    def test_complete_requires_both_families_and_exact_catalog_coverage(self):
        with tempfile.TemporaryDirectory() as folder:
            db_path=Path(folder)/'source.sqlite3'
            with sqlite3.connect(db_path) as db:
                db.execute('CREATE TABLE archived_batches(body TEXT,batch INTEGER,specification_count INTEGER)')
                db.execute('CREATE TABLE patterns(body TEXT,batch INTEGER,element TEXT)')
                for body in ('default','random'):
                    for batch in range(20):
                        db.execute('INSERT INTO archived_batches VALUES(?,?,?)',(body,batch,3000))
                db.execute("CREATE VIEW ignored AS SELECT 1")
                # Small synthetic index: full archives alone do not certify
                # all source JSON records have been indexed.
                db.execute('INSERT INTO patterns VALUES (?,?,?)',('default',0,'one'))
            incomplete=full_source_snapshot(db_path)
            self.assertEqual(incomplete['archivedBatches'],40)
            self.assertFalse(incomplete['complete'])
            with sqlite3.connect(db_path) as db:
                db.execute('DELETE FROM patterns')
                db.executemany('INSERT INTO patterns VALUES(?,?,?)',
                    [('default',0,str(i)) for i in range(120000)])
            done=full_source_snapshot(db_path)
            self.assertTrue(done['complete'])
            self.assertEqual(done['verifiedArchivedPatterns'],120000)
            with sqlite3.connect(db_path) as db:
                db.execute("DELETE FROM archived_batches WHERE body='random' AND batch=19")
            missing=full_source_snapshot(db_path)
            self.assertFalse(missing['complete'])
            self.assertIn('random/19',missing['missingBatches'])


if __name__=='__main__':unittest.main()
