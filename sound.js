/**
 * Töne & Tierreaktionen für KNACKEVOLL!
 *
 * Alle Klänge werden live mit der Web-Audio-API erzeugt – es werden keine
 * Audiodateien benötigt, alles funktioniert auch offline. Die Tierreaktionen
 * (Hüpfen, Wackeln, Sprechblase) sind rein optisch und laufen auch bei
 * ausgeschaltetem Ton.
 *
 * app.js ruft nur window.KnackSound.play(name, tierId, reaktion) auf.
 */
(function () {
  const STORAGE_KEY = 'knackevoll_sound';

  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem(STORAGE_KEY) === 'off'; } catch (e) { /* Speicher nicht verfügbar */ }

  // Noten (Hz)
  const C4 = 261.63, E4 = 329.63, G4 = 392, A4 = 440, B4 = 493.88;
  const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880;
  const C6 = 1046.5, E6 = 1318.5, G6 = 1568, C7 = 2093;

  function getCtx() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    return ctx;
  }

  /* Ein einzelner Ton: Frequenz, Startzeit (s), Dauer (s), Optionen */
  function tone(freq, t0, dur, opts = {}) {
    const { type = 'sine', gain = 0.2, to = null, vibrato = 0, filter = 0 } = opts;
    const c = ctx;
    const start = c.currentTime + t0;

    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);

    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.02, dur / 4));
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    if (vibrato) {
      const lfo = c.createOscillator();
      lfo.frequency.value = 6;
      const lfoGain = c.createGain();
      lfoGain.gain.value = vibrato;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(start);
      lfo.stop(start + dur + 0.05);
    }

    if (filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      osc.connect(f);
      f.connect(env);
    } else {
      osc.connect(env);
    }
    env.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  /* Folge von Tönen im gleichen Abstand */
  function seq(freqs, step, dur, opts = {}) {
    freqs.forEach((f, i) => tone(f, i * step, dur, opts));
  }

  /* Tierstimmen: jedes Tier klingt anders */
  const VOICES = {
    cat() {
      tone(520, 0, 0.18, { type: 'triangle', gain: 0.22, to: 900 });
      tone(900, 0.16, 0.3, { type: 'triangle', gain: 0.2, to: 520, vibrato: 12 });
    },
    raptor() {
      tone(900, 0, 0.07, { type: 'square', gain: 0.1, to: 1400 });
      tone(1000, 0.1, 0.07, { type: 'square', gain: 0.1, to: 1500 });
      tone(320, 0.22, 0.35, { type: 'sawtooth', gain: 0.18, to: 110, vibrato: 25, filter: 1200 });
    },
    bear() {
      tone(130, 0, 0.5, { type: 'sawtooth', gain: 0.3, to: 85, vibrato: 8, filter: 500 });
      tone(100, 0.45, 0.35, { type: 'sawtooth', gain: 0.25, to: 70, filter: 400 });
    },
    unicorn() {
      seq([C6, E6, G6, C7], 0.07, 0.18, { gain: 0.14 });
      tone(G6, 0.32, 0.4, { gain: 0.1, to: C7, vibrato: 20 });
    },
    camel() {
      tone(230, 0, 0.55, { type: 'sawtooth', gain: 0.2, to: 170, vibrato: 20, filter: 900 });
    }
  };

  /* Alle Klänge des Spiels */
  const SOUNDS = {
    take:   () => tone(520, 0, 0.09, { gain: 0.18, to: 880 }),
    unpack: () => tone(700, 0, 0.1, { gain: 0.16, to: 400 }),
    pick:   () => { tone(600, 0, 0.06, { type: 'triangle', gain: 0.16, to: 760 }); tone(760, 0.07, 0.07, { type: 'triangle', gain: 0.14, to: 940 }); },
    error:  () => { tone(190, 0, 0.12, { type: 'square', gain: 0.07, to: 160 }); tone(150, 0.13, 0.16, { type: 'square', gain: 0.07, to: 120 }); },
    bundle:   () => seq([G4, C5, E5], 0.06, 0.09, { type: 'triangle', gain: 0.16 }),
    unbundle: () => seq([E5, C5, G4], 0.06, 0.09, { type: 'triangle', gain: 0.16 }),
    place10: () => { tone(140, 0, 0.16, { gain: 0.35, to: 65 }); tone(900, 0, 0.03, { type: 'triangle', gain: 0.08 }); },
    place5:  () => { tone(220, 0, 0.13, { gain: 0.3, to: 110 }); tone(1100, 0, 0.03, { type: 'triangle', gain: 0.08 }); },
    place1:  () => { tone(330, 0, 0.1, { gain: 0.25, to: 165 }); tone(1300, 0, 0.03, { type: 'triangle', gain: 0.08 }); },
    row:   () => seq([C6, E6, G6], 0.09, 0.2, { gain: 0.16 }),
    plus:  () => seq([E5, G5], 0.09, 0.16, { type: 'triangle', gain: 0.2 }),
    minus: () => seq([G5, E5], 0.09, 0.16, { type: 'triangle', gain: 0.2 }),
    fox: () => {
      seq([A4, E5, A5], 0.07, 0.09, { type: 'triangle', gain: 0.16 });
      tone(1500, 0.26, 0.3, { gain: 0.1, to: 700, vibrato: 30 });
    },
    deliver:    () => { seq([C5, E5, G5, C6], 0.1, 0.18, { type: 'triangle', gain: 0.2 }); tone(C6, 0.4, 0.5, { gain: 0.14 }); },
    deliverPro: () => { seq([C5, E5, G5, C6, E6], 0.09, 0.2, { type: 'triangle', gain: 0.2 }); tone(E6, 0.45, 0.6, { gain: 0.14 }); tone(C5, 0.45, 0.6, { gain: 0.1 }); },
    knackevoll: () => {
      seq([C5, C5, C5, G5], 0.12, 0.14, { type: 'square', gain: 0.1 });
      seq([E5, G5, C6], 0.14, 0.4, { type: 'triangle', gain: 0.2 });
      tone(C6, 0.8, 0.7, { gain: 0.14 });
      tone(E6, 0.8, 0.7, { gain: 0.1 });
    },
    season_spring: () => seq([C5, E5, G5, C6], 0.09, 0.25, { gain: 0.15 }),
    season_summer: () => seq([G4, B4, D5, G5], 0.11, 0.3, { type: 'triangle', gain: 0.18 }),
    season_autumn: () => seq([E4, G4, C5, E5], 0.14, 0.34, { type: 'triangle', gain: 0.18 }),
    season_winter: () => seq([E6, G6, C7, G6], 0.12, 0.45, { gain: 0.1 }),
    winter: () => {
      seq([G5, E5, C5, G4, E4, C4], 0.32, 0.5, { type: 'triangle', gain: 0.16 });
      tone(C4, 2.0, 1.2, { gain: 0.1, filter: 600 });
    },
    voice: (animalId) => (VOICES[animalId] || VOICES.camel)()
  };

  // Mindestabstand je Klang, damit schnelle Mehrfach-Auslöser nicht klirren
  const MIN_GAP = { error: 350, take: 60, unpack: 60 };
  const lastPlayed = {};

  /* ---------- Tierreaktionen (optisch) ---------- */
  const REACT_CLASSES = ['react-happy', 'react-cheer', 'react-oops', 'react-sly', 'react-sleep'];
  const BUBBLES = {
    happy: ['❤️', '⭐', '😊'],
    cheer: ['💥', '🎉', '⭐'],
    oops:  ['💦', '❓', '🙈'],
    sly:   ['🦊', '😏'],
    sleep: ['💤']
  };

  function react(kind) {
    const el = document.getElementById('topDownAnimalSVG');
    const bubble = document.getElementById('animalBubble');
    if (el) {
      REACT_CLASSES.forEach(c => el.classList.remove(c));
      void el.offsetWidth; // Animation neu starten
      el.classList.add('react-' + kind);
    }
    if (bubble) {
      const list = BUBBLES[kind] || ['⭐'];
      bubble.textContent = list[Math.floor(Math.random() * list.length)];
      bubble.classList.remove('show');
      void bubble.offsetWidth;
      bubble.classList.add('show');
    }
  }

  /* ---------- Schalter ---------- */
  function updateSoundButton() {
    const btn = document.getElementById('soundToggleBtn');
    if (btn) btn.textContent = muted ? '🔇' : '🔊';
  }

  function setMuted(value) {
    muted = Boolean(value);
    try { localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on'); } catch (e) { /* ignorieren */ }
    updateSoundButton();
  }

  /* ---------- Öffentliche Schnittstelle ---------- */
  window.KnackSound = {
    names: Object.keys(SOUNDS),
    isMuted: () => muted,
    setMuted,
    react,

    /* name = Klang, animalId = Tier (für die Stimme), reaction = optionale Tierreaktion */
    play(name, animalId, reaction) {
      if (reaction) react(reaction);
      if (muted) return;
      const fn = SOUNDS[name];
      if (!fn) return;

      const now = Date.now();
      if (now - (lastPlayed[name] || 0) < (MIN_GAP[name] || 0)) return;
      lastPlayed[name] = now;

      if (!getCtx()) return;
      try {
        fn(animalId);
      } catch (err) {
        console.warn('Ton konnte nicht abgespielt werden:', name, err);
      }
    }
  };

  updateSoundButton();
})();

