import hashlib
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import audit_garmentcodedata_v2_completion as audit_tool
from ingest_garmentcodedata_v2 import connect_db


class CompleteSourceAuditTests(unittest.TestCase):
    def test_deep_audit_never_claims_full_100k_for_partial_collection(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            db=connect_db(root/'data')
            db.close()
            with patch.object(audit_tool,'list_remote_parquets',return_value=[]):
                result=audit_tool.audit(root,deep=True)
            self.assertFalse(result['allDataSaved'])
            self.assertEqual(result['minimumRequiredSpecifications'],100000)
            self.assertIn('expected_40_batches_found_0',str(result['incomplete']))

    def test_repair_damaged_archived_batch_preserves_pattern_rows(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            db=connect_db(root/'data')
            db.execute('INSERT INTO processed_batches VALUES (?,?,?,?,?,?)',('default',1,'abc',123,100,1))
            db.execute('INSERT INTO archived_batches VALUES (?,?,?,?,?,?)',('default',1,str(root/'archives/default/batch-01-specifications.tar.gz'),'abc',1,1))
            db.commit()
            db.close()
            source=root/'data/original-parquet/default_body/batch-01.parquet'
            source.parent.mkdir(parents=True)
            source.write_bytes(b'damaged')
            status={'deepHashVerified':True,'allDataSaved':False,
                    'incomplete':[{'source':'default_body/batch-01.parquet',
                      'issues':['cloud_archive_hash_mismatch','full_parquet_hash_mismatch']}]}
            result=audit_tool.prepare_repairs(root,status)
            self.assertEqual(result['resetBatches'],['default_body/batch-01.parquet'])
            self.assertEqual(len(result['quarantinedSources']),1)
            self.assertFalse(source.exists())
            self.assertEqual(Path(result['quarantinedSources'][0]).read_bytes(),b'damaged')
            with sqlite3.connect(root/'data/pattern-index.sqlite3') as db:
                self.assertEqual(db.execute('SELECT count(*) FROM processed_batches').fetchone()[0],0)
                self.assertEqual(db.execute('SELECT count(*) FROM archived_batches').fetchone()[0],0)

    def test_repair_requires_failed_deep_audit(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError,'failed deep'):
                audit_tool.prepare_repairs(Path(temp),{'deepHashVerified':False,'allDataSaved':False})


if __name__=='__main__': unittest.main()
