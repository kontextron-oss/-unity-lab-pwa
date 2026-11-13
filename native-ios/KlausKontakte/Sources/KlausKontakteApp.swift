import SwiftUI

@main
struct KlausKontakteApp: App {
    @StateObject private var store = ContactStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .preferredColorScheme(.dark)
        }
    }
}
