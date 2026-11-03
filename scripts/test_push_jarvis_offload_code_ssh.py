"""Unit checks for the reconnect deployment allowlist and digest logic."""
import importlib.util
from pathlib import Path
import tempfile
import unittest


spec=importlib.util.spec_from_file_location('push_jarvis_training_scripts',
    Path(__file__).with_name('push-jarvis-offload-code-ssh.py'))
push=importlib.util.module_from_spec(spec)
spec.loader.exec_module(push)


class JarvisScriptDeploymentTests(unittest.TestCase):
    def test_digests_identify_only_outdated_allowlisted_tools(self):
        local={f:('0'*64 if i==0 else 'a'*64)
               for i,f in enumerate(push.FILES)}
        remote={f:local[f] for f in push.FILES}
        self.assertEqual(push.files_to_update(local,remote),[])
        remote[push.FILES[1]]='b'*64
        remote['source-secret-file.json']='does-not-matter'
        self.assertEqual(push.files_to_update(local,remote),[push.FILES[1]])

    def test_sha256_reports_known_file_content(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'sample.py';path.write_bytes(b'hello')
            self.assertEqual(push.sha256(path),
                '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')


if __name__=='__main__':unittest.main()
