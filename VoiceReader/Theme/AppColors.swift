import SwiftUI

enum AppColors {
    static let background = Color(red: 0.039, green: 0.039, blue: 0.043) // #0a0a0b
    static let surface = Color(red: 0.098, green: 0.098, blue: 0.110) // #19191c
    static let surfaceHover = Color(red: 0.137, green: 0.137, blue: 0.153) // #232327
    static let accent = Color(red: 0.769, green: 0.353, blue: 0.235) // #c45a3c
    static let accentDim = Color(red: 0.769, green: 0.353, blue: 0.235).opacity(0.15)
    static let text = Color(red: 0.910, green: 0.894, blue: 0.871) // #e8e4de
    static let textSecondary = Color(red: 0.910, green: 0.894, blue: 0.871).opacity(0.5)
    static let border = Color.white.opacity(0.08)
    static let highlight = Color(red: 0.769, green: 0.353, blue: 0.235).opacity(0.12)
}
