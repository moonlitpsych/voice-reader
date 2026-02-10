import SwiftUI

struct ReaderView: View {
    @Environment(SpeechEngine.self) private var engine
    @State private var inputText: String = ""
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            ZStack {
                AppColors.background.ignoresSafeArea()

                if engine.isPlaying || engine.isPaused {
                    playbackView
                } else {
                    TextInputView(text: $inputText) {
                        startPlayback()
                    }
                }
            }
            .navigationTitle("Voice Reader")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if engine.isPlaying || engine.isPaused {
                        Button {
                            engine.stop()
                        } label: {
                            Image(systemName: "stop.fill")
                                .foregroundStyle(AppColors.accent)
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                            .foregroundStyle(AppColors.text)
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsSheet()
            }
            .onReceive(NotificationCenter.default.publisher(for: .sharedTextReceived)) { notification in
                if let text = notification.userInfo?["text"] as? String {
                    inputText = text
                    let autoPlay = notification.userInfo?["autoPlay"] as? Bool ?? true
                    if autoPlay {
                        startPlayback()
                    }
                }
            }
        }
    }

    private var playbackView: some View {
        VStack(spacing: 0) {
            PlaybackTextView()
                .frame(maxHeight: .infinity)

            VStack(spacing: 16) {
                ProgressBarView()
                PlayerControlsView()
                SpeedPickerView()
            }
            .padding(.vertical, 16)
            .background(AppColors.surface.opacity(0.5))
        }
    }

    private func startPlayback() {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        engine.loadText(trimmed)
        engine.play()
    }
}
