import Foundation

enum TextProcessor {
    /// Split text into sentences for sequential TTS playback.
    /// Matches the PWA splitting logic: split on sentence-ending punctuation followed by whitespace,
    /// or on double newlines (paragraph breaks).
    static func splitIntoSentences(_ text: String) -> [String] {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }

        // Split on: sentence-ending punctuation followed by space, or paragraph breaks
        // Using NSRegularExpression for lookbehind support
        let pattern = "(?<=[.!?…])\\s+|(?=\\n\\n)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            // Fallback: return entire text as one sentence
            return [trimmed]
        }

        let range = NSRange(trimmed.startIndex..., in: trimmed)
        var sentences: [String] = []
        var lastEnd = trimmed.startIndex

        regex.enumerateMatches(in: trimmed, range: range) { match, _, _ in
            guard let matchRange = match?.range,
                  let swiftRange = Range(matchRange, in: trimmed) else { return }

            let sentence = String(trimmed[lastEnd..<swiftRange.lowerBound])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !sentence.isEmpty {
                sentences.append(sentence)
            }
            lastEnd = swiftRange.upperBound
        }

        // Capture the last segment
        let remaining = String(trimmed[lastEnd...])
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !remaining.isEmpty {
            sentences.append(remaining)
        }

        return sentences
    }

    /// Estimate reading time in seconds for a given text at a words-per-minute rate.
    static func estimateTime(for text: String, wordsPerMinute: Double = 150) -> TimeInterval {
        let wordCount = text.split(separator: " ").count
        return Double(wordCount) / wordsPerMinute * 60
    }

    /// Estimate total reading time for an array of sentences.
    static func estimateTotalTime(sentences: [String], wordsPerMinute: Double = 150) -> TimeInterval {
        let totalWords = sentences.reduce(0) { $0 + $1.split(separator: " ").count }
        return Double(totalWords) / wordsPerMinute * 60
    }

    /// Generate a title from the first ~60 characters of text.
    static func generateTitle(from text: String) -> String {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.count <= 60 {
            return clean
        }
        let truncated = String(clean.prefix(57))
        // Try to break at a word boundary
        if let lastSpace = truncated.lastIndex(of: " ") {
            return String(truncated[..<lastSpace]) + "..."
        }
        return truncated + "..."
    }

    /// Word count for display.
    static func wordCount(_ text: String) -> Int {
        text.split { $0.isWhitespace || $0.isNewline }.count
    }
}
