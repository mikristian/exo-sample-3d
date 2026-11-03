"""Disk-backed trainer safety checks without remote hardware."""
import tempfile
import unittest
from pathlib import Path

import numpy as np

from train_garmentcode_seams_streaming import train_streaming,warm_start_weights
from train_garmentcode_seams import FEATURE_NAMES


class StreamedSeamTrainingTests(unittest.TestCase):
    def test_deep_refit_updates_using_every_pair_and_labels_metrics_in_sample(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);rng=np.random.default_rng(88)
            x=np.memmap(root/'x.bin',mode='w+',dtype=np.float32,shape=(350,len(FEATURE_NAMES)))
            y=np.memmap(root/'y.bin',mode='w+',dtype=np.uint8,shape=(350,))
            split=np.memmap(root/'s.bin',mode='w+',dtype=np.uint8,shape=(350,))
            x[:]=rng.normal(size=x.shape)
            y[:]=(x[:,2]>x[:,5]).astype(np.uint8)
            split[:]=np.arange(350)%10
            _,_,_,metrics,history=train_streaming(x,y,split,epochs=3,
                                                   train_on_all=True)
            self.assertTrue(metrics['fullDatasetOptimization'])
            self.assertEqual(metrics['trainingPairCount'],350)
            self.assertEqual(metrics['optimizerPairCount'],350)
            self.assertFalse(metrics['heldoutMetricsIndependent'])
            self.assertEqual(len(history),3)

    def test_warm_start_preserves_predicted_logits_under_changed_scaling(self):
        from train_garmentcode_seams import _predict
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);r=np.random.default_rng(22)
            original_mean=r.normal(size=33).astype(np.float32)
            original_std=r.uniform(1.2,2.4,size=33).astype(np.float32)
            new_mean=original_mean+r.normal(scale=.15,size=33).astype(np.float32)
            new_std=original_std*r.uniform(.9,1.1,size=33).astype(np.float32)
            weights={'w1':r.normal(scale=.05,size=(33,32)).astype(np.float32),
                     'b1':r.normal(scale=.05,size=32).astype(np.float32),
                     'w2':r.normal(scale=.05,size=(32,1)).astype(np.float32),
                     'b2':r.normal(scale=.05,size=1).astype(np.float32)}
            source=root/'model.npz'
            np.savez_compressed(source,**weights,mean=original_mean,std=original_std,
                                featureNames=np.asarray(FEATURE_NAMES))
            updated=warm_start_weights(source,new_mean,new_std)
            examples=r.normal(size=(120,33)).astype(np.float32)
            _,old=_predict((examples-original_mean)/original_std,weights)
            _,new=_predict((examples-new_mean)/new_std,updated)
            self.assertTrue(np.allclose(old,new,atol=1e-6))
            with self.assertRaisesRegex(ValueError,'feature'):
                bad=root/'bad.npz'
                np.savez_compressed(bad,**weights,mean=original_mean,std=original_std,
                                    featureNames=np.asarray(list(reversed(FEATURE_NAMES))))
                warm_start_weights(bad,new_mean,new_std)

    def test_finetuning_keeps_valid_initial_weights(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);r=np.random.default_rng(17)
            x=np.memmap(root/'x.bin',mode='w+',dtype=np.float32,shape=(350,33))
            y=np.memmap(root/'y.bin',mode='w+',dtype=np.uint8,shape=(350,))
            split=np.memmap(root/'s.bin',mode='w+',dtype=np.uint8,shape=(350,))
            x[:]=r.normal(size=x.shape)
            y[:]=(x[:,1]>x[:,2]).astype(np.uint8)
            split[:]=np.arange(350)%10
            weights,mean,std,_,_=train_streaming(x,y,split,epochs=9)
            checkpoint=root/'trained.npz'
            np.savez_compressed(checkpoint,**weights,mean=mean,std=std,
                                featureNames=np.asarray(FEATURE_NAMES))
            _,_,_,metrics,_=train_streaming(x,y,split,epochs=3,
                initial_checkpoint=checkpoint,learning_rate=0.0005)
            self.assertGreaterEqual(metrics['validationAveragePrecision'],
                                    metrics['initialValidationAveragePrecision']-0.000002)

    def test_disk_backed_memmaps_fit_and_score_holdout(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            rng=np.random.default_rng(9)
            x=np.memmap(root/'x.bin',mode='w+',dtype=np.float32,shape=(350,len(FEATURE_NAMES)))
            labels=np.memmap(root/'y.bin',mode='w+',dtype=np.uint8,shape=(350,))
            splits=np.memmap(root/'split.bin',mode='w+',dtype=np.uint8,shape=(350,))
            x[:]=rng.normal(size=x.shape)
            labels[:]=(x[:,3]+x[:,7]>0).astype(np.uint8)
            splits[:]=np.arange(350)%10
            progress=[]
            weights,mean,std,metric,history=train_streaming(x,labels,splits,
                epochs=14,batch_size=48,progress=progress.append)
            self.assertGreater(metric['testROCAUC'],0.6)
            self.assertGreater(metric['testAveragePrecision'],0.5)
            self.assertTrue(np.isfinite(weights['w1']).all())
            self.assertEqual(mean.shape,(len(FEATURE_NAMES),))
            self.assertTrue((std>0).all())
            self.assertTrue(progress)
            self.assertEqual(history[-1]['epoch'],len(history))


if __name__=='__main__':unittest.main()
