# EXO CLO Inspector — native permission isolation

The CLO inspection task previously ran through Chat On Steroids.app → zsh → osascript/Swift. Although the user authorized Chat On Steroids, those subprocesses received macOS TCC denial code -25211 (Accessibility) and false (Screen Recording). The main Chat On Steroids package is ad-hoc signed and has no stable Apple Developer Team ID. We cannot claim that is the only reason macOS denied these requests because macOS's TCC database was not readable, but this isolated bridge removes both concerns.

## Installed implementation

The app at ~/Applications/EXO CLO Inspector.app is a real, signed native macOS application, not a browser wrapper and not a temporary terminal process. Its unique bundle identifier is com.mikristian.exo.cloinspector. Its stable developer signing identity provides a separately identifiable entry for Privacy & Security. It uses ScreenCaptureKit to capture only the CLO application window and macOS Accessibility APIs to inspect only CLO's read-only window hierarchy. No input/clicks, project edits, external networking or background monitoring. The app is an accessory one-shot process that exits after writing its report.

Reports are written with private permissions to ~/Library/Application Support/EXO-CLO-Inspector/latest-status.json. When Screen Recording has been approved, a screenshot is stored at clo-property-editor-reference.png in the same directory. Neither file is transmitted elsewhere or added to Git.

Build from this folder using EXO_INSPECTOR_SIGN_IDENTITY with a valid signing identity and build.sh. The helper is separately signed and installed and does not modify Chat On Steroids, CLO3D or EXO Studio V1/V2. Do not rebuild or re-sign an already-authorized app unless necessary; changing signing identity may invalidate macOS privacy approvals.

To run, use the macOS open command with the path ~/Applications/EXO CLO Inspector.app, then check its JSON report. For initial authorization launch with the --request-permissions argument and add **EXO CLO Inspector** (not another Chat On Steroids entry) in System Settings → Privacy & Security → Accessibility and Screen & System Audio Recording. If the OS prompts, choose Allow. Run verify.sh to recheck read-only capture and Accessibility.

### Verified result, October 16, 2026

The installed helper was signed with an available Apple Development identity (Team ID MVU66XV7GK), and both permissions are now authorized for this dedicated native app. The verification script passed with Accessibility true, Screen Recording true, one CLO window and a real 1512 × 900 image captured at the private screenshot path. The Accessibility inspector returned real CLO controls including Simulate, sewing, buttons, zippers, binding, graphics and the CLO window title. The unmodified original Chat On Steroids app may still be denied access when its shell commands inspect macOS directly; all CLO GUI inspections should use the dedicated signed helper to retain the verified approval.

Privacy consent cannot be granted programmatically by an app or an agent. The recorded result above reflects macOS reporting both permissions as authorized for the signed helper.
