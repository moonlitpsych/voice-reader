import AVFoundation

enum VoiceMapping {
    struct VoiceOption: Identifiable {
        let id: String // AVSpeechSynthesisVoice.identifier
        let name: String
        let quality: AVSpeechSynthesisVoice.Quality
        let language: String

        var qualityLabel: String {
            switch quality {
            case .premium: return "Premium"
            case .enhanced: return "Enhanced"
            default: return "Default"
            }
        }
    }

    /// All available English voices, sorted: premium > enhanced > default, then alphabetical.
    static var availableVoices: [VoiceOption] {
        AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix("en") }
            .sorted { lhs, rhs in
                if lhs.quality != rhs.quality {
                    return lhs.quality.rawValue > rhs.quality.rawValue
                }
                return lhs.name < rhs.name
            }
            .map { voice in
                VoiceOption(
                    id: voice.identifier,
                    name: voice.name,
                    quality: voice.quality,
                    language: voice.language
                )
            }
    }

    /// Best default voice: first premium, then enhanced, then any English voice.
    static var defaultVoiceIdentifier: String {
        let voices = AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix("en-US") }
            .sorted { $0.quality.rawValue > $1.quality.rawValue }

        return voices.first?.identifier
            ?? AVSpeechSynthesisVoice(language: "en-US")?.identifier
            ?? ""
    }

    /// Whether any premium or enhanced voices are available (downloaded).
    static var hasPremiumVoices: Bool {
        AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix("en") }
            .contains { $0.quality == .premium || $0.quality == .enhanced }
    }
}
