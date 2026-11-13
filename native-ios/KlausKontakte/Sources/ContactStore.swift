import Foundation

struct PhoneEntry: Codable, Identifiable, Hashable {
    var id = UUID()
    var label: String = "Mobil"
    var number: String = ""
}

struct ContactCard: Codable, Identifiable, Hashable {
    var id = UUID()
    var name = ""
    var phones: [PhoneEntry] = [PhoneEntry()]
    var street = ""
    var house = ""
    var zip = ""
    var city = ""
    var email = ""
    var website = ""
    var notes = ""
    var favorite = false

    var address: String {
        [[street, house].filter { !$0.isEmpty }.joined(separator: " "),
         [zip, city].filter { !$0.isEmpty }.joined(separator: " ")]
            .filter { !$0.isEmpty }.joined(separator: "\n")
    }
}

private struct WebBackup: Codable {
    var contacts: [WebContact]
}

private struct WebContact: Codable {
    var name: String
    var phones: [WebPhone]?
    var phone: String?
    var street: String?
    var house: String?
    var zip: String?
    var city: String?
    var email: String?
    var website: String?
    var notes: String?
    var favorite: Bool?
}

private struct WebPhone: Codable { var label: String; var number: String }

@MainActor
final class ContactStore: ObservableObject {
    @Published private(set) var contacts: [ContactCard] = []

    private let fileURL: URL

    init() {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("KlausKontakte", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        fileURL = folder.appendingPathComponent("kontakte.json")
        load()
    }

    func save(_ contact: ContactCard) {
        var cleaned = contact
        cleaned.name = cleaned.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.name.isEmpty else { return }
        cleaned.phones = cleaned.phones.filter { !$0.number.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        if let index = contacts.firstIndex(where: { $0.id == cleaned.id }) {
            contacts[index] = cleaned
        } else {
            contacts.append(cleaned)
        }
        persist()
    }

    func delete(_ contact: ContactCard) {
        contacts.removeAll { $0.id == contact.id }
        persist()
    }

    func resolve(_ spoken: String) -> ContactCard? {
        let query = normalized(spoken)
        guard !query.isEmpty else { return nil }
        let exact = contacts.filter { normalized($0.name) == query }
        if exact.count == 1 { return exact[0] }
        let included = contacts.filter { normalized($0.name).contains(query) || query.contains(normalized($0.name)) }
        return included.count == 1 ? included[0] : nil
    }

    func importWebBackup(from url: URL) throws {
        let data = try Data(contentsOf: url)
        let decoder = JSONDecoder()
        let backup: WebBackup
        if let object = try? decoder.decode(WebBackup.self, from: data) {
            backup = object
        } else {
            backup = WebBackup(contacts: try decoder.decode([WebContact].self, from: data))
        }
        let imported = backup.contacts.compactMap { source -> ContactCard? in
            let name = source.name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty else { return nil }
            let numbers = source.phones?.map { PhoneEntry(label: $0.label, number: $0.number) }
                ?? (source.phone.map { [PhoneEntry(label: "Mobil", number: $0)] } ?? [])
            return ContactCard(name: name, phones: numbers, street: source.street ?? "", house: source.house ?? "",
                               zip: source.zip ?? "", city: source.city ?? "", email: source.email ?? "",
                               website: source.website ?? "", notes: source.notes ?? "", favorite: source.favorite ?? false)
        }
        for contact in imported where !contacts.contains(where: { normalized($0.name) == normalized(contact.name) }) {
            contacts.append(contact)
        }
        persist()
    }

    func importFile(from url: URL) throws {
        if url.pathExtension.lowercased() == "vcf" {
            try importVCard(from: url)
        } else {
            try importWebBackup(from: url)
        }
    }

    private func importVCard(from url: URL) throws {
        let text = try String(contentsOf: url, encoding: .utf8)
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\n ", with: "")
        var current: ContactCard?
        for line in text.components(separatedBy: "\n") {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.uppercased() == "BEGIN:VCARD" { current = ContactCard(phones: []); continue }
            if trimmed.uppercased() == "END:VCARD" {
                if let current, !current.name.isEmpty,
                   !contacts.contains(where: { normalized($0.name) == normalized(current.name) }) { contacts.append(current) }
                current = nil
                continue
            }
            guard var card = current, let separator = trimmed.firstIndex(of: ":") else { continue }
            let header = String(trimmed[..<separator]).uppercased()
            let value = String(trimmed[trimmed.index(after: separator)...]).replacingOccurrences(of: "\\n", with: "\n")
            if header.hasPrefix("FN") { card.name = value }
            else if header.hasPrefix("TEL") { card.phones.append(PhoneEntry(label: header.contains("CELL") ? "Mobil" : header.contains("WORK") ? "Arbeit" : header.contains("HOME") ? "Privat" : "Andere", number: value.replacingOccurrences(of: "tel:", with: "", options: .caseInsensitive))) }
            else if header.hasPrefix("EMAIL") { card.email = value }
            else if header.hasPrefix("URL") { card.website = value }
            else if header.hasPrefix("NOTE") { card.notes = value }
            current = card
        }
        persist()
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let saved = try? JSONDecoder().decode([ContactCard].self, from: data) else { return }
        contacts = saved
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(contacts) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }

    private func normalized(_ value: String) -> String {
        value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .replacingOccurrences(of: "frau ", with: "")
            .replacingOccurrences(of: "herr ", with: "")
            .filter { $0.isLetter || $0.isWhitespace }
            .split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }
}
