# Voice Reader iOS — Xcode Project Setup

All Swift source files are written. Follow these steps on the Mac Mini to create the Xcode project and build.

## 1. Create the Xcode Project

1. Open Xcode → **File > New > Project**
2. Choose **iOS > App**
3. Settings:
   - Product Name: `VoiceReader`
   - Team: your Apple Developer account
   - Organization Identifier: `com.moonlitpsych`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Storage: **SwiftData**
   - Minimum Deployment: **iOS 17.0**
4. Save it **inside** `voice-reader/` (Xcode creates `VoiceReader/VoiceReader.xcodeproj`)

## 2. Replace Generated Files with Ours

Xcode generates boilerplate files. Delete them and add ours:

1. In Xcode's project navigator, delete the generated `ContentView.swift`, `Item.swift`, `VoiceReaderApp.swift` (move to trash)
2. **File > Add Files to "VoiceReader"…** → select the entire `VoiceReader/` folder from this repo
   - Make sure "Copy items if needed" is **unchecked** (files are already in place)
   - Make sure "Create groups" is selected
   - Target: `VoiceReader`
3. Also add `VoiceReader/Shared/` files to both the main app target AND the share extension target later

## 3. Add Background Audio Capability

1. Select the `VoiceReader` target → **Signing & Capabilities**
2. Click **+ Capability** → **Background Modes**
3. Check: **Audio, AirPlay, and Picture in Picture**

## 4. Add App Group Capability

1. Select the `VoiceReader` target → **Signing & Capabilities**
2. Click **+ Capability** → **App Groups**
3. Add: `group.com.moonlitpsych.voicereader`

## 5. Register URL Scheme

1. Select the `VoiceReader` target → **Info** tab
2. Expand **URL Types** → click **+**
3. URL Schemes: `voicereader`
4. Identifier: `com.moonlitpsych.voicereader`

## 6. Add Share Extension Target

1. **File > New > Target** → **iOS > Share Extension**
2. Product Name: `VoiceReaderShareExtension`
3. Delete the generated `ShareViewController.swift` from the new target
4. Add files from `VoiceReaderShareExtension/` folder to this target
5. Also add these **shared files** to the Share Extension target:
   - `Shared/AppGroupConstants.swift`
   - `Shared/SharedModelContainer.swift`
   - `Models/Clip.swift`
   - `Engine/TextProcessor.swift`
6. Add **App Groups** capability to the Share Extension target too:
   - Same group: `group.com.moonlitpsych.voicereader`
7. Copy the `VoiceReaderShareExtension/Info.plist` contents into the extension's Info.plist (or replace the generated one)

## 7. Verify File → Target Membership

Open each file and check its target membership in the File Inspector (right panel):

| File | Main App | Share Extension |
|------|----------|-----------------|
| `VoiceReaderApp.swift` | ✅ | ❌ |
| `Models/Clip.swift` | ✅ | ✅ |
| `Models/SpeechSettings.swift` | ✅ | ❌ |
| `Engine/SpeechEngine.swift` | ✅ | ❌ |
| `Engine/AudioSessionManager.swift` | ✅ | ❌ |
| `Engine/NowPlayingManager.swift` | ✅ | ❌ |
| `Engine/TextProcessor.swift` | ✅ | ✅ |
| `Views/*` (all) | ✅ | ❌ |
| `Theme/*` (all) | ✅ | ❌ |
| `Utilities/VoiceMapping.swift` | ✅ | ❌ |
| `Shared/AppGroupConstants.swift` | ✅ | ✅ |
| `Shared/SharedModelContainer.swift` | ✅ | ✅ |
| `ShareViewController.swift` | ❌ | ✅ |
| `ShareView.swift` | ❌ | ✅ |

## 8. Build & Run

1. Select an iPhone 15 simulator (or your physical device)
2. **Product > Build** (⌘B)
3. Fix any issues — the most common will be:
   - Missing `import SwiftData` in Share Extension files (already included)
   - App Group entitlements need provisioning profile update
4. Run on device to test background audio and lock screen controls

## 9. App Icon

1. Create a 1024×1024 app icon (dark background, play button/waveform)
2. Drag into **Assets.xcassets > AppIcon**
3. Xcode 15+ auto-generates all sizes from the single 1024 image

## Rate Tuning

The speed-to-AVSpeechRate mapping in `SpeechSettings.swift` needs tuning on a real device:

```swift
static let rateTable: [(label: String, multiplier: Double, avRate: Float)] = [
    ("0.75x", 0.75, 0.42),   // ← adjust these Float values
    ("1x",    1.0,  0.50),
    ("1.25x", 1.25, 0.52),
    ("1.5x",  1.5,  0.545),
    ("1.75x", 1.75, 0.565),
    ("2x",    2.0,  0.59),
]
```

Play the same paragraph at each speed and adjust until it sounds right. The values are nonlinear — small changes above 0.5 make a big perceptual difference.

## Voice Download Tip

For best quality, on your iPhone go to:
**Settings > Accessibility > Spoken Content > Voices > English**
Download "Premium" or "Enhanced" voices (e.g., Samantha Premium, Zoe Premium).
These will automatically appear in the app's voice picker.
