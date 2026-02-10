import AVFoundation
import Observation

@Observable
final class SpeechEngine: NSObject {
    // MARK: - State

    private(set) var sentences: [String] = []
    private(set) var currentIndex: Int = 0
    private(set) var isPlaying: Bool = false
    private(set) var isPaused: Bool = false
    private(set) var elapsedTime: TimeInterval = 0

    var totalSentences: Int { sentences.count }
    var currentSentence: String? {
        guard currentIndex >= 0, currentIndex < sentences.count else { return nil }
        return sentences[currentIndex]
    }

    // MARK: - Dependencies

    var settings: SpeechSettings

    // MARK: - Private

    private let synthesizer = AVSpeechSynthesizer()
    private var elapsedTimer: Timer?
    private var isSpeakingAfterSkip = false

    // Silent audio player to keep audio session alive in background
    private var silentPlayer: AVAudioPlayer?

    // MARK: - Init

    init(settings: SpeechSettings) {
        self.settings = settings
        super.init()
        synthesizer.delegate = self

        setupInterruptionHandlers()
        prepareSilentPlayer()
    }

    // MARK: - Public API

    func loadText(_ text: String) {
        stop()
        sentences = TextProcessor.splitIntoSentences(text)
        currentIndex = 0
    }

    func play() {
        guard !sentences.isEmpty else { return }

        if isPaused {
            resume()
            return
        }

        isPlaying = true
        isPaused = false
        currentIndex = 0
        elapsedTime = 0

        startSilentPlayer()
        startElapsedTimer()
        speakCurrent()
    }

    func pause() {
        guard isPlaying, !isPaused else { return }
        synthesizer.pauseSpeaking(at: .immediate)
        isPaused = true
        stopElapsedTimer()
        NowPlayingManager.shared.updatePlaybackState(isPlaying: false)
    }

    func resume() {
        guard isPaused else { return }
        synthesizer.continueSpeaking()
        isPaused = false
        startElapsedTimer()
        NowPlayingManager.shared.updatePlaybackState(isPlaying: true)
    }

    func togglePlayPause() {
        if isPaused {
            resume()
        } else if isPlaying {
            pause()
        } else {
            play()
        }
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        isPlaying = false
        isPaused = false
        currentIndex = 0
        elapsedTime = 0
        stopElapsedTimer()
        stopSilentPlayer()
        NowPlayingManager.shared.clear()
    }

    func skipForward() {
        guard isPlaying, currentIndex < sentences.count - 1 else { return }
        isSpeakingAfterSkip = true
        synthesizer.stopSpeaking(at: .immediate)
        currentIndex += 1
        speakCurrent()
    }

    func skipBack() {
        guard isPlaying, currentIndex > 0 else { return }
        isSpeakingAfterSkip = true
        synthesizer.stopSpeaking(at: .immediate)
        currentIndex -= 1
        speakCurrent()
    }

    func skip5Forward() {
        guard isPlaying else { return }
        let target = min(currentIndex + 5, sentences.count - 1)
        guard target != currentIndex else { return }
        isSpeakingAfterSkip = true
        synthesizer.stopSpeaking(at: .immediate)
        currentIndex = target
        speakCurrent()
    }

    func jumpTo(index: Int) {
        guard isPlaying, index >= 0, index < sentences.count else { return }
        isSpeakingAfterSkip = true
        synthesizer.stopSpeaking(at: .immediate)
        currentIndex = index
        speakCurrent()
    }

    func changeSpeed(_ multiplier: Double) {
        settings.speedMultiplier = multiplier
        guard isPlaying, !isPaused else { return }
        // Restart current sentence at new speed
        isSpeakingAfterSkip = true
        synthesizer.stopSpeaking(at: .immediate)
        speakCurrent()
    }

    func changeVoice(_ identifier: String) {
        settings.voiceIdentifier = identifier
        guard isPlaying, !isPaused else { return }
        isSpeakingAfterSkip = true
        synthesizer.stopSpeaking(at: .immediate)
        speakCurrent()
    }

    // MARK: - Private Helpers

    private func speakCurrent() {
        guard currentIndex >= 0, currentIndex < sentences.count else {
            finishPlayback()
            return
        }

        let utterance = AVSpeechUtterance(string: sentences[currentIndex])
        utterance.rate = settings.avSpeechRate
        utterance.pitchMultiplier = 1.0
        utterance.preUtteranceDelay = 0
        utterance.postUtteranceDelay = 0.08 // Small gap between sentences

        if let voice = AVSpeechSynthesisVoice(identifier: settings.voiceIdentifier) {
            utterance.voice = voice
        } else {
            utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        }

        synthesizer.speak(utterance)

        NowPlayingManager.shared.update(
            title: String(sentences[currentIndex].prefix(60)),
            currentIndex: currentIndex,
            totalSentences: sentences.count,
            isPlaying: true
        )
    }

