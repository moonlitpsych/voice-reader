import SwiftUI

struct PlayerControlsView: View {
    @Environment(SpeechEngine.self) private var engine

    var body: some View {
        HStack(spacing: 0) {
            // Skip back
            controlButton(icon: "backward.fill", size: 20) {
                haptic()
                engine.skipBack()
            }

            Spacer()

            // +5 back (tap area)
            controlButton(icon: "gobackward.5", size: 22) {
                haptic()
                let target = max(engine.currentIndex - 5, 0)
                engine.jumpTo(index: target)
            }

            Spacer()

            // Play/Pause (large center button)
            Button {
                haptic(.medium)
                engine.togglePlayPause()
            } label: {
                Image(systemName: engine.isPaused ? "play.fill" : "pause.fill")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 64, height: 64)
                    .background(AppColors.accent)
                    .clipShape(Circle())
            }

            Spacer()

            // +5 forward
            controlButton(icon: "goforward.5", size: 22) {
                haptic()
                engine.skip5Forward()
            }

            Spacer()

            // Skip forward
            controlButton(icon: "forward.fill", size: 20) {
                haptic()
                engine.skipForward()
            }
        }
        .padding(.horizontal, 24)
    }

    private func controlButton(icon: String, size: CGFloat, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: size))
                .foregroundStyle(AppColors.text)
                .frame(width: 44, height: 44)
        }
    }

    private func haptic(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }
}
