import Foundation
import SwiftData

@Model
final class Clip {
    var id: UUID
    var title: String
    var text: String
    var createdAt: Date

    init(title: String, text: String) {
        self.id = UUID()
        self.title = title
        self.text = text
        self.createdAt = Date()
    }
}
