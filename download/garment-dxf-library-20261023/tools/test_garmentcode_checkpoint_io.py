import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from garmentcode_checkpoint_io import atomic_npz,atomic_json


class AtomicCheckpointTests(unittest.TestCase):
    def test_atomic_npz_preserves_existing_file_if_serialization_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            out=Path(folder)/'model.npz'
            atomic_npz(out,weights=np.ones((2,3),dtype='float32'))
            before=out.read_bytes()
            with patch('garmentcode_checkpoint_io.np.savez_compressed',side_effect=ValueError('Cannot serialize')):
                with self.assertRaisesRegex(ValueError,'Cannot serialize'):
                    atomic_npz(out,weights=np.zeros((2,3),dtype='float32'))
            self.assertEqual(out.read_bytes(),before)
            self.assertEqual(list(out.parent.glob('*.part')),[])
            atomic_npz(out,weights=np.zeros((2,3),dtype='float32'))
            with np.load(out,allow_pickle=False) as checkpoint:
                self.assertEqual(checkpoint['weights'].sum(),0)

    def test_atomic_json_round_trip_and_old_content_retention(self):
        with tempfile.TemporaryDirectory() as folder:
            out=Path(folder)/'manifest.json'
            atomic_json(out,{'trained':3450,'verified':True})
            data=out.read_bytes()
            with self.assertRaises(TypeError):
                atomic_json(out,{'notSerializable':object()})
            self.assertEqual(out.read_bytes(),data)
            self.assertEqual(json.loads(out.read_text())['trained'],3450)


if __name__=='__main__':unittest.main()
