#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
export EXO_DESKTOP_DEST="${EXO_DESKTOP_DEST:-$HOME/Applications/EXO ClothCraft Studio V2.app}"

# Strict verification is staging-only and requires an externally reviewed,
# exact runtime identity. An arbitrary operator-entered hash is not a release approval.
if [[ "${EXO_STRICT_RELEASE_MODE:-0}" == 1 ]]; then
  [[ "${EXO_BUILD_STAGING:-0}" == 1 ]] || { echo 'STRICT_RELEASE_REQUIRES_STAGING' >&2; exit 21; }
  [[ "${EXO_REVIEWED_RELEASE_IDENTITY:-}" =~ ^[a-f0-9]{64}$ ]] || {
    echo 'STRICT_RELEASE_REVIEWED_IDENTITY_REQUIRED' >&2; exit 22;
  }
fi

if [[ "${EXO_BUILD_STAGING:-0}" == 1 ]]; then
  # The only supported candidate build is an untouched NEW app under the
  # repo's private release-candidates output. Never stop/replace installed V2.
  CANDIDATE_ROOT="$ROOT/integrations/clothcraft/output/release-candidates"
  case "$EXO_DESKTOP_DEST" in
    "$CANDIDATE_ROOT/"*.app) ;;
    *) echo "EXO_STAGING_DESTINATION_REFUSED: choose NEW .app under $CANDIDATE_ROOT" >&2; exit 12 ;;
  esac
  # Compare resolved parents before any build or app shutdown. A symlinked
  # candidate path must never redirect writes into ~/Applications.
  mkdir -p "$CANDIDATE_ROOT"
  CANDIDATE_PARENT_REAL="$(cd -P "$(dirname "$EXO_DESKTOP_DEST")" && pwd)"
  CANDIDATE_ROOT_REAL="$(cd -P "$CANDIDATE_ROOT" && pwd)"
  if [[ "$CANDIDATE_PARENT_REAL" != "$CANDIDATE_ROOT_REAL" ]]; then
    echo "EXO_STAGING_PARENT_ESCAPE_REFUSED" >&2
    exit 16
  fi
  if [[ -e "$EXO_DESKTOP_DEST" || -L "$EXO_DESKTOP_DEST" ]]; then
    echo "EXO_STAGING_DESTINATION_EXISTS: refuse to overwrite prior candidate" >&2
    exit 13
  fi
  # Reject an unsafe data namespace BEFORE checking a source fence or
  # performing any build. Only the signed plist can select it at launch.
  if [[ -n "${EXO_STAGING_SUPPORT_NAME:-}" ]]; then
    [[ "$EXO_STAGING_SUPPORT_NAME" =~ ^EXO-ClothCraft-Studio-V2-Staging-[A-Za-z0-9-]{1,48}$ ]] || {
      echo "EXO_STAGING_SUPPORT_NAME_INVALID" >&2; exit 23;
    }
  fi
  [[ -n "${EXO_CANDIDATE_SOURCE_FENCE:-}" && -f "$EXO_CANDIDATE_SOURCE_FENCE" ]] || {
    echo "EXO_STAGING_SOURCE_FENCE_REQUIRED" >&2; exit 14;
  }
  node integrations/clothcraft/macos/v2-source-freeze-20261030.mjs --verify "$EXO_CANDIDATE_SOURCE_FENCE"
  node integrations/clothcraft/macos/v2-release-candidate-preflight-20261030.mjs "$EXO_DESKTOP_DEST"
  export EXO_SWIFT_STAGING=1
  # Full private app and rollback/web staging exceed 2GiB combined; do not
  # exhaust the local volume while the live signed application is in use.
  CANDIDATE_FREE_KIB="$(df -Pk "$ROOT" | awk 'END {print $4}')"
  if (( CANDIDATE_FREE_KIB < 4194304 )); then
    echo "EXO_STAGING_BUILD_REFUSED: require >=4GiB free; have ${CANDIDATE_FREE_KIB} KiB" >&2
    exit 15
  fi
