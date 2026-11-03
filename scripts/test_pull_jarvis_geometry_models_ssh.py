import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np


spec=importlib.util.spec_from_file_location('jarvis_geometry_model_mirror',
    Path(__file__).with_name('pull-jarvis-geometry-models-ssh.py'))
mirror=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mirror)


class RemoteGeometryModelValidationTests(unittest.TestCase):
    def test_valid_model_with_all_unique_source_embeddings(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            model=root/'model.npz';emb=root/'embeddings.npz';manifest=root/'manifest.json'
            shapes={'w1':(39,64),'b1':(64,),'w2':(64,16),'b2':(16,),
                    'w3':(16,64),'b3':(64,),'w4':(64,39),'b4':(39,),
                    'mean':(39,),'std':(39,)}
            tensors={name:np.ones(shape,dtype='float32') for name,shape in shapes.items()}
            tensors['featureNames']=np.array([f'f{i}' for i in range(39)])
            np.savez_compressed(model,**tensors)
            np.savez_compressed(emb,embeddings=np.ones((10,16),dtype='float32'),
                                sourceIds=np.array([f'id-{i}' for i in range(10)]))
            manifest.write_text(json.dumps({'schema':'exo.garmentcodedata-v2.geometry-training.v1',
                                            'trainingExamplesVerified':10}))
            mirror.validate_model(model,emb,manifest,10)
            np.savez_compressed(emb,embeddings=np.ones((10,16),dtype='float32'),
                                sourceIds=np.array(['duplicate']*10))
            with self.assertRaisesRegex(ValueError,'unique'):
                mirror.validate_model(model,emb,manifest,10)


if __name__=='__main__':unittest.main()
