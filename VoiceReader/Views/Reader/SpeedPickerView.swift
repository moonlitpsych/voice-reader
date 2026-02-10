import SwiftUI

struct SpeedPickerView: View {
    @Environment(SpeechEngine.self) private var engine

    var body: some View {
        HStack(spacing: 8) {
            ForEach(SpeechSettings.rateTable, id: \.multiplier) { entry in
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    engine.changeSpeed(entry.multiplier)
                } label: {
                    Text(entry.label)
                        .font(AppFonts.mono(12))
                        .foregroundStyle(isSelected(entry.multiplier) ? .white : AppColors.textSecondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(isSelected(entry.multiplier) ? AppColors.accent : AppColors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .strokeBorder(
                                    isSelected(entry.multiplier) ? Color.clear : AppColors.border,
                                    lineWidth: 1
                                )
                        )
                }
            }
        }
    }

    private func isSelected(_ multiplier: Double) -> Bool {
        engine.settings.speedMultiplier == multiplier
    }
}
