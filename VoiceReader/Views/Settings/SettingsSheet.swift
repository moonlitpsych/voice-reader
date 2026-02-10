import SwiftUI

struct SettingsSheet: View {
    @Environment(SpeechEngine.self) private var engine
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                // Voice selection
                Section {
                    Picker("Voice", selection: Bindable(engine.settings).voiceIdentifier) {
                        ForEach(VoiceMapping.availableVoices) { voice in
                            HStack {
                                Text(voice.name)
                                Spacer()
                                Text(voice.qualityLabel)
                                    .font(AppFonts.mono(10))
                                    .foregroundStyle(AppColors.textSecondary)
                            }
                            .tag(voice.id)
                        }
                    }
                    .pickerStyle(.inline)
                    .onChange(of: engine.settings.voiceIdentifier) { _, newValue in
                        engine.changeVoice(newValue)
                    }
                } header: {
                    Text("Voice")
                } footer: {
                    if !VoiceMapping.hasPremiumVoices {
                        Text("For better voices, go to Settings > Accessibility > Spoken Content > Voices and download enhanced or premium voices.")
                            .font(AppFonts.body(12))
                    }
                }

                // Speed
                Section("Speed") {
                    Picker("Speed", selection: Bindable(engine.settings).speedMultiplier) {
                        ForEach(SpeechSettings.rateTable, id: \.multiplier) { entry in
                            Text(entry.label).tag(entry.multiplier)
                        }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: engine.settings.speedMultiplier) { _, newValue in
                        engine.changeSpeed(newValue)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(AppColors.accent)
                }
            }
            .scrollContentBackground(.hidden)
            .background(AppColors.background)
        }
        .preferredColorScheme(.dark)
    }
}
