import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @EnvironmentObject private var store: ContactStore
    @StateObject private var speech = SpeechService()
    @State private var selection: ContactCard?
    @State private var importShown = false
    @State private var contactsOpen = false
    @State private var message = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 22) {
                Button {
                    speech.start(names: store.contacts.map(\.name)) { spoken in
                        if let contact = store.resolve(spoken) { selection = contact }
                        else { message = "Kein eindeutiger Kontakt gefunden: \(spoken)" }
                    }
                } label: {
                    Image(systemName: speech.isListening ? "mic.fill" : "mic")
                        .font(.system(size: 52, weight: .bold))
                        .frame(width: 126, height: 126)
                        .foregroundStyle(.black)
                        .background(.white, in: Circle())
                        .overlay(Circle().stroke(.white, lineWidth: 7))
                }
                .accessibilityLabel("Sprachsuche starten")

                Text("Klaus Kontakte").font(.largeTitle.bold())
                Button("Kontakte öffnen") { contactsOpen = true }
                    .buttonStyle(LargeButtonStyle(filled: true))
                Button("Neuer Kontakt") { selection = ContactCard() }
                    .buttonStyle(LargeButtonStyle(filled: false))

                if !speech.status.isEmpty { Text(speech.status).foregroundStyle(.secondary) }
                if !message.isEmpty { Text(message).foregroundStyle(.secondary) }
                Spacer()
                Button("Kontakte importieren") { importShown = true }
                    .buttonStyle(.bordered)
            }
            .padding(24)
            .navigationDestination(item: $selection) { contact in
                ContactDetail(contact: contact)
            }
            .sheet(isPresented: $contactsOpen) {
                ContactList { selection = $0; contactsOpen = false }
            }
            .fileImporter(isPresented: $importShown, allowedContentTypes: [.json, .vCard]) { result in
                guard case let .success(url) = result else { return }
                let allowed = url.startAccessingSecurityScopedResource(); defer { if allowed { url.stopAccessingSecurityScopedResource() } }
                do { try store.importFile(from: url); message = "Kontakte wurden lokal importiert." }
                catch { message = "Import nicht möglich." }
            }
        }
    }
}

private struct ContactList: View {
    @EnvironmentObject private var store: ContactStore
    @Environment(\.dismiss) private var dismiss
    let choose: (ContactCard) -> Void

    var body: some View {
        NavigationStack {
            List(store.contacts.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }) { contact in
                Button { choose(contact) } label: {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(contact.name).font(.title3.bold())
                        if !contact.address.isEmpty { Text(contact.address).foregroundStyle(.secondary) }
                    }
                }
            }
            .navigationTitle("Kontakte")
            .toolbar { Button("Fertig") { dismiss() } }
        }
    }
}

private struct ContactDetail: View {
    @EnvironmentObject private var store: ContactStore
    @Environment(\.dismiss) private var dismiss
    @State var contact: ContactCard

    var body: some View {
        Form {
            TextField("Name", text: $contact.name)
            Section("Telefonnummern") {
                ForEach($contact.phones) { $phone in
                    TextField("Nummer", text: $phone.number).keyboardType(.phonePad)
                }
                Button("Weitere Telefonnummer") { contact.phones.append(PhoneEntry()) }
            }
            Section("Adresse") {
                TextField("Straße", text: $contact.street)
                TextField("Hausnummer", text: $contact.house)
                TextField("Postleitzahl", text: $contact.zip).keyboardType(.numbersAndPunctuation)
                TextField("Ort", text: $contact.city)
            }
            Section("Weitere Angaben") {
                TextField("E-Mail-Adresse", text: $contact.email).keyboardType(.emailAddress)
                TextField("Webseite", text: $contact.website).keyboardType(.URL)
                TextField("Notizen", text: $contact.notes, axis: .vertical)
            }
            Button("Kontakt lokal speichern") { store.save(contact); dismiss() }
        }
        .navigationTitle(contact.name.isEmpty ? "Neuer Kontakt" : contact.name)
    }
}

private struct LargeButtonStyle: ButtonStyle {
    let filled: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.title2.bold()).frame(maxWidth: .infinity, minHeight: 92)
            .foregroundStyle(filled ? .black : .white)
            .background(filled ? .white : .black)
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(.white, lineWidth: filled ? 0 : 3))
            .clipShape(RoundedRectangle(cornerRadius: 22))
    }
}