fi

# Fail BEFORE trying to save, stop or replace a live installed application.
# All Rust/Swift compiler intermediates are created on the local Mac volume;
# the noexec expansion WebDAV tunnel cannot supply compiler scratch space.
# A nearly full disk can make both pre-shutdown saves and builds fail. Do not
# take the user's working EXO app offline to discover that failure afterwards.
EXO_BUILD_FREE_KIB="$(/bin/df -Pk "$ROOT" | /usr/bin/awk 'END {print $4}')"
if [[ ! "$EXO_BUILD_FREE_KIB" =~ ^[0-9]+$ ]] || (( EXO_BUILD_FREE_KIB < 2097152 )); then
  echo "EXO_NATIVE_APP_BUILD_REFUSED_LOCAL_DISK_HEADROOM: require >=2GiB free BEFORE touching the installed app; have ${EXO_BUILD_FREE_KIB:-unknown} KiB" >&2
  exit 6
fi

# Fail before stopping a running installed app. The ignored live Rust source
# must never be silently replaced by the older tracked packaging adapter;
# the manifest-verified pinned V2 snapshot is authoritative for default packaging.
# Existing-source builds require an explicitly reviewed exact SHA-256.
node integrations/clothcraft/macos/preflight-v2-native-source-20261028.mjs "$ROOT"
if [[ "${EXO_BUILD_STAGING:-0}" == 1 ]]; then
  node integrations/clothcraft/macos/v2-source-freeze-20261030.mjs --verify "$EXO_CANDIDATE_SOURCE_FENCE"
fi

