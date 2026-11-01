import AppKit
import CryptoKit
import Foundation
import WebKit

/// Native AppKit application window. Its interface and tools are bundled inside
/// the signed app, not opened in Safari, Chrome, or an external browser window.
final class EXOClothCraftApp: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKDownloadDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var processes: [Process] = []
    private var stagingWatchdog: Process?
    private var startupAttempts = 0
    // Explicit opt-in for a separately bundled staging app. The normal signed
    // installation keeps its original ports and Application Support identity.
    #if EXO_V2_STAGED
    // Candidate app stays isolated even when launched from Finder, which does
    // not inherit a Terminal-only EXO_V2_STAGING environment variable.
    private let staging = true
    #else
    private let staging = ProcessInfo.processInfo.environment["EXO_V2_STAGING"] == "1"
    #endif
    private var bridgePort: Int { staging ? 5485 : 5385 }
    private var webPort: Int { staging ? 5486 : 5386 }
    private var supportName: String {
        guard staging else { return "EXO-ClothCraft-Studio-V2" }
        // Staged candidates must not inherit the previous candidate's
        // saved garment, auth token or cached Node. A signed plist controls
        // this namespace even when launched from Finder.
        if let configured = Bundle.main.object(forInfoDictionaryKey: "EXOStagingSupportName") as? String,
           configured.range(of: "^EXO-ClothCraft-Studio-V2-Staging-[A-Za-z0-9-]{1,48}$",
                            options: .regularExpression) != nil {
            return configured
        }
        return "EXO-ClothCraft-Studio-V2-Staging"
    }
    private var pageURL: URL { URL(string: "http://127.0.0.1:\(webPort)/?desktop=1&engine=clothcraft")! }
    private var bridgeHealthURL: URL { URL(string: "http://127.0.0.1:\(bridgePort)/health")! }
    // The resource manifest is created and verified before the AppKit bundle
    // is signed. Match the running Node bridge's independently verified
    // identity to the manifest inside *this* signed app, not merely to a
    // generic localhost health response that happens to return HTTP 200.
    private var bundledRuntimeIdentity: String? {
        guard let resourceURL = Bundle.main.resourceURL,
              let bytes = try? Data(contentsOf: resourceURL.appendingPathComponent("runtime-provenance.json")),
              let manifest = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any],
              (manifest["schema"] as? String) == "exo.desktop.runtime-provenance.v3",
              let identity = manifest["identity"] as? String,
              identity.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { return nil }
        return identity
    }
    private var supportRoot: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/\(supportName)", isDirectory: true)
    }
    private var logsRoot: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/\(supportName)", isDirectory: true)
    }
    private var startupLabel: NSTextField!
    private var logs: FileHandle?
    // Fresh secret shared only by this WKWebView and its child bridge process.
    private let workspaceToken = UUID().uuidString + UUID().uuidString
    private var workspaceTokenIdentity: String {
        SHA256.hash(data: Data(workspaceToken.utf8))
            .map { String(format: "%02x", $0) }.joined()
    }

    private func traceStartup(_ message: String) {
        let directory = logsRoot
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let file = directory.appendingPathComponent("startup-trace.log")
        if !FileManager.default.fileExists(atPath: file.path) {
            FileManager.default.createFile(atPath: file.path, contents: Data())
        }
        if let handle = try? FileHandle(forWritingTo: file) {
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: Data("\(Date()) \(message)\n".utf8))
            try? handle.close()
        }
    }

    private func executableSHA256(_ url: URL) throws -> String {
        let stream = try FileHandle(forReadingFrom: url)
        defer { try? stream.close() }
        var hash = SHA256()
        while let chunk = try stream.read(upToCount: 1024 * 1024), !chunk.isEmpty {
            hash.update(data: chunk)
        }
        return hash.finalize().map { String(format: "%02x", $0) }.joined()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        traceStartup("applicationDidFinishLaunching")
        NSApp.setActivationPolicy(.regular)
        installMenu()
        window = NSWindow(contentRect: NSRect(x: 70, y: 60, width: 1510, height: 965),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "EXO ClothCraft Studio V2"
        window.minSize = NSSize(width: 970, height: 650)
        window.center()
        NotificationCenter.default.addObserver(self, selector: #selector(didExitStudioFullscreen(_:)),
                                               name: NSWindow.didExitFullScreenNotification, object: window)

        let root = NSView(frame: window.contentView!.bounds)
        root.autoresizingMask = [.width, .height]
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor(calibratedWhite: 0.10, alpha: 1).cgColor
        window.contentView = root

        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.websiteDataStore = staging ? .nonPersistent() : .default()
        configuration.userContentController.add(self, name: "exoStudioFullscreen")
        configuration.userContentController.addUserScript(WKUserScript(
            source: "window.__EXO_WORKSPACE_TOKEN__ = '\(workspaceToken)';",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.underPageBackgroundColor = NSColor(calibratedWhite: 0.10, alpha: 1)
        if #available(macOS 13.3, *) { webView.isInspectable = true }
        root.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: root.topAnchor),
            webView.bottomAnchor.constraint(equalTo: root.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
        ])
        startupLabel = NSTextField(labelWithString: "Starting EXO ClothCraft Studio V2…")
        startupLabel.textColor = .white
        startupLabel.font = .systemFont(ofSize: 19, weight: .medium)
        startupLabel.alignment = .center
        startupLabel.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(startupLabel)
        NSLayoutConstraint.activate([
            startupLabel.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            startupLabel.centerYAnchor.constraint(equalTo: root.centerYAnchor),
        ])

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        traceStartup("window prepared; starting services")
        do {
            try startServices()
            traceStartup("services spawned; awaiting web page")
            awaitPage()
        } catch {
            traceStartup("startup error: \(error.localizedDescription)")
            startupLabel.stringValue = "Could not start local ClothCraft services: \(error.localizedDescription)"
            NSLog("EXO startup error: %@", error.localizedDescription)
        }
    }

    private func startServices() throws {
        guard let resources = Bundle.main.resourceURL else {
            throw NSError(domain: "EXO", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "App resources are missing"])
        }
        let bundledNode = resources.appendingPathComponent("bin/node")
        // Some macOS installations terminate a signed Node executable when it
        // lives inside this app's Resources directory (SIGKILL/137), even though
        // that same official Node binary and signature run correctly elsewhere.
        // Clone our bundled runtime to user Application Support once, retaining
        // the Node Foundation signature and keeping the app fully offline.
        let runtimeFolder = supportRoot.appendingPathComponent("Runtime", isDirectory: true)
        try FileManager.default.createDirectory(at: runtimeFolder, withIntermediateDirectories: true)
        let node = runtimeFolder.appendingPathComponent("node")
        let sourceType = try bundledNode.resourceValues(forKeys: [.isSymbolicLinkKey, .isRegularFileKey])
        guard sourceType.isRegularFile == true && sourceType.isSymbolicLink != true else {
            throw NSError(domain: "EXO", code: 4,
                userInfo: [NSLocalizedDescriptionKey: "Bundled Node executable must be a real signed resource file"])
        }
        // File size and modification time are not a trust boundary: an older
        // or replaced cached Node binary could match both while running with
        // the app's private workspace token. Pin its bytes to the signed
        // bundled executable on every launch, without loading it all into RAM.
        let bundledIdentity = try executableSHA256(bundledNode)
        let existingType = try? node.resourceValues(forKeys: [.isSymbolicLinkKey, .isRegularFileKey])
        let trustedCachedNode = existingType?.isRegularFile == true &&
            existingType?.isSymbolicLink != true &&
            (try? executableSHA256(node)) == bundledIdentity
        if !trustedCachedNode {
            // Same-volume exclusive copy+rename is an atomic cache switch.
            // Never unlink a healthy previous runtime before the full signed
            // source has been copied and verified.
            let stagedNode = runtimeFolder.appendingPathComponent("node.pending-\(UUID().uuidString)")
            do {
                try FileManager.default.copyItem(at: bundledNode, to: stagedNode)
                guard try executableSHA256(stagedNode) == bundledIdentity else {
                    throw NSError(domain: "EXO", code: 3,
                        userInfo: [NSLocalizedDescriptionKey: "Cached Node copy has a mismatched SHA-256"])
                }
                guard rename(stagedNode.path, node.path) == 0 else {
                    throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno),
                        userInfo: [NSLocalizedDescriptionKey: "Atomic Node runtime replacement failed"])
                }
            } catch {
                try? FileManager.default.removeItem(at: stagedNode)
                throw error
            }
        }
        let scripts = resources.appendingPathComponent("integrations/clothcraft")
        let clothCraft = resources.appendingPathComponent("research/oss/clothcraft")
        let template = clothCraft.appendingPathComponent("target/debug/cloth-template")
        let fitting = clothCraft.appendingPathComponent("target/debug/cloth-fit")
        let native = resources.appendingPathComponent("native_cpp/build-cmake/garment_cad_cli")
        let rustStaticHost = scripts.appendingPathComponent("rust-static-host/target/debug/exo-rust-static-host")
        // Keep this list in sync with the server's local imports. An earlier
        // V2 bundle omitted agent-api.mjs; the window opened but its project
        // service crashed with ERR_MODULE_NOT_FOUND before a garment loaded.
        for required in [node, template, fitting, native, rustStaticHost,
                         resources.appendingPathComponent("web/index.html"),
                         scripts.appendingPathComponent("server.mjs"),
                         scripts.appendingPathComponent("workspace.mjs"),
                         scripts.appendingPathComponent("workspace-auth.mjs"),
                         scripts.appendingPathComponent("agent-api.mjs")] {
            if !FileManager.default.fileExists(atPath: required.path) {
                throw NSError(domain: "EXO", code: 2,
                              userInfo: [NSLocalizedDescriptionKey: "Missing bundled resource: \(required.lastPathComponent)"])
            }
        }
        let logsDir = logsRoot
        try FileManager.default.createDirectory(at: logsDir, withIntermediateDirectories: true)
        let outputsDir = supportRoot.appendingPathComponent("Output", isDirectory: true)
        try FileManager.default.createDirectory(at: outputsDir, withIntermediateDirectories: true)
        let log = logsDir.appendingPathComponent("desktop.log")
        if !FileManager.default.fileExists(atPath: log.path) {
            FileManager.default.createFile(atPath: log.path, contents: Data())
        }
        logs = try FileHandle(forWritingTo: log)
        try logs?.seekToEnd()
        let configurations: [(URL, [String], [String: String])] = [
            (rustStaticHost, ["--web-root", resources.appendingPathComponent("web").path], ["EXO_WEB_PORT": String(webPort)]),
            (node, [scripts.appendingPathComponent("server.mjs").path], ["EXO_CLOTHCRAFT_PORT": String(bridgePort)]),
        ]
        for (executable, arguments, extra) in configurations {
            let p = Process()
            p.executableURL = executable
            p.arguments = arguments
            p.currentDirectoryURL = resources
            var environment = ProcessInfo.processInfo.environment
            environment["EXO_CLOTHCRAFT_REPO"] = clothCraft.path
            environment["EXO_CLOTHCRAFT_TEMPLATE_BIN"] = template.path
            environment["EXO_CLOTHCRAFT_FIT_BIN"] = fitting.path
            environment["EXO_NATIVE_CLI"] = native.path
            environment["EXO_CLOTHCRAFT_OUTPUT_DIR"] = outputsDir.path
            environment["EXO_CLOTHCRAFT_GPU"] = "1"
            environment["EXO_WORKSPACE_TOKEN"] = workspaceToken
            environment["EXO_CLOTHCRAFT_AVATAR_THOMAS_OBJ"] = resources.appendingPathComponent("collision-avatars/thomas-body.obj").path
            environment["EXO_CLOTHCRAFT_AVATAR_MAKEHUMAN_OBJ"] = resources.appendingPathComponent("collision-avatars/makehuman-body.obj").path
            extra.forEach { environment[$0.key] = $0.value }
            p.environment = environment
            p.standardOutput = logs
            p.standardError = logs
            try p.run()
            processes.append(p)
        }
        if staging {
            do { try startStagingWatchdog() }
            catch {
                processes.forEach { if $0.isRunning { $0.terminate() } }
                throw error
            }
        }
    }

    // AppKit termination hooks do not run after SIGKILL, SIGTERM's default
    // disposition, or a native crash. A separate process watches its actual
    // parent PID so the two staging servers do not survive those exits.
    // Only stage this supervisor; production keeps its existing lifecycle.
    private func startStagingWatchdog() throws {
        let shell = Process()
        shell.executableURL = URL(fileURLWithPath: "/bin/sh")
        shell.arguments = ["-c", Self.stagingWatchdogScript, "exo-staging-watchdog",
                           String(ProcessInfo.processInfo.processIdentifier)] + processes.map { String($0.processIdentifier) }
        shell.standardOutput = logs
        shell.standardError = logs
        try shell.run()
        stagingWatchdog = shell
        traceStartup("staging watchdog pid=\(shell.processIdentifier) supervising \(processes.map { $0.processIdentifier })")
    }

    // Keep this POSIX shell source self-contained for the disposable lifecycle
    // fixture, which exercises the exact text embedded in the signed launcher.
    private static let stagingWatchdogScript = #"""
    parent="$1"
    shift
    # Capture birth identities before the AppKit parent disappears. Killing
    # an old numeric PID without rechecking would risk terminating an
    # unrelated process if macOS recycled that PID during the grace period.
    birth() {
      ps -o lstart= -p "$1" 2>/dev/null | tr -s ' ' | sed 's/^ //;s/ $//'
    }
    children=""
    for child do
      started=$(birth "$child")
      if [ -n "$started" ]; then
        children="$children
    $child|$started"
      fi
    done
    kill_owned() {
      signals="$1"
      entries="$2"
      printf '%s\n' "$entries" | while IFS='|' read -r pid started; do
        [ -n "$pid" ] && [ -n "$started" ] || continue
        current=$(birth "$pid")
        if [ -n "$current" ] && [ "$current" = "$started" ]; then
          kill -"$signals" "$pid" 2>/dev/null || :
        fi
      done
    }
    # Remember the native Rust descendants *while* their Node parent is
    # alive. A failed bridge may exit long before AppKit, reparenting its
    # exo-session so that a one-time pgrep -P at shutdown misses it.
    tracked_descendants=""
    capture_descendants() {
      for child do
        registered=$(printf '%s\n' "$children" | awk -F'|' -v id="$child" '$1==id {print $2;exit}')
        [ -n "$registered" ] && [ "$(birth "$child")" = "$registered" ] || continue
        for descendant in $(pgrep -P "$child" 2>/dev/null); do
          owner=$(ps -o ppid= -p "$descendant" 2>/dev/null | tr -d '[:space:]')
          [ "$owner" = "$child" ] || continue
          started=$(birth "$descendant")
          [ -n "$started" ] || continue
          entry="$descendant|$started"
          if ! printf '%s\n' "$tracked_descendants" | grep -Fqx "$entry"; then
            tracked_descendants="$tracked_descendants
    $entry"
          fi
        done
      done
    }
    while :; do
      capture_descendants "$@"
      actual=$(ps -o ppid= -p "$$" 2>/dev/null | tr -d '[:space:]')
      if [ "$actual" != "$parent" ]; then
        kill_owned TERM "$tracked_descendants"
        kill_owned TERM "$children"
        sleep 1
        kill_owned KILL "$tracked_descendants"
        kill_owned KILL "$children"
        exit 0
      fi
      sleep 0.25
    done
    """#

    private func awaitPage() {
        startupAttempts += 1
        let request = URLRequest(url: pageURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 2)
        URLSession.shared.dataTask(with: request) { [weak self] _, response, _ in
            guard let self else { return }
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                self.finishStartupProbe(false)
                return
            }
            // A 200 from the Rust static host alone does not mean the editor
            // can load/save garments. Require the separately launched Node
            // bridge to answer its own health contract before mounting React.
            let bridgeRequest = URLRequest(url: self.bridgeHealthURL,
                                           cachePolicy: .reloadIgnoringLocalCacheData,
                                           timeoutInterval: 2)
            URLSession.shared.dataTask(with: bridgeRequest) { [weak self] bytes, reply, _ in
                guard let self else { return }
                guard let expectedBundledIdentity = self.bundledRuntimeIdentity else {
                    self.finishStartupProbe(false)
                    return
                }
                let payload = bytes.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
                let signedResources = payload?["runtimeProvenance"] as? [String: Any]
                let nativeSession = payload?["nativeSession"] as? [String: Any]
                let trustedBridge = (reply as? HTTPURLResponse)?.statusCode == 200 &&
                    (payload?["ok"] as? Bool) == true &&
                    (payload?["backend"] as? String) == "clothcraft-exo-local" &&
                    (payload?["workspaceBridgeProtocol"] as? String) == "exo.workspace.bridge.v2" &&
                    (payload?["workspaceAuthIdentity"] as? String) == self.workspaceTokenIdentity &&
                    (signedResources?["verified"] as? Bool) == true &&
                    (signedResources?["identity"] as? String) == expectedBundledIdentity
                guard trustedBridge, (payload?["nativeReady"] as? Bool) == true else {
                    self.finishStartupProbe(false)
                    return
                }
                // The bridge starts with loaded=false. Rust becomes loaded
                // only after the FIRST authenticated workspace snapshot.
                // Requiring loaded=true before React can mount deadlocks the
                // very first launch of a clean signed app.
                if (nativeSession?["loaded"] as? Bool) == true &&
                   (nativeSession?["nativeProcessRunning"] as? Bool) == true {
                    self.finishStartupProbe(true)
                } else {
                    self.bootstrapNativeWorkspace()
                }
            }.resume()
        }.resume()
    }

    private func bootstrapNativeWorkspace() {
        var request = URLRequest(url: URL(string: "http://127.0.0.1:\(bridgePort)/workspace")!,
                                 cachePolicy: .reloadIgnoringLocalCacheData,
                                 timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(workspaceToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = Data("{\"op\":\"snapshot\"}".utf8)
        URLSession.shared.dataTask(with: request) { [weak self] data, response, _ in
            guard let self else { return }
            let result = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
            let snapshot = result?["data"] as? [String: Any]
            let authorizedNative = (response as? HTTPURLResponse)?.statusCode == 200 &&
                (result?["ok"] as? Bool) == true &&
                snapshot?["template"] != nil &&
                snapshot?["revision"] != nil
            self.finishStartupProbe(authorizedNative)
        }.resume()
    }

    private func finishStartupProbe(_ ready: Bool) {
        DispatchQueue.main.async {
            // A previously launched or hostile localhost service could answer
            // on the expected port while our bundled Rust asset host failed to
            // bind. Do not mount a secret-injected WKWebView unless BOTH child
            // processes started by this exact AppKit instance are still alive.
            let childrenAlive = self.processes.count == 2 &&
                self.processes.allSatisfy { $0.isRunning }
            if ready && childrenAlive {
                self.webView.load(URLRequest(url: self.pageURL))
            } else if self.startupAttempts < 80 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { self.awaitPage() }
            } else {
                self.startupLabel.stringValue = "EXO web or native workspace service failed to start; check \(self.logsRoot.path)/desktop.log"
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        startupLabel.removeFromSuperview()
        window.title = "EXO ClothCraft Studio V2"
    }

    @available(macOS 12.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        // Camera capture is requested by Camera Fabric Hand after an explicit
        // user click. Never grant microphone access or other web origins.
        let localApp = origin.protocol == "http" && origin.host == "127.0.0.1" && origin.port == webPort
        decisionHandler(localApp && type == .camera ? .grant : .deny)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // The main-frame WKUserScript contains a per-launch workspace bearer.
        // Never load another web origin in that same frame: the user script
        // would otherwise grant an unrelated site the local garment capability.
        guard let destination = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        let localPage = destination.scheme == "http" &&
            destination.host == "127.0.0.1" && destination.port == webPort
        let localBlob = destination.scheme == "blob" &&
            destination.absoluteString.hasPrefix("blob:http://127.0.0.1:\(webPort)/")
        if navigationAction.shouldPerformDownload {
            decisionHandler(localPage || localBlob ? .download : .cancel)
            return
        }
        if navigationAction.targetFrame?.isMainFrame == true ||
           navigationAction.targetFrame == nil {
            decisionHandler(localPage ? .allow : .cancel)
            return
        }
        // Embedded navigations remain same-origin as the bundled application.
        decisionHandler(localPage ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let folder = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Downloads", isDirectory: true)
        let name = (suggestedFilename as NSString).lastPathComponent
        let base = URL(fileURLWithPath: name).deletingPathExtension().lastPathComponent
        let ext = URL(fileURLWithPath: name).pathExtension
        var candidate = folder.appendingPathComponent(name)
        var i = 1
        while FileManager.default.fileExists(atPath: candidate.path) {
            let variant = ext.isEmpty ? "\(base)-\(i)" : "\(base)-\(i).\(ext)"
            candidate = folder.appendingPathComponent(variant)
            i += 1
        }
        completionHandler(candidate)
    }

    @objc private func reloadWorkspace(_ sender: Any?) {
        webView?.reload()
    }

    // Only the bundled localhost UI may request native window fullscreen.
    // The separate 2D editor and saved garment are not changed by this toggle.
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "exoStudioFullscreen", message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.host == "127.0.0.1",
              message.frameInfo.securityOrigin.port == webPort,
              let action = message.body as? String,
              action == "enter" || action == "exit" else { return }
        DispatchQueue.main.async { [weak self] in
            guard let window = self?.window else { return }
            let isFullscreen = window.styleMask.contains(.fullScreen)
            if (action == "enter" && !isFullscreen) || (action == "exit" && isFullscreen) {
                window.toggleFullScreen(nil)
            }
        }
    }

    @objc private func didExitStudioFullscreen(_ notification: Notification) {
        webView?.evaluateJavaScript("window.dispatchEvent(new Event('exo-native-3d-fullscreen-exited'))", completionHandler: nil)
    }

    private func installMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu(title: "EXO ClothCraft Studio V2")
        appMenu.addItem(withTitle: "About EXO ClothCraft Studio V2", action: #selector(NSApp.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit EXO ClothCraft Studio V2", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)
        let viewItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(withTitle: "Reload Workspace", action: #selector(reloadWorkspace(_:)), keyEquivalent: "r")
        viewItem.submenu = viewMenu
        main.addItem(viewItem)
        NSApp.mainMenu = main
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "exoStudioFullscreen")
        NotificationCenter.default.removeObserver(self)
        processes.forEach { process in if process.isRunning { process.terminate() } }
        // The watchdog exits by observing its parent disappear; it also handles
        // abnormal termination when this callback never runs.
        try? logs?.close()
    }
}

@main
enum EXOClothCraftEntry {
    static func main() {
        let app = NSApplication.shared
        let delegate = EXOClothCraftApp()
        app.delegate = delegate
        // NSApplication.delegate is weak. Keep our delegate strongly alive
        // for the entire event loop, including optimized (-O) release builds.
        // Otherwise the window can restore without startup services running.
        withExtendedLifetime(delegate) { app.run() }
    }
}
