#!/usr/bin/env python3
"""Rebuild an isolated V3 React-hybrid preview using existing installed V2 UI and Rust/ClothCraft resources.

Developer preview only: EXO's remaining JS/C++ authoritative handlers are NOT all Rust-converted.
The installed V2 and native Rust V3 apps are not altered, and no proprietary assets are copied to Git.
"""
from pathlib import Path
import argparse, hashlib, os, plistlib, shutil, subprocess

PARTS = ("bin", "web", "integrations", "research", "native_cpp", "node_modules", "collision-avatars", "src")
APP_NAME = "EXO ClothCraft Studio V3 React Hybrid.app"

def digest(p):
    h=hashlib.sha256()
    with p.open("rb") as stream:
        for piece in iter(lambda:stream.read(1024*1024),b""): h.update(piece)
    return h.hexdigest()

def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--repo",type=Path,default=Path(__file__).resolve().parents[3])
    cli.add_argument("--destination",type=Path,required=True,help="External-volume folder; must have 250 MiB free")
    cli.add_argument("--reference",type=Path,default=Path.home()/"Applications/EXO ClothCraft Studio V2.app")
    a=cli.parse_args()
    repo=a.repo.expanduser().resolve(); dest=a.destination.expanduser().resolve()
    reference=a.reference.expanduser().resolve()
    resource=reference/"Contents/Resources"; app=dest/APP_NAME
    node=Path.home()/"Library/Application Support/EXO-ClothCraft-Studio-V2/Runtime/node"
    swift=repo/"integrations/clothcraft/macos/EXOClothCraftWorkspaceV2.swift"
    assert swift.is_file() and resource.is_dir(), "V2 source and installed V2 required"
    assert not app.exists(), "Refuse to overwrite existing preview"
    assert node.is_file() and digest(node)==digest(resource/"bin/node"), "Signed Node runtime mismatch"
    assert all((resource/p).exists() for p in PARTS) and (resource/"runtime-provenance.json").is_file()
    dest.mkdir(parents=True,exist_ok=True)
    assert shutil.disk_usage(dest).free>250*1024*1024, "Insufficient external scratch space"
    for port in (5485,5486):
        found=subprocess.run(["lsof","-nP",f"-iTCP:{port}","-sTCP:LISTEN"],capture_output=True,text=True)
        assert not found.stdout.strip(), f"Preview port {port} is occupied"
    s=swift.read_text()
    i=s.index("    private var supportName: String {")
    j=s.index("    private var pageURL: URL",i)
    s=s[:i]+'    private var supportName: String { "EXO-ClothCraft-Studio-V3-React-Hybrid" }\n'+s[j:]
    assert "private var bridgePort: Int { staging ? 5485 : 5385 }" in s
    assert "private var webPort: Int { staging ? 5486 : 5386 }" in s
    i=s.index("        let runtimeFolder = supportRoot.appendingPathComponent(")
    j=s.index("        let scripts = resources.appendingPathComponent(",i)
    safe_node=str(node).replace("\\","\\\\").replace('"','\\"')
    replace='''        // Signed V2 Node cache is read-only and hash-matched to the bundled binary.
        let node = URL(fileURLWithPath: "NODE_PATH")
        let bundledIdentity = try executableSHA256(bundledNode)
        guard FileManager.default.isExecutableFile(atPath: node.path),
              (try? executableSHA256(node)) == bundledIdentity else {
            throw NSError(domain: "EXO-V3-Hybrid", code: 8,
              userInfo: [NSLocalizedDescriptionKey: "Signed V2 Node cache unavailable or mismatched"])
        }
'''.replace("NODE_PATH",safe_node)
    s=s[:i]+replace+s[j:]
    data=dest/"Workspace-Data"
    i=s.index("    private var supportRoot: URL {")
    j=s.index("    private var startupLabel: NSTextField!",i)
    safe_data=str(data).replace("\\","\\\\").replace('"','\\"')
    s=s[:i]+f'''    private var supportRoot: URL {{ URL(fileURLWithPath: "{safe_data}/Support", isDirectory: true) }}
    private var logsRoot: URL {{ URL(fileURLWithPath: "{safe_data}/Logs", isDirectory: true) }}
'''+s[j:]
    s=s.replace("EXO ClothCraft Studio V2","EXO ClothCraft Studio V3 React Hybrid")
    assert "runtimeFolder" not in s
    gen=dest/"EXOClothCraftV3ReactHybrid.generated.swift"
    gen.write_text(s)
    binary=app/"Contents/MacOS/EXOClothCraftV3ReactHybrid"
    binary.parent.mkdir(parents=True);(app/"Contents/Resources").mkdir(parents=True)
    info={"CFBundleDisplayName":"EXO ClothCraft Studio V3 React Hybrid",
          "CFBundleExecutable":binary.name,
          "CFBundleIdentifier":"com.mikristian.exo.clothcraft.v3.react-hybrid",
          "CFBundleName":"EXO ClothCraft Studio V3 React Hybrid","CFBundlePackageType":"APPL",
          "CFBundleShortVersionString":"0.1.0","CFBundleVersion":"1",
          "NSHighResolutionCapable":True,
          "LSMinimumSystemVersion":"13.0",
          "NSAppTransportSecurity":{"NSAllowsLocalNetworking":True}}
    with (app/"Contents/Info.plist").open("wb") as f:plistlib.dump(info,f)
    env=os.environ.copy();env["TMPDIR"]=str(dest);env["CLANG_MODULE_CACHE_PATH"]=str(dest/"swift-module-cache")
    subprocess.run(["swiftc","-parse-as-library","-D","EXO_V2_STAGED","-Onone",
      "-module-cache-path",str(dest/"swift-module-cache"),
      "-framework","AppKit","-framework","WebKit","-o",str(binary),str(gen)],check=True,env=env)
    for name in PARTS:(app/"Contents/Resources"/name).symlink_to(resource/name,target_is_directory=True)
    shutil.copy2(resource/"runtime-provenance.json",app/"Contents/Resources/runtime-provenance.json")
    # Sign only our own new executable: --deep could traverse original V2 resource symlinks.
    subprocess.run(["codesign","--force","--sign","-","--timestamp=none",str(binary)],check=True)
    print("V3 React Hybrid ready:",app)
    print("Isolated workspace:",data)
    print("Original React and existing Rust/ClothCraft services; other EXO logic still being migrated.")
    print("Open with: open -n "+repr(str(app)))

if __name__=="__main__":main()
