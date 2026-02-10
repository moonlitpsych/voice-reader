import SwiftUI

struct PlaybackTextView: View {
    @Environment(SpeechEngine.self) private var engine

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(engine.sentences.enumerated()), id: \.offset) { index, sentence in
                        Text(sentence)
                            .font(AppFonts.body())
                            .foregroundStyle(foregroundColor(for: index))
                            .padding(.vertical, 6)
                            .padding(.horizontal, 12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                index == engine.currentIndex
                                    ? AppColors.highlight
                                    : Color.clear
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .id(index)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                engine.jumpTo(index: index)
                            }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            .onChange(of: engine.currentIndex) { _, newIndex in
                withAnimation(.easeInOut(duration: 0.3)) {
                    proxy.scrollTo(newIndex, anchor: .center)
                }
            }
        }
    }

    private func foregroundColor(for index: Int) -> Color {
        if index == engine.currentIndex {
            return AppColors.text
        } else if index < engine.currentIndex {
            return AppColors.textSecondary
        } else {
            return AppColors.text.opacity(0.7)
        }
    }
}
