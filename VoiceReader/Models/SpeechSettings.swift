import Foundation
import Observation

@Observable
final class SpeechSettings {
    var voiceIdentifier: String {
        didSet { save() }
    }

    var speedMultiplier: Double {
        didSet { save() }
    }

    /// AVSpeechUtteranceRate is nonlinear. These values are tuned empirically.
    /// The range 0.0–1.0 maps to AVSpeechUtteranceMinimumSpeechRate...MaximumSpeechRate,
    /// but the perceptual "1x" is around 0.50, and doubling speed is only ~0.59.
    static let rateTable: [(label: String, multiplier: Double, avRate: Float)] = [
        ("0.75x", 0.75, 0.42),
        ("1x",    1.0,  0.50),
        ("1.25x", 1.25, 0.52),
        ("1.5x",  1.5,  0.545),
        ("1.75x", 1.75, 0.565),
        ("2x",    2.0,  0.59),
    ]

    var avSpeechRate: Float {
        Self.rateTable.first { $0.multiplier == speedMultiplier }?.avRate ?? 0.50
    }

    init() {
        let defaults = UserDefaults.standard
        self.voiceIdentifier = defaults.string(forKey: "voiceIdentifier")
            ?? VoiceMapping.defaultVoiceIdentifier
        self.speedMultiplier = defaults.double(forKey: "speedMultiplier").nonZero ?? 1.0
    }

    private func save() {
        let defaults = UserDefaults.standard
        defaults.set(voiceIdentifier, forKey: "voiceIdentifier")
        defaults.set(speedMultiplier, forKey: "speedMultiplier")
    }
}

private extension Double {
    var nonZero: Double? {
        self == 0 ? nil : self
    }
}
