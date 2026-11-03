"""Durable, same-volume checkpoint writes for EXO source-trained models.

Saving straight to the active .npz path risks truncating a trained model if
an import, training run or Mac crashes. Serialize to a unique sibling, flush,
and atomically replace the completed artifact only after success.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile

import numpy as np


def atomic_npz(path: Path, **arrays):
    path=Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix=path.name+'.',suffix='.npz.part',dir=path.parent)
    temp=Path(name)
    try:
        with os.fdopen(fd,'wb') as out:
            np.savez_compressed(out,**arrays)
            out.flush()
            os.fsync(out.fileno())
        # Verify the completed NPZ can be decoded before exposing it as live.
        with np.load(temp,allow_pickle=False) as check:
            if set(check.files)!=set(arrays):
                raise ValueError('Incomplete checkpoint NPZ; previous model kept')
            for key in check.files:
                if check[key].shape!=np.asarray(arrays[key]).shape:
                    raise ValueError(f'Checkpoint shape mismatch: {key}')
        os.replace(temp,path)
    finally:
        temp.unlink(missing_ok=True)


def atomic_json(path: Path, document):
    path=Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    payload=(json.dumps(document,indent=2)+'\n').encode()
    fd,name=tempfile.mkstemp(prefix=path.name+'.',suffix='.json.part',dir=path.parent)
    temp=Path(name)
    try:
        with os.fdopen(fd,'wb') as out:
            out.write(payload)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temp,path)
    finally:
        temp.unlink(missing_ok=True)
