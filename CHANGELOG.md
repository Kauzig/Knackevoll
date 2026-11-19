# Changelog

Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/), Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).
Solange die Hauptversion `0` ist, können sich Spielstände und Verhalten zwischen Minor-Versionen ändern.

## [0.7.0]
### Hinzugefügt
- Setup neu geordnet: Der Modus ist ein Reiter oben (🐪 Endlos-Karawane, ❄️ Wintervorrat, 📖 Abenteuer mit Fortschritt). Zahlenraum und Rick bleiben im jeweiligen Modus, der Ton liegt im eigenen Reiter „⚙️ Einstellungen“, die Abenteuer-Karte direkt im Reiter. Die Buttons unten sind durch eine Linie abgesetzt.
- Zahlenraum und Rick werden pro Spielmodus gespeichert: Endlos-Karawane und Wintervorrat haben je eigene Einstellungen (ältere Profile übernehmen ihre bisherige Einstellung für beide).
- Das Setup-Fenster springt beim Wechseln der Reiter nicht mehr in der Höhe.
- Abenteuer-Modus (Story) „Der Knackevolle Schatz“: Karte mit Folgen und Packplan-Fragmenten, Szenen mit Crew-Tieren und Rick, Fortschritt pro Spielerprofil.
- Spiel-Setup lässt sich über ein ✕ oben rechts schließen (auch die Abenteuer-Karte), ohne eine neue Runde zu starten. Änderungen im Setup werden dabei verworfen, nur „Karawane starten“ übernimmt sie.
- Der Abenteuer-Reiter zeigt den Fortschritt, z. B. „2/7 🧩“.
- Prolog mit Grundhandlung und Vorstellung des Karawanen-Teams (beim ersten Öffnen, später über „Legende & Team“ wiederholbar).
- Folgen 1 und 2 (Endlos-Karawane mit festen Aufträgen und Rick-Skript).
- Rückfrage, bevor eine laufende Folge durch Setup oder Profilwechsel beendet wird.
- Neue Dateien `story-data.js` und `story.js`.

## [0.6.0]
### Hinzugefügt
- Neues Packtier: Faultier 🦥 (Top-Down-Grafik, eigene Stimme, Höhlen-Thema „Baumkronen-Vorratslager“).
### Geändert
- Auswahl von Reittier und Fracht-Lizenz wandert aus dem Spiel-Setup ins Spieler-Profil.

## [0.5.0]
### Hinzugefügt
- Zentrale Versionsnummer (`version.js`), Anzeige im Footer, Kopplung an den Service-Worker-Cache.
- Changelog.

## [0.4.0]
### Geändert
- „Wüstenfuchs“ wird zu „Rick“, inklusive angepasster Logik, UI und Ankündigung.
- Auftragsbereich auf Level 1 reicht bis 10 (erste zehn Bündel abschließbar).
### Behoben
- Rick-Overlay flackert nicht mehr.

## [0.3.0]
### Hinzugefügt
- Soundeffekte und Tierreaktionen, Ton-Schalter.
- Winterkarten: feste Slots, Mini-Vorschau wartender Karten, visuelles Feedback bei ungültigen Zügen.
- Leitfaden für Eltern und Lehrkräfte.
### Geändert
- Statistiken getrennt nach Spielmodus, mit Migration alter Profile.

## [0.2.0]
### Hinzugefügt
- Höhle mit Lager- und Abschlussmechanik, geführte Tutorial-Runde.
- Beute-System, Winter-Features.
- PWA (Manifest und Service Worker).
- Pädagogische Erläuterungen in der README.
### Geändert
- Spieldaten in `game-data.js` ausgelagert.

## [0.1.0]
### Hinzugefügt
- Erste vorzeigbare Version: Kernspiel, Spielerverwaltung, Wüstenfuchs-Modus, Statistik, README, Lizenz.
