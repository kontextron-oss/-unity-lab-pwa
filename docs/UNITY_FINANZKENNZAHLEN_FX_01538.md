# UNITY 0.15.3.8 – Standardisierte Finanzkennzahlen und Währungsabgleich

## Bereits umgesetzt

Für **jede Aktie der Masterliste** steht ein einheitlicher, read-only Datenvertrag über `unityFinancialStockSnapshot(stock)` beziehungsweise `unityFinancialMasterDataset(list)` zur Verfügung. Für nicht erschlossene Unternehmen erscheint ein neutraler `unverified`-Status, nicht eine schlechte Bewertung oder Verkaufsempfehlung.

Datenquelle ist je Aktie der nach ISIN bzw. eindeutigem Ticker und ISIN zugeordnete Finanzdatensatz: XBRL/ESEF, SEC Company Facts oder die explizit verifizierten offiziellen Jahresberichts-PDFs. Rohwerte dürfen nur mit übereinstimmender Berichtswährung, identischem Geschäftsjahresende und nachvollziehbarem Primärbeleg verwendet werden.

Die Basiskennzahlen werden aus denselben fünf geprüften Konzernwerten berechnet:

- Nettomarge = Jahresüberschuss / Umsatz.
- Eigenkapitalquote = Eigenkapital / Bilanzsumme.
- Operative Cashflow-Marge = operativer Cashflow / Umsatz.
- Cashflow / Gewinn = operativer Cashflow / Jahresüberschuss (nur bei positivem Gewinn).
- Umsatz- und Ergebniswachstum gegenüber Vorjahr nur bei **nachgewiesenen Zahlen desselben Unternehmens, gleicher Währung und vergleichbaren Geschäftsjahresenden** von 330–400 Tagen Abstand. Fehlende Vorjahre bleiben `null`, nicht 0 %.

## Wechselkurs und Bewertung

Die EZB-Datendatei liefert EUR je eine Einheit Fremdwährung. Für unterschiedliche Börsen- und Berichtswährungen wird **Börsenwährung → EUR → Berichtswährung** auf demselben EZB-Referenztag berechnet. Beispiel ABB: CHF-Börsenkurs, USD-Konzernabschluss. Fehlende/alte oder nicht datumsgleiche Wechselkurse blockieren eine Kursbewertung, nicht die Unternehmenskennzahlen. Wechselkurse sind Referenzkurse, keine Ausführungskurse.

Ein KGV wird ausschließlich berechnet, wenn ein zugeordnetes, geprüftes *verwässertes EPS* je Aktie im Berichtsjahr vorliegt. KBV und FCF-Rendite erfordern außerdem eine stichtagsbezogene ausstehende Aktienzahl und ggf. belegte Investitionsausgaben. Die verwässerte **durchschnittliche** Aktienzahl wird nicht als exakte Bilanzstichtags-Aktienzahl ausgegeben.

Das Modul berechnet **keinen fairen Unternehmenswert, keine Sicherheitsmarge, keine Kaufzone und keine Orderfreigabe**. Die bisherige UNITY-5.1-Entscheidungslogik und ihre Veto-Regeln bleiben vollständig unverändert.

## Datenabdeckung – nächste Stufen

Aktuell sind vier europäische Pilotunternehmen mit fünf geprüften Kernwerten versorgt (ABB, Schneider Electric, Siemens Energy, Infineon); zusätzlich existieren SEC-Jahresdatensätze für ausgewählte US/US-registrierte Unternehmen. Der neue Datenvertrag ist nicht mit umfassender weltweiter Quellenabdeckung gleichzusetzen. Weiterer Aufbau: prior-period audited PDFs für die drei PDF-Pilotwerte, weitere eindeutig identifizierte Emittenten-Adapter, verifizierte EPS/Aktienzahl/Capex/Guidance-Daten und anschließend fair-value-Modelle mit Fehlertoleranz, Bandbreiten und unabhängiger Kauf-Freigabe.

Keine Änderungen an privaten Depotdaten, Kontoanmeldungen, iPhone-Austausch, pCloud oder PC-Architektur. Ein ausführbarer Test belegt Währungs-Konversion, Umsatz-/Gewinnentwicklung, Quellenkonflikte, harte fehlende Daten und die Nicht-Freigabe jeder Snapshot-Order.