# Rebuilding a running .app can leave its previously launched localhost Node
# processes orphaned after an abrupt AppKit termination. Those stale services
# will then occupy 5385/5386 and make the new window look broken. Handle only
# processes whose executable AND script paths match this exact installed app.
if [[ -d "$EXO_DESKTOP_DEST" ]]; then
  EXO_WORKSPACE_AUTH_FILE="$HOME/Library/Application Support/EXO-ClothCraft-Studio-V2/Output/workspace-auth-token"
  for port in 5385 5386; do
    while read -r pid; do
      [[ "$pid" =~ ^[0-9]+$ ]] || continue
      cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      if [[ "$cmd" == *"EXO-ClothCraft-Studio-V2/Runtime/node "* && "$cmd" == *"$EXO_DESKTOP_DEST/Contents/Resources/integrations/clothcraft/"* ]]; then
        if [[ "$port" == 5385 ]]; then
          # Save the user's persistent Rust workspace before stopping services.
          [[ -r "$EXO_WORKSPACE_AUTH_FILE" ]] || { echo 'Cannot save workspace: missing runtime credential' >&2; exit 1; }
          EXO_WORKSPACE_AUTH_TOKEN="$(cat "$EXO_WORKSPACE_AUTH_FILE")"
          curl -fsS --connect-timeout 2 --max-time 10 -X POST \
            -H "Authorization: Bearer $EXO_WORKSPACE_AUTH_TOKEN" \
            -H 'Origin: http://127.0.0.1:5386' -H 'Content-Type: application/json' \
            --data '{"op":"pause"}' http://127.0.0.1:5385/workspace >/dev/null || true
          curl -fsS --connect-timeout 2 --max-time 10 -X POST \
            -H "Authorization: Bearer $EXO_WORKSPACE_AUTH_TOKEN" \
            -H 'Origin: http://127.0.0.1:5386' -H 'Content-Type: application/json' \
            --data '{"op":"save"}' http://127.0.0.1:5385/workspace >/dev/null || true
          while read -r child; do
            [[ "$child" =~ ^[0-9]+$ ]] || continue
            childcmd="$(ps -p "$child" -o command= 2>/dev/null || true)"
            [[ "$childcmd" == "$EXO_DESKTOP_DEST/Contents/Resources/research/oss/clothcraft/target/debug/exo-session "* ]] && kill -TERM "$child" 2>/dev/null || true
          done < <(pgrep -P "$pid" || true)
        fi
        kill -TERM "$pid" 2>/dev/null || true
      fi
    done < <(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  done
  while read -r pid command; do
    if [[ "$command" == "$EXO_DESKTOP_DEST/Contents/MacOS/EXOClothCraft" ]]; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done < <(ps -axo pid=,command=)
  sleep 1
fi
export CARGO_HOME="$ROOT/research/runtime/clothcraft-rust-toolchain/cargo"
export RUSTUP_HOME="$ROOT/research/runtime/clothcraft-rust-toolchain/rustup"
export PATH="$CARGO_HOME/bin:/usr/local/bin:$PATH"
# Recheck source identity and disk immediately before the native build in case
# another worker edited the ignored checkout after the early no-shutdown gate.
node integrations/clothcraft/macos/preflight-v2-native-source-20261028.mjs "$ROOT"
if [[ "${EXO_BUILD_STAGING:-0}" == 1 ]]; then
  node integrations/clothcraft/macos/v2-source-freeze-20261030.mjs --verify "$EXO_CANDIDATE_SOURCE_FENCE"
fi
if [[ "${EXO_USE_EXISTING_EXO_SESSION_SOURCE:-0}" == 1 ]]; then
  # Explicitly reviewed exceptional source; never silently roll back grading.
  test -s research/oss/clothcraft/src/bin/exo-session.rs
  echo 'Building existing ClothCraft fork session source without overwriting it.'
else
  if [[ -e research/oss/clothcraft/src/bin/exo-session.rs ]] && \
     ! cmp -s integrations/clothcraft/exo-session-v2-authoritative-20261028.rs research/oss/clothcraft/src/bin/exo-session.rs; then
    echo 'Refusing to overwrite different local Rust session work in the ClothCraft checkout.' >&2
    echo 'Review src/bin/exo-session.rs and integrations/clothcraft/exo-session-v2-authoritative-20261028.rs before packaging.' >&2
    exit 1
  fi
  # The files were already compared. Do not write the live checkout at all:
  # preserving its inode, mtime and active editor state avoids a build race.
  echo 'Building verified pinned V2 native source; live checkout unchanged.'
fi
(cd research/oss/clothcraft && cargo build --locked -j 2 --bin exo-session)
# A concurrent edit to the ignored Rust checkout during Cargo invalidates the
# approved input identity. Reject that artifact before staging or signing it.
node integrations/clothcraft/macos/preflight-v2-native-source-20261028.mjs "$ROOT"
if [[ "${EXO_BUILD_STAGING:-0}" == 1 ]]; then
  node integrations/clothcraft/macos/v2-source-freeze-20261030.mjs --verify "$EXO_CANDIDATE_SOURCE_FENCE"
fi
# Build the small Rust metadata validator independently of the cloth solver.
cargo build --locked --offline --manifest-path integrations/clothcraft/rust-service/Cargo.toml --bin exo-metadata-validation
test -x integrations/clothcraft/rust-service/target/debug/exo-metadata-validation
cargo build --locked --offline --manifest-path integrations/clothcraft/rust-agent-api/Cargo.toml --bin exo-agent-validator
test -x integrations/clothcraft/rust-agent-api/target/debug/exo-agent-validator
cargo build --locked --offline --manifest-path integrations/clothcraft/rust-static-host/Cargo.toml --bin exo-rust-static-host
test -x integrations/clothcraft/rust-static-host/target/debug/exo-rust-static-host
# Swift explicitly requests GPU mode at every launch. A CPU-only engineering
# artifact must never be packaged into that release (it blanks both viewports).
node scripts/qa-exo-v2-desktop-gpu-binary.mjs
export EXO_DESKTOP_SWIFT_SOURCE=integrations/clothcraft/macos/EXOClothCraftWorkspaceV2.swift
if [[ "${EXO_BUILD_STAGING:-0}" == 1 ]]; then
  # Cargo can regenerate gigabytes of disposed compiler intermediates. Refuse
  # to begin the Vite/full app stage if its scratch has exhausted safe space.
  STAGING_AFTER_CARGO_KIB="$(df -Pk "$ROOT" | awk 'END {print $4}')"
  if (( STAGING_AFTER_CARGO_KIB < 2097152 )); then
    echo "EXO_STAGING_AFTER_CARGO_HEADROOM_REFUSED: have ${STAGING_AFTER_CARGO_KIB} KiB" >&2
    exit 17
  fi
  export EXO_BUILD_BRIDGE_URL=http://127.0.0.1:5485
else
  export EXO_BUILD_BRIDGE_URL=http://127.0.0.1:5385
fi
bash integrations/clothcraft/macos/build.sh
if [[ "${EXO_BUILD_STAGING:-0}" == 1 ]]; then
  STAGING_AFTER_WEB_KIB="$(df -Pk "$ROOT" | awk 'END {print $4}')"
  if (( STAGING_AFTER_WEB_KIB < 524288 )); then
    echo "EXO_STAGING_AFTER_WEB_HEADROOM_REFUSED: have ${STAGING_AFTER_WEB_KIB} KiB" >&2
    exit 18
  fi
  node integrations/clothcraft/macos/v2-source-freeze-20261030.mjs --verify "$EXO_CANDIDATE_SOURCE_FENCE"
  /usr/libexec/PlistBuddy -c 'Set :CFBundleIdentifier com.mikristian.exo.clothcraft.workspace.v2.candidate' "$EXO_DESKTOP_DEST/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c 'Set :CFBundleDisplayName EXO ClothCraft V2 Candidate' "$EXO_DESKTOP_DEST/Contents/Info.plist"
  if [[ -n "${EXO_STAGING_SUPPORT_NAME:-}" ]]; then
    /usr/libexec/PlistBuddy -c "Add :EXOStagingSupportName string $EXO_STAGING_SUPPORT_NAME" \
      "$EXO_DESKTOP_DEST/Contents/Info.plist"
  fi
else
  /usr/libexec/PlistBuddy -c 'Set :CFBundleIdentifier com.mikristian.exo.clothcraft.workspace.v2' "$EXO_DESKTOP_DEST/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c 'Set :CFBundleDisplayName EXO ClothCraft Studio V2' "$EXO_DESKTOP_DEST/Contents/Info.plist"
fi
/usr/libexec/PlistBuddy -c 'Set :CFBundleShortVersionString 0.3.0' "$EXO_DESKTOP_DEST/Contents/Info.plist"
node integrations/clothcraft/runtime-provenance.mjs "$EXO_DESKTOP_DEST/Contents/Resources"
/usr/bin/codesign --force --deep --sign - "$EXO_DESKTOP_DEST"
/usr/bin/codesign --verify --deep --strict "$EXO_DESKTOP_DEST"
node integrations/clothcraft/runtime-provenance.mjs --verify "$EXO_DESKTOP_DEST/Contents/Resources"
if [[ "${EXO_BUILD_STAGING:-0}" == 1 && "${EXO_STRICT_RELEASE_MODE:-0}" == 1 ]]; then
  node integrations/clothcraft/macos/v2-release-abi-gate-20261030.mjs \
    "$EXO_DESKTOP_DEST" "$EXO_REVIEWED_RELEASE_IDENTITY" --offline
fi
if [[ "${EXO_BUILD_STAGING:-0}" == 1 ]]; then
  node integrations/clothcraft/macos/v2-source-freeze-20261030.mjs --verify "$EXO_CANDIDATE_SOURCE_FENCE"
fi
