"""Validate remote seam checkpoint mirror rejects malformed model weights."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

import numpy as np


spec=importlib.util.spec_from_file_location('jarvis_seam_mirror',
    Path(__file__).with_name('pull-jarvis-seam-models-ssh.py'))
mirror=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)


class MirrorValidationTests(unittest.TestCase):
    def test_accept_valid_geometry_and_reject_corrupt_or_wrong_shape(self):
        with tempfile.TemporaryDirectory() as temporary:
            file=Path(temporary)/'seam.npz'
            valid={'w1':np.ones((33,32),dtype='float32'),
                   'b1':np.zeros(32,dtype='float32'),
                   'w2':np.ones((32,1),dtype='float32'),
                   'b2':np.zeros(1,dtype='float32'),
                   'mean':np.zeros(33,dtype='float32'),
                   'std':np.ones(33,dtype='float32'),
                   'featureNames':np.array([f'f{i}' for i in range(33)])}
            np.savez_compressed(file,**valid)
            mirror.validate_npz(file)
            valid['w1']=np.ones((33,16),dtype='float32')
            np.savez_compressed(file,**valid)
            with self.assertRaisesRegex(ValueError,'shape'):
                mirror.validate_npz(file)
            valid['w1']=np.full((33,32),np.inf,dtype='float32')
            np.savez_compressed(file,**valid)
            with self.assertRaisesRegex(ValueError,'Non-finite'):
                mirror.validate_npz(file)


if __name__=='__main__':unittest.main()
