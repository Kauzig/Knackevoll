# KNACKEVOLL! – Passt, wackelt und hat Fracht!

[![Lizenz: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/deed.de)

Ein browserbasierter Prototyp für den Mathematikunterricht in der Schuleingangsphase (1. Klasse). Kinder beladen ihr gewähltes Packtier (Einhorn, Raptor, Bär, Katze oder Kamel) mit Frachtstücken im Zahlenraum bis 10 oder 20.

## Didaktisches Konzept
* **Bündeln statt Zählen:** Durch die Dienes-Farblogik (**10er-Kiste Blau**, **5er-Sack Gelb**, **1er-Einheit Rot**) und das **Profi-Packer-Ziel** werden Kinder motiviert, möglichst große Bündel zu wählen, statt mühsam einzelne Einheiten abzuzählen.
* **Stellenwertverständnis („Erst links, dann rechts“):** Die linke Satteltasche (Zehnerstelle) muss zuerst exakt auf 10 gefüllt werden, bevor die rechte Überlauf-Tasche (Einerstelle) geöffnet wird.
* **Wackel-Regel & Entbündeln:** Ein 10er-Feld darf nicht überladen werden. Im zuschaltbaren **Modul 2 („Der schlaue Wüstenfuchs“)** blockiert ein Bandit einzelne Markt-Depots, sodass Kinder größere Einheiten direkt am Sattel entbündeln (`10er → 2× 5er` oder `5er → 5× 1er`) und überzählige Stücke wieder auspacken müssen.
* **Lokale Profil- & Statistikverwaltung:** Alle Spielerprofile und Statistiken (verschickte Fracht, gepackte Tiere, Profi-Packer-Quote, ausgetrickste Wüstenfüchse) werden lokal im Browser über **IndexedDB** gespeichert.

## Direkt spielen / Lokal starten
Das Spiel benötigt keinen Build-Prozess und keine externen Abhängigkeiten:
1. Repository herunterladen oder klonen.
2. `index.html` per Doppelklick in einem modernen Browser öffnen (oder über GitHub Pages bereitstellen).

## Lizenz & Urheberrecht
© 2026 **Tobias Moebert**

Dieses Projekt (Spielidee, Didaktik, Grafiken und Code) steht unter der Lizenz **[Creative Commons Namensnennung – Nicht kommerziell 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/deed.de)**.  
Eine kommerzielle Nutzung (z. B. durch Verlage oder kostenpflichtige Lernplattformen) ist ohne vorherige schriftliche Genehmigung des Urhebers nicht gestattet.
