#!/usr/bin/env swift
// Native AppKit/System Events accessibility acceptance for the disposable signed EXO staging app.
// Usage: swift this-file.swift <staging-pid> <absolute-staging-app-path> <staging-output-json> [--interact]
// Without --interact this is a read-only preflight; no app is launched.
import AppKit
import ApplicationServices
import Foundation

struct Failure: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}
func require(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() { throw Failure(message) }
}
func attribute(_ element: AXUIElement, _ name: String) -> AnyObject? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
    return value
}
func string(_ element: AXUIElement, _ name: String) -> String {
    attribute(element, name) as? String ?? ""
}
func descendants(_ root: AXUIElement, limit: Int = 2400) -> [AXUIElement] {
    var pending = [root]
    var all = [AXUIElement]()
    var index = 0
    while index < pending.count && all.count < limit {
        let next = pending[index]
        index += 1
        all.append(next)
        if let children = attribute(next, kAXChildrenAttribute as String) as? [AXUIElement] {
            pending.append(contentsOf: children)
        }
    }
    return all
}
func matches(_ element: AXUIElement, _ needle: String) -> Bool {
    [kAXTitleAttribute as String, kAXDescriptionAttribute as String, kAXHelpAttribute as String,
     kAXValueAttribute as String].contains { string(element, $0).localizedCaseInsensitiveContains(needle) }
}
func count(_ elements: [AXUIElement], _ needle: String) -> Int {
    elements.filter { matches($0, needle) }.count
}
func press(_ root: AXUIElement, label: String, requireExact: Bool = false) throws {
    let candidates = descendants(root).filter { matches($0, label) &&
        ["AXButton", "AXMenuItem", "AXPopUpButton"].contains(string($0, kAXRoleAttribute as String)) }
    let exact = candidates.filter { candidate in
        [kAXTitleAttribute as String, kAXDescriptionAttribute as String].contains { name in
            string(candidate, name).localizedCaseInsensitiveCompare(label) == .orderedSame
        }
    }
    let actionable = requireExact ? exact : exact.count == 1 ? exact : candidates
    try require(actionable.count == 1, "Expected one AX button '\(label)', found \(actionable.count)")
    let code = AXUIElementPerformAction(actionable[0], kAXPressAction as CFString)
    try require(code == .success, "AXPress \(label) returned \(code.rawValue)")
}
func delay() { Thread.sleep(forTimeInterval: 0.75) }
func write(_ value: [String: Any], at url: URL) {
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys]) else { return }
    try? data.write(to: url, options: .atomic)
}

let arguments = CommandLine.arguments
guard arguments.count == 4 || (arguments.count == 5 && arguments[4] == "--interact") else {
    fputs("Usage: swift qa_signed_wkwebview_ax_20261030.swift PID APP_PATH OUTPUT_JSON [--interact]\n", stderr)
    exit(2)
}
let interactive = arguments.count == 5
let pid = Int32(arguments[1]) ?? -1
let cwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
let app = URL(fileURLWithPath: arguments[2], relativeTo: cwd).standardizedFileURL.resolvingSymlinksInPath()
let output = URL(fileURLWithPath: arguments[3], relativeTo: cwd).standardizedFileURL.resolvingSymlinksInPath()
let repo = cwd.standardizedFileURL.resolvingSymlinksInPath()
let stageDirectory = repo.appendingPathComponent("integrations/clothcraft/output/release-candidates").standardizedFileURL.resolvingSymlinksInPath()
var report: [String: Any] = ["pass": false, "runtime": "native-appkit-ax-wkwebview",
                              "pid": pid, "interactionPerformed": false, "printScaleVerified": false]
