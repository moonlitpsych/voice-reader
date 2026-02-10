import SwiftUI
import SwiftData

@main
struct VoiceReaderApp: App {
    let modelContainer: ModelContainer
    @State private var speechEngine: SpeechEngine
    @State private var speechSettings = SpeechSettings()

    init() {
        do {
            let schema = Schema([Clip.self])
            let config = ModelConfiguration(
                schema: schema,
                url: SharedModelContainer.storeURL,
                allowsSave: true
            )
            modelContainer = try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }

        let settings = SpeechSettings()
        _speechSettings = State(wrappedValue: settings)
        _speechEngine = State(wrappedValue: SpeechEngine(settings: settings))

        AudioSessionManager.shared.configure()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(speechEngine)
                .environment(speechSettings)
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
                    checkPendingSharedText()
                }
                .onAppear {
                    NowPlayingManager.shared.attach(to: speechEngine)
                }
        }
        .modelContainer(modelContainer)
    }

    private func handleIncomingURL(_ url: URL) {
        guard url.scheme == "voicereader", url.host == "read" else { return }
        checkPendingSharedText()
    }

    private func checkPendingSharedText() {
        guard let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName),
              let text = defaults.string(forKey: AppGroupConstants.pendingTextKey),
              !text.isEmpty else { return }

        // Clear it so we don't re-read
        defaults.removeObject(forKey: AppGroupConstants.pendingTextKey)

        // Post notification for the reader to pick up
        NotificationCenter.default.post(
            name: .sharedTextReceived,
            object: nil,
            userInfo: ["text": text]
        )
    }
}

extension Notification.Name {
    static let sharedTextReceived = Notification.Name("sharedTextReceived")
}
