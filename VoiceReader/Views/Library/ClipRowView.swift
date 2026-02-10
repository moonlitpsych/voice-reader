import SwiftUI

struct ClipRowView: View {
    let clip: Clip

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(clip.title)
                .font(AppFonts.body(15))
                .foregroundStyle(AppColors.text)
                .lineLimit(2)

            HStack(spacing: 12) {
                Text(clip.createdAt, format: .dateTime.month(.abbreviated).day().year())
                    .font(AppFonts.mono(11))
                    .foregroundStyle(AppColors.textSecondary)

                Text("\(TextProcessor.wordCount(clip.text)) words")
                    .font(AppFonts.mono(11))
                    .foregroundStyle(AppColors.textSecondary)
            }

            Text(String(clip.text.prefix(120)))
                .font(AppFonts.body(13))
                .foregroundStyle(AppColors.textSecondary)
                .lineLimit(2)
        }
        .padding(.vertical, 4)
    }
}