do {
    try require(pid > 0, "An explicit positive staging PID is required")
    try require(FileManager.default.fileExists(atPath: repo.appendingPathComponent("integrations/clothcraft/macos/tests/qa_signed_wkwebview_ax_20261030.swift").path), "Run from repository root")
    try require(app.deletingLastPathComponent().path == stageDirectory.path, "App must be directly inside staging release-candidates")
    try require(app.pathExtension == "app" && app.lastPathComponent.contains("Candidate"), "Candidate .app required")
    try require(output.path.hasPrefix(stageDirectory.path + "/") && output.pathExtension == "json", "Output must be staging-only JSON")
    try require(output.path != app.path, "Output may not overwrite app")
    let info = NSDictionary(contentsOf: app.appendingPathComponent("Contents/Info.plist"))
    let bundleID = info?["CFBundleIdentifier"] as? String ?? ""
    try require(bundleID == "com.mikristian.exo.clothcraft.workspace.v2.candidate", "Staging candidate bundle identifier mismatch: \(bundleID)")
    guard let running = NSRunningApplication(processIdentifier: pid) else { throw Failure("Staging PID is not running") }
    try require(running.bundleIdentifier == bundleID, "Running PID bundle ID mismatch")
    try require(running.bundleURL?.standardizedFileURL.resolvingSymlinksInPath().path == app.path, "PID executable bundle path differs from specified candidate")
    let signing = Process()
    signing.executableURL = URL(fileURLWithPath: "/usr/bin/codesign")
    signing.arguments = ["--verify", "--strict", "--deep", app.path]
    signing.standardOutput = Pipe()
    signing.standardError = Pipe()
    try signing.run()
    signing.waitUntilExit()
    try require(signing.terminationStatus == 0, "Candidate code signature invalid")
    try require(AXIsProcessTrusted(), "Accessibility permission missing for this Swift/terminal host")
    let cgWindows = (CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]]) ?? []
    let stagingWindows = cgWindows.filter { ($0[kCGWindowOwnerPID as String] as? Int32) == pid && ($0[kCGWindowLayer as String] as? Int) == 0 }
    report["cgOnscreenStagingWindows"] = stagingWindows.count
    try require(!stagingWindows.isEmpty, "No onscreen CGWindow belonging to exact staging PID")
    let axApp = AXUIElementCreateApplication(pid)
    // AXApplication descendants include an enormous and asynchronously
    // changing menu tree. On cold WKWebView launches that tree has exhausted
    // the 9k-node traversal budget *before* reaching the single AXWindow.
    // Request the target process's own AXWindows directly and wait for its
    // true WKWebView child rather than interpreting the partial tree as no UI.
    AXUIElementSetMessagingTimeout(axApp, 2.0)
    var windows = [AXUIElement]()
    var all = [AXUIElement]()
    var ready = false
    var lastWindowError = AXError.success
    var focusedWindowError = AXError.success
    for attempt in 1...8 {
        var windowValue: CFTypeRef?
        lastWindowError = AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &windowValue)
        let rawWindows = windowValue as? [AXUIElement] ?? []
        report["lastAXWindowRawCount"] = rawWindows.count
        report["lastAXWindowRoles"] = rawWindows.map { string($0, kAXRoleAttribute as String) }
        windows = rawWindows.filter {
            string($0, kAXRoleAttribute as String) == "AXWindow"
        }
        if windows.isEmpty {
            var focusValue: CFTypeRef?
            focusedWindowError = AXUIElementCopyAttributeValue(axApp, kAXFocusedWindowAttribute as CFString, &focusValue)
            if let value = focusValue, CFGetTypeID(value) == AXUIElementGetTypeID() {
                let focused = unsafeBitCast(value, to: AXUIElement.self)
                if string(focused, kAXRoleAttribute as String) == "AXWindow" {
                    windows = [focused]
                    report["axWindowViaFocusFallback"] = true
                }
            }
        }
        if windows.count == 1 {
            AXUIElementSetMessagingTimeout(windows[0], 2.0)
            all = descendants(windows[0], limit: 2400)
            if all.contains(where: { string($0, kAXRoleAttribute as String) == "AXWebArea" }) {
                report["axReadinessAttempt"] = attempt
                ready = true
                break
            }
        }
        Thread.sleep(forTimeInterval: 0.25)
    }
    report["directAXWindowCount"] = windows.count
    report["lastAXWindowsError"] = lastWindowError.rawValue
    report["lastAXFocusedWindowError"] = focusedWindowError.rawValue
    report["axTreeLimitReached"] = all.count == 2400
    try require(ready, "Signed WKWebView AX window and web area not both ready in bounded AX query")
    let windowCount = all.filter { string($0, kAXRoleAttribute as String) == "AXWindow" }.count
    var roleCounts: [String: Int] = [:]
    for node in all { roleCounts[string(node, kAXRoleAttribute as String), default: 0] += 1 }
    report["axElementCount"] = all.count
    report["axRoles"] = roleCounts
    report["windowTitles"] = all.filter { string($0, kAXRoleAttribute as String) == "AXWindow" }.map { string($0, kAXTitleAttribute as String) }
    try require(windowCount > 0, "No accessible staging app window")
    // AXWebArea is exposed by macOS WKWebView. Browser automation or HTTP cannot satisfy this.
    let webAreas = all.filter { string($0, kAXRoleAttribute as String) == "AXWebArea" }
    try require(!webAreas.isEmpty, "No native WKWebView AXWebArea exposed")
    report["nativeWebAreas"] = webAreas.count
    report["nativeWindows"] = windowCount
    report["initial2DControls"] = count(all, "2D")
    report["initialPrintControls"] = count(all, "Print Layout")
    report["actionableModeCandidates"] = all.filter { candidate in
        ["AXButton", "AXMenuItem", "AXPopUpButton"].contains(string(candidate, kAXRoleAttribute as String)) &&
        ["simulat", "workspace", "print", "mode"].contains(where: { needle in matches(candidate, needle) })
    }.prefix(35).map {
        ["role": string($0, kAXRoleAttribute as String),
         "title": string($0, kAXTitleAttribute as String),
         "description": string($0, kAXDescriptionAttribute as String),
         "help": string($0, kAXHelpAttribute as String)]
    }
    try require(count(all, "2D") > 0, "No 2D control exposed in native WKWebView")
    try require(count(all, "Print Layout") > 0, "No Print Layout control exposed in native WKWebView")
    if interactive {
        try require(ProcessInfo.processInfo.environment["EXO_STAGING_DISPOSABLE_SESSION"] == "YES", "Disposable staging session confirmation missing")
        try require(ProcessInfo.processInfo.environment["EXO_STAGING_NATIVE_AX_APPROVED_PID"] == "\(pid)", "Prime must approve this exact staging PID")
        let printRegion = "Print Layout replacing 2D pattern window"
        let printProperty = "Print Layout Property Editor"
        try require(count(all, printRegion) == 0 && count(all, printProperty) == 0,
                    "Print Layout already opened: cannot prove a new native click")
        // There are two similarly named simulation popups. Only the *top*
        // menu owns the real Print Layout command; do not click the lower one.
        try press(windows[0], label: "Simulation, animation, print layout and Techpack modes", requireExact: true)
        delay()
        all = descendants(windows[0], limit: 2400)
        let menuTitle = "Simulation animation and print layout workspace modes"
        let menus = all.filter {
            string($0, kAXRoleAttribute as String) == "AXMenu" &&
            string($0, kAXTitleAttribute as String) == menuTitle
        }
        try require(menus.count == 1, "Expected exact native AXMenu after opening top flyout; found \(menus.count)")
        let directChildren = attribute(menus[0], kAXChildrenAttribute as String) as? [AXUIElement] ?? []
        let actionTitle = "Print Layout · Fabric rolls"
        let actions = directChildren.filter {
            string($0, kAXRoleAttribute as String) == "AXMenuItem" &&
            string($0, kAXTitleAttribute as String) == actionTitle
        }
        report["openMenuPrintActionCount"] = actions.count
        try require(actions.count == 1, "Expected one exact direct AXMenuItem '\(actionTitle)', found \(actions.count)")
        try require(AXUIElementPerformAction(actions[0], kAXPressAction as CFString) == .success,
                    "Native AXPress on Print Layout menu item failed")
        delay()
        all = descendants(windows[0], limit: 2400)
        try require(count(all, printProperty) > 0 || count(all, printRegion) > 0,
                    "Native WKWebView Print Layout press did not expose a named print workspace")
        report["printWorkspaceVisible"] = true
        report["pressedExactNativeMenuItem"] = actionTitle
        // Print-preview workspace entry is validated; no system Print or factory output is invoked.
        // Another press may toggle workspace state. Stay on print preview for inspection.
        report["interactionPerformed"] = true
    }
    report["pass"] = true
} catch {
    report["error"] = String(describing: error)
}
write(report, at: output)
print(String(data: (try? JSONSerialization.data(withJSONObject: report, options: [.sortedKeys])) ?? Data(), encoding: .utf8) ?? "{}")
if report["pass"] as? Bool != true { exit(1) }
