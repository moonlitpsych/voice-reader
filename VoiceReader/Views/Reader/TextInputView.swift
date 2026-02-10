import SwiftUI
import SwiftData

struct TextInputView: View {
    @Binding var text: String
    @Environment(\.modelContext) private var modelContext
    var onPlay: () -> Void

    @State private var showSavedToast = false

    var body: some View {
        VStack(spacing: 0) {
            // Text editor
            ZStack(alignment: .topLeading) {
                TextEditor(text: $text)
                    .font(AppFonts.body())
                    .foregroundStyle(AppColors.text)
                    .scrollContentBackground(.hidden)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)

                if text.isEmpty {
                    Text("Paste or type text to read aloud...")
                        .font(AppFonts.body())
                        .foregroundStyle(AppColors.textSecondary)
                        .padding(.horizontal, 17)
                        .padding(.vertical, 16)
                        .allowsHitTesting(false)
                }
            }
            .background(AppColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(AppColors.border, lineWidth: 1)
            )
            .padding(.horizontal, 16)

            // Action buttons
            HStack(spacing: 12) {
                // Paste
                Button {
                    if let clipboard = UIPasteboard.general.string, !clipboard.isEmpty {
                        text = clipboard
                    }
                } label: {
                    Label("Paste", systemImage: "doc.on.clipboard")
                        .font(AppFonts.label(13))
                }
                .buttonStyle(SecondaryButtonStyle())

                // Save
                Button {
                    saveClip()
                } label: {
                    Label("Save", systemImage: "square.and.arrow.down")
                        .font(AppFonts.label(13))
                }
                .buttonStyle(SecondaryButtonStyle())
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                // Clear
                Button {
                    text = ""
                } label: {
                    Label("Clear", systemImage: "xmark")
                        .font(AppFonts.label(13))
                }
                .buttonStyle(SecondaryButtonStyle())
                .disabled(text.isEmpty)

                Spacer()

                // Word count
                if !text.isEmpty {
                    Text("\(TextProcessor.wordCount(text)) words")
                        .font(AppFonts.mono(11))
                        .foregroundStyle(AppColors.textSecondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)

            Spacer()

            // Play button
            Button(action: onPlay) {
                HStack(spacing: 8) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 18))
                    Text("Play")
                        .font(AppFonts.title(18))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(AppColors.accent)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .opacity(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.4 : 1)
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
        .overlay {
            if showSavedToast {
                VStack {
                    Spacer()
                    Text("Saved to Library")
                        .font(AppFonts.label(13))
                        .foregroundStyle(AppColors.text)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(AppColors.surface)
                        .clipShape(Capsule())
                        .shadow(color: .black.opacity(0.3), radius: 8, y: 4)
                        .padding(.bottom, 80)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }

    private func saveClip() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let title = TextProcessor.generateTitle(from: trimmed)
        let clip = Clip(title: title, text: trimmed)
        modelContext.insert(clip)

        withAnimation(.easeInOut(duration: 0.3)) {
            showSavedToast = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation(.easeInOut(duration: 0.3)) {
                showSavedToast = false
            }
        }
    }
}

// MARK: - Button Styles

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(AppColors.text)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(configuration.isPressed ? AppColors.surfaceHover : AppColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(AppColors.border, lineWidth: 1)
            )
    }
}
