import AVFAudio
import Speech

@MainActor
final class SpeechService: NSObject, ObservableObject {
    @Published var status = ""
    @Published var isListening = false

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "de-DE"))
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    func start(names: [String], onResult: @escaping (String) -> Void) {
        Task {
            let speechAllowed = await speechPermission()
            let microphoneAllowed = await microphonePermission()
            guard speechAllowed && microphoneAllowed else {
                status = "Mikrofon oder Spracherkennung nicht erlaubt."
                return
            }
            begin(names: names, onResult: onResult)
        }
    }

    func stop() {
        task?.cancel()
        task = nil
        request?.endAudio()
        request = nil
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        isListening = false
    }

    private func begin(names: [String], onResult: @escaping (String) -> Void) {
        stop()
        guard let recognizer, recognizer.isAvailable else {
            status = "Spracherkennung ist gerade nicht verfügbar."
            return
        }
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = false
        request.contextualStrings = Array(Set(names.flatMap { [$0, $0.replacingOccurrences(of: "Frau ", with: ""), $0.replacingOccurrences(of: "Herr ", with: "")] })).prefix(100).map(String.init)
        if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }
        self.request = request
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }
        do {
            try AVAudioSession.sharedInstance().setCategory(.record, mode: .measurement, options: .duckOthers)
            try AVAudioSession.sharedInstance().setActive(true, options: .notifyOthersOnDeactivation)
            engine.prepare()
            try engine.start()
            isListening = true
            status = "Ich höre zu."
            task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self else { return }
                if let result, result.isFinal {
                    let words = result.bestTranscription.formattedString
                    Task { @MainActor in onResult(words); self.stop() }
                } else if error != nil {
                    Task { @MainActor in self.status = "Name nicht verstanden. Bitte noch einmal sprechen."; self.stop() }
                }
            }
        } catch {
            status = "Mikrofon konnte nicht gestartet werden."
            stop()
        }
    }

    private func speechPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0 == .authorized) }
        }
    }

    private func microphonePermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { continuation.resume(returning: $0) }
        }
    }
}
