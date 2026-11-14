#!/usr/bin/env python3
"""Build and exercise a tiny source-extracted EXO C++ helper across a Rust C ABI."""
import hashlib
import pathlib
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'native_cpp/core/dxf_export.cpp'


def run(args, **kwargs):
    result = subprocess.run(args, check=True, capture_output=True, text=True, **kwargs)
    return result.stdout.strip()


def main():
    source = SOURCE.read_text()
    start = source.index('std::string safeLayer(')
    end = source.index('\nvoid pair(', start)
    original_function = source[start:end]
    assert 'return result.empty() ? "PATTERN" : result;' in original_function
    rustc = shutil.which('rustc') or str(pathlib.Path.home() / '.cargo/bin/rustc')
    assert pathlib.Path(rustc).exists() and shutil.which('clang++')
    cpp = r'''#include <string>
#include <cstddef>
#include <cstring>
''' + original_function + r'''
// The wrapper uses raw byte spans; it never dereferences null or writes past output capacity.
extern "C" int exo_safe_layer(const unsigned char* input, size_t input_len,
                              unsigned char* output, size_t capacity, size_t* written) {
  if (!written || !output || (!input && input_len != 0)) return -1;
  *written = 0;
  // Length is capped before std::string creation to bound memory use by the source limit.
  std::string value;
  if (input_len > 0) value.assign(reinterpret_cast<const char*>(input),
                                  input_len < 48 ? input_len : 48);
  auto transformed = safeLayer(value);
  if (capacity < transformed.size()) return -2;
  std::memcpy(output, transformed.data(), transformed.size());
  *written = transformed.size();
  return 0;
}
'''
    rust = r'''
use std::ptr;
#[link(name = "c++")]
unsafe extern "C" {
    fn exo_safe_layer(input: *const u8, len: usize, output: *mut u8,
                      capacity: usize, written: *mut usize) -> i32;
}
fn expected(value: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    for &c in value.iter().take(48) {
        out.push(match c {
            b'a'..=b'z' => c - b'a' + b'A',
            b'A'..=b'Z' | b'0'..=b'9' | b'_' | b'-' => c,
            _ => b'_',
        });
    }
    if out.is_empty() { b"PATTERN".to_vec() } else { out }
}
fn check(value: &[u8], null_input_when_empty: bool) {
    let mut out = [0xa5u8; 56];
    let mut count = usize::MAX;
    let ptr = if null_input_when_empty { ptr::null() } else { value.as_ptr() };
    let status = unsafe {
        exo_safe_layer(ptr, value.len(), out.as_mut_ptr(), 48, &mut count)
    };
    assert_eq!(status, 0, "C ABI status for {:?}", value);
    assert_eq!(&out[..count], expected(value), "C++/Rust parity for {:?}", value);
    assert!(out[count..].iter().all(|&b| b == 0xa5), "output canary overwritten");
}
fn main() {
    let normal: [&[u8]; 8] = [b"front", b"Front Left", b"123_-", b"ABC", b"sleeve1",
                                     b"a", b"aBcDeF", b"ABCDEFGHIJKLMN"];
    // Five negative input controls: empty, invalid punctuation, multibyte UTF-8,
    // embedded NUL, and oversized input.
    let negative: [&[u8]; 5] = [b"", b"A/B:C!", b"\xc3\xa9", b"a\0b", &LONG];
    for case in normal { check(case, false); }
    for case in negative { check(case, case.is_empty()); }

    // Explicit ABI failure contracts (all operations remain in process memory).
    let mut out = [0xa5u8; 48];
    let mut written = 123usize;
    assert_eq!(unsafe { exo_safe_layer(ptr::null(), 1, out.as_mut_ptr(), 48, &mut written) }, -1);
    assert_eq!(unsafe { exo_safe_layer(b"x".as_ptr(), 1, ptr::null_mut(), 48, &mut written) }, -1);
    assert_eq!(unsafe { exo_safe_layer(b"x".as_ptr(), 1, out.as_mut_ptr(), 48, ptr::null_mut()) }, -1);
    assert_eq!(unsafe { exo_safe_layer(b"x".as_ptr(), 1, out.as_mut_ptr(), 0, &mut written) }, -2);
    assert_eq!(written, 0);
    assert!(out.iter().all(|&b| b == 0xa5));
    println!("PASS bridge: 13/13 C++↔Rust byte parity, 5/5 negative inputs, 4/4 ABI error assertions, canaries intact");
}
const LONG: [u8; 52] = [b'x'; 52];
'''
    with tempfile.TemporaryDirectory(prefix='exo-cxx-bridge-', dir='/tmp') as td:
        temp = pathlib.Path(td)
        (temp / 'bridge.cpp').write_text(cpp)
        (temp / 'caller.rs').write_text(rust)
        run(['clang++', '-std=c++17', '-O0', '-c', str(temp / 'bridge.cpp'), '-o', str(temp / 'bridge.o')])
        run([rustc, '--edition=2024', '-C', 'opt-level=0', str(temp / 'caller.rs'),
             '-C', f'link-arg={temp / "bridge.o"}', '-o', str(temp / 'bridge')])
        print(run([str(temp / 'bridge')]))
    print('source_sha256=' + hashlib.sha256(SOURCE.read_bytes()).hexdigest())
    print('rustc=' + run([rustc, '--version']))
    print('clang=' + run(['clang++', '--version']).splitlines()[0])
    print('cxx_crate=not_used; bridge=minimal C ABI; temp artifacts=removed')


if __name__ == '__main__':
    main()
