#!/usr/bin/env python3
"""Build a standalone branded ClothCraft Assets site without modifying its source."""
from pathlib import Path
import argparse
import re
import shutil

SOURCE = Path(__file__).resolve().parents[3] / 'concepts' / 'exo-community-ui'
TARGET = Path(__file__).resolve().parents[1] / 'clothcraft-assets'
OMIT = {'README.md', 'CLO_CONNECT_FABRIC_REFERENCE.md', 'EDITION_THREE_QA.md',
        'EXO_UI_REDESIGN_IMPLEMENTATION_INDEX.md', 'serve-site.py'}

def rebrand(text):
    replacements = {
        'EXO Community': 'ClothCraft Assets',
        'EXO COMMUNITY': 'CLOTHCRAFT ASSETS',
        'EXO community': 'ClothCraft community',
        'EXO creative community': 'ClothCraft creative community',
        'EXO concept community': 'ClothCraft concept community',
        'EXO archive': 'ClothCraft archive',
        'EXO DIGITAL OBJECTS': 'CLOTHCRAFT DIGITAL OBJECTS',
        'THE EXO ARCHIVE': 'THE CLOTHCRAFT ARCHIVE',
        'EXO /': 'CLOTHCRAFT /',
        'EXO LAB': 'CLOTHCRAFT LAB',
        'EXO DISCOVER': 'CLOTHCRAFT DISCOVER',
        'EXO original': 'ClothCraft original',
        'EXO existing': 'ClothCraft existing',
        'EXO Studio': 'ClothCraft Studio',
        'EXO Creator': 'ClothCraft Creator',
        'EXO · Studio': 'ClothCraft · Studio',
        'EXO <small>': 'CLOTHCRAFT <small>',
        '✳ EXO <small>': '✳ CLOTHCRAFT <small>',
        'EXO ClothCraft': 'ClothCraft',
        'EXO — Fashion assets': 'ClothCraft Assets — Fashion assets',
        'More ways to explore EXO': 'More ways to explore ClothCraft',
        '<span>EXO<br>LAB</span>': '<span>CLOTHCRAFT<br>LAB</span>',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    # Rebrand standalone display copy while retaining identifiers such as
    # EXO01, exo-studio, file paths, CSS selectors, and source asset keys.
    text = re.sub(r'(?<![\w/.-])EXO(?![\w/.-])', 'ClothCraft', text)
    text = text.replace('github.com/mikristian/exo-sample-3d', 'github.com/erythrofr/ClothCraft')
    text = text.replace('github\\.com\\/mikristian\\/exo-sample-3d', 'github\\.com\\/erythrofr\\/ClothCraft')
    text = text.replace('ClothCraft <em>ClothCraft</em>', 'ClothCraft <em>Studio</em>')
    text = text.replace('CLOTHCRAFT / CLOTHCRAFT STUDIO', 'CLOTHCRAFT / STUDIO V2')
    return text

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check expected packaged files')
    args = parser.parse_args()
    if args.check:
        required = ('index.html', 'app.js', 'styles.css', 'fabric-index.json',
                    'market-media.json', 'project-media', 'previews', 'download/index.html')
        missing = [name for name in required if not (TARGET / name).exists()]
        assert not missing, f'Missing packaged assets: {missing}'
        html = (TARGET / 'index.html').read_text()
        assert '<title>ClothCraft Assets — Digital Fashion Community</title>' in html and '<small>ASSETS</small>' in html and 'class="clothcraft-return"' in html
        assert 'href="../"' in html and 'href="../#home"' not in html
        download_html = (TARGET / 'download' / 'index.html').read_text()
        release_js = (TARGET / 'download' / 'releases.js').read_text()
        assert 'ClothCraft <em>Studio</em>' in download_html
        assert 'ClothCraft <em>ClothCraft</em>' not in download_html
        assert 'github.com/erythrofr/ClothCraft' in download_html
        assert 'github.com/mikristian/exo-sample-3d' not in download_html + release_js
        assert 'mac: null' in release_js and 'windows: null' in release_js
        for ref in re.findall(r'(?:src|href)="\./([^"#?]+)', html):
            assert (TARGET / ref).exists(), f'Missing HTML reference: {ref}'
        print(f'Validated ClothCraft Assets at {TARGET}')
        return
    if TARGET.exists():
        shutil.rmtree(TARGET)
    shutil.copytree(SOURCE, TARGET, symlinks=False,
                    ignore=lambda directory, names: [name for name in names
                        if (name in OMIT or name.startswith('qa-') or name.startswith('qa_'))])
    for path in TARGET.rglob('*'):
        if path.is_file() and path.suffix in {'.html', '.js'}:
            path.write_text(rebrand(path.read_text()))
    index = TARGET / 'index.html'
    html = index.read_text()
    html = html.replace('<title>ClothCraft — The Creative Design Community</title>',
                        '<title>ClothCraft Assets — Digital Fashion Community</title>')
    html = html.replace('<span>ClothCraft<span class="exo-brand-dot">.</span></span><small>COMMUNITY</small>',
                        '<span>ClothCraft<span class="exo-brand-dot">.</span></span><small>ASSETS</small>')
    html = html.replace('<body>', '<body>\n  <a class="clothcraft-return" href="../" aria-label="Return to ClothCraft main website">← ClothCraft main site</a>')
    html = html.replace('</head>', '<link rel="stylesheet" href="./clothcraft-brand.css">\n</head>')
    index.write_text(html)
    (TARGET / 'clothcraft-brand.css').write_text('''/* Standalone asset portal navigation. Keep marketplace layout intact. */
.clothcraft-return{position:fixed;bottom:20px;left:20px;z-index:9999;background:#f4f7ff;color:#145ee9;border:1px solid #a8c9ff;border-radius:999px;padding:12px 18px;font:600 13px/1.2 system-ui,sans-serif;text-decoration:none;box-shadow:0 6px 20px #0002}
.clothcraft-return:hover,.clothcraft-return:focus-visible{background:#145ee9;color:#fff}
@media(max-width:560px){.clothcraft-return{bottom:12px;left:12px;padding:10px 14px;max-width:calc(100vw - 24px);box-sizing:border-box}}
@media(max-width:680px){.topbar{gap:8px}.topbar>.brand{flex:none;max-width:42vw}.topbar>.brand>span{font-size:clamp(14px,4vw,20px);letter-spacing:-.7px}.main-links{min-width:0}.top-actions{flex:none}.clothcraft-return{font-size:12px}}
@media(max-width:375px){.top-actions .avatar-button{display:none}.topbar>.brand{max-width:45vw}}
''')
    print(f'Packaged {sum(p.is_file() for p in TARGET.rglob("*"))} files into {TARGET}')
    main_check = [TARGET / p for p in ('index.html', 'app.js', 'fabric-index.json')]
    assert all(p.exists() for p in main_check)

if __name__ == '__main__':
    main()
