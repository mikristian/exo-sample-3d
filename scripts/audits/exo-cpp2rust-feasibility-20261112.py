#!/usr/bin/env python3
"""Isolated C++ versus Rust DXF layer-name parity pilot; writes only to a temp dir."""
import hashlib
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'native_cpp/core/dxf_export.cpp'
CASES = [b'', b'front', b'Front Left', b'123_-', b'A/B:C', b'a' * 47, b'a' * 48,
         b'a' * 49, b'ABC\tDEF', b'\xc3\xa9', b'\x00hi', b'xyz!@#', b'UPPER']


def run(args, *, cwd=None):
    return subprocess.run(args, cwd=cwd, check=True, text=True, capture_output=True).stdout


def main():
    source = SOURCE.read_text()
    start = source.index('std::string safeLayer(')
    end = source.index('\nvoid pair(', start)
    actual_cpp_function = source[start:end]
    assert 'return result.empty() ? "PATTERN" : result;' in actual_cpp_function
    rustc = shutil.which('rustc') or str(pathlib.Path.home() / '.cargo/bin/rustc')
    for tool in ('clang++', rustc):
        if not shutil.which(tool) and not pathlib.Path(tool).is_file():
            raise RuntimeError(f'missing compiler: {tool}')
    cpp = '''#include <string>\n#include <iostream>\n#include <iterator>\n''' + actual_cpp_function + r'''
int main() {
  std::string s((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());
  for (unsigned char c: safeLayer(s)) { const char* digits="0123456789abcdef";
    std::cout << digits[c >> 4] << digits[c & 15]; }
}
'''
    rust = r'''
use std::io::{self, Read};
fn safe_layer(value: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    for &c in value {
        if out.len() >= 48 { break; }
        let converted = match c {
            b'a'..=b'z' => c - b'a' + b'A',
            b'A'..=b'Z' | b'0'..=b'9' | b'_' | b'-' => c,
            _ => b'_',
        };
        out.push(converted);
    }
    if out.is_empty() { b"PATTERN".to_vec() } else { out }
}
fn main() {
    let mut input = Vec::new();
    io::stdin().read_to_end(&mut input).unwrap();
    for byte in safe_layer(&input) { print!("{:02x}", byte); }
}
'''
    with tempfile.TemporaryDirectory(prefix='exo-cpp2rust-pilot-') as tmp:
        temp = pathlib.Path(tmp)
        (temp / 'original.cpp').write_text(cpp)
        (temp / 'pilot.rs').write_text(rust)
        run(['clang++', '-std=c++17', '-O2', str(temp / 'original.cpp'), '-o', str(temp / 'cpp')])
        run([rustc, '--edition=2021', '-O', str(temp / 'pilot.rs'), '-o', str(temp / 'rust')])
        for i, case in enumerate(CASES):
            results = []
            for binary in ('cpp', 'rust'):
                response = subprocess.run([str(temp / binary)], input=case, capture_output=True, check=True)
                results.append(response.stdout)
            if results[0] != results[1]:
                raise AssertionError(f'case {i}: {case!r}: C++={results[0]!r} Rust={results[1]!r}')
        print(f'PASS {len(CASES)}/{len(CASES)} byte-exact cases, C++ function extracted from dxf_export.cpp')
        print('source_sha256=' + hashlib.sha256(SOURCE.read_bytes()).hexdigest())
        print('compiler_clang=' + run(['clang++', '--version']).splitlines()[0])
        print('compiler_rust=' + run([rustc, '--version']).strip())
        cargo_bin = pathlib.Path.home() / '.cargo/bin'
        print('translator_cpp2rust=' + str(shutil.which('cpp2rust') or (cargo_bin / 'cpp2rust' if (cargo_bin / 'cpp2rust').exists() else None)))
        print('translator_c2rust=' + str(shutil.which('c2rust') or (cargo_bin / 'c2rust' if (cargo_bin / 'c2rust').exists() else None)))
        print('pilot_kind=manual Rust rewrite, not automatic conversion')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'FAIL {type(exc).__name__}: {exc}', file=sys.stderr)
        raise
