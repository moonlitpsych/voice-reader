import SwiftUI
import SwiftData

struct LibraryView: View {
    @Query(sort: \Clip.createdAt, order: .reverse) private var clips: [Clip]
    @Environment(\.modelContext) private var modelContext
    @Environment(SpeechEngine.self) private var speechEngine

    var switchToReader: () -> Void

    var body: some View {
        NavigationStack {
            Group {
                if clips.isEmpty {
                    emptyState
                } else {
                    clipsList
                }
            }
            .navigationTitle("Library")
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "books.vertical")
                .font(.system(size: 48))
                .foregroundStyle(AppColors.textSecondary)
            Text("No saved clips")
                .font(AppFonts.body())
                .foregroundStyle(AppColors.textSecondary)
            Text("Save text from the Reader tab to build your library.")
                .font(AppFonts.body(14))
                .foregroundStyle(AppColors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppColors.background)
    }

    private var clipsList: some View {
        List {
            ForEach(clips) { clip in
                ClipRowView(clip: clip)
                    .listRowBackground(AppColors.background)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        loadClip(clip)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            modelContext.delete(clip)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(AppColors.background)
    }

    private func loadClip(_ clip: Clip) {
        // Post notification so ReaderView picks up the text and populates inputText
        NotificationCenter.default.post(
            name: .sharedTextReceived,
            object: nil,
            userInfo: ["text": clip.text, "autoPlay": false]
        )
        switchToReader()
    }
}
