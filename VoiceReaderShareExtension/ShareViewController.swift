import UIKit
import SwiftUI
import SwiftData
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

        extractText { [weak self] text in
            guard let self, let text, !text.isEmpty else {
                self?.dismiss()
                return
            }

            let shareView = ShareView(
                text: text,
                onReadAloud: {
                    self.sendToMainApp(text: text)
                    self.dismiss()
                },
                onSaveToLibrary: {
                    self.saveToLibrary(text: text)
                    self.dismiss()
                },
                onCancel: {
                    self.dismiss()
                }
            )

            let hostingController = UIHostingController(rootView: shareView)
            hostingController.view.backgroundColor = .clear
            addChild(hostingController)
            view.addSubview(hostingController.view)
            hostingController.view.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
                hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            ])
            hostingController.didMove(toParent: self)
        }
    }

    private func extractText(completion: @escaping (String?) -> Void) {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
            completion(nil)
            return
        }

        for item in items {
            guard let attachments = item.attachments else { continue }

            for provider in attachments {
                // Try plain text first
                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { data, _ in
                        DispatchQueue.main.async {
                            if let text = data as? String {
                                completion(text)
                            } else {
                                completion(nil)
                            }
                        }
                    }
                    return
                }

                // Try URL (extract page text from URL — just pass URL string for now)
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier) { data, _ in
                        DispatchQueue.main.async {
                            if let url = data as? URL {
                                completion(url.absoluteString)
                            } else {
                                completion(nil)
                            }
                        }
                    }
                    return
                }
            }
        }

        completion(nil)
    }

    private func sendToMainApp(text: String) {
        // Write text to App Group UserDefaults
        if let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName) {
            defaults.set(text, forKey: AppGroupConstants.pendingTextKey)
        }

        // Open main app via URL scheme.
        // Extensions can't call UIApplication.shared.open() directly.
        // Use the responder chain to find an object that responds to openURL:.
        guard let url = URL(string: "\(AppGroupConstants.urlScheme)://read") else { return }
        var responder: UIResponder? = self as UIResponder
        while let current = responder {
            let selector = sel_registerName("openURL:")
            if current.responds(to: selector) {
                current.perform(selector, with: url)
                return
            }
            responder = current.next
        }
        // If we get here, opening the app failed silently.
        // The user will see "Saved!" and can open Voice Reader manually.
        // The text is stored in App Group defaults and will be picked up on next launch.
    }

    private func saveToLibrary(text: String) {
        // Save clip via shared SwiftData container
        let title = TextProcessor.generateTitle(from: text)
        let clip = Clip(title: title, text: text)

        do {
            let schema = Schema([Clip.self])
            let config = ModelConfiguration(
                schema: schema,
                url: SharedModelContainer.storeURL,
                allowsSave: true
            )
            let container = try ModelContainer(for: schema, configurations: [config])
            let context = ModelContext(container)
            context.insert(clip)
            try context.save()
        } catch {
            print("Failed to save clip from share extension: \(error)")
        }
    }

    private func dismiss() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
