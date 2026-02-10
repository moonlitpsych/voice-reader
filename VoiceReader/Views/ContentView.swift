import SwiftUI

struct ContentView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            ReaderView()
                .tabItem {
                    Label("Reader", systemImage: "play.circle.fill")
                }
                .tag(0)

            LibraryView(switchToReader: { selectedTab = 0 })
                .tabItem {
                    Label("Library", systemImage: "books.vertical.fill")
                }
                .tag(1)
        }
        .tint(AppColors.accent)
        .preferredColorScheme(.dark)
    }
}
