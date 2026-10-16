import AppKit
import ApplicationServices
import CoreGraphics
import Foundation
import ImageIO
import ScreenCaptureKit
import UniformTypeIdentifiers

// A real launchd/LaunchServices app process, never osascript or a temporary
// Swift process. All interaction is read-only, restricted to the CLO app.
// Does not modify Chat On Steroids, CLO projects, EXO V1, or native V2 state.
struct Node: Codable {
    var role: String
    var name: String
    var value: String?
    var children: [Node]
}

struct Report: Codable {
    var version = "1.0.0"
    var generatedAt = ISO8601DateFormatter().string(from: Date())
    var identifier = Bundle.main.bundleIdentifier ?? "unknown"
    var executable = CommandLine.arguments.first ?? "unknown"
    var accessibility = false
    var screenRecording = false
    var cloPID: Int32?
    var cloWindowCount = 0
    var cloWindows: [Node] = []
    var screenshotPath: String?
    var warnings: [String] = []
}

func attribute(_ element: AXUIElement, _ key: CFString) -> AnyObject? {
    var result: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, key, &result) == .success else { return nil }
    return result
}

func stringAttribute(_ element: AXUIElement, _ key: CFString) -> String {
    guard let result = attribute(element, key) else { return "" }
    if let text = result as? String { return String(text.prefix(180)) }
    return ""
}

func scan(_ element: AXUIElement, depth: Int, budget: inout Int) -> Node {
    budget -= 1
    var node = Node(
        role: stringAttribute(element, kAXRoleAttribute as CFString),
        name: stringAttribute(element, kAXTitleAttribute as CFString),
        value: nil,
        children: []
    )
    if let value = attribute(element, kAXValueAttribute as CFString), let text = value as? String {
        node.value = String(text.prefix(180))
    }
    if depth >= 7 || budget <= 0 { return node }
    for key in [kAXChildrenAttribute as CFString] {
        if let children = attribute(element, key) as? [AXUIElement] {
            for child in children.prefix(50) where budget > 0 {
                node.children.append(scan(child, depth: depth + 1, budget: &budget))
            }
        }
    }
    return node
}

@MainActor
func captureCLO(to folder: URL, report: inout Report) async {
    guard report.screenRecording else { return }
    do {
        let list = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        let windows = list.windows.filter {
            let name = $0.owningApplication?.applicationName ?? ""
            let bundle = $0.owningApplication?.bundleIdentifier ?? ""
            return name.contains("CLO_Standalone") || bundle == "com.clo3d.security.closo"
        }
        guard let target = windows.first(where: { $0.frame.width >= 400 }) else {
            report.warnings.append("CLO screen-sharing window not found")
            return
        }
        let config = SCStreamConfiguration()
        config.width = max(1, Int(target.frame.width))
        config.height = max(1, Int(target.frame.height))
        config.showsCursor = false
        let filter = SCContentFilter(desktopIndependentWindow: target)
        let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
        let output = folder.appendingPathComponent("clo-property-editor-reference.png")
        guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else {
            report.warnings.append("Cannot create CLO PNG image destination")
            return
        }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else {
            report.warnings.append("Cannot write CLO PNG screenshot")
            return
        }
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: output.path)
        report.screenshotPath = output.path
    } catch {
        report.warnings.append("CLO screenshot failed: \(error.localizedDescription)")
    }
}

@main
struct CLOInspectorBridge {
    @MainActor static func main() async {
        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        let folder = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/EXO-CLO-Inspector", isDirectory: true)
        do { try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true) }
        catch { return }
        try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: folder.path)
        var report = Report()
        let request = CommandLine.arguments.contains("--request-permissions")
        let axPromptOptions = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: request] as CFDictionary
        report.accessibility = AXIsProcessTrustedWithOptions(axPromptOptions)
        report.screenRecording = request ? CGRequestScreenCaptureAccess() : CGPreflightScreenCaptureAccess()

        let clo = NSRunningApplication.runningApplications(withBundleIdentifier: "com.clo3d.security.closo").first
            ?? NSWorkspace.shared.runningApplications.first(where: { $0.localizedName?.contains("CLO_Standalone") ?? false })
        report.cloPID = clo?.processIdentifier
        if report.accessibility, let clo {
            let appElement = AXUIElementCreateApplication(clo.processIdentifier)
            if let windows = attribute(appElement, kAXWindowsAttribute as CFString) as? [AXUIElement] {
                report.cloWindowCount = windows.count
                var budget = 600
                for window in windows.prefix(5) where budget > 0 {
                    report.cloWindows.append(scan(window, depth: 0, budget: &budget))
                }
            } else {
                report.warnings.append("CLO Accessibility window tree unavailable")
            }
        }
        await captureCLO(to: folder, report: &report)
        let destination = folder.appendingPathComponent("latest-status.json")
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        if let data = try? encoder.encode(report) {
            try? data.write(to: destination, options: .atomic)
            try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: destination.path)
        }
        app.terminate(nil)
    }
}
