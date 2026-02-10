import SwiftUI

struct ShareView: View {
    let text: String
    let onReadAloud: () -> Void
    let onSaveToLibrary: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 20) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Voice Reader")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(Color(red: 0.910, green: 0.894, blue: 0.871))

                        Text("\(wordCount) words")
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(Color.white.opacity(0.5))
                    }

                    Spacer()

                    Button(action: onCancel) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 24))
                            .foregroundStyle(Color.white.opacity(0.3))
                    }
                }

                // Preview
                Text(String(text.prefix(200)) + (text.count > 200 ? "..." : ""))
                    .font(.system(size: 14))
                    .foregroundStyle(Color.white.opacity(0.6))
                    .lineLimit(4)
                    .frame(maxWidth: .infinity, alignment: .leading)

                // Actions
                VStack(spacing: 10) {
                    Button(action: onReadAloud) {
                        HStack(spacing: 8) {
                            Image(systemName: "play.fill")
                            Text("Read Aloud")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color(red: 0.769, green: 0.353, blue: 0.235))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    Button(action: onSaveToLibrary) {
                        HStack(spacing: 8) {
                            Image(systemName: "square.and.arrow.down")
                            Text("Save to Library")
                                .font(.system(size: 16, weight: .medium))
                        }
                        .foregroundStyle(Color(red: 0.910, green: 0.894, blue: 0.871))
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color.white.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
                        )
                    }
                }
            }
            .padding(24)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color(red: 0.098, green: 0.098, blue: 0.110))
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .background(Color.black.opacity(0.4))
    }

    private var wordCount: Int {
        text.split { $0.isWhitespace || $0.isNewline }.count
    }
}
