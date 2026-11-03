import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import prefetch_garmentcodedata_v2 as prefetch


class PrefetchTests(unittest.TestCase):
    def test_selects_only_future_random_batched_sources(self):
        sources=[{'body':body,'batch':batch} for body in ('default','random')
                 for batch in range(20)]
        selected=prefetch.select_batches(sources,'random',11,19)
        self.assertEqual(len(selected),9)
        self.assertEqual([e['batch'] for e in selected],list(range(11,20)))
        self.assertTrue(all(e['body']=='random' for e in selected))
        self.assertEqual(len(prefetch.select_batches(sources)),40)

    def test_preserves_hash_and_reuses_complete_archive(self):
        payload = b'parquet test bytes'*100
        entry = {'body':'random','batch':0,'path':'random_body/batch-00.parquet',
                 'size':len(payload),'sha256':hashlib.sha256(payload).hexdigest()}
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)

            def fake_download(e, out, reserve):
                self.assertEqual(e, entry)
                self.assertEqual(reserve, 10)
                source = out / '.staging/source.part'
                source.parent.mkdir(parents=True, exist_ok=True)
                source.write_bytes(payload)
                return source

            with patch.object(prefetch, 'download_parquet', side_effect=fake_download) as mock:
                result = prefetch.prefetch_one(entry, root)
                self.assertEqual(result['status'], 'verified_and_saved')
                saved = root/'original-parquet/random_body/batch-00.parquet'
                self.assertEqual(saved.read_bytes(), payload)
                self.assertEqual(prefetch.prefetch_one(entry, root)['status'], 'already_verified')
                self.assertEqual(mock.call_count, 1)

    def test_detects_corrupt_previous_file(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)/'file.parquet'
            p.write_bytes(b'badfile')
            with self.assertRaisesRegex(ValueError, 'SHA-256'):
                prefetch.verify_existing(p, {'size':7,'sha256':'0'*64})

    def test_missing_source_hash_cannot_count_as_verified(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)/'file.parquet'
            p.write_bytes(b'content')
            with self.assertRaisesRegex(ValueError, 'Missing valid source SHA-256'):
                prefetch.verify_existing(p, {'path':'file.parquet','size':7})

    def test_yields_to_importer_partial_then_reuses_verified_target(self):
        payload = b'verified parquet'
        entry = {'body':'random','batch':11,'path':'random_body/batch-11.parquet',
                 'size':len(payload),'sha256':hashlib.sha256(payload).hexdigest()}
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            partial = prefetch.importer_partial(entry, root)
            partial.parent.mkdir(parents=True)
            partial.write_bytes(payload[:4])
            target = root/'original-parquet'/entry['path']

            def publish(_):
                target.parent.mkdir(parents=True)
                target.write_bytes(payload)

            with patch.object(prefetch.time,'sleep',side_effect=publish), patch.object(
                    prefetch,'download_parquet',side_effect=AssertionError('duplicate download')):
                self.assertEqual(prefetch.prefetch_one(entry,root)['status'],'already_verified')
            self.assertEqual(partial.read_bytes(),payload[:4])

    def test_stalled_partial_is_preserved_and_not_considered_complete(self):
        payload = b'valid parquet'
        entry = {'body':'random','batch':12,'path':'random_body/batch-12.parquet',
                 'size':len(payload),'sha256':hashlib.sha256(payload).hexdigest()}
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            partial = prefetch.importer_partial(entry,root)
            partial.parent.mkdir(parents=True)
            partial.write_bytes(payload[:3])

            def download(_,staging,unused):
                source=staging/'.staging'/'source.part'
                source.parent.mkdir(parents=True)
                source.write_bytes(payload)
                return source

            with patch.object(prefetch.time,'sleep'),patch.object(prefetch,'download_parquet',side_effect=download) as mock:
                self.assertEqual(prefetch.prefetch_one(entry,root)['status'],'verified_and_saved')
                self.assertEqual(mock.call_count,1)
            self.assertEqual(partial.read_bytes(),payload[:3])

    def test_corrupt_published_target_not_accepted(self):
        entry={'body':'random','batch':13,'path':'random_body/batch-13.parquet',
               'size':4,'sha256':hashlib.sha256(b'good').hexdigest()}
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            target=root/'original-parquet'/entry['path']
            target.parent.mkdir(parents=True)
            target.write_bytes(b'evil')
            with self.assertRaisesRegex(ValueError,'SHA-256'):
                prefetch.prefetch_one(entry,root)


if __name__ == '__main__':
    unittest.main()
