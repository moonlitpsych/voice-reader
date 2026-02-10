import Foundation
import SwiftData

enum SharedModelContainer {
    /// URL for the SwiftData store inside the shared App Group container.
    /// Falls back to the default app container if the group isn't available.
    static var storeURL: URL {
        if let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: AppGroupConstants.suiteName
        ) {
            return containerURL.appendingPathComponent("VoiceReader.store")
        }
        // Fallback — will work in simulator and if App Group isn't configured yet
        return URL.applicationSupportDirectory.appendingPathComponent("VoiceReader.store")
    }
}