/* ---------- Von index.html aufgerufen ---------- */
function toggleSound() {
  const nowMuted = !window.KnackSound.isMuted();
  window.KnackSound.setMuted(nowMuted);
  if (!nowMuted) window.KnackSound.play('pick');
}

// Für Erwachsene (Spiel-Setup): alle Klänge und Tierreaktionen nacheinander anhören
const SOUND_DEMO_LIST = [
  ['pick', 'Karte / Auftrag wählen', null],
  ['take', 'Fracht einladen', null],
  ['unpack', 'Fracht auspacken', null],
  ['error', 'Das geht nicht (Wackel-Regel)', 'oops'],
  ['bundle', 'Bündeln', null],
  ['unbundle', 'Entbündeln', null],
  ['place10', 'Ablegen: 10er', null],
  ['place5', 'Ablegen: 5er', null],
  ['place1', 'Ablegen: 1er', null],
  ['row', 'Reihe voll', 'happy'],
  ['plus', 'Plus-Karte geschafft', 'happy'],
  ['minus', 'Minus-Karte geschafft', 'happy'],
  ['fox', 'Wüstenfuchs ausgetrickst', 'sly'],
  ['deliver', 'Lieferung geschafft', 'happy'],
  ['deliverPro', 'Profi-Packer', 'cheer'],
  ['knackevoll', 'KNACKEVOLL!', 'cheer'],
  ['season_spring', 'Frühling', 'happy'],
  ['season_summer', 'Sommer', 'happy'],
  ['season_autumn', 'Herbst', 'happy'],
  ['season_winter', 'Winter', 'happy'],
  ['voice', 'Tierstimme', 'happy'],
  ['winter', 'Winterschlaf', 'sleep']
];
let soundDemoRunning = false;

async function soundDemo() {
  if (soundDemoRunning) return;
  soundDemoRunning = true;
  window.KnackSound.setMuted(false);
  const animalId = typeof config !== 'undefined' ? config.animal.id : 'camel';
  for (const [name, label, reaction] of SOUND_DEMO_LIST) {
    if (typeof showToast === 'function') showToast(label);
    window.KnackSound.play(name, animalId, reaction);
    await new Promise(resolve => setTimeout(resolve, name === 'winter' ? 3200 : 1100));
  }
  soundDemoRunning = false;
}
