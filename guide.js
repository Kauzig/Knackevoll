/**
 * Ingame-Anleitung für Eltern und Lehrkräfte.
 *
 * Der Text wird beim Öffnen aus den echten Spielwerten zusammengesetzt (Punkte, Sterne-Grenzen,
 * Höhlengrößen, Stückzahl pro Karte …). So bleibt die Anleitung korrekt, wenn Regeln angepasst werden.
 * Zu jedem Baustein steht ein Satz „So sagst du es dem Kind“ in kindgerechter Sprache.
 */

function guideChip(size, label) {
  return `<span class="mini-cargo-chip chip-${size}">${label}</span>`;
}

// Kindgerechte Erklärung zum Vorlesen / Sinngemäß-Weitersagen
function guideSay(text) {
  return `<p class="guide-say"><span aria-hidden="true">💬</span> <em>${text}</em></p>`;
}

function guideSection(icon, title, body, open = false) {
  return `
    <details class="guide-section" ${open ? 'open' : ''}>
      <summary><span class="guide-icon" aria-hidden="true">${icon}</span> ${title}</summary>
      <div class="guide-content">${body}</div>
    </details>
  `;
}

function renderGuide() {
  const dims1 = getCaveDims(1);
  const dims2 = getCaveDims(2);
  const lim1 = CAVE_STAR_LIMITS[1];
  const lim2 = CAVE_STAR_LIMITS[2];
  const p = CRATE_POINTS;

  const quickStart = `
    <p><strong>Worum geht es?</strong> Kinder lernen Zahlen als <em>Bündel</em> kennen:
       ${guideChip(10, '1 Blaue')} = ${guideChip(5, '2 Gelbe')} = ${guideChip(1, '10 Rote')}.
       Sie zerlegen Zahlen bis 10 bzw. 20, rechnen mit Zehnern und Einern und merken beim Spielen,
       dass Bündeln schneller und ordentlicher ist als Einzelzählen.</p>
    <ol class="guide-steps">
      <li><strong>Profil wählen.</strong> Jedes Kind bekommt ein eigenes Profil (Name oben links). So hat es seine eigenen Einstellungen, seine Statistik und seine Höhlen.</li>
      <li><strong>Spiel-Setup:</strong> Packtier und Fracht aussuchen lassen (das motiviert), Zahlenraum und Modus wählen – Empfehlung unter „Stufen &amp; Auswahl“.</li>
      <li><strong>Übungsrunde:</strong> Beim ersten Start führt eine Hand durch zwei kleine Aufgaben. Das Kind soll sie <em>selbst</em> nachmachen. Im Setup lässt sie sich über „🎓 Übungsrunde starten“ wiederholen.</li>
      <li><strong>Danebensitzen, nicht vorsagen.</strong> Die Fragen unter „Kinder begleiten“ helfen, ohne die Lösung zu verraten.</li>
      <li><strong>10 bis 15 Minuten</strong> reichen. Der Spielstand wird laufend gespeichert, man kann jederzeit aufhören.</li>
    </ol>`;

  const blocks = `
    <table class="guide-table">
      <tr><td>${guideChip(10, '10er')}</td><td><strong>Blaue Kiste</strong> – 10 Plätze, füllt eine ganze Tasche.</td></tr>
      <tr><td>${guideChip(5, '5er')}</td><td><strong>Gelber Sack</strong> – halb so lang, bis zur Naht in der Mitte.</td></tr>
      <tr><td>${guideChip(1, '1er')}</td><td><strong>Rote Einheit</strong> – ein einzelner Platz.</td></tr>
    </table>
    ${guideSay('Ein blauer Block ist so viel wert wie zwei gelbe oder zehn rote. Probier es aus: Entbündle den blauen!')}
    <ul>
      <li><strong>Offener Markt</strong> (drei Depots): Antippen legt das Stück in die Tasche. Es ist immer genug da.</li>
      <li><strong>Satteltaschen:</strong> Die <em>linke</em> ist die Zehner-Tasche (10 Plätze). Die <em>rechte</em> ist die Überlauf-Tasche für die Einer und gehört nur zu Stufe 2 (insgesamt 20 Plätze). Das Tier ist von oben zu sehen.</li>
      <li><strong>Packtier &amp; Lizenz:</strong> Nur zur Personalisierung („Ich bin der Raptor und fahre Feenstaub“). Das Tier antippen macht seine Stimme.</li>
      <li><strong>Frachtbrief:</strong> Zeigt Tier und Lizenz des Kindes.</li>
      <li><strong>Höhle</strong> (nur Wintervorrat): Das Lager des Tieres als Raster – Stufe 1 hat ${dims1.rows}×${dims1.cols} Felder, Stufe 2 hat ${dims2.rows}×${dims2.cols}. Dort wird die Fracht hineingepuzzelt.</li>
    </ul>`;

  const rules = `
    <ul>
      <li><strong>Erst links, dann rechts.</strong> Die rechte Tasche öffnet erst, wenn die linke genau 10 enthält. So wird jede Zahl über 10 als „ein Zehner und Einer“ gelesen.
        ${guideSay('Das Tier packt immer zuerst die linke Tasche voll. Eine 14 ist: links ein Zehner voll, rechts 4.')}</li>
      <li><strong>Wackel-Regel.</strong> Passt ein Stück nicht mehr in die Tasche, wackelt sie, es klingt tief, und das Tier wackelt mit. Das ist <em>kein</em> Fehler im Sinne von „falsch“, sondern der Hinweis zum Nachdenken.
        ${guideSay('Wenn es wackelt, passt das Stück nicht mehr rein. Wie viele Plätze sind noch frei? Welches Stück passt?')}</li>
      <li><strong>Entbündeln.</strong> Ein Knopf an der Tasche macht aus einem 10er zwei 5er und aus einem 5er fünf 1er. Hilfreich, wenn man zu viel genommen hat oder ein Stück sonst nicht passt.
        ${guideSay('Man kann die blaue Kiste aufschnüren: Dann hast du zwei gelbe Säcke. Und aus einem gelben Sack werden fünf rote.')}</li>
      <li><strong>Auspacken.</strong> Eine Kiste in der Tasche antippen nimmt sie wieder heraus. <em>Spiegelregel:</em> Zuerst muss die rechte Tasche leer sein, dann erst die linke.</li>
      <li><strong>Bündeln</strong> (nur Wintervorrat): Die Knöpfe 🔗 fassen fünf Einer zu einem 5er und zwei 5er zu einem 10er zusammen. Das macht die Fracht übersichtlicher und bringt am Ende mehr Punkte.</li>
    </ul>`;

  const endless = `
    <ul>
      <li><strong>Auftrag wählen:</strong> Drei Auftragskarten liegen offen. Jede zeigt die Zahl, das Streifenbild und das Profi-Ziel (⭐ mit Kistensymbolen). Die Auswahl kostet nichts, danach bleibt der Auftrag bis zur Lieferung fest.</li>
      <li><strong>Packen:</strong> Das Kind lädt aus dem Markt genau so viel ein, wie der Auftrag verlangt. Zu viel geladen? Entbündeln und den Überschuss auspacken.</li>
      <li><strong>Lieferung:</strong> Sobald die Summe stimmt, gibt es ein Feierfenster. Das <em>Profi-Packer-Ziel</em> (⭐ mit Kistenbild) sagt, mit wie wenigen Stücken es ginge.
        ${guideSay('Schaffst du es mit nur drei Kisten? Dann bist du Profi-Packer.')}</li>
      <li><strong>Ende:</strong> Es gibt keines. Der Modus eignet sich für kurze, einzelne Runden.</li>
    </ul>`;

  const winter = `
    <p>Die Tiere packen Vorräte für den Winter. Das Tier trägt seine Ladung <em>von Zug zu Zug weiter</em>. Wird die Höhle voll, ist das Spiel zu Ende.</p>
    <ul>
      <li><strong>Drei Karten liegen offen.</strong>
        <span class="winter-mini card-plus">🧺+6</span> <em>Einkaufen:</em> Das Kind holt so viel vom Markt – mit <strong>höchstens ${WINTER_MAX_TAKES} Stücken</strong> (✋✋). Das erzwingt das Bündeln.<br>
        <span class="winter-mini card-minus">🏠−2</span> <em>Abladen:</em> Das Kind nimmt so viel aus den Taschen (zuerst rechts) und legt es in die Höhle.
        ${guideSay('Der Korb heißt: Ich kaufe ein, das Tier bekommt mehr. Das Haus heißt: Ich bringe etwas in die Höhle, das Tier hat dann weniger.')}</li>
      <li><strong>Karten bleiben liegen.</strong> Eine nicht gespielte Karte behält ihren Platz, solange sie noch lösbar ist. So kann das Kind vorausplanen. Während man eine Karte spielt, sind die anderen klein zu sehen. Mit ↩ nimmt man den Zug zurück.</li>
      <li><strong>Passt nicht? Dann denken.</strong> Ein Stück, das nicht mehr in die Tasche passt, wird abgelehnt (Wackel-Regel). Ist das Ziel nicht mehr zu erreichen, blinkt ↩. Oft hilft eine andere Zerlegung, zum Beispiel 5 + 5 statt 10, wenn links nur noch 5 frei sind.</li>
      <li><strong>💥 KNACKEVOLL!</strong> Wird das Tier ganz voll (Stufe 1: 10, Stufe 2: 20), wandert alles auf einen Schlag in die Höhle, und es gibt eine kleine Feier. Die Auswertung zählt mit, wie oft das passiert ist.
        ${guideSay('Wenn das Tier ganz voll ist, ruf KNACKEVOLL!')}</li>
      <li><strong>Einlagern.</strong> Die Fracht liegt als Teile bereit. <em>Teil oben antippen, dann ein Feld in der Höhle antippen:</em> Es erscheint eine Vorschau (grün = passt, rot = passt nicht). Ein zweites Antippen irgendwo auf der Vorschau legt dort ab. „↻ Drehen“ stellt ein Teil hochkant. Teile der aktuellen Lieferung nimmt man durch Antippen wieder heraus. Eine volle Reihe gibt einen 💎.
        ${guideSay('Leg deine Kisten so, dass keine Lücken bleiben. Eine ganz volle Reihe bringt einen Edelstein.')}</li>
      <li><strong>Jahreszeiten.</strong> Je voller die Höhle, desto weiter zieht das Jahr: 🌸 Frühling, ☀️ Sommer, 🍂 Herbst, ❄️ Winter. Der Bildschirm ändert dabei seine Farben.</li>
      <li><strong>Ende:</strong> Ist die Höhle voll, hält das Tier ❄️ Winterschlaf und die Auswertung erscheint. Mit „🌸 ▶“ beginnt ein neues Jahr in einer leeren Höhle.</li>
    </ul>`;

  const scoring = `
    <p><strong>Bündeln lohnt sich:</strong> Jede abgelegte Kiste bringt Punkte, größere Stücke sind mehr wert, als es ihre Plätze wären.</p>
    <table class="guide-table guide-table-points">
      <tr><td>${guideChip(10, '10er')}</td><td><strong>${p[10]} Punkte</strong></td><td>zehn Einer wären nur 10</td></tr>
      <tr><td>${guideChip(5, '5er')}</td><td><strong>${p[5]} Punkte</strong></td><td>fünf Einer wären nur 5; zwei 5er ergeben ${2 * p[5]}, ein 10er dagegen ${p[10]}</td></tr>
      <tr><td>${guideChip(1, '1er')}</td><td><strong>${p[1]} Punkt</strong></td><td></td></tr>
    </table>
    <ul>
      <li><strong>📦 Packen</strong> (1 bis 3 Sterne): Stufe 1: 2 Sterne ab ${lim1.points[0]} Punkten, 3 Sterne ab ${lim1.points[1]}. Stufe 2: 2 Sterne ab ${lim2.points[0]}, 3 Sterne ab ${lim2.points[1]}.</li>
      <li><strong>🃏 Tempo</strong> (1 Stern): bei höchstens ${lim1.maxCards} Karten (Stufe 1) bzw. ${lim2.maxCards} (Stufe 2).</li>
      <li><strong>💥 KNACKEVOLL:</strong> Wie oft das Tier randvoll war.</li>
      <li><strong>Rekord</strong> pro Tier und Stufe: die meisten Punkte (mit und ohne Fuchs getrennt gezählt).</li>
    </ul>
    ${guideSay('Große Kisten bringen mehr Sterne. Wer gut bündelt, bekommt am Ende mehr!')}
    <p class="guide-note">Die Sterne-Grenzen sind aus Testspielen geschätzt. Das Kind muss die Punkte nicht ausrechnen – es sieht beim Ablegen „+${p[10]} ⭐“ und merkt: große Kiste, große Zahl.</p>`;

  const fox = `
    <p>Rick, der Wüstenfuchs, ist ein Schelm: Er legt sich auf ein Depot im Markt und blockiert es. Das Kind muss einen anderen Weg finden.</p>
    <ul>
      <li><strong>Vorausplanen:</strong> Rick bleibt für eine ganze Lieferung (bzw. einen Einkaufs-Zug) auf demselben Depot. Über dem Markt steht, wo er gerade liegt und wohin er danach zieht. Die Karten sind so gewählt, dass sich jeder Auftrag trotz Sperre lösen lässt.</li>
      <li><strong>Beispiel:</strong> Rick liegt auf den 5er-Säcken, gebraucht wird aber ein 5er. Dann kann das Kind eine 10er-Kiste nehmen, sie entbündeln und die überzähligen Stücke zurücklegen – oder mit Einern auffüllen.</li>
      <li><strong>Belohnung:</strong> Wer die Karte trotzdem schafft, bekommt die <em>Fuchs-Beute</em> (je nach Lizenz zum Beispiel ein goldener Honigtopf). Im Wintervorrat steht sie auf dem Schatzregal der Höhle. Sie funkelt, wenn das Kind dafür entbündelt hat. Wenn <em>jede</em> Beute funkelt, gibt es 🦊 🏆.</li>
      <li><strong>Wann?</strong> Für Kinder, die das Packen schon sicher beherrschen. Rick lässt sich im Setup ein- und ausschalten. Eine Beute gibt es nur, wenn seine Sperre für die gewählte Karte wirklich im Weg war.</li>
    </ul>
    ${guideSay('Rick schläft auf einem Stapel. Du musst dir etwas anderes einfallen lassen – geht es mit einem größeren Stück, das du aufteilst?')}`;

  const levels = `
    <ul>
      <li><strong>Stufe 1 – Zahlenraum bis 10:</strong> Eine Tasche, im Wintervorrat eine Höhle mit ${dims1.rows}×${dims1.cols} Feldern. Geeignet ab dem Schulanfang (1. Halbjahr).</li>
      <li><strong>Stufe 2 – Zahlenraum bis 20:</strong> Zwei Taschen mit Zehnerübergang, Höhle mit ${dims2.rows}×${dims2.cols} Feldern. Geeignet ab dem 2. Halbjahr. Auf dieser Stufe passt manchmal das „Idealstück“ nicht mehr in die linke Tasche, und das Kind muss selbst zerlegen. Das ist gewollt.</li>
      <li><strong>Endlos-Karawane</strong> ist der leichtere Einstieg (Zahlen zerlegen). <strong>Wintervorrat</strong> verlangt zusätzlich Plus und Minus mit Zustand und räumliches Denken beim Einlagern.</li>
      <li><strong>Empfohlene Reihenfolge:</strong> Endlos Stufe 1 → Wintervorrat Stufe 1 → Endlos Stufe 2 → Wintervorrat Stufe 2 → Fuchs zuschalten.</li>
      <li><strong>Dauer:</strong> Ein ganzer Winter dauert deutlich länger als eine Sitzung. Er wird gespeichert, man macht beim nächsten Mal einfach weiter.</li>
    </ul>`;

  const coaching = `
    <ul>
      <li><strong>Fragen statt Vorsagen:</strong>
        <ul class="guide-questions">
          <li>„Wie viele fehlen noch?“</li>
          <li>„Wie viele Plätze sind links noch frei? Welches Stück passt da hinein?“</li>
          <li>„Was ist mehr wert: zwei gelbe oder eine blaue?“</li>
          <li>„Geht das auch mit weniger Kisten?“</li>
          <li>„Was könntest du statt der Einer nehmen?“</li>
        </ul></li>
      <li><strong>Wackeln gehört dazu.</strong> Nicht korrigieren, sondern nachfragen. Das Kind soll sehen, <em>warum</em> es nicht passt.</li>
      <li><strong>Zählt das Kind einzeln?</strong> Fragen: „Gibt es ein größeres Stück, das hineinpasst?“ Das Spiel belohnt Bündeln bewusst.</li>
      <li><strong>Tipp für zwei Kinder an einem Gerät:</strong> Abwechselnd eine Karte wählen. Einer packt, der andere schaut zu und sagt, ob es stimmt („Kontrolleur“).</li>
      <li><strong>Was geübt wird:</strong> Zahlen als Zehner und Einer sehen, Zerlegen und Ergänzen bis 10 bzw. 20, Plus und Minus mit Zehnerübergang (Wintervorrat, Stufe 2), Raumvorstellung beim Einlagern.</li>
      <li><strong>Kommt ein Kind nicht weiter?</strong> Im Wintervorrat kann es den Zug mit ↩ abbrechen und neu anfangen, im Endlos-Modus Fracht wieder auspacken. Es ist nichts verloren.</li>
    </ul>`;

  const tech = `
    <ul>
      <li><strong>Profile:</strong> Name oben links antippen – dort Kinder anlegen, wechseln und die Statistik ansehen. Wer ein Profil mit ✖ löscht, löscht auch dessen Statistik und Höhlen unwiderruflich.</li>
      <li><strong>Spiel-Setup:</strong> Tier, Fracht, Stufe, Fuchs und Modus. Jede Kombination aus Tier und Stufe hat ihre eigene Höhle.</li>
      <li><strong>🔄 Neustart:</strong> Legt neue Aufträge bzw. Karten aus. Der Fortschritt in der Höhle bleibt erhalten.</li>
      <li><strong>🔊 Ton:</strong> Oben ein- und ausschalten (wird gemerkt). Im Setup spielt „▶ Töne testen“ alle Klänge vor. Die Tierreaktionen laufen auch ohne Ton.</li>
      <li><strong>Touch (Tablet):</strong> In der Höhle erst antippen (Vorschau), dann noch einmal auf die Vorschau tippen. Das ✔ pulsiert, wenn das Teil dort passt.</li>
      <li><strong>Datenschutz:</strong> Namen, Einstellungen und Spielstände werden nur lokal im Browser dieses Geräts gespeichert. Das Spiel selbst sendet keine Daten ins Internet.</li>
      <li><strong>Gerätewechsel:</strong> Spielstände wandern nicht mit. Je nach Browser können lokale Daten außerdem nach längerer Nichtnutzung oder beim Löschen der Browserdaten verloren gehen.</li>
    </ul>`;

  return [
    guideSection('🚀', 'Schnellstart', quickStart, true),
    guideSection('🧱', 'Die Bausteine – was ist was?', blocks),
    guideSection('📏', 'Die Regeln beim Packen', rules),
    guideSection('🐪', 'Modus „Endlos-Karawane“', endless),
    guideSection('❄️', 'Modus „Wintervorrat“', winter),
    guideSection('⭐', 'Punkte &amp; Sterne', scoring),
    guideSection('🦊', 'Rick, der Wüstenfuchs', fox),
    guideSection('🎚️', 'Stufen &amp; Auswahl', levels),
    guideSection('💬', 'Kinder begleiten', coaching),
    guideSection('🔧', 'Bedienung, Profile &amp; Datenschutz', tech)
  ].join('');
}

function openGuide() {
  document.getElementById('guideBody').innerHTML = renderGuide();
  document.getElementById('guideModal').classList.remove('hidden');
  document.getElementById('guideModal').scrollTop = 0;
}

function closeGuide() {
  document.getElementById('guideModal').classList.add('hidden');
}

// Alle Abschnitte aufklappen (für den Druck) – auch beim Drucken per Tastatur (Strg+P)
function openAllGuideSections() {
  document.querySelectorAll('#guideBody details').forEach(d => { d.open = true; });
}

function printGuide() {
  openAllGuideSections();
  window.print();
}

window.addEventListener('beforeprint', () => {
  if (!document.getElementById('guideModal').classList.contains('hidden')) openAllGuideSections();
});
