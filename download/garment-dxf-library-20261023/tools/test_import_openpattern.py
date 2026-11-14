import hashlib
import stat
from pathlib import Path
import tempfile
import unittest
import zipfile

import import_openpattern as importer


DXF = b'0\nSECTION\n2\nENTITIES\n0\nLINE\n8\n0\n10\n0\n20\n0\n11\n1\n21\n1\n0\nENDSEC\n0\nEOF\n'


class ImportTests(unittest.TestCase):
    def test_synthetic_zip_idempotence_and_byte_integrity(self):
        with tempfile.TemporaryDirectory(prefix='exo-openpattern-test-', dir=Path(__file__).resolve().parents[3]) as temporary:
            sandbox = Path(temporary)
            old = importer.ROOT, importer.INBOX, importer.DEST, importer.MANIFEST
            importer.ROOT = sandbox
            importer.INBOX = sandbox / 'openpattern-inbox'
            importer.DEST = sandbox / 'dxf' / 'openpattern-imports'
            importer.MANIFEST = sandbox / 'reports' / 'openpattern-files.json'
            importer.INBOX.mkdir()
            try:
                archive = importer.INBOX / 'synthetic.zip'
                with zipfile.ZipFile(archive, 'w') as out:
                    out.writestr('garment/', b'')
                    out.writestr('garment/instructions.pdf', b'%PDF-1.7 fake test fixture')
                    out.writestr('garment/model.glb', b'glTF')
                    out.writestr('garment/project.zprj', b'test')
                    out.writestr('garment/preview.png', b'PNG')
                    out.writestr('garment/tee.dxf', DXF)
                    out.writestr('garment/duplicate.dxf', DXF)
                first = importer.import_files(archive, 'local synthetic test', 'test-only license metadata', 'synthetic test creator', importer.MANIFEST)
                self.assertEqual((first['newFiles'], first['duplicates']), (1, 1))
                self.assertEqual(first['checkoutCompleted'], False)
                self.assertEqual((importer.DEST / (hashlib.sha256(DXF).hexdigest() + '.dxf')).read_bytes(), DXF)
                second = importer.import_files(archive, 'local synthetic test', 'test-only license metadata', 'synthetic test creator', importer.MANIFEST)
                self.assertEqual((second['newFiles'], second['duplicates'], second['manifestTotal']), (0, 2, 1))
                with self.assertRaisesRegex(ValueError, 'mandatory'):
                    importer.import_files(archive, '', 'test', 'test', importer.MANIFEST)
                bad = importer.INBOX / 'evil.zip'
                with zipfile.ZipFile(bad, 'w') as out:
                    out.writestr('../escape.dxf', DXF)
                with self.assertRaisesRegex(ValueError, 'Unsafe'):
                    importer.import_files(bad, 'synthetic', 'test', 'test', importer.MANIFEST)
                for index, unsafe in enumerate(('../escape.pdf', '/absolute.png', 'nested/../bad.glb', 'nested\\bad.zprj')):
                    bad = importer.INBOX / f'unsafe-{index}.zip'
                    with zipfile.ZipFile(bad, 'w') as out:
                        out.writestr('safe.dxf', DXF)
                        out.writestr(unsafe, b'unsafe')
                    with self.assertRaisesRegex(ValueError, 'Unsafe'):
                        importer.import_files(bad, 'synthetic', 'test', 'test', importer.MANIFEST)
                symlink = importer.INBOX / 'symlink.zip'
                info = zipfile.ZipInfo('product/linked.pdf')
                info.create_system = 3
                info.external_attr = (stat.S_IFLNK | 0o777) << 16
                with zipfile.ZipFile(symlink, 'w') as out:
                    out.writestr('safe.dxf', DXF)
                    out.writestr(info, b'/etc/passwd')
                with self.assertRaisesRegex(ValueError, 'symlink'):
                    importer.import_files(symlink, 'synthetic', 'test', 'test', importer.MANIFEST)
                bomb = importer.INBOX / 'bomb.zip'
                with zipfile.ZipFile(bomb, 'w', compression=zipfile.ZIP_DEFLATED) as out:
                    out.writestr('bomb.dxf', b'0' * 200000)
                with self.assertRaisesRegex(ValueError, 'ratio'):
                    importer.import_files(bomb, 'synthetic', 'test', 'test', importer.MANIFEST)
                # An unrelated highly compressed PDF must not be decompressed.
                mixed = importer.INBOX / 'compressed-asset.zip'
                with zipfile.ZipFile(mixed, 'w', compression=zipfile.ZIP_DEFLATED) as out:
                    out.writestr('asset.pdf', b'x' * 200000)
                    out.writestr('new.dxf', DXF)
                self.assertEqual(importer.candidates(mixed), [('new.dxf', DXF)])
            finally:
                importer.ROOT, importer.INBOX, importer.DEST, importer.MANIFEST = old


if __name__ == '__main__':
    unittest.main()