    private func finishPlayback() {
        isPlaying = false
        isPaused = false
        currentIndex = 0
        elapsedTime = 0
        stopElapsedTimer()
        stopSilentPlayer()
        NowPlayingManager.shared.clear()
    }

    private func advanceToNext() {
        if currentIndex < sentences.count - 1 {
            currentIndex += 1
            speakCurrent()
        } else {
            finishPlayback()
        }
    }

    // MARK: - Elapsed Timer

    private func startElapsedTimer() {
        stopElapsedTimer()
        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self, self.isPlaying, !self.isPaused else { return }
            self.elapsedTime += 0.5
        }
    }

    private func stopElapsedTimer() {
        elapsedTimer?.invalidate()
        elapsedTimer = nil
    }

    // MARK: - Silent Audio (Background Workaround)

    private func prepareSilentPlayer() {
        // Generate a tiny silent WAV in memory (44 bytes header + 1 second of silence)
        let sampleRate: Int = 44100
        let numSamples = sampleRate // 1 second
        var data = Data()

        // WAV header
        let headerSize = 44
        let dataSize = numSamples * 2 // 16-bit mono
        let fileSize = headerSize + dataSize - 8

        data.append(contentsOf: "RIFF".utf8)
        data.append(contentsOf: withUnsafeBytes(of: Int32(fileSize).littleEndian) { Array($0) })
        data.append(contentsOf: "WAVE".utf8)
        data.append(contentsOf: "fmt ".utf8)
        data.append(contentsOf: withUnsafeBytes(of: Int32(16).littleEndian) { Array($0) }) // chunk size
        data.append(contentsOf: withUnsafeBytes(of: Int16(1).littleEndian) { Array($0) })  // PCM
        data.append(contentsOf: withUnsafeBytes(of: Int16(1).littleEndian) { Array($0) })  // mono
        data.append(contentsOf: withUnsafeBytes(of: Int32(sampleRate).littleEndian) { Array($0) })
        data.append(contentsOf: withUnsafeBytes(of: Int32(sampleRate * 2).littleEndian) { Array($0) }) // byte rate
        data.append(contentsOf: withUnsafeBytes(of: Int16(2).littleEndian) { Array($0) })  // block align
        data.append(contentsOf: withUnsafeBytes(of: Int16(16).littleEndian) { Array($0) }) // bits per sample
        data.append(contentsOf: "data".utf8)
        data.append(contentsOf: withUnsafeBytes(of: Int32(dataSize).littleEndian) { Array($0) })

        // Silent samples
        data.append(Data(count: dataSize))

        do {
            silentPlayer = try AVAudioPlayer(data: data)
            silentPlayer?.numberOfLoops = -1  // Loop forever
            silentPlayer?.volume = 0.01       // Nearly silent
        } catch {
            print("Failed to create silent player: \(error)")
        }
    }

    private func startSilentPlayer() {
        silentPlayer?.play()
    }

    private func stopSilentPlayer() {
        silentPlayer?.stop()
    }

    // MARK: - Interruption Handling

    private func setupInterruptionHandlers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruptionBegan),
            name: .audioInterruptionBegan,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruptionEnded),
            name: .audioInterruptionEnded,
            object: nil
        )
    }

    @objc private func handleInterruptionBegan() {
        if isPlaying && !isPaused {
            pause()
        }
    }

    @objc private func handleInterruptionEnded(_ notification: Notification) {
        let shouldResume = notification.userInfo?["shouldResume"] as? Bool ?? false
        if shouldResume && isPaused {
            resume()
        }
    }
}

// MARK: - AVSpeechSynthesizerDelegate

extension SpeechEngine: AVSpeechSynthesizerDelegate {
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                           didFinish utterance: AVSpeechUtterance) {
        // didFinish fires for both natural completion and stopSpeaking().
        // If we stopped for a skip/speed change, isSpeakingAfterSkip is true
        // and speakCurrent() was already called — don't advance again.
        if isSpeakingAfterSkip {
            isSpeakingAfterSkip = false
            return
        }
        advanceToNext()
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                           didCancel utterance: AVSpeechUtterance) {
        // Fired by stopSpeaking(). Skip/stop handle their own state,
        // so this is intentionally a no-op.
    }
}
