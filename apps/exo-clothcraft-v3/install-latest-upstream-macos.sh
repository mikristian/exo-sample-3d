#!/usr/bin/env bash
# Package a verified, clean upstream ClothCraft build into its own local app.
# The original ClothCraft.app, EXO V2 and EXO V3 apps are never replaced.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
source_tree="$root/research/oss/clothcraft-latest-20261103"
expected_commit="5a7400f0bea90ca8ab0d289efe204ed18a681ccc"
target="$HOME/Applications/ClothCraft Upstream Latest.app"
binary="$root/research/oss/clothcraft/target/debug/cloth-fit"

[[ -d "$source_tree" ]] || { echo "Latest upstream worktree not found" >&2; exit 1; }
[[ "$(git -C "$source_tree" rev-parse HEAD)" == "$expected_commit" ]] || {
  echo "Latest upstream worktree is not the verified commit" >&2; exit 1;
}
[[ -x "$binary" ]] || { echo "Build newest cloth-fit before packaging" >&2; exit 1; }
[[ ! -e "$target" ]] || { echo "Already installed; refusing to overwrite $target" >&2; exit 1; }
mkdir -p "$HOME/Applications"
stage="$(mktemp -d "$HOME/Applications/.clothcraft-upstream-stage.XXXXXX")"
trap 'rm -rf "$stage"' EXIT
app="$stage/ClothCraft Upstream Latest.app"
res="$app/Contents/Resources"
mkdir -p "$app/Contents/MacOS" "$res/bin"
cp "$binary" "$res/bin/cloth-fit"
cp -R "$source_tree/assets" "$res/assets"
cp "$source_tree/LICENSE" "$res/ClothCraft-MIT-LICENSE.txt"
printf '%s\n' "$expected_commit" > "$res/UPSTREAM_COMMIT.txt"

cat > "$app/Contents/MacOS/ClothCraftLatest" <<'LAUNCH'
#!/bin/bash
set -euo pipefail
RES="$(cd "$(dirname "$0")/../Resources" && pwd)"
WORK="$HOME/Library/Application Support/ClothCraft Upstream Latest/Workspace"
LOGS="$HOME/Library/Logs/ClothCraft Upstream Latest"
mkdir -p "$WORK" "$LOGS"
cd "$RES"
export RUST_BACKTRACE=1
if [[ -s "$WORK/fitting-project.json" ]]; then
  exec "$RES/bin/cloth-fit" --steps 0 --view --project "$WORK/fitting-project.json" \
    --output "$WORK" >> "$LOGS/clothcraft.log" 2>&1
fi
exec "$RES/bin/cloth-fit" --steps 0 --view \
  --avatar "$RES/assets/makehuman/mannequin.obj" --output "$WORK" \
  >> "$LOGS/clothcraft.log" 2>&1
LAUNCH
chmod +x "$app/Contents/MacOS/ClothCraftLatest"

cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleExecutable</key><string>ClothCraftLatest</string>
  <key>CFBundleIdentifier</key><string>dev.exo.clothcraft.upstream.latest</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>ClothCraft Upstream Latest</string>
  <key>CFBundleDisplayName</key><string>ClothCraft Upstream Latest</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>20261103</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST

if command -v codesign >/dev/null 2>&1; then
  codesign --force --sign - --timestamp=none "$res/bin/cloth-fit"
  codesign --force --sign - --timestamp=none "$app"
fi
mv "$app" "$target"
echo "Installed verified ClothCraft main $expected_commit at: $target"
echo "Separate user data: ~/Library/Application Support/ClothCraft Upstream Latest/Workspace"
echo "Local development build, ad-hoc signed; not a notarized public release."
