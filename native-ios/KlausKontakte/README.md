# Klaus Kontakte für iPhone

Native iOS-Ergänzung zur PWA. Die App speichert Kontakte ausschließlich lokal im App-Speicher und enthält keine Kontakt- oder Beispieldaten.

## Enthalten

- Große Sprachsuche über Apples `Speech`-Framework
- Kontaktname als `contextualStrings` für die Erkennung (maximal 100 Namen)
- Lokale Speicherung im App-Speicher
- Import der bestehenden PWA-JSON-Sicherung und von VCF/vCard-Dateien
- Leeres Formular für neue Kontakte mit mehreren Telefonnummern

## Build

Auf einem Mac mit Xcode und XcodeGen ausführen:

```sh
cd native-ios/KlausKontakte
xcodegen generate
open KlausKontakte.xcodeproj
```

In Xcode wird ein eigenes Apple-Entwicklerkonto für die Signierung gewählt. Für eine dauerhafte Verteilung an mehrere Familien-iPhones ist Apples Developer-Programm erforderlich. Die Sprachsuche selbst verwendet keinen kostenpflichtigen Dienst.
