import SwiftUI

struct ProgressBarView: View {
    @Environment(SpeechEngine.self) private var engine

    var body: some View {
        VStack(spacing: 6) {
            // Tappable progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // Track
                    RoundedRectangle(cornerRadius: 3)
                        .fill(AppColors.surface)
                        .frame(height: 6)

                    // Fill
                    RoundedRectangle(cornerRadius: 3)
                        .fill(AppColors.accent)
                        .frame(width: fillWidth(in: geo.size.width), height: 6)
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onEnded { value in
                            let fraction = max(0, min(1, value.location.x / geo.size.width))
                            let targetIndex = Int(fraction * Double(engine.totalSentences - 1))
                            engine.jumpTo(index: targetIndex)
                        }
                )
            }
            .frame(height: 6)

            // Labels
            HStack {
                Text(elapsedLabel)
                    .font(AppFonts.mono(11))
                    .foregroundStyle(AppColors.textSecondary)

                Spacer()

                Text("\(engine.currentIndex + 1)/\(engine.totalSentences)")
                    .font(AppFonts.mono(11))
                    .foregroundStyle(AppColors.text)

                Spacer()

                Text(remainingLabel)
                    .font(AppFonts.mono(11))
                    .foregroundStyle(AppColors.textSecondary)
            }
        }
        .padding(.horizontal, 16)
    }

    private func fillWidth(in totalWidth: CGFloat) -> CGFloat {
        guard engine.totalSentences > 0 else { return 0 }
        let fraction = CGFloat(engine.currentIndex) / CGFloat(engine.totalSentences)
        return totalWidth * fraction
    }

    private var elapsedLabel: String {
        formatTime(engine.elapsedTime)
    }

    private var remainingLabel: String {
        let remaining = engine.sentences.suffix(from: engine.currentIndex)
        let est = TextProcessor.estimateTotalTime(
            sentences: Array(remaining),
            wordsPerMinute: 150 * engine.settings.speedMultiplier
        )
        return "-" + formatTime(est)
    }

    private func formatTime(_ seconds: TimeInterval) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }
}
