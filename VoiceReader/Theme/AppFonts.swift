import SwiftUI

enum AppFonts {
    static func body(_ size: CGFloat = 16) -> Font {
        .system(size: size, design: .default)
    }

    static func mono(_ size: CGFloat = 13) -> Font {
        .system(size: size, design: .monospaced)
    }

    static func label(_ size: CGFloat = 12) -> Font {
        .system(size: size, weight: .medium, design: .monospaced)
    }

    static func title(_ size: CGFloat = 20) -> Font {
        .system(size: size, weight: .semibold, design: .default)
    }
}
