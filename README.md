# KNACKEVOLL! – Passt, wackelt und hat Fracht!

[![Lizenz: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de)

KNACKEVOLL! ist ein browserbasierter Prototyp für den Mathematikunterricht in der Schuleingangsphase (1. Klasse). Die Anwendung unterstützt das Erlernen von Zahlenräumen bis 10 und 20 durch eine spielerische Auseinandersetzung mit Zerlegung, Bündelung und Stellenwertverständnis.

**Hinweis**: Bei der vorliegenden Anwendung handelt es sich um einen konzeptionellen Prototyp. Das didaktische Design sowie die Lernwirksamkeit wurden bisher nicht wissenschaftlich evaluiert.

## Didaktisches Konzept

Das Programm verfolgt mehrere mathematische Lernziele:

* **Bündeln und Entbündeln**: Durch die Verwendung von Frachtstücken in den Größen 10, 5 und 1 (analog zur Dienes-Logik) werden die Lernenden dazu angeregt, Zahlen nicht nur linear zu zählen, sondern in strukturierten Gruppen zu begreifen. Das Ziel des Profi-Packers fördert die Suche nach der effizientesten Zerlegung einer Zahl.
* **Stellenwertverständnis**: Die mechanische Trennung in eine linke (Zehnerstelle) und eine rechte (Einerstelle) Satteltasche visualisiert den Übergang vom Einer- zum Zehnerraum. Die Regel, die linke Tasche zuerst zu füllen, unterstützt die Internalisierung des Zehnersystems.
* **Flexibilität im Umgang mit Zahlen**: In Modulen wie dem Wüstenfuchs werden bestimmte Bündelgrößen blockiert. Dies zwingt die Lernenden dazu, alternative Zerlegungsstrategien zu finden und aktiv zu entbündeln, um die Zielzahl zu erreichen.
* **Kombination von Arithmetik und räumlichem Vorstellungsvermögen**: Im Modus Wintervorrat müssen gelieferte Frachtstücke als geometrische Einheiten in einer Höhle platziert werden. Dies verbindet die mathematische Operation (Addition/Subtraktion) mit einer räumlichen Optimierungsaufgabe.

## Spielmodi

### Endlos-Karawane
In diesem Modus erhalten die Lernenden aufeinanderfolgende Lieferaufträge mit spezifischen Zielzahlen. Der Fokus liegt auf der korrekten Zusammensetzung der Zahl unter Einhaltung der Taschenkapazitäten und der Optimierung der Stückzahl.

### Wintervorrat
Dieser Modus erweitert das Spiel um eine strategische Komponente. Frachtstücke werden nicht nur geliefert, sondern in einer Höhle eingelagert. Ziel ist es, die Höhle effizient zu füllen und volle Reihen zu erzeugen. Der Modus integriert Elemente des Ressourcenmanagements und der Flächenfüllung.

### Modul: Der schlaue Wüstenfuchs
Als optionale Erweiterung blockiert der Wüstenfuchs den Zugriff auf bestimmte Frachtgrößen am Markt. Die Lernenden müssen daher größere Einheiten bereits im Sattel entbündeln, um die fehlenden kleineren Teile zu ersetzen.

## Technische Umsetzung und Datenschutz

Die Anwendung ist als Progressive Web App (PWA) konzipiert. Alle Spielerprofile und Statistiken werden lokal im Browser über IndexedDB gespeichert. Es erfolgt keine Übertragung von Daten an externe Server, wodurch eine datenschutzkonforme Nutzung im schulischen Umfeld gewährleistet ist.

## Direkt spielen / Lokal starten

Das Spiel benötigt keinen Build-Prozess und keine externen Abhängigkeiten:
1. Repository herunterladen oder klonen.
2. `index.html` per Doppelklick in einem modernen Browser öffnen (oder über GitHub Pages bereitstellen).

## Lizenz & Urheberrecht

© 2026 **Tobias Moebert**

Dieses Projekt (Spielidee, Didaktik, Grafiken und Code) steht unter der Lizenz **[Creative Commons Namensnennung – Nicht-kommerziell – Weitergabe unter gleichen Bedingungen 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de)**.  
Bearbeitungen und Weiterentwicklungen müssen unter derselben Lizenz weitergegeben werden; eine kommerzielle Nutzung ohne vorherige schriftliche Genehmigung des Urhebers ist nicht gestattet.
