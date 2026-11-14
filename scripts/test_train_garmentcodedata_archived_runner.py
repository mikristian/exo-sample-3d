import importlib.util
import tempfile
import unittest
from pathlib import Path


file=Path(__file__).with_name('train-garmentcodedata-archived-runner.py')
spec=importlib.util.spec_from_file_location('exo_archived_training_runner',file)
runner=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class VerifiedGeometryTrainingRunnerTests(unittest.TestCase):
    def test_warm_start_prioritizes_full_archive_then_trained_v2(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            full=root/'training/geometry-encoder-full-archive'
            v2=root/'training/geometry-encoder-v2'
            v2.mkdir(parents=True)
            (v2/'geometry-encoder-v1.npz').write_bytes(b'fixture')
            (v2/'training-manifest.json').write_text('{}')
            self.assertEqual(runner.choose_initial_checkpoint(root,full),v2/'geometry-encoder-v1.npz')
            full.mkdir()
            (full/'geometry-encoder-v1.npz').write_bytes(b'fixture')
            (full/'training-manifest.json').write_text('{}')
            self.assertEqual(runner.choose_initial_checkpoint(root,full),full/'geometry-encoder-v1.npz')


if __name__=='__main__':unittest.main()
