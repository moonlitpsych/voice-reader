import MediaPlayer

final class NowPlayingManager {
    static let shared = NowPlayingManager()

    private var engine: SpeechEngine?

    private init() {}

    func attach(to engine: SpeechEngine) {
        self.engine = engine
        setupRemoteCommands()
    }

    func update(title: String, currentIndex: Int, totalSentences: Int, isPlaying: Bool) {
        var info = [String: Any]()
        info[MPMediaItemPropertyTitle] = title
        info[MPMediaItemPropertyArtist] = "Voice Reader"
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = NSNumber(value: currentIndex)
        info[MPMediaItemPropertyPlaybackDuration] = NSNumber(value: totalSentences)
        info[MPNowPlayingInfoPropertyPlaybackRate] = NSNumber(value: isPlaying ? 1.0 : 0.0)

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    func updatePlaybackState(isPlaying: Bool) {
        var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
        info[MPNowPlayingInfoPropertyPlaybackRate] = NSNumber(value: isPlaying ? 1.0 : 0.0)
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    func clear() {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    private func setupRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()

        center.playCommand.isEnabled = true
        center.playCommand.addTarget { [weak self] _ in
            self?.engine?.resume()
            return .success
        }

        center.pauseCommand.isEnabled = true
        center.pauseCommand.addTarget { [weak self] _ in
            self?.engine?.pause()
            return .success
        }

        center.togglePlayPauseCommand.isEnabled = true
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.engine?.togglePlayPause()
            return .success
        }

        center.nextTrackCommand.isEnabled = true
        center.nextTrackCommand.addTarget { [weak self] _ in
            self?.engine?.skipForward()
            return .success
        }

        center.previousTrackCommand.isEnabled = true
        center.previousTrackCommand.addTarget { [weak self] _ in
            self?.engine?.skipBack()
            return .success
        }

        // Disable unused commands
        center.skipForwardCommand.isEnabled = false
        center.skipBackwardCommand.isEnabled = false
        center.seekForwardCommand.isEnabled = false
        center.seekBackwardCommand.isEnabled = false
        center.changePlaybackPositionCommand.isEnabled = false
    }
}
