/**
 * Story-Daten: Episoden des Abenteuers „Der Knackevolle Schatz“.
 * Hintergrund und Figuren stehen in STORY.md.
 *
 * Seiten ({ who, text }) werden in story.js als Szenen gezeigt. Pro Seite 1–2 kurze Sätze.
 *   who:    'narrator' | 'rick' | 'npc' (mit icon + name) | Tier-Id (z. B. 'camel')
 *           Ist das Tier der Held, springt automatisch ein anderes Crew-Tier ein.
 *   Platzhalter im Text: {tier} / {Tier} = Tier des Kindes mit Artikel, {fracht} = gewählte Fracht-Lizenz.
 *   Die Fracht im Spiel ist die Lizenz des Kindes – Texte nennen deshalb nie eine feste Fracht.
 *
 * Episoden-Skript (Endlos-Karawane):
 *   orders: feste Zielzahlen in Lieferreihenfolge (die ersten drei liegen gleichzeitig aus)
 *   rick:   Rick-Sperre je Lieferung (5, 10 oder 1). Jede Sperre sollte zu den Aufträgen passen,
 *           also in deren Idealzerlegung vorkommen, sonst bleibt Rick wirkungslos.
 */
const STORY_FRAGMENT_TOTAL = 7;

// Reihenfolge, in der Crew-Tiere einspringen, wenn die Rolle gerade der Held ist
const STORY_CREW_ORDER = ['camel', 'bear', 'cat', 'sloth', 'unicorn', 'raptor'];

// Prolog: Grundhandlung und Team. Läuft beim ersten Öffnen des Abenteuers und lässt sich auf der Karte wiederholen.
const STORY_PROLOGUE = [
  { who: 'narrator', icon: '🗺️', text: 'Vor langer Zeit packte der Ur-Packmeister Knack das perfekteste Lager der Welt: den Knackevollen Schatz.' },
  { who: 'narrator', icon: '📦', text: 'Dort passt alles. Nichts wackelt. Jedes Fach ist randvoll.' },
  { who: 'narrator', icon: '🧩', text: 'Den Weg dorthin zeigt ein Packplan. Der wurde in 7 Stücke zerrissen und in alle Winde verstreut.' },
  { who: 'narrator', icon: '🐪', text: 'Deine Karawane liefert Fracht, packt klug und sucht unterwegs die Teile des Plans!' }
];

// Schluss des Prologs: Warum es zur Wüstenoase geht (führt direkt zu Folge 1). Die letzte Zeile spricht der Held.
const STORY_PROLOGUE_END = [
  { who: 'narrator', icon: '✉️', text: 'Heute Morgen kam ein Brief: Die Oase hinter dem Wüstentor braucht dringend {fracht}!' },
  { who: 'narrator', icon: '👂', text: 'Und auf dem Basar flüstert man sich zu: In der Oase soll ein altes Stück vom Packplan versteckt sein!' }
];
const STORY_PROLOGUE_HERO_END = 'Das ist unsere Chance! Auf zur Oase!';

// Vorstellung der Crew in der Ich-Form (der Held stellt sich separat vor)
const STORY_TEAM = {
  unicorn: 'Ich bin das Einhorn! Ich erkenne jedes Zeichen des Schicksals. Meistens.',
  raptor: 'Ich bin der Raptor! Ich habe einen Plan: einfach ganz schnell rennen!',
  bear: 'Ich bin der Bär. Erst Honig, dann Plan, dann… mehr Honig.',
  cat: 'Ich bin die Katze. Ich weiß schon, wo es langgeht. Erklären werde ich es nicht.',
  camel: 'Ich bin das Kamel. Quittung? Habe ich. Vertrag? Gelesen. Vorschriften? Auswendig.',
  sloth: 'Ich bin… das Faultier. Ich… komme… gleich. Habe ich… was verpasst?'
};

const STORY_EPISODES = [
  {
    id: 'ep1',
    title: 'Der Zoll am Wüstentor',
    place: '🏜️',
    fragment: 1,
    mode: 'endless',
    level: 1,
    orders: [7, 9, 8],
    rick: [5, 1, 5],
    briefing: [
      { who: 'narrator', text: 'Die Karawane erreicht das Wüstentor. Dahinter liegt die Oase, und die wartet schon auf {fracht}!' },
      { who: 'npc', icon: '🧔', name: 'Oasenwirt', text: 'Eilig, eilig! Aber bitte ordentlich gepackt, sonst fällt alles runter!' },
      { who: 'camel', text: 'Alle Papiere sind in Ordnung. Fast. Irgendetwas stimmt hier nicht.' }
    ],
    rickScene: [
      { who: 'narrator', text: 'Mitten auf dem Weg steht ein winziges Zollhäuschen aus Pappe.' },
      { who: 'rick', text: 'Willkommen am Rick-Zoll! Heute leider keine Fünfer-Kisten. Nein, ich habe keinen Grund. Rein zufällig!' },
      { who: 'rick', text: 'Und danach gibt es keine Einer. Aber das habe ich nicht gesagt!' }
    ],
    outro: [
      { who: 'narrator', text: 'Alle Lieferungen sind angekommen, und die Oase jubelt.' },
      { who: 'sloth', text: 'Hab ich… gerade… was… gesehen? In der alten Kiste da…' },
      { who: 'narrator', text: 'Tatsächlich: Zwischen den Brettern steckt ein vergilbter Papierfetzen mit einer Zeichnung.' }
    ]
  },
  {
    id: 'ep2',
    title: 'Der Hafen-Express',
    place: '⚓',
    fragment: 2,
    mode: 'endless',
    level: 2,
    orders: [16, 17, 18],
    rick: [5, 10, 5],
    briefing: [
      { who: 'narrator', text: 'Im Hafen wartet ein Gourmet-Bär auf die berühmteste {fracht} der Welt.' },
      { who: 'npc', icon: '🧑‍✈️', name: 'Hafenmeister', text: 'Das Schiff legt bald ab! Alles muss ordentlich gepackt sein, sonst bleibt es im Hafen.' },
      { who: 'unicorn', text: 'Das ist ein Zeichen, dass wir uns beeilen sollten! Oder ein Möwenschrei.' }
    ],
    rickScene: [
      { who: 'narrator', text: 'Auf dem Steg taucht Rick auf, mit einer Lupe, die er falsch herum hält.' },
      { who: 'rick', text: 'Ich sehe alles! Die Kisten, die Schiffe… ach nein, das ist mein Hut. Egal: Heute keine Fünfer!' }
    ],
    outro: [
      { who: 'narrator', text: 'Die Ladung ist an Bord, und der Gourmet-Bär schnuppert genießerisch.' },
      { who: 'narrator', text: 'Im Fischernetz hängt ein zweites Stück Papier. Es passt genau an das erste!' },
      { who: 'rick', text: 'Ich war das nicht. Ich war gar nicht hier. Ich bin schon weg!' }
    ]
  }
];
