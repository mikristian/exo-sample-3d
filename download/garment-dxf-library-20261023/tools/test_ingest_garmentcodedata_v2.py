import base64
import gzip
import hashlib
import json
import sqlite3
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import ingest_garmentcodedata_v2 as ingest
from audit_library import inspect


def make_record(element='test_shirt'):
    # A valid source-shaped panel specification with a single closed loop.
    panel = {'vertices': [[0, 0], [10, 0], [10, 20], [0, 20]],
             'edges': [{'endpoints': [0, 1]}, {'endpoints': [1, 2]},
                       {'endpoints': [2, 3]}, {'endpoints': [3, 0]}]}
    raw = json.dumps({'pattern': {'panels': {'front': panel}}}, sort_keys=True).encode()
    return {'batch': 0, 'body': 'default', 'element': element,
            'kind': 'specification', 'data': raw, 'sha256': hashlib.sha256(raw).hexdigest()}


class GarmentCodeV2ImportTests(unittest.TestCase):
    def test_invalid_retained_source_quarantined_before_clean_download(self):
        payload=b'valid-parquet-archive'
        with tempfile.TemporaryDirectory() as folder:
            out=Path(folder)
            retained=out/'original-parquet/default_body/batch-01.parquet'
            retained.parent.mkdir(parents=True)
            retained.write_bytes(b'bad')
            entry={'path':'default_body/batch-01.parquet','size':len(payload),
                   'sha256':hashlib.sha256(payload).hexdigest()}
            class Response:
                status=200
                headers={}
                def __init__(self): self.sent=False
                def read(self,n):
                    if self.sent: return b''
                    self.sent=True
                    return payload
                def close(self): pass
            with patch.object(ingest.urllib.request,'urlopen',return_value=Response()):
                actual=ingest.download_parquet(entry,out,5)
            self.assertEqual(actual.read_bytes(),payload)
            self.assertEqual(retained.with_name(retained.name+'.quarantine').read_bytes(),b'bad')

    def test_full_partial_finishes_without_http_416(self):
        source = b'Parquet-full-file-from-a-previous-run'
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder)
            staged = out/'.staging/default_body-batch-10.parquet.part'
            staged.parent.mkdir()
            staged.write_bytes(source)
            item = {'path':'default_body/batch-10.parquet', 'body':'default',
                    'batch':10, 'size':len(source), 'sha256':hashlib.sha256(source).hexdigest()}
            with patch.object(ingest.urllib.request, 'urlopen', side_effect=AssertionError('completed file should never request Range at EOF')):
                self.assertEqual(ingest.download_parquet(item,out,5),staged)
            self.assertEqual(staged.read_bytes(),source)

    def test_duckdb_out_of_memory_retries_with_larger_budget(self):
        import duckdb
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder)
            db = ingest.connect_db(out)
            try:
                with patch.object(ingest, 'ingest_parquet_duckdb',
                        side_effect=[duckdb.OutOfMemoryException('384MB not enough'), (8, 1)]) as mocked:
                    self.assertEqual(ingest.ingest_parquet(db,out,out/'source.parquet',engine='duckdb'),(8,1))
                    self.assertEqual([call.kwargs['memory_limit'] for call in mocked.call_args_list],['1GB','2GB'])
            finally:
                db.close()

    def test_bad_full_partial_quarantines_and_can_redownload(self):
        good = b'good Parquet'; bad = b'bad! Parquet'
        self.assertEqual(len(good),len(bad))
        with tempfile.TemporaryDirectory() as folder:
            out=Path(folder)
            staged = out/'.staging/random_body-batch-01.parquet.part'
            staged.parent.mkdir()
            staged.write_bytes(bad)
            entry={'path':'random_body/batch-01.parquet','size':len(good),
                   'sha256':hashlib.sha256(good).hexdigest()}
            with self.assertRaisesRegex(ValueError,'preserved damaged file'):
                ingest.download_parquet(entry,out,5)
            self.assertFalse(staged.exists())
            self.assertEqual(list(staged.parent.glob('*.corrupt-*'))[0].read_bytes(),bad)

    def test_verified_pattern_round_trip_and_reimport(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder)
            db = ingest.connect_db(out)
            record = make_record()
            try:
                self.assertTrue(ingest.ingest(db, out, record, to_dxf=True))
                db.commit()
                self.assertTrue(ingest.ingest(db, out, record, to_dxf=True))
                db.commit()
                result = ingest.report(db, out)
                self.assertEqual(result['storedSpecifications'], 1)
                self.assertEqual(result['genericDxfConverted'], 1)
                self.assertEqual(result['factoryApproved'], 0)
                saved = out/'specifications/default/batch-00/test_shirt_specification.json'
                self.assertEqual(saved.read_bytes(), record['data'])
                self.assertEqual(db.execute('SELECT license FROM patterns').fetchone()[0], 'CC BY 4.0')
                dxf = out/'dxf/default/batch-00/test_shirt.dxf'
                self.assertTrue(inspect(dxf.read_bytes())['envelopeOK'])
            finally:
                db.close()

    def test_viewer_base64_and_non_spec_rows(self):
        record = make_record()
        record['data'] = base64.b64encode(record['data']).decode()
        self.assertEqual(ingest.validate_record(record)[1], 1)
        other = dict(record, kind='sim_mesh')
        self.assertIsNone(ingest.validate_record(other))

    def test_parquet_filters_large_mesh_before_python_conversion(self):
        import pyarrow as pa
        import pyarrow.parquet as pq
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            record = make_record()
            mesh = dict(record, kind='sim_mesh', data=b'3D-MESH'*10000,
                        sha256=hashlib.sha256(b'3D-MESH'*10000).hexdigest())
            table = pa.Table.from_pylist([mesh, record, mesh])
            parquet = root/'batch.parquet'
            pq.write_table(table, parquet)
            db = ingest.connect_db(root/'out')
            try:
                seen, count = ingest.ingest_parquet(db, root/'out', parquet,
                                                    expected_body='default', expected_batch=0)
                self.assertEqual((seen, count), (3, 1))
                self.assertEqual(db.execute('select count(*) from patterns').fetchone()[0], 1)
            finally: db.close()

    def test_duckdb_filtered_parquet_preserves_checksum_and_rows(self):
        import pyarrow as pa
        import pyarrow.parquet as pq
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            record = make_record()
            mesh = dict(record, kind='sim_mesh', data=b'PLY'*50000,
                        sha256=hashlib.sha256(b'PLY'*50000).hexdigest())
            source = root/'sample.parquet'
            pq.write_table(pa.Table.from_pylist([mesh, record, mesh]), source)
            db = ingest.connect_db(root/'out')
            try:
                self.assertEqual(ingest.ingest_parquet(db,root/'out',source,
                    expected_body='default',expected_batch=0,engine='duckdb'), (3,1))
                self.assertEqual(db.execute('select count(*) from patterns').fetchone()[0],1)
            finally:db.close()

    def test_reject_bad_hash_traversal_and_invalid_geometry(self):
        record = make_record()
        with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
            ingest.validate_record(dict(record, sha256='0'*64))
        with self.assertRaisesRegex(ValueError, 'Unsafe'):
            ingest.validate_record(dict(record, element='../../.ssh/authorized_keys'))
        malformed = json.dumps({'pattern': {'panels': {'front': {'vertices': [], 'edges': 'not-edges'}}}}).encode()
        with self.assertRaisesRegex(ValueError, 'topology'):
            ingest.validate_record(dict(record, data=malformed, sha256=hashlib.sha256(malformed).hexdigest()))

    def test_source_is_not_modified_and_missing_dxf_is_honest(self):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder)
            db = ingest.connect_db(out)
            try:
                record = make_record()
                original = record['data']
                ingest.ingest(db, out, record)
                db.commit()
                self.assertEqual(record['data'], original)
                self.assertEqual(ingest.report(db, out)['genericDxfConverted'], 0)
            finally:
                db.close()

    def test_cloud_archive_readback_resumable_and_safe_prune(self):
        with tempfile.TemporaryDirectory() as folder:
            out, cloud = Path(folder)/'local', Path(folder)/'expansion'
            db = ingest.connect_db(out)
            try:
                record = make_record()
                ingest.ingest(db, out, record)
                db.commit()
                archive = ingest.archive_to_cloud(db, out, cloud, 'default', 0)
                destination = Path(archive['remoteArchive'])
                self.assertTrue(destination.exists())
                self.assertEqual(archive['sha256'], ingest.file_sha256(destination))
                with tarfile.open(destination, 'r:gz') as reader:
                    member = reader.getmember('specifications/default/batch-00/test_shirt_specification.json')
                    self.assertEqual(reader.extractfile(member).read(), record['data'])
                # Resuming after a prior cloud upload does not delete the local source.
                self.assertEqual(ingest.archive_to_cloud(db, out, cloud, 'default', 0)['sha256'], archive['sha256'])
                self.assertTrue((out/'specifications/default/batch-00/test_shirt_specification.json').exists())
                backup = ingest.backup_index_to_cloud(db, out, cloud)
                self.assertEqual(ingest.file_sha256(Path(backup['cloudIndex'])), backup['indexSha256'])
                backup_bytes = gzip.decompress(Path(backup['cloudIndex']).read_bytes())
                self.assertEqual(backup_bytes[:16], b'SQLite format 3\x00')
            finally:
                db.close()


if __name__ == '__main__':
    unittest.main()
