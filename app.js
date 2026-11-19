let config = {
  animal: ANIMALS[1],
  license: LICENSES[0],
  level: 2,
  foxMode: false,        // Modul 2: Der schlaue Wüstenfuchs (im Setup zuschaltbar)
  gameMode: 'endless'    // 'endless' = Endlos-Karawane (Aufträge), 'cave' = Wintervorrat (Plus/Minus-Karten + Höhle)
};

let state = {
  activeOrder: null,     // Zielzahl (z. B. 14)
  activeFoxBlock: null,  // Sperre von Rick für den aktiven Auftrag (null, 10, 5 oder 1)
  rick: { current: null, next: null }, // Rick: aktuelle und angekündigte Sperre
  activeOrderIdx: null,
  availableOrders: [],   // Array aus { val }
  leftBag: [],           // Array aus Zahlenwerten: [10, 5, 1, ...]
  rightBag: [],
  unbundledThisOrder: false // Wurde beim aktuellen Auftrag entbündelt? (Extra-Funkeln für die Fuchs-Beute)
};

// Ton & Tierreaktion (sound.js). Fehlt das Skript, läuft das Spiel einfach stumm weiter.
function fx(name, reaction) {
  if (window.KnackSound) window.KnackSound.play(name, config.animal.id, reaction);
}

// Antippen des Tieres: Stimme + kleine Reaktion
function tapAnimal() {
  fx('voice', 'happy');
}

/* ============================================================================
   SPIELER-MANAGEMENT & STATISTIKEN (IndexedDB)
   ============================================================================ */
const DB_NAME = 'KnackevollDB';
const DB_VERSION = 1;
const STORE_PROFILES = 'profiles';

let dbInstance = null;
let profiles = [];
let activeProfile = null;

function openGameDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_PROFILES)) {
        db.createObjectStore(STORE_PROFILES, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB Fehler:', event.target.error);
      reject(event.target.error);
    };
  });
}

async function dbGetAllProfiles() {
  const db = await openGameDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROFILES, 'readonly');
    const store = tx.objectStore(STORE_PROFILES);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbSaveProfile(profile) {
  const db = await openGameDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROFILES, 'readwrite');
    const store = tx.objectStore(STORE_PROFILES);
    const req = store.put(profile);
    req.onsuccess = () => resolve(profile);
    req.onerror = () => reject(req.error);
  });
}

async function dbDeleteProfile(id) {
  const db = await openGameDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROFILES, 'readwrite');
    const store = tx.objectStore(STORE_PROFILES);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Statistik ist pro Spielmodus getrennt: stats.endless (Endlos-Karawane) und stats.cave (Wintervorrat).
// Ältere Profile hatten eine gemeinsame, flache Statistik – die gehört zur Endlos-Karawane.
function migrateStats(profile) {
  if (!profile) return;
  const old = profile.stats || {};
  if (old.endless && old.cave) return;
  profile.stats = {
    endless: {
      totalCargoSent: old.totalCargoSent || 0,
      packedAnimals: old.packedAnimals || 0,
      proPackers: old.proPackers || 0,
      foxOutsmarted: old.foxOutsmarted || 0
    },
    cave: {
      totalCargoSent: 0,
      foxOutsmarted: 0,
      cavesFilled: old.cavesFilled || 0,
      knackevoll: old.knackevoll || 0
    }
  };
}

function getModeStats(profile, mode) {
  if (!profile) return {};
  migrateStats(profile);
  return profile.stats[mode === 'cave' ? 'cave' : 'endless'];
}

/*
 * Zahlenraum und Rick sind pro Spielmodus getrennt: profile.modeSettings = { endless: {level, foxMode}, cave: {...} }.
 * Ältere Profile hatten eine gemeinsame Einstellung (profile.level / foxMode); beide Modi starten damit.
 * config.level und config.foxMode sind immer die Werte des aktuellen Modus.
 */
const fallbackSettings = {}; // Falls kein Profil geladen werden konnte

function getModeSettings(profile, mode) {
  const holder = profile || fallbackSettings;
  if (!holder.modeSettings) holder.modeSettings = {};
  const key = mode === 'cave' ? 'cave' : 'endless';
  if (!holder.modeSettings[key]) {
    holder.modeSettings[key] = { level: holder.level || 2, foxMode: Boolean(holder.foxMode) };
  }
  return holder.modeSettings[key];
}

async function initPlayerManagement() {
  try {
    profiles = await dbGetAllProfiles();
    profiles.forEach(migrateStats);
    if (profiles.length === 0) {
      const defaultProfile = {
        id: 'player_' + Date.now(),
        name: 'Karawanen-Kind',
        animalId: 'raptor',
        licenseId: 'fairy',
        level: 2,
        foxMode: false,
        createdAt: Date.now()
      };
      migrateStats(defaultProfile);
      await dbSaveProfile(defaultProfile);
      profiles = [defaultProfile];
    }

    const lastId = localStorage.getItem('knackevoll_activeProfileId');
    const found = profiles.find(p => p.id === lastId) || profiles[0];
    await selectProfile(found.id, false);
  } catch (err) {
    console.error('Fehler beim Initialisieren der Profile:', err);
  }
}

async function selectProfile(profileId, shouldRenderSetup = true) {
  const target = profiles.find(p => p.id === profileId);
  if (!target) return;

  activeProfile = target;
  localStorage.setItem('knackevoll_activeProfileId', target.id);

  config.animal = ANIMALS.find(a => a.id === target.animalId) || ANIMALS[1];
  config.license = LICENSES.find(l => l.id === target.licenseId) || LICENSES[0];
  config.gameMode = target.gameMode === 'cave' ? 'cave' : 'endless';
  // Beide Modi sofort anlegen: ältere Profile übernehmen so ihre gemeinsame Einstellung für beide,
  // bevor eine Änderung die alten Felder (level, foxMode) überschreibt
  getModeSettings(target, 'endless');
  getModeSettings(target, 'cave');
  const modeSettings = getModeSettings(target, config.gameMode);
  config.level = modeSettings.level;
  config.foxMode = modeSettings.foxMode;

  if (shouldRenderSetup) {
    renderProfileModal();
    renderSetupModal();
  }
  render();
}

async function createNewProfile() {
  const input = document.getElementById('newProfileNameInput');
  const rawName = (input.value || '').trim();
  if (!rawName) {
    input.focus();
    return;
  }

  const newProfile = {
    id: 'player_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    name: rawName,
    animalId: config.animal.id,
    licenseId: config.license.id,
    level: config.level,
    foxMode: config.foxMode,
    gameMode: config.gameMode,
    modeSettings: JSON.parse(JSON.stringify(captureSetup().modeSettings)), // übernimmt die Einstellungen beider Modi
    createdAt: Date.now()
  };
  migrateStats(newProfile);

  await dbSaveProfile(newProfile);
  profiles.push(newProfile);
  input.value = '';
  await selectProfile(newProfile.id, true);
}

async function removeProfile(event, profileId) {
  event.stopPropagation();
  if (profiles.length <= 1) {
    alert('Mindestens ein Spieler-Profil muss bestehen bleiben!');
    return;
  }

  const target = profiles.find(p => p.id === profileId);
  if (!target) return;

  await dbDeleteProfile(profileId);
  profiles = profiles.filter(p => p.id !== profileId);

  if (activeProfile && activeProfile.id === profileId) {
    await selectProfile(profiles[0].id, true);
  } else {
    renderProfileModal();
  }
}

async function saveActiveProfilePreferences() {
  if (!activeProfile || story.active) return; // Story-Folgen überschreiben die Einstellungen nur vorübergehend
  activeProfile.animalId = config.animal.id;
  activeProfile.licenseId = config.license.id;
  activeProfile.level = config.level;       // gleichzeitig der Stand des aktuellen Modus (ältere Versionen lesen nur diese Felder)
  activeProfile.foxMode = config.foxMode;
  activeProfile.gameMode = config.gameMode;
  const modeSettings = getModeSettings(activeProfile, config.gameMode);
  modeSettings.level = config.level;
  modeSettings.foxMode = config.foxMode;
  await dbSaveProfile(activeProfile);
}

async function recordDeliveryStats(deliveredAmount, isProPacker, wasFoxOutsmarted) {
  if (!activeProfile) return;
  const st = getModeStats(activeProfile, 'endless');
  st.totalCargoSent += deliveredAmount;
  st.packedAnimals += 1;
  if (isProPacker) st.proPackers += 1;
  if (wasFoxOutsmarted) st.foxOutsmarted += 1;
  await dbSaveProfile(activeProfile);
}

/* ============================================================================
   SPIELLOGIK, WÜSTENFUCHS & OPTIMAL-BERECHNUNG
   ============================================================================ */

/*
 * Berechnet die minimale Kistenanzahl im Sattel am Ende:
 * - Standard (oder wenn 5er / 1er durch den Fuchs blockiert sind):
 *   Über den Entbündel-Workaround (10er -> 2x 5er oder 5er -> 5x 1er und Überschuss auspacken)
 *   kann man im Sattel trotzdem die absolute Ideal-Zerlegung erreichen!
 * - Ausnahme: Wenn der Fuchs die [10er-Kisten] blockiert, gibt es kein größeres Stück zum Entbündeln.
 *   Dann muss man 10er-Taschen mit zwei 5er-Säcken füllen -> das Profi-Ziel passt sich fair an!
 */
function getOptimalPacking(target, foxBlockedDepot = null) {
  let rem = target;
  const pieces = [];

  if (foxBlockedDepot !== 10) {
    while (rem >= 10) {
      pieces.push(10);
      rem -= 10;
    }
  }
  while (rem >= 5) {
    pieces.push(5);
    rem -= 5;
  }
  while (rem >= 1) {
    pieces.push(1);
    rem -= 1;
  }
  return {
    pieces,
    minPieces: pieces.length
  };
}

/* ----------------------------------------------------------------------------
   Rick, der Wüstenfuchs
   Rick liegt pro Lieferung (Endlos) bzw. pro Einkaufs-Zug (Wintervorrat) auf genau einem Depot.
   Die Sperre für die nächste Lieferung steht schon vorher fest und wird angekündigt,
   damit das Kind vorausplanen kann.
   ---------------------------------------------------------------------------- */
const RICK_DEPOTS = [10, 5, 1];
const RICK_NAME = 'Rick';

function rickIsActive() {
  return config.foxMode && !tutorial.active;
}

function rickBlockNow() {
  return rickIsActive() ? state.rick.current : null;
}

function rickBlockNext() {
  return rickIsActive() ? state.rick.next : null;
}

// Ist die Sperre für diesen Wert wirklich im Weg? (Sonst wäre das Depot ohnehin nicht gebraucht.)
function isRickRelevant(val, block) {
  return Boolean(block) && getOptimalPacking(val).pieces.includes(block);
}

/*
 * Wählt die Sperre für den übernächsten Zug.
 * - valid:    harte Bedingung (z. B. alle offenen Karten bleiben lösbar), wird nur ignoriert, wenn nichts übrig bleibt
 * - relevant: weiche Bedingung (Rick soll mindestens eine offene Karte wirklich betreffen)
 * Die neue Sperre unterscheidet sich immer von der aktuellen.
 */
function pickRickBlock(exclude, valid = () => true, relevant = () => true) {
  if (story.active) return storyNextRickBlock(); // Story: Sperren stehen im Episoden-Skript
  const candidates = RICK_DEPOTS.filter(d => d !== exclude);
  const ok = candidates.filter(valid);
  const base = ok.length > 0 ? ok : candidates;
  const preferred = base.filter(relevant);
  const pool = preferred.length > 0 ? preferred : base;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Kurzer Satz für die Sprechblase: wo Rick jetzt liegt und wo er als Nächstes liegen wird
function rickAnnouncement() {
  const now = rickBlockNow();
  if (!now) return '';
  const next = rickBlockNext();
  return `🦊 ${RICK_NAME} schläft auf den ${now}er-Kisten${next ? ` – danach auf den ${next}ern` : ''}. Plane voraus!`;
}

// Abzeichen für Auftragskarten: 🌿 nur, wenn Rick gar nicht aktiv ist, sonst immer seine Sperre
// (ob sie für den Auftrag eine Rolle spielt, findet das Kind selbst heraus).
function rickBadgeHTML(block, style = '') {
  if (!block) return `<div style="margin-top:6px; font-size:1.1rem;" title="Freier Markt">🌿</div>`;
  return `<div class="fox-card-badge" ${style ? `style="${style}"` : ''} title="${RICK_NAME} blockiert das ${block}er-Depot">🦊 🚫 ${block}er</div>`;
}

function renderRickBanner() {
  const el = document.getElementById('rickBanner');
  if (!el) return;
  const now = rickBlockNow();
  const next = rickBlockNext();
  el.classList.toggle('hidden', !now);
  if (!now) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <span class="rick-banner-now" title="${RICK_NAME} schläft gerade auf den ${now}er-Kisten">🦊 ${RICK_NAME}: 🚫 ${now}er</span>
    ${next ? `<span class="rick-banner-next" title="Danach schläft ${RICK_NAME} auf den ${next}er-Kisten">danach ➜ 🚫 ${next}er</span>` : ''}
  `;
}

function resetRick() {
  state.rick = { current: null, next: null };
}

// Neues Spiel: aktuelle Sperre würfeln, die nächste folgt in planRickNext()
function startRick(valid, relevant) {
  resetRick();
  if (!config.foxMode) return;
  state.rick.current = pickRickBlock(null, valid, relevant);
}

// Nächster Zug: angekündigte Sperre wird aktuell. Die neue Ankündigung folgt mit planRickNext(),
// sobald die neuen Karten feststehen.
function advanceRick() {
  if (!rickIsActive()) return;
  state.rick = {
    current: state.rick.next || pickRickBlock(state.rick.current),
    next: null
  };
}

function planRickNext(valid, relevant) {
  if (!rickIsActive()) return;
  state.rick.next = pickRickBlock(state.rick.current, valid, relevant);
}

/* Top-Down SVG Illustrationen der Packtiere */
function getTopDownAnimalSVG(animalId) {
  const strapsAndSaddle = `
    <rect x="4" y="76" width="152" height="12" rx="4" fill="#6e381b" stroke="#3e2411" stroke-width="2"/>
    <rect x="4" y="114" width="152" height="12" rx="4" fill="#6e381b" stroke="#3e2411" stroke-width="2"/>
    <rect x="10" y="74" width="10" height="16" rx="2" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>
    <rect x="140" y="74" width="10" height="16" rx="2" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>
    <rect x="10" y="112" width="10" height="16" rx="2" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>
    <rect x="140" y="112" width="10" height="16" rx="2" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>
    <rect x="44" y="64" width="72" height="72" rx="14" fill="#b91c1c" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="5 3"/>
    <ellipse cx="80" cy="100" rx="25" ry="28" fill="#8b5a2b" stroke="#3e2411" stroke-width="2.5"/>
    <ellipse cx="80" cy="100" rx="16" ry="18" fill="#a45a32"/>
  `;

  switch (animalId) {
    case 'unicorn':
      return `
        <svg viewBox="0 0 160 200" width="100%" height="100%">
          <path d="M80 155 C62 175, 68 195, 80 198 C92 195, 98 175, 80 155 Z" fill="#ec4899" stroke="#831843" stroke-width="2"/>
          <path d="M80 160 C72 175, 75 190, 80 194 C85 190, 88 175, 80 160 Z" fill="#38bdf8"/>
          <ellipse cx="80" cy="105" rx="38" ry="56" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
          ${strapsAndSaddle}
          <ellipse cx="80" cy="44" rx="20" ry="26" fill="#ffffff" stroke="#cbd5e1" stroke-width="2.5"/>
          <ellipse cx="80" cy="52" rx="7" ry="16" fill="#f472b6"/>
          <ellipse cx="80" cy="52" rx="4" ry="12" fill="#facc15"/>
          <polygon points="62,32 54,18 68,24" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
          <polygon points="98,32 106,18 92,24" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
          <circle cx="69" cy="28" r="3" fill="#1e293b"/>
          <circle cx="91" cy="28" r="3" fill="#1e293b"/>
          <polygon points="74,20 80,2 86,20" fill="#facc15" stroke="#b45309" stroke-width="2"/>
        </svg>
      `;

    case 'raptor':
      return `
        <svg viewBox="0 0 160 200" width="100%" height="100%">
          <path d="M68 148 L80 198 L92 148 Z" fill="#15803d" stroke="#14532d" stroke-width="3"/>
          <path d="M45 64 Q30 58 28 48" stroke="#16a34a" stroke-width="7" stroke-linecap="round" fill="none"/>
          <path d="M115 64 Q130 58 132 48" stroke="#16a34a" stroke-width="7" stroke-linecap="round" fill="none"/>
          <ellipse cx="80" cy="104" rx="40" ry="52" fill="#22c55e" stroke="#14532d" stroke-width="3"/>
          ${strapsAndSaddle}
          <path d="M62 52 C60 20, 70 8, 80 8 C90 8, 100 20, 98 52 Z" fill="#16a34a" stroke="#14532d" stroke-width="2.5"/>
          <circle cx="80" cy="44" r="4" fill="#facc15"/>
          <circle cx="80" cy="54" r="4" fill="#facc15"/>
          <circle cx="80" cy="158" r="4" fill="#facc15"/>
          <circle cx="80" cy="172" r="3.5" fill="#facc15"/>
          <circle cx="67" cy="26" r="4" fill="#fde047" stroke="#14532d" stroke-width="1.5"/>
          <circle cx="93" cy="26" r="4" fill="#fde047" stroke="#14532d" stroke-width="1.5"/>
          <line x1="67" y1="23" x2="67" y2="29" stroke="#000" stroke-width="1.5"/>
          <line x1="93" y1="23" x2="93" y2="29" stroke="#000" stroke-width="1.5"/>
        </svg>
      `;

    case 'bear':
      return `
        <svg viewBox="0 0 160 200" width="100%" height="100%">
          <ellipse cx="38" cy="64" rx="12" ry="9" fill="#78350f" stroke="#451a03" stroke-width="2"/>
          <ellipse cx="122" cy="64" rx="12" ry="9" fill="#78350f" stroke="#451a03" stroke-width="2"/>
          <ellipse cx="40" cy="144" rx="12" ry="9" fill="#78350f" stroke="#451a03" stroke-width="2"/>
          <ellipse cx="120" cy="144" rx="12" ry="9" fill="#78350f" stroke="#451a03" stroke-width="2"/>
          <circle cx="80" cy="166" r="10" fill="#78350f" stroke="#451a03" stroke-width="2.5"/>
          <ellipse cx="80" cy="105" rx="46" ry="56" fill="#92400e" stroke="#451a03" stroke-width="3"/>
          ${strapsAndSaddle}
          <circle cx="58" cy="36" r="10" fill="#78350f" stroke="#451a03" stroke-width="2.5"/>
          <circle cx="102" cy="36" r="10" fill="#78350f" stroke="#451a03" stroke-width="2.5"/>
          <circle cx="80" cy="40" r="24" fill="#92400e" stroke="#451a03" stroke-width="2.5"/>
          <ellipse cx="80" cy="22" rx="11" ry="9" fill="#d97706"/>
          <ellipse cx="80" cy="17" rx="5" ry="3.5" fill="#1c1917"/>
          <circle cx="70" cy="32" r="3" fill="#1c1917"/>
          <circle cx="90" cy="32" r="3" fill="#1c1917"/>
        </svg>
      `;

    case 'cat':
      return `
        <svg viewBox="0 0 160 200" width="100%" height="100%">
          <path d="M80 156 Q82 188 108 190" stroke="#ea580c" stroke-width="11" stroke-linecap="round" fill="none"/>
          <path d="M80 156 Q82 188 108 190" stroke="#fb923c" stroke-width="7" stroke-linecap="round" fill="none"/>
          <circle cx="46" cy="60" r="8" fill="#fed7aa" stroke="#9a3412" stroke-width="2"/>
          <circle cx="114" cy="60" r="8" fill="#fed7aa" stroke="#9a3412" stroke-width="2"/>
          <ellipse cx="80" cy="104" rx="37" ry="54" fill="#fb923c" stroke="#9a3412" stroke-width="3"/>
          <path d="M48 88 Q80 82 112 88" stroke="#c2410c" stroke-width="4" fill="none"/>
          <path d="M48 122 Q80 128 112 122" stroke="#c2410c" stroke-width="4" fill="none"/>
          ${strapsAndSaddle}
          <polygon points="56,42 50,16 70,28" fill="#fb923c" stroke="#9a3412" stroke-width="2.5"/>
          <polygon points="104,42 110,16 90,28" fill="#fb923c" stroke="#9a3412" stroke-width="2.5"/>
          <circle cx="80" cy="38" r="21" fill="#fb923c" stroke="#9a3412" stroke-width="2.5"/>
          <line x1="58" y1="30" x2="36" y2="26" stroke="#431407" stroke-width="1.8"/>
          <line x1="58" y1="35" x2="36" y2="35" stroke="#431407" stroke-width="1.8"/>
          <line x1="102" y1="30" x2="124" y2="26" stroke="#431407" stroke-width="1.8"/>
          <line x1="102" y1="35" x2="124" y2="35" stroke="#431407" stroke-width="1.8"/>
          <circle cx="71" cy="32" r="3.5" fill="#22c55e" stroke="#14532d" stroke-width="1"/>
          <circle cx="89" cy="32" r="3.5" fill="#22c55e" stroke="#14532d" stroke-width="1"/>
          <polygon points="77,23 83,23 80,27" fill="#f43f5e"/>
        </svg>
      `;

    case 'sloth':
      return `
        <svg viewBox="0 0 160 200" width="100%" height="100%">
          <ellipse cx="80" cy="168" rx="11" ry="8" fill="#a8977f" stroke="#57483a" stroke-width="2.5"/>
          <g stroke="#f5f1e6" stroke-width="3" stroke-linecap="round">
            <line x1="22" y1="50" x2="14" y2="40"/><line x1="28" y1="48" x2="23" y2="36"/><line x1="34" y1="48" x2="32" y2="36"/>
            <line x1="138" y1="50" x2="146" y2="40"/><line x1="132" y1="48" x2="137" y2="36"/><line x1="126" y1="48" x2="128" y2="36"/>
            <line x1="22" y1="150" x2="14" y2="160"/><line x1="28" y1="152" x2="23" y2="164"/><line x1="34" y1="152" x2="32" y2="164"/>
            <line x1="138" y1="150" x2="146" y2="160"/><line x1="132" y1="152" x2="137" y2="164"/><line x1="126" y1="152" x2="128" y2="164"/>
          </g>
          <path d="M44 62 Q30 56 28 48" stroke="#8b7a64" stroke-width="12" stroke-linecap="round" fill="none"/>
          <path d="M116 62 Q130 56 132 48" stroke="#8b7a64" stroke-width="12" stroke-linecap="round" fill="none"/>
          <path d="M44 146 Q30 150 28 154" stroke="#8b7a64" stroke-width="12" stroke-linecap="round" fill="none"/>
          <path d="M116 146 Q130 150 132 154" stroke="#8b7a64" stroke-width="12" stroke-linecap="round" fill="none"/>
          <ellipse cx="80" cy="105" rx="42" ry="56" fill="#a8977f" stroke="#57483a" stroke-width="3"/>
          <path d="M52 92 Q58 96 64 92 M96 92 Q102 96 108 92 M54 124 Q60 128 66 124 M94 124 Q100 128 106 124" stroke="#8b7a64" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          ${strapsAndSaddle}
          <circle cx="80" cy="38" r="23" fill="#d6c7a8" stroke="#57483a" stroke-width="2.5"/>
          <ellipse cx="69" cy="34" rx="8" ry="11" transform="rotate(20 69 34)" fill="#57483a"/>
          <ellipse cx="91" cy="34" rx="8" ry="11" transform="rotate(-20 91 34)" fill="#57483a"/>
          <path d="M65 34 Q69 37 73 34" stroke="#fef9ee" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M87 34 Q91 37 95 34" stroke="#fef9ee" stroke-width="2" fill="none" stroke-linecap="round"/>
          <ellipse cx="80" cy="43" rx="4" ry="3" fill="#292524"/>
          <path d="M72 49 Q80 55 88 49" stroke="#57483a" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>
      `;

    case 'camel':
    default:
      return `
        <svg viewBox="0 0 160 200" width="100%" height="100%">
          <line x1="80" y1="158" x2="80" y2="186" stroke="#b45309" stroke-width="5" stroke-linecap="round"/>
          <circle cx="80" cy="190" r="6" fill="#78350f"/>
          <ellipse cx="80" cy="105" rx="42" ry="56" fill="#d97706" stroke="#78350f" stroke-width="3"/>
          ${strapsAndSaddle}
          <circle cx="80" cy="68" r="14" fill="#b45309" stroke="#78350f" stroke-width="2"/>
          <circle cx="80" cy="132" r="14" fill="#b45309" stroke="#78350f" stroke-width="2"/>
          <rect x="69" y="26" width="22" height="32" rx="10" fill="#d97706" stroke="#78350f" stroke-width="2.5"/>
          <ellipse cx="80" cy="22" rx="16" ry="14" fill="#f59e0b" stroke="#78350f" stroke-width="2.5"/>
          <circle cx="63" cy="24" r="5" fill="#b45309" stroke="#78350f" stroke-width="2"/>
          <circle cx="97" cy="24" r="5" fill="#b45309" stroke="#78350f" stroke-width="2"/>
          <circle cx="73" cy="17" r="2.8" fill="#1c1917"/>
          <circle cx="87" cy="17" r="2.8" fill="#1c1917"/>
        </svg>
      `;
  }
}

function renderProfileModal() {
  const listEl = document.getElementById('profileListContainer');
  if (listEl) {
    listEl.innerHTML = profiles.map(p => {
      const pAnimal = ANIMALS.find(a => a.id === p.animalId) || ANIMALS[1];
      const isSelected = activeProfile && p.id === activeProfile.id;
      return `
        <div class="profile-card ${isSelected ? 'active-profile' : ''}" onclick="selectProfile('${p.id}', true)">
          <div class="profile-card-info">
            <span class="profile-card-avatar">${pAnimal.icon}</span>
            <span class="profile-card-name" title="${p.name}">${p.name}</span>
          </div>
          ${profiles.length > 1 ? `<button class="btn-delete-profile" onclick="removeProfile(event, '${p.id}')" title="Profil löschen">✖</button>` : ''}
        </div>
      `;
    }).join('');
  }

  const gearName = document.getElementById('profileGearName');
  if (gearName) gearName.textContent = activeProfile ? activeProfile.name : 'Gast';
  const animalsEl = document.getElementById('profileAnimals');
  if (animalsEl) animalsEl.innerHTML = ANIMALS.map(a => `
    <div class="tile-option ${a.id === config.animal.id ? 'active-tile' : ''}" onclick="chooseAnimal('${a.id}')">
      <div style="font-size:2.1rem;">${a.icon}</div>
      <strong>${a.name}</strong>
    </div>
  `).join('');
  const licensesEl = document.getElementById('profileLicenses');
  if (licensesEl) licensesEl.innerHTML = LICENSES.map(l => `
    <div class="tile-option ${l.id === config.license.id ? 'active-tile' : ''}" onclick="chooseLicense('${l.id}')">
      <div style="font-size:2.1rem;">${l.icon}</div>
      <strong>${l.name}</strong>
    </div>
  `).join('');

  const statsEl = document.getElementById('activeProfileStatsBanner');
  if (statsEl && activeProfile) {
    const item = (icon, label, value) => `
      <div class="p-stat-item">
        <span class="p-stat-icon">${icon}</span>
        <div class="p-stat-text">
          <small>${label}</small>
          <strong>${value}</strong>
        </div>
      </div>`;
    const en = getModeStats(activeProfile, 'endless');
    const cv = getModeStats(activeProfile, 'cave');
    const rate = en.packedAnimals > 0 ? Math.round((en.proPackers / en.packedAnimals) * 100) : 0;
    const section = (mode, title, items) => `
      <div class="p-stat-section ${config.gameMode === mode ? 'p-stat-current' : ''}">
        <h4 class="p-stat-title">${title}${config.gameMode === mode ? ' <span class="p-stat-badge">aktueller Modus</span>' : ''}</h4>
        <div class="profile-stats-banner">${items.join('')}</div>
      </div>`;
    const endlessSection = section('endless', '🐪 Endlos-Karawane', [
      item('📦', 'Verschickte Fracht', `${en.totalCargoSent} Einh.`),
      item('🐪', 'Gepackte Tiere', en.packedAnimals),
      item('🏅', 'Profi-Packer', `${en.proPackers} <span style="font-size:0.8rem; font-weight:700; color:#15803d;">(${rate}%)</span>`),
      item('🦊', 'Schlauer als Rick', `${en.foxOutsmarted}×`)
    ]);
    const caveSection = section('cave', '❄️ Wintervorrat', [
      item('📦', 'Eingelagerte Fracht', `${cv.totalCargoSent} Einh.`),
      item('🏠', 'Winter geschafft', cv.cavesFilled),
      item('💥', 'KNACKEVOLL!', `${cv.knackevoll}×`),
      item('🦊', 'Schlauer als Rick', `${cv.foxOutsmarted}×`)
    ]);
    statsEl.innerHTML = config.gameMode === 'cave' ? caveSection + endlessSection : endlessSection + caveSection;
  }
}

function renderSetupModal() {
  const nameEl = document.getElementById('setupActivePlayerName');
  if (nameEl) nameEl.textContent = activeProfile ? activeProfile.name : 'Gast';
  const gearEl = document.getElementById('setupActivePlayerGear');
  if (gearEl) gearEl.textContent = `${config.animal.icon} ${config.animal.name} · ${config.license.icon} ${config.license.name}`;

  // 1. Zahlenraum
  document.getElementById('lvlTile1').classList.toggle('active-tile', config.level === 1);
  document.getElementById('lvlTile2').classList.toggle('active-tile', config.level === 2);

  // 2. Rick-Erweiterung (Modul 2)
  const foxOff = document.getElementById('foxOffTile');
  const foxOn = document.getElementById('foxOnTile');
  if (foxOff && foxOn) {
    foxOff.classList.toggle('active-tile', !config.foxMode);
    foxOn.classList.toggle('active-tile', config.foxMode);
  }

  // Ansicht: freier Modus (Endlos/Winter, folgt config.gameMode), Abenteuer oder Einstellungen
  const view = setupView;
  const inMode = view === 'mode';
  document.getElementById('tabEndless').classList.toggle('active-tab', inMode && config.gameMode !== 'cave');
  document.getElementById('tabCave').classList.toggle('active-tab', inMode && config.gameMode === 'cave');
  document.getElementById('tabStory').classList.toggle('active-tab', view === 'story');
  document.getElementById('tabSettings').classList.toggle('active-tab', view === 'settings');
  document.getElementById('tabStoryProgress').textContent = `${storyFragments().length}/${STORY_FRAGMENT_TOTAL} 🧩`;
  // Alle Reiter liegen übereinander im selben Grid-Feld. Inaktive sind nur unsichtbar, nehmen aber Platz ein,
  // damit das Fenster beim Wechseln nicht in der Höhe springt.
  document.getElementById('setupModePane').classList.toggle('pane-inactive', !inMode);
  document.getElementById('setupStoryPane').classList.toggle('pane-inactive', view !== 'story');
  document.getElementById('setupSettingsPane').classList.toggle('pane-inactive', view !== 'settings');
  document.getElementById('setupStartBtn').style.visibility = inMode ? '' : 'hidden'; // Folgen starten direkt auf der Karte
  if (view === 'story') renderStoryMap();

  const dims = getCaveDims();
  document.getElementById('setupModeDesc').textContent = config.gameMode === 'cave'
    ? `Plus & Minus: Vorräte in die ${getCaveTheme().name} (${dims.rows}×${dims.cols})`
    : 'Ein Auftrag nach dem anderen – ohne Ende.';

  // Schließen ohne Neustart geht erst, wenn eine Runde läuft
  const closeBtn = document.getElementById('setupCloseBtn');
  if (closeBtn) closeBtn.style.display = gameRunning ? '' : 'none';

  const playerName = activeProfile ? activeProfile.name : 'Karawanen-Kind';
  document.getElementById('setupMottoBox').textContent =
    `${playerName}: „Ich bin ${config.animal.article} und fahre heute eine offizielle ${config.license.name}-Lieferung!“`;
}

function chooseAnimal(id) {
  config.animal = ANIMALS.find(a => a.id === id);
  saveActiveProfilePreferences();
  renderProfileModal();
  renderSetupModal();
}

function chooseLicense(id) {
  config.license = LICENSES.find(l => l.id === id);
  saveActiveProfilePreferences();
  renderProfileModal();
  renderSetupModal();
}

function setLevel(lvl) {
  config.level = lvl;
  saveActiveProfilePreferences();
  renderSetupModal();
}

function setFoxMode(enabled) {
  config.foxMode = Boolean(enabled);
  saveActiveProfilePreferences();
  renderSetupModal();
}

// Reiter im Setup: 'mode' (Endlos oder Wintervorrat, je nach config.gameMode), 'story' (Abenteuer) oder 'settings'.
// Abenteuer und Einstellungen sind keine Spielmodi (config.gameMode bleibt unberührt),
// Endlos und Wintervorrat setzen den Modus wie bisher.
let setupView = 'mode';

function selectSetupTab(tab) {
  if (tab === 'story') {
    openStoryMap();
    return;
  }
  if (tab === 'settings') {
    setupView = 'settings';
    renderSetupModal();
    return;
  }
  setupView = 'mode';
  setGameMode(tab);
}

// Moduswechsel: Zahlenraum und Rick des alten Modus merken, die des neuen laden
function setGameMode(mode) {
  const next = mode === 'cave' ? 'cave' : 'endless';
  if (next !== config.gameMode) {
    const old = getModeSettings(activeProfile, config.gameMode);
    old.level = config.level;
    old.foxMode = config.foxMode;
    config.gameMode = next;
    const loaded = getModeSettings(activeProfile, next);
    config.level = loaded.level;
    config.foxMode = loaded.foxMode;
  }
  saveActiveProfilePreferences();
  renderSetupModal();
}

// Läuft schon eine Runde? Erst dann lässt sich das Setup schließen, ohne zu starten.
let gameRunning = false;

// Merkt sich, wie das Setup beim Öffnen aussah. Das ✕ verwirft alle Änderungen
// (Profil, Tier, Fracht, Zahlenraum, Rick, Modus) und setzt die laufende Runde fort.
let setupSnapshot = null;

function captureSetup() {
  const modeSettings = {
    endless: { ...getModeSettings(activeProfile, 'endless') },
    cave: { ...getModeSettings(activeProfile, 'cave') }
  };
  modeSettings[config.gameMode === 'cave' ? 'cave' : 'endless'] = { level: config.level, foxMode: config.foxMode };
  return {
    profileId: activeProfile ? activeProfile.id : null,
    animalId: config.animal.id,
    licenseId: config.license.id,
    gameMode: config.gameMode,
    modeSettings
  };
}

function snapshotSetup() {
  setupSnapshot = captureSetup();
}

function setupChanged() {
  return JSON.stringify(captureSetup()) !== JSON.stringify(setupSnapshot);
}

// Stellt Profil und Einstellungen vom Öffnen des Setups wieder her (auch im gespeicherten Profil)
async function revertSetup() {
  const s = setupSnapshot;
  const target = profiles.find(p => p.id === s.profileId);
  if (!target) return;
  target.animalId = s.animalId;
  target.licenseId = s.licenseId;
  target.gameMode = s.gameMode;
  target.modeSettings = JSON.parse(JSON.stringify(s.modeSettings));
  const active = target.modeSettings[s.gameMode === 'cave' ? 'cave' : 'endless'];
  target.level = active.level;
  target.foxMode = active.foxMode;
  await dbSaveProfile(target);
  await selectProfile(target.id, false);
}

function openSetupModal() {
  if (story.active) { storyLeaveForMenu(); return; } // nach Rückfrage: Folge beenden, Setup ist danach offen
  snapshotSetup();
  setupView = 'mode';
  renderSetupModal();
  document.getElementById('setupModal').classList.remove('hidden');
}

// ✕: Setup schließen, Änderungen verwerfen und die laufende Runde fortsetzen
async function closeSetupModal() {
  document.getElementById('setupModal').classList.add('hidden');
  if (setupChanged()) await revertSetup();
  renderProfileModal();
  render();
  continueGameFlow();
}

let profileIdOnModalOpen = null;

function openProfileModal() {
  if (!storyLeaveForMenu()) return;
  profileIdOnModalOpen = activeProfile ? activeProfile.id : null;
  renderProfileModal();
  document.getElementById('profileModal').classList.remove('hidden');
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.add('hidden');
  renderSetupModal();
  // Bei Spielerwechsel neue Runde mit den Einstellungen des neuen Profils starten
  // (nicht, wenn das Profil-Fenster aus dem Setup heraus geöffnet wurde)
  const changed = activeProfile && activeProfile.id !== profileIdOnModalOpen;
  if (changed && document.getElementById('setupModal').classList.contains('hidden')) {
    startRound();
  } else {
    render();
  }
}

function startFromSetup() {
  saveActiveProfilePreferences();
  document.getElementById('setupModal').classList.add('hidden');
  startRound();
}

function openOrderModal() {
  if (state.activeOrder !== null) return;

  const list = document.getElementById('popupOrdersList');
  list.innerHTML = state.availableOrders.map((orderObj, idx) => {
    const num = orderObj.val;
    const foxBlock = rickBlockNow();
    const opt = getOptimalPacking(num, foxBlock);

    const foxBadgeHTML = rickBadgeHTML(foxBlock);

    return `
      <div class="OrderCardPopup" onclick="pickOrderCard(${idx})">
        <div class="order-badge-num">${num}</div>
        <div class="order-cargo-title">${config.license.icon} ${config.license.name}</div>
        ${renderTwentyStrip(num)}
        ${foxBadgeHTML}
        <div class="order-pro-goal" title="Profi-Packer: ${opt.minPieces} ${opt.minPieces === 1 ? 'Frachtstück' : 'Frachtstücke'}">
          ⭐ ${'📦'.repeat(opt.minPieces)}
        </div>
        <div style="margin-top:8px;">
          <span class="btn btn-oasis" style="padding:5px 16px; font-size:1.2rem;">👆</span>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('orderModal').classList.remove('hidden');
}

function closeOrderModal() {
  document.getElementById('orderModal').classList.add('hidden');
}

// Wertebereich für Aufträge (Endlos-Karawane)
function getOrderRange() {
  const maxVal = config.level === 1 ? 10 : 19; // Stufe 1 bis 10 (die 10 ist das erste Zehnerbündel), Stufe 2 bis 19; alle Aufträge sind auch mit Ricks Sperren lösbar
  const minVal = config.level === 1 ? 2 : 6;
  return { minVal, maxVal };
}

/*
 * Filter für Ricks Sperren im Endlos-Modus:
 * - lösbar: Jeder Auftrag lässt sich mit jeder Sperre lösen (fehlendes 10er → 2×5, fehlendes 5er → 10 entbündeln,
 *   fehlendes 1er → 5er aufschnüren; die Taschen reichen dafür, weil die Auftragswerte unter der Kapazität bleiben).
 *   Es muss also nichts herausgefiltert werden.
 * - relevant: Rick soll mindestens einen der offenen Aufträge wirklich betreffen.
 */
function rickOrderFilters() {
  const orders = () => state.availableOrders.filter(Boolean);
  return [undefined, block => orders().some(o => isRickRelevant(o.val, block))];
}

function generateOrders() {
  if (story.active) return storyInitialOrders();
  const { minVal, maxVal } = getOrderRange();
  if (maxVal < 1) return [];
  const span = maxVal - minVal + 1;
  const values = [];
  while (values.length < 3) {
    const candidate = Math.floor(Math.random() * span) + minVal;
    // Doppelte Werte nur, wenn der Bereich zu klein für 3 verschiedene ist (Endspurt in der Höhle)
    if (!values.includes(candidate) || values.length >= span) {
      values.push(candidate);
    }
  }
  return values.map(val => ({ val }));
}

function generateReplacementOrder() {
  const { minVal, maxVal } = getOrderRange();
  const span = maxVal - minVal + 1;
  const existingVals = state.availableOrders.filter(Boolean).map(o => o.val);
  const freeValues = [];
  for (let v = minVal; v <= maxVal; v++) {
    if (!existingVals.includes(v)) freeValues.push(v);
  }
  const pool = freeValues.length > 0 ? freeValues : [Math.floor(Math.random() * span) + minVal];
  const candidate = pool[Math.floor(Math.random() * pool.length)];
  return { val: candidate };
}

function resetGame() {
  gameRunning = true;
  if (story.active) storyResetRun(); // Neustart in einer Folge beginnt die Folge von vorn
  if (isCaveMode()) {
    winterResume();
    return;
  }
  state.activeOrder = null;
  state.activeFoxBlock = null;
  state.activeOrderIdx = null;
  state.availableOrders = generateOrders();
  startRick(...rickOrderFilters());
  planRickNext(...rickOrderFilters());
  state.leftBag = [];
  state.rightBag = [];
  document.getElementById('celebrationModal').classList.add('hidden');
  setSpeech(rickAnnouncement() || 'Wähle deinen nächsten Auftrag für die Karawane aus!', '');
  render();
  if (document.getElementById('setupModal').classList.contains('hidden')) {
    continueGameFlow();
  }
}

// Auftrag im Pop-up wählen
function pickOrderCard(index) {
  if (state.activeOrder !== null) return;

  const chosen = state.availableOrders[index];
  state.activeOrderIdx = index;
  state.activeOrder = chosen.val;
  state.activeFoxBlock = rickBlockNow();
  state.unbundledThisOrder = false;
  fx('pick');

  const opt = getOptimalPacking(state.activeOrder, state.activeFoxBlock);
  closeOrderModal();

  if (isRickRelevant(state.activeOrder, state.activeFoxBlock)) {
    let tip = '';
    if (state.activeFoxBlock === 5) {
      tip = 'Tipp: Lade eine 10er-Kiste ein, schnüre sie in zwei 5er auf und packe einen 5er wieder aus!';
    } else if (state.activeFoxBlock === 1) {
      tip = 'Tipp: Lade einen 5er-Sack ein, schnüre ihn in fünf 1er auf und packe die überzähligen 1er wieder aus!';
    } else {
      tip = 'Tipp: Nutze zwei 5er-Säcke, um die linke 10er-Tasche vollzumachen!';
    }
    setSpeech(`🦊 Oh! ${RICK_NAME} schläft auf den ${state.activeFoxBlock}er-Kisten! ${tip}`, '');
  } else {
    setSpeech(
      `📜 Auftrag „${state.activeOrder}× ${config.license.name}“ angenommen! Schaffst du es als Profi-Packer mit nur ${opt.minPieces} ${opt.minPieces === 1 ? 'Frachtstück' : 'Frachtstücken'}?`,
      ''
    );
  }
  render();
}

// Prüft nach jeder Änderung (Einladen oder Auspacken), ob der Zielwert exakt erreicht wurde
function checkOrderCompletion() {
  if (state.activeOrder === null) return false;
  const totalSum = sumArray(state.leftBag) + sumArray(state.rightBag);
  if (totalSum === state.activeOrder) {
    render();
    finishOrderDelivery();
    return true;
  }
  return false;
}

// Frachtstück einladen (Option 1: man darf bis zum Taschenlimit 10/20 einladen, um große Stücke in der Tasche entbündeln zu können)
function takeCargo(val) {
  if (isCaveMode()) {
    winterTakeCargo(val);
    return;
  }
  if (state.activeOrder === null) {
    setSpeech('Bitte wähle zuerst oben einen Auftrag aus, bevor du Fracht einlädst!', 'error');
    return;
  }

  // Prüfen, ob Rick auf diesem Markt-Depot schläft
  if (state.activeFoxBlock === val) {
    const foxHint = val === 1
      ? 'Hol dir stattdessen einen 5er-Sack und schnüre ihn an der Satteltasche in fünf 1er auf!'
      : (val === 5
          ? 'Hol dir stattdessen eine 10er-Kiste und teile sie an der Satteltasche in zwei 5er!'
          : 'Nimm stattdessen zwei 5er-Säcke für die linke Tasche!');
    setSpeech(`🦊💤 Pssst! ${RICK_NAME} schläft auf den ${val}er-Kisten! ${foxHint}`, 'error');
    return;
  }

  const leftSum = sumArray(state.leftBag);
  const rightSum = sumArray(state.rightBag);

  // „Erst links, dann rechts“-Regel + Wackel-Regel für Taschenkapazität (10 pro Tasche)
  let target = 'left';
  if (leftSum < 10) {
    if (leftSum + val > 10) {
      wobbleBag('bagLeft');
      setSpeech(`⚠️ Wackel-Regel! In der linken Satteltasche sind nur noch ${10 - leftSum} Plätze frei – ein ${val}er-Stück passt dort nicht hinein!`, 'error');
      return;
    }
    target = 'left';
  } else {
    if (config.level === 1) {
      wobbleBag('bagLeft');
      setSpeech('Die Satteltasche ist bereits randvoll (10/10)!', 'error');
      return;
    }
    if (rightSum + val > 10) {
      wobbleBag('bagRight');
      setSpeech(`⚠️ Wackel-Regel! In der rechten Satteltasche sind nur noch ${10 - rightSum} Plätze frei!`, 'error');
      return;
    }
    target = 'right';
  }

  if (target === 'left') {
    state.leftBag.push(val);
  } else {
    state.rightBag.push(val);
  }
  fx('take');

  // Falls Zielwert exakt getroffen -> Lieferung feiern!
  if (checkOrderCompletion()) return;

  const newTotal = sumArray(state.leftBag) + sumArray(state.rightBag);
  if (newTotal > state.activeOrder) {
    const diff = newTotal - state.activeOrder;
    setSpeech(
      `🔨 Du hast jetzt ${newTotal} geladen (Ziel: ${state.activeOrder}). Nutze jetzt „🔄 Tauschen (Entbündeln)“ an der Tasche und packe ${diff} überzählige Einheit${diff === 1 ? '' : 'en'} wieder aus!`,
      ''
    );
  } else {
    const totalPieces = state.leftBag.length + state.rightBag.length;
    setSpeech(
      `✅ ${val} mal ${config.license.icon} eingeladen! Aktuell liegen ${totalPieces} ${totalPieces === 1 ? 'Stück' : 'Stücke'} (${newTotal} / ${state.activeOrder}) in den Taschen.`,
      ''
    );
  }
  render();
}

// Frachtstück wieder auspacken (kann nach dem Entbündeln auch direkt die Lieferung auslösen!)
function unpackCargo(side, index) {
  if (isCaveMode()) {
    winterUnpack(side, index);
    return;
  }
  if (side === 'left' && state.rightBag.length > 0) {
    wobbleBag('bagLeft');
    setSpeech('⚠️ Spiegelregel beim Auspacken: Räume zuerst die rechte Überlauf-Tasche leer, bevor du links auspackst!', 'error');
    return;
  }

  const bag = side === 'left' ? state.leftBag : state.rightBag;
  if (index < 0 || index >= bag.length) return;

  const removedVal = bag.splice(index, 1)[0];
  fx('unpack');

  // Prüfen, ob durch das Auspacken des Überschusses genau der Zielwert erreicht wurde!
  if (checkOrderCompletion()) return;

  setSpeech(`↩️ ${removedVal} mal ${config.license.icon} wieder ausgepackt und in den Markt zurückgelegt.`, '');
  render();
}

// Entbündeln 1: Blaue 10er-Kiste in zwei gelbe 5er-Säcke teilen
function unbundleTen(side) {
  const bag = side === 'left' ? state.leftBag : state.rightBag;
  const idx = bag.indexOf(10);
  if (idx === -1) return;

  bag.splice(idx, 1, 5, 5);
  fx('unbundle');
  state.unbundledThisOrder = true;
  saveBagsIfIdle();
  setSpeech('🔄 Clever entbündelt: Die blaue 10er-Kiste wurde in zwei gelbe 5er-Säcke geteilt! Du kannst einzelne Stücke per Klick auspacken.', '');
  render();
}

// Entbündeln 2: Gelben 5er-Sack in fünf rote 1er-Einheiten aufschnüren
function unbundleFive(side) {
  const bag = side === 'left' ? state.leftBag : state.rightBag;
  const idx = bag.lastIndexOf(5);
  if (idx === -1) return;

  bag.splice(idx, 1, 1, 1, 1, 1, 1);
  fx('unbundle');
  state.unbundledThisOrder = true;
  saveBagsIfIdle();
  setSpeech('🔄 Clever entbündelt: Der gelbe 5er-Sack wurde in fünf einzelne 1er aufgeschnürt! Klicke überzählige 1er an, um sie auszupacken.', '');
  render();
}

/* Konfetti-Animation auslösen */
function launchConfetti(count = 45) {
  const layer = document.getElementById('confettiLayer');
  if (!layer) return;
  const colors = ['#2563eb', '#facc15', '#ef4444', '#22c55e', '#f97316', '#ec4899'];

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
    piece.style.animationDelay = (Math.random() * 0.35) + 's';
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 3500);
  }
}

/* Großes Feier-Pop-up bei abgeschlossener Lieferung */
async function finishOrderDelivery() {
  const deliveredOrder = state.activeOrder;
  const foxWasActive = isRickRelevant(deliveredOrder, state.activeFoxBlock) ? state.activeFoxBlock : null;
  const packedPieces = [...state.leftBag, ...state.rightBag];
  const usedPiecesCount = packedPieces.length;

  const opt = getOptimalPacking(deliveredOrder, state.activeFoxBlock);
  const isProPacker = usedPiecesCount <= opt.minPieces;

  if (tutorial.active) {
    tutorial.deliveries += 1;
  } else if (story.active) {
    if (isProPacker) story.proPackers += 1; // Story-Folgen zählen nicht in die Modus-Statistik
  } else {
    await recordDeliveryStats(deliveredOrder, isProPacker, Boolean(foxWasActive));
  }

  launchConfetti(isProPacker ? 65 : 40);
  fx(isProPacker ? 'deliverPro' : 'deliver', isProPacker ? 'cheer' : 'happy');
  if (isProPacker) setTimeout(() => fx('voice', 'cheer'), 900);
  if (foxWasActive) setTimeout(() => fx('fox', 'sly'), 1400);

  const chip = v => `<span class="mini-cargo-chip chip-${v}">${v} ${config.license.icon}</span>`;
  const userChipsHTML = packedPieces.map(chip).join('');
  const optChipsHTML = opt.pieces.map(chip).join('');

  // Ergebnis als Bild: Profi = Medaille, sonst Glühbirne + ideale Aufteilung
  const resultBadge = isProPacker
    ? `<div class="result-badge result-pro" title="Profi-Packer">🏅 ${'⭐'.repeat(Math.min(opt.minPieces, 5))}</div>`
    : `<div class="result-badge result-tip" title="So geht es mit weniger Stücken">💡 <span class="result-arrow">➔</span> ${optChipsHTML}</div>`;

  const foxBadge = foxWasActive
    ? `<div class="result-badge result-fox" title="${RICK_NAME} ausgetrickst – er lässt seine Beute fallen: ${config.license.lootName}">
         🦊💨 <span class="result-arrow">➔</span> <span class="loot-item ${state.unbundledThisOrder ? 'loot-sparkle' : ''}">${config.license.loot}</span>
       </div>`
    : '';

  // Ausführliche Auswertung & Gesamtbilanz nur auf Nachfrage (für Eltern & Lehrkräfte)
  const pStats = getModeStats(activeProfile, 'endless');
  const playerStatLine = activeProfile && !story.active
    ? `<p>👤 <strong>${activeProfile.name}s Bilanz Endlos-Karawane:</strong> 📦 ${pStats.totalCargoSent || 0} Fracht · 🐪 ${pStats.packedAnimals || 0} Tiere · 🏅 ${pStats.proPackers || 0}× Profi · 🦊 ${pStats.foxOutsmarted || 0}× Fuchs ausgetrickst</p>`
    : '';

  const adultDetails = `
    <details class="adult-details text-detail">
      <summary>👩‍🏫 Für Erwachsene</summary>
      <p>${config.animal.icon} ${config.animal.article} hat genau <strong>${deliveredOrder}× ${config.license.name}</strong> geliefert.</p>
      <p>Benutzte Frachtstücke: <strong>${usedPiecesCount}</strong> · Profi-Packer-Ziel: <strong>${opt.minPieces}</strong>
        ${isProPacker ? ' – optimal gebündelt! 🏅' : ' – mit größeren Bündeln wäre es mit weniger Stücken gegangen.'}</p>
      ${foxWasActive ? `<p>🦊 Die ${foxWasActive}er-Sperre von ${RICK_NAME}, dem Wüstenfuchs, wurde durch Tauschen/Entbündeln umgangen.</p>` : ''}
      ${playerStatLine}
    </details>
  `;

  const nextLabel = tutorial.active ? '👍' : '📜 ▶';

  const dialog = document.getElementById('celebrationDialog');

  dialog.innerHTML = `
    <div class="celebration-trophy">${isProPacker ? (foxWasActive ? '🦊🏅⭐' : '🏅⭐📦') : '🎉🐪📦'}</div>
    <div class="celebration-big-number">+${deliveredOrder} ${config.license.icon}</div>

    <div class="delivered-pieces-row">${userChipsHTML}</div>

    <div class="result-badges">
      ${resultBadge}
      ${foxBadge}
    </div>

    <div style="margin-top:18px;">
      <button class="btn btn-oasis celebration-next-btn" onclick="acknowledgeCelebration()">
        ${nextLabel}
      </button>
    </div>

    ${tutorial.active ? '' : adultDetails}
  `;

  // Taschen leeren und Auftrag durch neuen ersetzen
  state.leftBag = [];
  state.rightBag = [];
  state.activeOrder = null;
  state.activeFoxBlock = null;
  if (tutorial.active) {
    nextTutorialOrders();
  } else if (story.active) {
    advanceRick();
    storyRefillOrders(state.activeOrderIdx);
    planRickNext(...rickOrderFilters());
  } else {
    advanceRick();
    state.availableOrders[state.activeOrderIdx] = generateReplacementOrder();
    planRickNext(...rickOrderFilters());
  }
  state.activeOrderIdx = null;

  document.getElementById('celebrationModal').classList.remove('hidden');
  setSpeech(`🎉 Lieferung (${deliveredOrder}× ${config.license.name}) erfolgreich in die Oase gebracht!`, 'success');
  render();
}

function acknowledgeCelebration() {
  document.getElementById('celebrationModal').classList.add('hidden');
  continueGameFlow();
}

function sumArray(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function wobbleBag(id) {
  const el = document.getElementById(id);
  el.classList.remove('wobble-error');
  void el.offsetWidth;
  el.classList.add('wobble-error');
}

function setSpeech(text, type) {
  if (type === 'error') fx('error', 'oops');
  const banner = document.getElementById('speechBanner');
  banner.className = 'camel-speech' + (type ? ` speech-${type}` : '');
  document.getElementById('speechText').textContent = text;
}

function renderTwentyStrip(target) {
  let r1 = '';
  for (let i = 1; i <= 10; i++) {
    const cls = i <= target ? (target >= 10 ? 'pip-10' : 'pip-1') : '';
    const mid = i === 5 ? 'pip-mid' : '';
    r1 += `<div class="ten-pip ${cls} ${mid}"></div>`;
  }
  let r2 = '';
  if (config.level === 2) {
    for (let i = 11; i <= 20; i++) {
      const cls = i <= target ? 'pip-1' : '';
      const mid = i === 15 ? 'pip-mid' : '';
      r2 += `<div class="ten-pip ${cls} ${mid}"></div>`;
    }
  }
  return `
    <div class="twenty-strip-box">
      <div class="ten-row">${r1}</div>
      ${config.level === 2 ? `<div class="ten-row">${r2}</div>` : ''}
    </div>
  `;
}

function render() {
  // Aktiver Spieler & Live-Statistik im Header
  const headerNameEl = document.getElementById('activePlayerHeaderName');
  if (headerNameEl && activeProfile) {
    headerNameEl.textContent = activeProfile.name;
  }

  const pill = document.getElementById('headerStatsPill');
  if (pill) pill.style.display = story.active ? 'none' : ''; // Die Modus-Statistik gehört nicht zum Abenteuer
  if (pill && !story.active) {
    const ms = getModeStats(activeProfile, config.gameMode);
    const parts = config.gameMode === 'cave'
      ? [['📦 Fracht', ms.totalCargoSent], ['🏠 Winter', ms.cavesFilled], ['💥 Knackevoll', ms.knackevoll], ['🦊 Fuchs', ms.foxOutsmarted]]
      : [['📦 Fracht', ms.totalCargoSent], ['🐪 Tiere', ms.packedAnimals], ['🏅 Profi', ms.proPackers], ['🦊 Fuchs', ms.foxOutsmarted]];
    pill.innerHTML = parts.map(([l, v]) => `<span>${l}: <strong>${v || 0}</strong></span>`)
      .join('<span style="opacity:0.4;">|</span>');
    pill.title = config.gameMode === 'cave' ? 'Deine Bilanz im Wintervorrat' : 'Deine Bilanz in der Endlos-Karawane';
  }

  // Frachtbrief & Top-Down Packtier zwischen den Taschen
  document.getElementById('waybillEmoji').textContent = config.license.icon;
  document.getElementById('waybillTitle').textContent = config.license.title;
  document.getElementById('waybillSentence').textContent =
    `„Ich bin ${config.animal.article} und fahre heute eine offizielle ${config.license.name}-Lieferung!“`;
  document.getElementById('animalBoardName').textContent = `${config.animal.name}-Tableau (Top-Down)`;

  // Markt-Vorschau-Steine
  document.getElementById('depot10Label').textContent = `10 mal ${config.license.icon}`;
  document.getElementById('depot5Label').textContent = `5 mal ${config.license.icon}`;
  document.getElementById('unitDepotIcon').textContent = `1 mal ${config.license.icon}`;

  document.getElementById('topDownAnimalSVG').innerHTML = getTopDownAnimalSVG(config.animal.id);
  document.getElementById('mountCaptionLabel').textContent = `${config.animal.icon} ${config.animal.name}`;

  const leftSum = sumArray(state.leftBag);
  const rightSum = sumArray(state.rightBag);
  const totalLoaded = leftSum + rightSum;

  // Einzel-Slot für den aktuellen Auftrag (Breitformat mit prominentem Profi-Packer-Ziel)
  const slot = document.getElementById('activeOrderSlot');
  const lockLabel = document.getElementById('orderLockLabel');
  if (isCaveMode()) {
    renderWinterPanel();
  } else if (state.activeOrder === null) {
    document.getElementById('orderPanelTitle').textContent = '📜 Aktueller Auftrag';
    slot.className = 'order-slot-box';
    lockLabel.textContent = 'Auftrag wählen';
    slot.innerHTML = `
      <div style="font-size:2.2rem; margin-bottom:6px;">📜</div>
      <p style="margin:0 0 12px; color:#6b5344; font-weight:700;">Noch kein Auftrag aktiv.</p>
      <button class="btn btn-oasis" onclick="openOrderModal()">
        📜 Auftrag auswählen
      </button>
    `;
  } else {
    const opt = getOptimalPacking(state.activeOrder, state.activeFoxBlock);
    const currentPieces = state.leftBag.length + state.rightBag.length;
    const isWithinProLimit = currentPieces <= opt.minPieces;

    const totalPips = Math.max(opt.minPieces, currentPieces);
    let pipsHTML = '';
    for (let i = 1; i <= totalPips; i++) {
      if (i <= currentPieces) {
        const cls = i <= opt.minPieces ? 'used-ok' : 'used-extra';
        pipsHTML += `<span class="crate-pip ${cls}" title="Geladenes Frachtstück ${i}">📦</span>`;
      } else {
        pipsHTML += `<span class="crate-pip" title="Freier Profi-Slot">▫️</span>`;
      }
    }

    const foxInfoLine = state.activeFoxBlock
      ? rickBadgeHTML(state.activeFoxBlock, 'margin-top:8px;')
      : '';

    const overloadHint = totalLoaded > state.activeOrder
      ? `<span class="overload-warning-pill">⚡ ${totalLoaded} / ${state.activeOrder} geladen: Entbündeln & ${totalLoaded - state.activeOrder} auspacken!</span>`
      : `<span class="pro-counter-pill">Im Sattel: ${currentPieces} von optimal ${opt.minPieces} ${opt.minPieces === 1 ? 'Stück' : 'Stücken'}</span>`;

    slot.className = 'order-slot-box locked-order';
    lockLabel.textContent = '🔒 Aktiv bis zur Lieferung';
    slot.innerHTML = `
      <div class="order-main-info">
        <div class="order-badge-num">${state.activeOrder}</div>
        <div class="order-cargo-title">${config.license.icon} ${config.license.name}</div>
        ${renderTwentyStrip(state.activeOrder)}
        ${foxInfoLine}
      </div>

      <div class="pro-goal-showcase ${isWithinProLimit ? 'on-track' : 'over-par'}">
        <div class="pro-goal-left">
          <div class="pro-medal-icon">${isWithinProLimit ? '🏅' : '💡'}</div>
          <div class="pro-goal-text">
            <small>Optimales Packziel (Profi-Packer)</small>
            <strong>Schaffe es mit nur ${opt.minPieces} ${opt.minPieces === 1 ? 'Frachtstück' : 'Frachtstücken'}!</strong>
          </div>
        </div>
        <div class="pro-goal-slots">
          <div class="crate-slots-row">${pipsHTML}</div>
          ${overloadHint}
        </div>
      </div>
    `;
  }

  renderRickBanner();

  // Markt-Depots aktivieren/deaktivieren + Rick-Overlay rendern
  const winterCard = isCaveMode() ? state.winter.card : null;
  const canGrab = isCaveMode() ? Boolean(winterCard && winterCard.type === 'plus') : state.activeOrder !== null;
  const foxBlockNow = rickBlockNow(); // Rick liegt schon vor der Kartenwahl sichtbar auf seinem Depot
  [
    { id: 'depot10', val: 10 },
    { id: 'depot5', val: 5 },
    { id: 'depot1', val: 1 }
  ].forEach(d => {
    const el = document.getElementById(d.id);
    if (!el) return;
    el.classList.toggle('disabled', !canGrab);

    // Rick-Overlay nur anlegen bzw. entfernen, wenn sich etwas ändert – sonst flackert es bei jedem Einpacken
    const oldFox = el.querySelector('.fox-blocker-overlay');
    const isFoxHere = Boolean(foxBlockNow) && foxBlockNow === d.val;
    el.classList.toggle('fox-blocked', isFoxHere);

    if (!isFoxHere && oldFox) oldFox.remove();
    if (isFoxHere && !oldFox) {
      const overlay = document.createElement('div');
      overlay.className = 'fox-blocker-overlay';
      overlay.innerHTML = `
        <div class="fox-emoji">🦊💤</div>
        <strong>${RICK_NAME} schläft hier!</strong>
        <small>Tipp: Größeres Stück am Sattel entbündeln!</small>
      `;
      el.appendChild(overlay);
    }
  });

  // Satteltaschen & Top-Down Grid
  const maxCap = config.level === 1 ? 10 : 20;

  document.getElementById('totalLoadText').textContent =
    isCaveMode()
      ? `${totalLoaded} / ${getBagCapacity()} geladen`
      : state.activeOrder !== null
      ? `${totalLoaded} / ${state.activeOrder} geladen`
      : `${totalLoaded} / ${maxCap} geladen`;

  document.getElementById('leftBagCounter').textContent = `${leftSum} / 10`;
  document.getElementById('rightBagCounter').textContent = `${rightSum} / 10`;

  const formatPieceLabel = (val) =>
    val === 1
      ? `<span class="piece-count-sm">1 mal</span><span class="piece-icon-sm">${config.license.icon}</span>`
      : `${val} mal ${config.license.icon}`;

  // Frachtstücke links rendern
  document.getElementById('leftBagPieces').innerHTML = state.leftBag.map((val, idx) => `
    <div class="cargo-block block-${val}"
         onclick="unpackCargo('left', ${idx})"
         title="Klicken zum Auspacken">
      ${formatPieceLabel(val)}
    </div>
  `).join('');

  const rightBagEl = document.getElementById('bagRight');
  const gridEl = document.getElementById('saddlebagsGrid');
  if (config.level === 1) {
    rightBagEl.style.display = 'none';
    gridEl.classList.add('level-1-layout');
  } else {
    rightBagEl.style.display = 'block';
    gridEl.classList.remove('level-1-layout');
    const unlocked = leftSum === 10;
    rightBagEl.classList.toggle('bag-locked', !unlocked);
    document.getElementById('rightLockHint').textContent = unlocked
      ? '💡 Klick auf Kiste = Auspacken'
      : '🔒 Erst öffnen, wenn links randvoll (10) ist!';

    document.getElementById('rightBagPieces').innerHTML = state.rightBag.map((val, idx) => `
      <div class="cargo-block block-${val}"
           onclick="unpackCargo('right', ${idx})"
           title="Klicken zum Auspacken">
        ${formatPieceLabel(val)}
      </div>
    `).join('');
  }

  // Entbündel-Buttons an beiden Taschen ein-/ausblenden
  const btnL10 = document.getElementById('swapBtnLeft10');
  const btnL5  = document.getElementById('swapBtnLeft5');
  const btnR10 = document.getElementById('swapBtnRight10');
  const btnR5  = document.getElementById('swapBtnRight5');

  if (btnL10) btnL10.style.display = state.leftBag.includes(10) ? 'inline-block' : 'none';
  if (btnL5)  btnL5.style.display  = state.leftBag.includes(5)  ? 'inline-block' : 'none';
  if (btnR10) btnR10.style.display = state.rightBag.includes(10) ? 'inline-block' : 'none';
  if (btnR5)  btnR5.style.display  = state.rightBag.includes(5)  ? 'inline-block' : 'none';

  // Bündel-Buttons (nur im Wintervorrat): 5× 1er ➔ 5er, 2× 5er ➔ 10er
  const count = (bag, v) => bag.filter(x => x === v).length;
  [['Left', state.leftBag], ['Right', state.rightBag]].forEach(([side, bag]) => {
    const b5 = document.getElementById(`bundleBtn${side}5`);
    const b10 = document.getElementById(`bundleBtn${side}10`);
    if (b5) b5.style.display = isCaveMode() && count(bag, 1) >= 5 ? 'inline-block' : 'none';
    if (b10) b10.style.display = isCaveMode() && count(bag, 5) >= 2 ? 'inline-block' : 'none';
  });

  renderCavePanel();
}

/* ============================================================================
   HÖHLE (Stufe 1: 5×10-, Stufe 2: 10×10-Lager pro Tier)
   Abgeladene Fracht wird als Puzzleteil (10er = 1×10, 5er = 1×5, 1er = 1×1)
   in die Höhle gelegt. Gespielt wird sie im Wintervorrat-Modus (Modul 4).
   ============================================================================ */

const fallbackCaves = {}; // Falls kein Profil geladen werden konnte

// Zustand der Einlager-Ansicht (nicht gespeichert)
const storageUI = { selectedIdx: 0, vertical: false, hover: null, justPlaced: null, lastPointer: 'mouse' };

function isCaveMode() {
  return config.gameMode === 'cave';
}

function getCaveTheme(animalId = config.animal.id) {
  return CAVE_THEMES[animalId] || CAVE_THEMES.camel;
}

function getCaveDims(level = config.level) {
  return { rows: level === 1 ? 5 : 10, cols: 10 };
}

function getCaveCapacity() {
  const d = getCaveDims();
  return d.rows * d.cols;
}

// Jede Kombination aus Tier und Stufe hat ihre eigene Höhle (5×10 und 10×10 getrennt)
function getCaveKey() {
  return `${config.animal.id}_L${config.level}`;
}

function createEmptyCave() {
  return {
    pieces: [], pending: [], batch: 0, completed: false, loot: [], foxUsed: false,
    bags: { left: [], right: [] }, cards: [], turns: 0, knackevoll: 0
  };
}

function getActiveCave() {
  if (tutorial.active && tutorial.cave) return tutorial.cave;
  let caves = fallbackCaves;
  if (activeProfile) {
    if (!activeProfile.caves) activeProfile.caves = {};
    caves = activeProfile.caves;
  }
  const key = getCaveKey();
  if (!caves[key]) caves[key] = createEmptyCave();
  return caves[key];
}

async function saveCave() {
  if (tutorial.active) return; // Übungs-Höhle wird nicht gespeichert
  if (activeProfile) await dbSaveProfile(activeProfile);
}

function getCaveUsedCells(cave) {
  return sumArray(cave.pieces.map(p => p.size));
}

function buildCaveGrid(cave) {
  const { rows, cols } = getCaveDims();
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  cave.pieces.forEach((p, idx) => {
    for (let i = 0; i < p.size; i++) {
      const r = p.r + (p.vertical ? i : 0);
      const c = p.c + (p.vertical ? 0 : i);
      if (r < rows && c < cols) grid[r][c] = idx;
    }
  });
  return grid;
}

function countFullRows(grid) {
  return grid.filter(row => row.every(cell => cell !== null)).length;
}

function canPlacePiece(grid, size, r, c, vertical) {
  const rows = grid.length;
  const cols = grid[0].length;
  if (r < 0 || c < 0) return false;
  if (vertical ? r + size > rows : c + size > cols) return false;
  for (let i = 0; i < size; i++) {
    if (grid[r + (vertical ? i : 0)][c + (vertical ? 0 : i)] !== null) return false;
  }
  return true;
}

function pieceFitsAnywhere(grid, size) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (canPlacePiece(grid, size, r, c, false) || canPlacePiece(grid, size, r, c, true)) return true;
    }
  }
  return false;
}

// Verschiebt den Ankerpunkt so, dass das Teil nicht über den Rand ragt (kinderfreundlich)
function clampAnchor(size, r, c, vertical) {
  const { rows, cols } = getCaveDims();
  if (vertical) r = Math.max(0, Math.min(r, rows - size));
  else c = Math.max(0, Math.min(c, cols - size));
  return { r, c };
}

function renderCavePieceHTML(size, r, c, vertical, extraClass = '', attrs = '') {
  let units = '';
  for (let i = 1; i <= size; i++) {
    units += `<span class="cave-unit ${size === 10 && i === 5 ? 'unit-mid' : ''}"></span>`;
  }
  const area = vertical
    ? `grid-row:${r + 1} / span ${size}; grid-column:${c + 1};`
    : `grid-row:${r + 1}; grid-column:${c + 1} / span ${size};`;
  return `
    <div class="cave-piece piece-${size} ${vertical ? 'is-vertical' : ''} ${extraClass}" style="${area}" ${attrs}>
      ${units}
    </div>
  `;
}

// Baut das Höhlen-Raster. Im interaktiven Modus (Einlagern) gibt es Vorschau & Zurücknehmen.
function renderCaveHTML(cave, interactive = false, sleeping = false) {
  const { rows, cols } = getCaveDims();
  const theme = getCaveTheme();
  const season = getSeason(cave);
  let cells = '';

  if (interactive) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells += `<div class="cave-cell" data-r="${r}" data-c="${c}" style="grid-row:${r + 1}; grid-column:${c + 1};"
                       onpointerenter="caveHover(event, ${r}, ${c})"
                       onclick="caveCellClick(${r}, ${c})"></div>`;
      }
    }
  } else {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells += `<div class="cave-cell" style="grid-row:${r + 1}; grid-column:${c + 1};"></div>`;
      }
    }
  }

  const pieces = cave.pieces.map((p, idx) => {
    const removable = interactive && p.batch === cave.batch;
    const isNew = p === storageUI.justPlaced;
    const html = renderCavePieceHTML(
      p.size, p.r, p.c, p.vertical,
      `${removable ? 'removable' : ''} ${isNew ? 'piece-new' : ''}`,
      removable ? `onclick="removeStoredPiece(${idx})" title="Antippen = zurück in die Ablage"` : ''
    );
    // Frisch abgelegte Kiste: Punkte schweben kurz nach oben
    const pop = isNew
      ? `<div class="points-pop" style="${p.vertical
          ? `grid-row:${p.r + 1} / span ${p.size}; grid-column:${p.c + 1};`
          : `grid-row:${p.r + 1}; grid-column:${p.c + 1} / span ${p.size};`}">+${CRATE_POINTS[p.size]} ⭐</div>`
      : '';
    return html + pop;
  }).join('');

  const preview = interactive ? renderCavePreviewHTML(cave) : '';

  return `
    <div class="cave-frame cave-theme-${config.animal.id} season-${season.id}">
      <div class="cave-frame-title">${season.deco[0]} ${theme.name} ${season.deco[1]}</div>
      ${renderLootShelfHTML(cave)}
      <div class="cave-grid ${rows === 5 ? 'cave-half' : ''}"
           style="grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${rows}, 1fr);"
           ${interactive ? 'onpointerdown="storageUI.lastPointer = event.pointerType" onpointerleave="caveHoverLeave(event)"' : ''}>
        ${cells}${pieces}${preview}
        ${sleeping ? `<div class="cave-sleeper">${config.animal.icon}<span>💤</span></div>` : ''}
      </div>
    </div>
  `;
}

function renderCavePreviewHTML(cave) {
  if (!storageUI.hover || cave.pending.length === 0) return '';
  const size = cave.pending[storageUI.selectedIdx];
  const grid = buildCaveGrid(cave);
  const vertical = size > 1 && storageUI.vertical;
  const a = clampAnchor(size, storageUI.hover.r, storageUI.hover.c, vertical);
  const valid = canPlacePiece(grid, size, a.r, a.c, vertical);
  return renderCavePieceHTML(size, a.r, a.c, vertical, `cave-preview ${valid ? 'valid' : 'invalid'}`);
}

// Aktualisiert nur die Vorschau, ohne die abgelegten Kisten neu aufzubauen (sonst flackern sie)
function updateCavePreview() {
  const gridEl = document.querySelector('#storageCaveFrame .cave-grid');
  if (!gridEl) return;
  const old = gridEl.querySelector('.cave-preview');
  if (old) old.remove();
  gridEl.insertAdjacentHTML('beforeend', renderCavePreviewHTML(getActiveCave()));
}

// Schatzregal mit der Fuchs-Beute (funkelnd, wenn dafür entbündelt wurde)
function renderLootShelfHTML(cave) {
  const loot = cave.loot || [];
  if (loot.length === 0) return '';
  const items = loot.map(l =>
    `<span class="loot-item ${l.sparkle ? 'loot-sparkle' : ''}" title="${l.name}${l.sparkle ? ' (mit Entbündeln erobert)' : ''}">${l.icon}</span>`
  ).join('');
  return `<div class="loot-shelf" title="Fuchs-Beute">🦊 ${items}</div>`;
}

// Fuchs-Meister: Jede Beute dieser Höhle wurde durch Entbündeln erobert
function isFoxMaster(cave) {
  const loot = cave.loot || [];
  return loot.length > 0 && loot.every(l => l.sparkle);
}

// Rekorde getrennt für Höhlen mit und ohne Fuchs-Aufträge
function getCaveRecordKey(cave) {
  return getCaveKey() + '_pts' + (cave.foxUsed ? '_fox' : '');
}

function getCaveProgressLine(cave) {
  ensureWinterCave(cave);
  const rows = countFullRows(buildCaveGrid(cave));
  return `⭐ ${getCavePoints(cave)} &nbsp;|&nbsp; 📦 ${getCaveUsedCells(cave)} / ${getCaveCapacity()} &nbsp;|&nbsp; 💎 ${rows} &nbsp;|&nbsp; 🃏 ${cave.turns} &nbsp;|&nbsp; 💥 ${cave.knackevoll}`;
}

/* Kleine Höhlen-Ansicht unterhalb des Packtier-Tableaus */
function renderCavePanel() {
  const panel = document.getElementById('cavePanel');
  if (!panel) return;
  if (!isCaveMode()) {
    panel.classList.add('hidden');
    document.body.removeAttribute('data-season');
    return;
  }
  const cave = ensureWinterCave(getActiveCave());
  panel.classList.remove('hidden');
  document.body.setAttribute('data-season', getSeason(cave).id);
  document.getElementById('caveSeasonTrack').innerHTML = renderSeasonTrack(cave);
  document.getElementById('cavePanelGrid').innerHTML = renderCaveHTML(cave, false);
  document.getElementById('cavePanelStats').innerHTML = getCaveProgressLine(cave);
}

/* ---------- Ablauf-Steuerung ---------- */

// Entscheidet, was als Nächstes passiert: Einlagern, Abschlussbildschirm, Karte oder Auftrag
function continueGameFlow() {
  if (story.active && state.availableOrders.length === 0) {
    completeEpisode();
    return;
  }
  if (isCaveMode()) {
    const cave = getActiveCave();
    if (cave.completed && !tutorial.active) {
      showCaveComplete();
    } else if (cave.pending.length > 0) {
      openStorageModal();
    }
    // Sonst: Die Karten liegen im Spielfeld, das Kind wählt selbst
    return;
  }
  if (tutorial.active && state.availableOrders.length === 0) {
    finishTutorial();
    return;
  }
  openOrderModal();
}

/* ---------- Einlagern ---------- */

function openStorageModal() {
  storageUI.selectedIdx = 0;
  storageUI.hover = null;
  renderStorage();
  document.getElementById('storageModal').classList.remove('hidden');
}

function setStorageHint(text, type = '') {
  const el = document.getElementById('storageHint');
  el.className = 'camel-speech' + (type ? ` speech-${type}` : '');
  el.textContent = text;
}

function renderStorage(hintText = null, hintType = '') {
  const cave = getActiveCave();
  const grid = buildCaveGrid(cave);
  const theme = getCaveTheme();

  if (storageUI.selectedIdx >= cave.pending.length) storageUI.selectedIdx = 0;

  document.getElementById('storageTitle').textContent = `${theme.deco[0]} Ab in die ${theme.name}!`;

  const tray = document.getElementById('storageTray');
  if (cave.pending.length === 0) {
    tray.innerHTML = `<span class="storage-tray-empty">✅ Alles eingelagert!</span>`;
  } else {
    tray.innerHTML = cave.pending.map((size, idx) => `
      <button class="mini-cargo-chip chip-${size} tray-chip ${idx === storageUI.selectedIdx ? 'selected' : ''}"
              onclick="selectPendingPiece(${idx})">
        ${size} mal ${config.license.icon}
      </button>
    `).join('');
  }

  const rotateBtn = document.getElementById('storageRotateBtn');
  const selectedSize = cave.pending[storageUI.selectedIdx];
  rotateBtn.style.visibility = cave.pending.length > 0 && selectedSize > 1 ? 'visible' : 'hidden';
  rotateBtn.textContent = storageUI.vertical ? '↻ Drehen (jetzt: hochkant)' : '↻ Drehen (jetzt: quer)';

  document.getElementById('storageCaveFrame').innerHTML = renderCaveHTML(cave, true);
  storageUI.justPlaced = null;
  document.getElementById('storageStats').innerHTML = getCaveProgressLine(cave);

  const unbundleBtn = document.getElementById('storageUnbundleBtn');
  const stuck = cave.pending.length > 0 && selectedSize > 1 && !pieceFitsAnywhere(grid, selectedSize);
  unbundleBtn.style.display = stuck ? 'inline-block' : 'none';
  if (stuck) {
    unbundleBtn.textContent = selectedSize === 10 ? '🔄 10er ➔ 2× 5er' : '🔄 5er ➔ 5× 1er';
  }

  const doneBtn = document.getElementById('storageDoneBtn');
  doneBtn.disabled = cave.pending.length > 0;

  if (hintText) {
    setStorageHint(hintText, hintType);
  } else if (cave.pending.length === 0) {
    setStorageHint('Super! Alles liegt in der Höhle. Tippe auf „Fertig“ – oder tippe ein neues Teil an, um es noch einmal umzulegen.', 'success');
  } else if (stuck) {
    setStorageHint(`Der ${selectedSize}er passt nirgends mehr hin! Entbündle ihn in kleinere Teile.`, 'error');
  } else {
    setStorageHint('Tippe ein Frachtstück oben an und dann auf ein Feld in der Höhle. Beim ersten Tippen siehst du eine Vorschau, beim zweiten wird abgelegt.');
  }
}

function selectPendingPiece(idx) {
  storageUI.selectedIdx = idx;
  renderStorage();
}

function toggleStorageRotation() {
  storageUI.vertical = !storageUI.vertical;
  renderStorage();
}

// Maus: Vorschau beim Darüberfahren. Touch: Vorschau erst beim ersten Antippen (siehe caveCellClick)
function caveHover(event, r, c) {
  if (event.pointerType !== 'mouse') return;
  if (storageUI.hover && storageUI.hover.r === r && storageUI.hover.c === c) return;
  storageUI.hover = { r, c };
  updateCavePreview();
}

function caveHoverLeave(event) {
  // Bei Touch und Stift feuert pointerleave direkt nach dem Loslassen – noch vor dem Klick.
  // Die Vorschau darf dann nicht gelöscht werden, sonst klappt das zweite Antippen nie.
  if (event && event.pointerType && event.pointerType !== 'mouse') return;
  if (!storageUI.hover) return;
  storageUI.hover = null;
  updateCavePreview();
}

// Maus: Vorschau liegt schon unter dem Zeiger, ein Klick legt ab.
// Touch: 1. Antippen zeigt die Vorschau, 2. Antippen irgendwo auf die Vorschau legt dort ab.
function caveCellClick(r, c) {
  const cave = getActiveCave();
  if (cave.pending.length === 0) return;

  const size = cave.pending[storageUI.selectedIdx];
  const vertical = size > 1 && storageUI.vertical;

  if (storageUI.hover) {
    const a = clampAnchor(size, storageUI.hover.r, storageUI.hover.c, vertical);
    const onPreview = vertical
      ? (c === a.c && r >= a.r && r < a.r + size)
      : (r === a.r && c >= a.c && c < a.c + size);
    if (onPreview) {
      // Nach dem Ablegen keine „Geister-Vorschau“ des nächsten Teils an gleicher Stelle (nur bei Touch)
      if (storageUI.lastPointer !== 'mouse') storageUI.hover = null;
      placeSelectedPiece(a.r, a.c);
      return;
    }
  }
  storageUI.hover = { r, c };
  renderStorage();
}

function placeSelectedPiece(r, c) {
  const cave = getActiveCave();
  const size = cave.pending[storageUI.selectedIdx];
  const vertical = size > 1 && storageUI.vertical;
  const grid = buildCaveGrid(cave);
  const a = clampAnchor(size, r, c, vertical);

  if (!canPlacePiece(grid, size, a.r, a.c, vertical)) {
    fx('error', 'oops');
    renderStorage(`⚠️ Da passt der ${size}er nicht hin! Probier eine andere Stelle${size > 1 ? ' oder drehe das Teil' : ''}.`, 'error');
    return;
  }

  const rowsBefore = countFullRows(grid);
  const seasonBefore = getSeason(cave).id;
  const newPiece = { size, r: a.r, c: a.c, vertical, batch: cave.batch };
  cave.pieces.push(newPiece);
  storageUI.justPlaced = newPiece;
  cave.pending.splice(storageUI.selectedIdx, 1);
  const rowsAfter = countFullRows(buildCaveGrid(cave));

  saveCave();
  fx('place' + size);
  if (rowsAfter > rowsBefore) setTimeout(() => fx('row', 'happy'), 180);
  const seasonNow = getSeason(cave);
  if (seasonNow.id !== seasonBefore) {
    // Jahreszeitenwechsel: kurzer Jingle, Symbol in der Bildmitte, Tier freut sich
    setTimeout(() => {
      fx('season_' + seasonNow.id, 'cheer');
      showToast(seasonNow.icon);
    }, rowsAfter > rowsBefore ? 700 : 250);
  }

  if (rowsAfter > rowsBefore) {
    launchConfetti(25);
    const n = rowsAfter - rowsBefore;
    renderStorage(`💎 ${n === 1 ? 'Eine Reihe' : n + ' Reihen'} randvoll! Dafür gibt es ${n === 1 ? 'einen Edelstein' : n + ' Edelsteine'}!`, 'success');
  } else {
    renderStorage();
  }
}

// Teile aus der aktuellen Lieferung dürfen zurück in die Ablage
function removeStoredPiece(idx) {
  const cave = getActiveCave();
  const piece = cave.pieces[idx];
  if (!piece || piece.batch !== cave.batch) return;
  cave.pieces.splice(idx, 1);
  cave.pending.push(piece.size);
  storageUI.selectedIdx = cave.pending.length - 1;
  storageUI.vertical = piece.vertical;
  saveCave();
  fx('unpack');
  renderStorage('↩️ Zurück in die Ablage genommen.');
}

// Notlösung, wenn ein großes Teil nirgends mehr hineinpasst
function unbundleSelectedPiece() {
  const cave = getActiveCave();
  const size = cave.pending[storageUI.selectedIdx];
  if (size === 10) cave.pending.splice(storageUI.selectedIdx, 1, 5, 5);
  else if (size === 5) cave.pending.splice(storageUI.selectedIdx, 1, 1, 1, 1, 1, 1);
  else return;
  saveCave();
  renderStorage(`🔄 Clever entbündelt! Jetzt passt die Fracht in die Lücken.`);
}

async function finishStorage() {
  const cave = getActiveCave();
  if (cave.pending.length > 0) return;

  cave.batch += 1;
  storageUI.hover = null;
  document.getElementById('storageModal').classList.add('hidden');

  if (tutorial.active) {
    render();
    finishTutorial();
    return;
  }

  if (getCaveUsedCells(cave) >= getCaveCapacity()) {
    cave.completed = true;
    if (activeProfile) {
      getModeStats(activeProfile, 'cave').cavesFilled += 1;
      const key = getCaveRecordKey(cave);
      if (!activeProfile.caveRecords) activeProfile.caveRecords = {};
      const best = activeProfile.caveRecords[key];
      const points = getCavePoints(cave);
      cave.isNewRecord = !best || points > best;
      if (cave.isNewRecord) activeProfile.caveRecords[key] = points;
    }
    await saveCave();
    render();
    showCaveComplete();
    return;
  }

  refreshWinterCards(cave);
  await saveCave();
  render();
  setSpeech(`${getSeason(cave).icon} Alles verstaut! Wähle die nächste Karte.`, '');
}

/* ---------- Abschlussbildschirm ---------- */

function showCaveComplete() {
  const cave = ensureWinterCave(getActiveCave());
  const theme = getCaveTheme();
  const best = activeProfile && activeProfile.caveRecords ? activeProfile.caveRecords[getCaveRecordKey(cave)] : null;
  const playerName = activeProfile ? activeProfile.name : 'Du';
  const loot = cave.loot || [];
  const points = getCavePoints(cave);
  const packStars = getPackStars(points);
  const tempo = isTempoStar(cave);
  const limits = CAVE_STAR_LIMITS[config.level];
  const crateCounts = { 10: 0, 5: 0, 1: 0 };
  cave.pieces.forEach(p => { crateCounts[p.size] += 1; });

  launchConfetti(90);

  document.getElementById('caveCompleteDialog').innerHTML = `
    <div class="celebration-trophy">❄️${config.animal.icon}💤❄️</div>
    <div class="celebration-big-number">❄️ Winterschlaf! ❄️</div>

    ${renderCaveHTML(cave, false, true)}

    <div class="result-badges" style="margin:14px 0;">
      <div class="result-badge result-pro" title="Packen: ${points} Punkte">📦 ${starString(packStars)}</div>
      <div class="result-badge ${tempo ? 'result-pro' : 'result-tip'}" title="Tempo: ${cave.turns} Karten">🃏 ${tempo ? '⭐' : '☆'}</div>
      <div class="result-badge result-pro" title="KNACKEVOLL!-Bonus">💥 ${cave.knackevoll}×</div>
      ${loot.length > 0 ? `<div class="result-badge result-fox" title="Fuchs-Beute">🦊 ➔ ${loot.length}× ${loot[0].icon}</div>` : ''}
      ${isFoxMaster(cave) ? `<div class="result-badge result-pro" title="Jede Beute durch Entbündeln erobert">🦊 🏆</div>` : ''}
      ${cave.isNewRecord ? `<div class="result-badge result-pro" title="Neuer Rekord: so viele Punkte wie noch nie">🏆 ⭐ ${points}</div>` : ''}
    </div>
    <div class="celebration-big-number" title="Punkte">⭐ ${points}</div>

    <details class="adult-details text-detail">
      <summary>👩‍🏫 Für Erwachsene</summary>
      <p>${playerName} hat die <strong>${theme.name}</strong> von ${config.animal.article} randvoll mit ${config.license.name} für den Winter gefüllt.</p>
      <p>Punkte: <strong>${points}</strong>${best ? ` · Rekord: <strong>${best}</strong>${cave.foxUsed ? ' (mit Wüstenfuchs)' : ''}` : ''}</p>
      <p>Kisten: ${crateCounts[10]}× 10er (je ${CRATE_POINTS[10]}), ${crateCounts[5]}× 5er (je ${CRATE_POINTS[5]}), ${crateCounts[1]}× Einer (je ${CRATE_POINTS[1]}).
        Größere Bündel bringen einen Bonus: Ein 10er zählt doppelt so viel wie zehn Einer.</p>
      <p>Sterne: 📦 Packen ${packStars} von 3 (2 ab ${limits.points[0]}, 3 ab ${limits.points[1]} Punkten) · 🃏 Tempo ${tempo ? 'erreicht' : 'knapp verpasst'}: ${cave.turns} Karten (Stern bis ${limits.maxCards})</p>
      <p>Gespielte Karten: <strong>${cave.turns}</strong></p>
      <p>KNACKEVOLL! (Tier randvoll): <strong>${cave.knackevoll}×</strong> · Volle Reihen: <strong>${countFullRows(buildCaveGrid(cave))}</strong></p>
      ${loot.length > 0 ? `<p>Fuchs-Beute: <strong>${loot.length}</strong>, davon mit Entbündeln erobert: <strong>${loot.filter(l => l.sparkle).length}</strong></p>` : ''}
    </details>

    <div style="margin-top:18px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
      <button class="btn" onclick="openSetupFromCaveComplete()" title="Spiel-Setup">⚙️</button>
      <button class="btn btn-oasis celebration-next-btn" onclick="startNewCave()" title="Neues Jahr – neue Höhle">🌸 ▶</button>
    </div>
  `;

  document.getElementById('caveCompleteModal').classList.remove('hidden');
  fx('winter', 'sleep');
  setSpeech(`❄️ ${config.animal.article} hält zufrieden Winterschlaf vor den Vorräten!`, 'success');
}

function openSetupFromCaveComplete() {
  document.getElementById('caveCompleteModal').classList.add('hidden');
  openSetupModal();
}

async function startNewCave() {
  const key = getCaveKey();
  if (activeProfile) {
    activeProfile.caves[key] = createEmptyCave();
  } else {
    fallbackCaves[key] = createEmptyCave();
  }
  await saveCave();
  document.getElementById('caveCompleteModal').classList.add('hidden');
  resetGame();
}

/* ============================================================================
   MODUL 4: WINTERVORRAT (Höhlen-Modus)
   Das Tier packt Vorräte für den Winter. Plus-Karten = auf dem Markt einkaufen
   (max. 2 Stücke), Minus-Karten = vom Tier abladen und in die Höhle legen.
   Wird das Tier randvoll, heißt es KNACKEVOLL! und alles wandert auf einmal
   in die Höhle. Mit dem Füllstand der Höhle ziehen die Jahreszeiten vorbei.
   ============================================================================ */
// [Wert, Anzahl im Kartendeck] – alle Werte sind mit höchstens 2 Stücken darstellbar
const WINTER_PLUS_DECK = [[1, 3], [2, 3], [5, 5], [6, 4], [10, 4], [11, 3], [15, 2]];
const WINTER_MINUS_DECK = [[1, 3], [2, 3], [5, 4], [6, 3], [10, 3]];
const WINTER_MAX_TAKES = 2;

// Wertung: Bündeln lohnt sich. Ein 10er zählt doppelt so viel wie zehn Einer, ein 5er 1,6-mal so viel.
const CRATE_POINTS = { 10: 20, 5: 8, 1: 1 };
// Sterne-Grenzen (aus Testspielen geschätzt): [ab 2 Sternen, ab 3 Sternen] Punkte, Tempo-Stern bis maximal x Karten
const CAVE_STAR_LIMITS = {
  1: { points: [65, 78], maxCards: 22 },
  2: { points: [125, 140], maxCards: 36 }
};

function getCavePoints(cave) {
  return cave.pieces.reduce((sum, p) => sum + (CRATE_POINTS[p.size] || 0), 0);
}

function getPackStars(points) {
  const [two, three] = CAVE_STAR_LIMITS[config.level].points;
  return points >= three ? 3 : (points >= two ? 2 : 1);
}

function isTempoStar(cave) {
  return cave.turns <= CAVE_STAR_LIMITS[config.level].maxCards;
}

function starString(n, total = 3) {
  return '⭐'.repeat(n) + '☆'.repeat(Math.max(0, total - n));
}

const SEASONS = [
  { id: 'spring', icon: '🌸', name: 'Frühling', deco: ['🌷', '🐣', '🌱'] },
  { id: 'summer', icon: '☀️', name: 'Sommer',   deco: ['🌻', '🍓', '🦋'] },
  { id: 'autumn', icon: '🍂', name: 'Herbst',   deco: ['🍁', '🍄', '🌰'] },
  { id: 'winter', icon: '❄️', name: 'Winter',   deco: ['⛄', '🌨️', '❄️'] }
];

function createWinterTurnState() {
  return { card: null, cardIdx: null, snapshot: null, takes: 0, unloaded: [] };
}
state.winter = createWinterTurnState();

function getBagCapacity() {
  return config.level === 1 ? 10 : 20;
}

// Ältere Höhlen um die Felder des Wintervorrats ergänzen
function ensureWinterCave(cave) {
  if (!cave.bags) cave.bags = { left: [], right: [] };
  if (!cave.cards) cave.cards = [];
  if (typeof cave.turns !== 'number') cave.turns = 0;
  if (typeof cave.knackevoll !== 'number') cave.knackevoll = 0;
  if (!cave.loot) cave.loot = [];
  return cave;
}

function getCaveLoad(cave) {
  return sumArray(cave.bags.left) + sumArray(cave.bags.right);
}

function getSeason(cave) {
  if (cave.completed) return SEASONS[3];
  const ratio = getCaveUsedCells(cave) / getCaveCapacity();
  return SEASONS[Math.min(3, Math.floor(ratio * 4))];
}

/* ---------- Karten ---------- */

// Legt ein Stück in die Taschen – nach den Spielregeln: erst links bis 10, dann rechts (Wackel-Regel).
// Gibt die neuen Taschen zurück oder null, wenn das Stück dort nicht hineinpasst.
function placeInBags(left, right, val) {
  const leftSum = sumArray(left);
  const rightSum = sumArray(right);
  if (leftSum + rightSum + val > getBagCapacity()) return null; // Tier wäre überladen
  if (leftSum < 10) {
    return leftSum + val <= 10 ? { left: [...left, val], right } : null;
  }
  return rightSum + val <= 10 ? { left, right: [...right, val] } : null;
}

// Gibt es von diesem Zustand aus einen Weg zum Zielwert? Höchstens maxTakes Stücke vom Markt (ohne das
// gesperrte Depot), und die Stücke müssen nach den Passregeln in die Taschen passen. Ein Überschuss darf
// anschließend entbündelt und zurückgelegt werden.
function planFrom(target, blocked, left, right, maxTakes) {
  const allowed = [10, 5, 1].filter(p => p !== blocked);
  let best = null;
  const walk = (l, r, taken) => {
    const total = sumArray(l) + sumArray(r);
    if (total >= target) {
      if (!best || taken.length < best.pieces.length || (taken.length === best.pieces.length && total < best.total)) {
        best = { pieces: taken, total };
      }
      return;
    }
    if (taken.length >= maxTakes) return;
    for (const piece of allowed) {
      const next = placeInBags(l, r, piece);
      if (next) walk(next.left, next.right, [...taken, piece]);
    }
  };
  walk(left, right, []);
  return best;
}

function findPlusPlan(val, blocked, left, right) {
  return planFrom(sumArray(left) + sumArray(right) + val, blocked, left, right, WINTER_MAX_TAKES);
}

function isWinterCardValid(card, cave) {
  const load = getCaveLoad(cave);
  if (card.type === 'minus') return card.val <= load;
  // Plus: Tier darf nicht überladen werden, und alles muss später noch in die Höhle passen
  const free = getCaveCapacity() - getCaveUsedCells(cave) - sumArray(cave.pending) - load;
  if (load + card.val > getBagCapacity() || card.val > free) return false;
  // Muss sich mit höchstens 2 Stücken und den Passregeln lösen lassen (auch an Ricks aktueller Sperre vorbei)
  return Boolean(findPlusPlan(card.val, rickBlockNow(), cave.bags.left, cave.bags.right));
}

function drawWinterCard(cave, existing) {
  const pool = [];
  WINTER_PLUS_DECK.forEach(([val, n]) => { for (let i = 0; i < n; i++) pool.push({ type: 'plus', val }); });
  WINTER_MINUS_DECK.forEach(([val, n]) => { for (let i = 0; i < n; i++) pool.push({ type: 'minus', val }); });

  const valid = pool.filter(c => isWinterCardValid(c, cave));
  if (valid.length === 0) return null;
  // Möglichst keine doppelten Karten in der Auslage
  const fresh = valid.filter(c => !existing.some(e => e && e.type === c.type && e.val === c.val));
  const source = fresh.length > 0 ? fresh : valid;
  // Neue Karten sind immer lösbar (isWinterCardValid prüft Ricks aktuelle Sperre mit)
  return { ...source[Math.floor(Math.random() * source.length)] };
}

// Die Auslage hat 3 feste Plätze. Eine Karte bleibt genau dort liegen, solange sie noch spielbar ist –
// so kann das Kind vorausplanen. Ersetzt werden nur die gespielte und ungültig gewordene Karten,
// und zwar an ihrem eigenen Platz (null = Platz leer, falls gerade keine passende Karte existiert).
const WINTER_CARD_SLOTS = 3;

/*
 * Filter für Ricks nächste Sperre im Wintervorrat:
 * - lösbar:   alle ausliegenden Plus-Karten bleiben mit der neuen Sperre erreichbar (vom aktuellen Taschenstand aus)
 * - relevant: Rick betrifft mindestens eine ausliegende Plus-Karte
 */
function rickWinterFilters(cave) {
  const plus = () => cave.cards.filter(c => c && c.type === 'plus');
  return [
    block => plus().every(c => findPlusPlan(c.val, block, cave.bags.left, cave.bags.right)),
    block => plus().some(c => isRickRelevant(c.val, block))
  ];
}

function syncRickToCave(cave) {
  cave.rick = config.foxMode ? { ...state.rick } : null;
}

function refreshWinterCards(cave) {
  if (tutorial.active) return; // Die Übung legt ihre Karten selbst fest
  const slots = Array.from({ length: WINTER_CARD_SLOTS }, (_, i) => {
    const card = cave.cards[i];
    return card && isWinterCardValid(card, cave) ? card : null;
  });
  for (let i = 0; i < WINTER_CARD_SLOTS; i++) {
    if (slots[i]) continue;
    slots[i] = drawWinterCard(cave, slots.filter(Boolean)); // null, wenn nichts Spielbares da ist
  }
  cave.cards = slots;
}

/* ---------- Spielzug ---------- */

// Taschen des Tieres aus der Höhle übernehmen (nach Laden, Profilwechsel, Neustart)
function winterResume() {
  const cave = ensureWinterCave(getActiveCave());
  state.activeOrder = null;
  state.activeFoxBlock = null;
  state.leftBag = [...cave.bags.left];
  state.rightBag = [...cave.bags.right];
  state.winter = createWinterTurnState();
  // Rick macht dort weiter, wo er aufgehört hat (gespeichert in der Höhle)
  resetRick();
  if (config.foxMode) {
    state.rick = cave.rick && cave.rick.current ? { current: cave.rick.current, next: cave.rick.next || null } : { current: null, next: null };
    if (!state.rick.current) state.rick.current = pickRickBlock(null);
  }
  refreshWinterCards(cave);
  if (config.foxMode && !state.rick.next) planRickNext(...rickWinterFilters(cave));
  syncRickToCave(cave);
  document.getElementById('celebrationModal').classList.add('hidden');
  setSpeech(rickAnnouncement() || `${getSeason(cave).icon} Wähle oben eine Karte: ➕ einkaufen oder ➖ in die Höhle bringen!`, '');
  render();
  if (document.getElementById('setupModal').classList.contains('hidden')) {
    continueGameFlow();
  }
}

function getWinterTarget() {
  const w = state.winter;
  if (!w.card) return null;
  const start = sumArray(w.snapshot.left) + sumArray(w.snapshot.right);
  return w.card.type === 'plus' ? start + w.card.val : start - w.card.val;
}

function pickWinterCard(idx) {
  if (state.winter.card) return;
  const cave = getActiveCave();
  const card = cave.cards[idx];
  if (!card) return;
  state.winter = {
    card,
    cardIdx: idx,
    snapshot: { left: [...state.leftBag], right: [...state.rightBag] },
    takes: 0,
    unloaded: []
  };
  state.unbundledThisOrder = false;
  fx('pick');

  if (card.type === 'plus') {
    setSpeech(isRickRelevant(card.val, rickBlockNow())
      ? `🦊💤 ${RICK_NAME} schläft auf den ${rickBlockNow()}er-Kisten! Hol ${card.val} anders – du darfst auch zu viel nehmen, entbündeln und zurücklegen.`
      : `🧺 +${card.val}: Hol ${card.val}× ${config.license.icon} vom Markt – mit höchstens ${WINTER_MAX_TAKES} Stücken!`, '');
  } else {
    setSpeech(`🏠 −${card.val}: Pack ${card.val}× ${config.license.icon} ab – zuerst aus der rechten Tasche!`, '');
  }
  render();
}

// Zug abbrechen: Taschen wie vor der Karte, Karte zurück in die Auslage
function cancelWinterTurn() {
  const w = state.winter;
  if (!w.card) return;
  state.leftBag = [...w.snapshot.left];
  state.rightBag = [...w.snapshot.right];
  state.winter = createWinterTurnState();
  setSpeech('↩️ Alles wie vorher. Wähle eine Karte!', '');
  render();
}

function winterTakeCargo(val) {
  const w = state.winter;
  if (!w.card) {
    setSpeech('👆 Wähle zuerst oben eine Karte!', 'error');
    return;
  }
  if (w.card.type !== 'plus') {
    setSpeech('🏠 Bei einer Minus-Karte wird abgeladen, nicht eingekauft. Tippe auf die Fracht in den Taschen!', 'error');
    return;
  }
  if (rickBlockNow() === val) {
    setSpeech(`🦊💤 Pssst! ${RICK_NAME} schläft auf den ${val}er-Kisten! Nimm ein anderes Stück.`, 'error');
    return;
  }
  if (w.takes >= WINTER_MAX_TAKES) {
    setSpeech(`✋✋ Nur ${WINTER_MAX_TAKES} Stücke pro Karte! Mit ↩ kannst du neu anfangen.`, 'error');
    flashTakeLimit();
    return;
  }

  const leftSum = sumArray(state.leftBag);
  const rightSum = sumArray(state.rightBag);
  const total = leftSum + rightSum;

  // Wackel-Regel wie im Endlos-Modus: Ein Stück, das nicht mehr in die Tasche passt, bleibt draußen –
  // das Kind muss selbst überlegen, wie es den Rest zerlegt (z. B. 5 + 5 statt 10).
  if (total + val > getBagCapacity()) {
    wobbleBag(config.level === 1 || leftSum < 10 ? 'bagLeft' : 'bagRight');
    setSpeech(`⚠️ Wackel-Regel! Auf ${config.animal.article} ist nur noch Platz für ${getBagCapacity() - total}.`, 'error');
    return;
  }
  if (leftSum < 10) {
    if (leftSum + val > 10) {
      wobbleBag('bagLeft');
      setSpeech(`⚠️ Wackel-Regel! In der linken Satteltasche sind nur noch ${10 - leftSum} Plätze frei – ein ${val}er-Stück passt dort nicht hinein!`, 'error');
      return;
    }
    state.leftBag.push(val);
  } else {
    if (rightSum + val > 10) {
      wobbleBag('bagRight');
      setSpeech(`⚠️ Wackel-Regel! In der rechten Satteltasche sind nur noch ${10 - rightSum} Plätze frei!`, 'error');
      return;
    }
    state.rightBag.push(val);
  }
  fx('take');
  w.takes += 1;

  if (checkWinterCompletion()) return;
  render();
}

// Sackgasse: Ziel nicht mehr erreichbar (z. B. falsches Stück gewählt) → ↩ blinkt, Kind fängt neu an
function isWinterStuck() {
  const w = state.winter;
  if (!w.card || w.card.type !== 'plus') return false;
  const total = sumArray(state.leftBag) + sumArray(state.rightBag);
  const target = getWinterTarget();
  if (total >= target) return false; // Überschuss lässt sich durch Entbündeln lösen
  return !planFrom(target, rickBlockNow(), state.leftBag, state.rightBag, WINTER_MAX_TAKES - w.takes);
}

function winterUnpack(side, index) {
  const w = state.winter;
  if (!w.card) {
    setSpeech('👆 Wähle zuerst oben eine Karte!', 'error');
    return;
  }
  if (side === 'left' && state.rightBag.length > 0) {
    wobbleBag('bagLeft');
    setSpeech('⚠️ Spiegelregel: Zuerst die rechte Tasche leer räumen!', 'error');
    return;
  }
  const bag = side === 'left' ? state.leftBag : state.rightBag;
  const val = bag[index];
  if (val === undefined) return;
  const total = sumArray(state.leftBag) + sumArray(state.rightBag);
  const target = getWinterTarget();

  if (w.card.type === 'plus') {
    // Nur Überschuss darf zurück auf den Markt
    if (total - val < target) {
      wobbleBag(side === 'left' ? 'bagLeft' : 'bagRight');
      setSpeech(total > target
        ? `🔄 Zu groß! Du hast ${total - target} zu viel – entbündle das Stück erst.`
        : '🧺 Bei Plus wird eingekauft. Hol Fracht vom Markt!', 'error');
      return;
    }
    bag.splice(index, 1);
    fx('unpack');
  } else {
    const need = w.card.val - sumArray(w.unloaded);
    if (val > need) {
      wobbleBag(side === 'left' ? 'bagLeft' : 'bagRight');
      setSpeech(`🔄 Der ${val}er ist zu groß – es fehlen nur noch ${need}. Entbündle ihn zuerst!`, 'error');
      return;
    }
    bag.splice(index, 1);
    w.unloaded.push(val);
    fx('unpack');
  }

  if (checkWinterCompletion()) return;
  render();
}

function checkWinterCompletion() {
  const w = state.winter;
  if (!w.card) return false;
  const total = sumArray(state.leftBag) + sumArray(state.rightBag);
  if (w.card.type === 'plus' && total === getWinterTarget()) {
    finishWinterPlus();
    return true;
  }
  if (w.card.type === 'minus' && sumArray(w.unloaded) === w.card.val) {
    finishWinterMinus();
    return true;
  }
  return false;
}

// Karte aus der Auslage nehmen, Zug zählen
function consumeWinterCard(cave) {
  cave.cards[state.winter.cardIdx] = null; // Platz wird frei, die anderen Karten bleiben liegen
  cave.turns += 1;
  if (tutorial.active) {
    tutorial.winterTurns += 1;
    cave.cards = tutorial.cardQueue.length > 0 ? [tutorial.cardQueue.shift()] : [];
  }
}

async function finishWinterPlus() {
  const cave = getActiveCave();
  const card = state.winter.card;
  const outsmartedRick = isRickRelevant(card.val, rickBlockNow());
  consumeWinterCard(cave);
  advanceRick(); // Die angekündigte Sperre gilt ab dem nächsten Einkauf

  let lootHTML = '';
  if (outsmartedRick) {
    // Streich vereitelt: Der Fuchs lässt seine Beute fallen
    cave.loot.push({ icon: config.license.loot, name: config.license.lootName, sparkle: state.unbundledThisOrder });
    cave.foxUsed = true;
    lootHTML = ` 🦊💨 ➔ <span class="loot-item ${state.unbundledThisOrder ? 'loot-sparkle' : ''}">${config.license.loot}</span>`;
  }
  if (!tutorial.active && activeProfile) {
    const st = getModeStats(activeProfile, 'cave');
    st.totalCargoSent += card.val;
    if (outsmartedRick) st.foxOutsmarted += 1;
  }

  const total = sumArray(state.leftBag) + sumArray(state.rightBag);
  state.winter = createWinterTurnState();

  if (total !== getBagCapacity()) {
    fx('plus', 'happy');
    if (outsmartedRick) setTimeout(() => fx('fox', 'sly'), 500);
  }

  if (total === getBagCapacity()) {
    syncRickToCave(cave); // die neue Ankündigung folgt nach dem Feiern in winterResume()
    await triggerKnackevoll(cave, lootHTML);
    return;
  }

  cave.bags = { left: [...state.leftBag], right: [...state.rightBag] };
  refreshWinterCards(cave);
  planRickNext(...rickWinterFilters(cave));
  syncRickToCave(cave);
  await saveCave();
  if (!tutorial.active && activeProfile) await dbSaveProfile(activeProfile);
  launchConfetti(outsmartedRick ? 40 : 15);
  showToast(`✔ +${card.val} ${config.license.icon}${lootHTML}`);
  setSpeech(`✅ +${card.val} eingekauft! ${rickAnnouncement() || 'Wähle die nächste Karte.'}`, 'success');
  render();
}

async function finishWinterMinus() {
  const cave = getActiveCave();
  const card = state.winter.card;
  const unloaded = [...state.winter.unloaded];
  consumeWinterCard(cave);
  cave.bags = { left: [...state.leftBag], right: [...state.rightBag] };
  cave.pending = [...cave.pending, ...unloaded];
  state.winter = createWinterTurnState();
  fx('minus', 'happy');
  await saveCave();
  showToast(`✔ −${card.val} ${config.license.icon} ➔ 🏠`);
  render();
  openStorageModal();
}

// Tier randvoll: alles auf einen Schlag in die Höhle + Bonuspunkt
async function triggerKnackevoll(cave, lootHTML = '') {
  const allPieces = [...state.leftBag, ...state.rightBag];
  cave.pending = [...cave.pending, ...allPieces];
  cave.bags = { left: [], right: [] };
  cave.knackevoll += 1;
  state.leftBag = [];
  state.rightBag = [];
  if (!tutorial.active && activeProfile) {
    getModeStats(activeProfile, 'cave').knackevoll += 1;
    await dbSaveProfile(activeProfile);
  }
  await saveCave();
  launchConfetti(90);
  fx('knackevoll', 'cheer');
  setTimeout(() => fx('voice', 'cheer'), 1500);
  if (lootHTML) setTimeout(() => fx('fox', 'sly'), 2400);

  const chips = allPieces.map(v => `<span class="mini-cargo-chip chip-${v}">${v} ${config.license.icon}</span>`).join('');
  document.getElementById('celebrationDialog').innerHTML = `
    <div class="celebration-trophy">💥${config.animal.icon}💥</div>
    <div class="celebration-big-number knackevoll-title">KNACKEVOLL!</div>
    <div class="delivered-pieces-row">${chips}</div>
    <div class="result-badges">
      <div class="result-badge result-pro" title="KNACKEVOLL!-Bonus">⭐ +1</div>
      ${lootHTML ? `<div class="result-badge result-fox">${lootHTML}</div>` : ''}
    </div>
    <div style="margin-top:18px;">
      <button class="btn btn-oasis celebration-next-btn" onclick="acknowledgeCelebration()">🏠 ▶</button>
    </div>
  `;
  document.getElementById('celebrationModal').classList.remove('hidden');
  setSpeech(`💥 KNACKEVOLL! ${config.animal.article} bringt alles auf einmal in die Höhle!`, 'success');
  render();
}

// Bündeln: aus kleinen Stücken wieder größere machen (nur im Wintervorrat)
function bundleCargo(side, kind) {
  const bag = side === 'left' ? state.leftBag : state.rightBag;
  const from = kind === 5 ? 1 : 5;
  const need = kind === 5 ? 5 : 2;
  const positions = [];
  bag.forEach((v, i) => { if (v === from) positions.push(i); });
  if (positions.length < need) return;
  const use = positions.slice(0, need);
  const insertAt = use[0];
  for (let i = use.length - 1; i >= 0; i--) bag.splice(use[i], 1);
  bag.splice(insertAt, 0, kind);
  fx('bundle', 'happy');
  setSpeech(`🔗 Gebündelt: ${need}× ${from}er ➔ 1× ${kind}er!`, '');
  saveBagsIfIdle();
  render();
}

// Außerhalb eines Zuges (z. B. Bündeln/Entbündeln zum Aufräumen) sofort speichern
function saveBagsIfIdle() {
  if (!isCaveMode() || state.winter.card) return;
  const cave = getActiveCave();
  cave.bags = { left: [...state.leftBag], right: [...state.rightBag] };
  saveCave();
}

function flashTakeLimit() {
  const el = document.getElementById('winterTakes');
  if (!el) return;
  el.classList.remove('wobble-error');
  void el.offsetWidth;
  el.classList.add('wobble-error');
}

function showToast(html) {
  const el = document.getElementById('gameToast');
  el.innerHTML = html;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

/* ---------- Darstellung ---------- */

function renderWinterCardHTML(card, idx, active = false) {
  const isPlus = card.type === 'plus';
  const rickBlock = isPlus && isRickRelevant(card.val, rickBlockNow()) ? rickBlockNow() : null;
  const fox = rickBlock
    ? `<div class="fox-card-badge" title="${RICK_NAME} blockiert das ${rickBlock}er-Depot">🦊 🚫 ${rickBlock}er</div>`
    : '';
  return `
    <div class="winter-card ${isPlus ? 'card-plus' : 'card-minus'} ${active ? 'card-active' : ''}"
         ${active ? '' : `onclick="pickWinterCard(${idx})"`}
         title="${isPlus ? `Einkaufen: ${card.val} vom Markt holen (max. ${WINTER_MAX_TAKES} Stücke)` : `Abladen: ${card.val} in die Höhle bringen`}">
      <div class="winter-card-icon">${isPlus ? '🧺' : '🏠'}</div>
      <div class="winter-card-num">${isPlus ? '+' : '−'}${card.val}</div>
      <div class="winter-card-sub">${isPlus ? '✋'.repeat(WINTER_MAX_TAKES) : `${config.license.icon} ➔ 🏠`}</div>
      ${fox}
    </div>
  `;
}

// Kleine, nicht antippbare Ansicht einer liegengebliebenen Karte (während ein Zug läuft)
function renderWinterMiniCardHTML(card) {
  const isPlus = card.type === 'plus';
  const rickHere = isPlus && isRickRelevant(card.val, rickBlockNow());
  return `<span class="winter-mini ${isPlus ? 'card-plus' : 'card-minus'}"
                title="${isPlus ? 'Einkaufen' : 'Abladen'} ${card.val}${rickHere ? ` – ${RICK_NAME} blockiert das ${rickBlockNow()}er-Depot` : ''}">
            ${isPlus ? '🧺' : '🏠'}${isPlus ? '+' : '−'}${card.val}${rickHere ? '🦊' : ''}
          </span>`;
}

function renderWinterPanel() {
  const cave = ensureWinterCave(getActiveCave());
  const slot = document.getElementById('activeOrderSlot');
  const lockLabel = document.getElementById('orderLockLabel');
  document.getElementById('orderPanelTitle').textContent = `${getSeason(cave).icon} Vorräte für den Winter`;
  const w = state.winter;

  if (!w.card) {
    slot.className = 'order-slot-box winter-slot';
    lockLabel.textContent = '👆';
    slot.innerHTML = cave.cards.some(Boolean)
      ? `<div class="winter-card-row">${cave.cards.map((c, i) => c
          ? renderWinterCardHTML(c, i)
          : '<div class="winter-card card-empty"></div>').join('')}</div>`
      : `<div style="font-size:2rem;">🏠</div>`;
    return;
  }

  slot.className = 'order-slot-box winter-slot locked-order';
  lockLabel.textContent = '';
  let status = '';
  if (w.card.type === 'plus') {
    const hands = Array.from({ length: WINTER_MAX_TAKES }, (_, i) =>
      `<span class="take-hand ${i < w.takes ? 'used' : ''}">✋</span>`).join('');
    const total = sumArray(state.leftBag) + sumArray(state.rightBag);
    const target = getWinterTarget();
    status = `
      <div class="winter-takes" id="winterTakes" title="Höchstens ${WINTER_MAX_TAKES} Stücke vom Markt">${hands}</div>
      ${total > target ? `<span class="overload-warning-pill">🔄 ${total - target} zu viel</span>` : ''}
    `;
  } else {
    const chips = w.unloaded.map(v => `<span class="mini-cargo-chip chip-${v}">${v}</span>`).join('');
    const rest = w.card.val - sumArray(w.unloaded);
    status = `
      <div class="winter-unload-tray" title="Abgeladen">${chips || '<span style="opacity:0.5;">📦</span>'}</div>
      <span class="pro-counter-pill">🏠 noch ${rest}</span>
    `;
  }
  // Die anderen Karten bleiben sichtbar (zum Vorausplanen), aber ohne Funktion, solange ein Zug läuft
  const waiting = cave.cards.filter((c, i) => c && i !== w.cardIdx);
  const preview = waiting.length
    ? `<div class="winter-preview" title="Diese Karten bleiben liegen">${waiting.map(renderWinterMiniCardHTML).join('')}</div>`
    : '';

  slot.innerHTML = `
    <div class="winter-active-row">
      ${renderWinterCardHTML(w.card, w.cardIdx, true)}
      <div class="winter-status">${status}</div>
      <button class="btn winter-cancel-btn ${isWinterStuck() ? 'pulse-hint' : ''}" onclick="cancelWinterTurn()" title="Zug abbrechen – alles wie vorher">↩</button>
      ${preview}
    </div>
  `;
}

function renderSeasonTrack(cave) {
  const ratio = getCaveUsedCells(cave) / getCaveCapacity();
  const current = getSeason(cave);
  return `
    <div class="season-track" title="Füllstand der Höhle: ${Math.round(ratio * 100)} %">
      <div class="season-fill" style="width:${ratio * 100}%;"></div>
      ${SEASONS.map(s => `<span class="season-mark ${s.id === current.id ? 'current' : ''}">${s.icon}</span>`).join('')}
    </div>
  `;
}

/* ============================================================================
   GEFÜHRTE ÜBUNGSRUNDE (Tutorial)
   Eine Zeige-Hand führt durch zwei kleine Aufträge (Endlos-Karawane) bzw. durch
   eine Plus- und eine Minus-Karte mit Einlagern (Wintervorrat). Klicks außerhalb des gezeigten Ziels werden ignoriert,
   damit das Kind nur durch Nachmachen lernt – ganz ohne Lesen.
   ============================================================================ */
const tutorial = {
  active: false,
  steps: [],
  stepIdx: 0,
  queue: [],        // noch folgende Übungsaufträge
  deliveries: 0,
  cardQueue: [],    // noch folgende Übungskarten (Wintervorrat)
  winterTurns: 0,
  cave: null,       // Übungs-Höhle (wird nicht gespeichert)
  timer: null,
  lastTarget: null
};

function isTutorialDone(profile = activeProfile) {
  if (!profile) return false;
  // Wer schon Tiere gepackt hat, kennt das Spiel bereits
  return Boolean(profile.tutorialDone) || Boolean(profile.stats && getModeStats(profile, 'endless').packedAnimals > 0);
}

// Startet eine Runde – beim allerersten Mal als geführte Übung
function startRound() {
  if (!isTutorialDone()) startTutorial();
  else resetGame();
}

function getTutorialOrders() {
  // Runde 1: 7 = 5 + 1 + 1 (Bündeln statt Zählen)
  // Runde 2: Stufe 2 → 16 = 10 + 5 + 1 (Erst links, dann rechts) · Stufe 1 → 10 (eine Kiste füllt die Tasche)
  return config.level === 1
    ? [{ val: 7, plan: [5, 1, 1] }, { val: 10, plan: [10] }]
    : [{ val: 7, plan: [5, 1, 1] }, { val: 16, plan: [10, 5, 1] }];
}

function isVisible(el) {
  return Boolean(el) && el.getClientRects().length > 0;
}

function isHidden(id) {
  return document.getElementById(id).classList.contains('hidden');
}

function buildTutorialSteps(orders) {
  const steps = [];
  const loadedCount = () => state.leftBag.length + state.rightBag.length;

  orders.forEach((order, idx) => {
    const round = idx + 1;
    steps.push({
      allow: '.OrderCardPopup',
      target: () => document.querySelector('#popupOrdersList .OrderCardPopup'),
      done: () => state.activeOrder !== null || tutorial.deliveries >= round
    });
    order.plan.forEach((val, k) => {
      steps.push({
        allow: `#depot${val}`,
        target: () => document.getElementById(`depot${val}`),
        done: () => tutorial.deliveries >= round || loadedCount() >= k + 1
      });
    });
    steps.push({
      allow: '#celebrationDialog .btn-oasis',
      target: () => document.querySelector('#celebrationDialog .btn-oasis'),
      done: () => tutorial.deliveries >= round && isHidden('celebrationModal')
    });
  });

  return steps;
}

// Wintervorrat-Übung: +6 einkaufen (5 + 1), dann −2 abladen (1 weg, 5er entbündeln, 1 weg), dann einlagern
function buildWinterTutorialSteps() {
  const turns = () => tutorial.winterTurns;
  const firstOne = () => document.querySelector('#leftBagPieces .block-1');
  const steps = [
    { allow: '#activeOrderSlot .winter-card', target: () => document.querySelector('#activeOrderSlot .winter-card'),
      done: () => state.winter.card !== null || turns() >= 1 },
    { allow: '#depot5', target: () => document.getElementById('depot5'),
      done: () => state.winter.takes >= 1 || turns() >= 1 },
    { allow: '#depot1', target: () => document.getElementById('depot1'),
      done: () => turns() >= 1 },
    { allow: '#activeOrderSlot .winter-card', target: () => document.querySelector('#activeOrderSlot .winter-card'),
      done: () => (turns() >= 1 && state.winter.card !== null) || turns() >= 2 },
    { allow: '#leftBagPieces .block-1', target: firstOne,
      done: () => state.winter.unloaded.length >= 1 || turns() >= 2 },
    { allow: '#swapBtnLeft5', target: () => document.getElementById('swapBtnLeft5'),
      done: () => state.unbundledThisOrder || turns() >= 2 },
    { allow: '#leftBagPieces .block-1', target: firstOne,
      done: () => turns() >= 2 }
  ];
  [0, 1].forEach(k => steps.push({
    allow: '#storageCaveFrame .cave-cell',
    target: () => getTutorialStorageCell(),
    done: () => tutorial.cave.pieces.length >= k + 1
  }));
  steps.push({
    allow: '#storageDoneBtn',
    target: () => document.getElementById('storageDoneBtn'),
    done: () => isHidden('storageModal')
  });
  return steps;
}

// Schlägt die erste freie Stelle (von oben links) vor, an der das gewählte Teil quer passt
function getTutorialStorageCell() {
  const cave = tutorial.cave;
  if (!cave || cave.pending.length === 0) return null;
  const size = cave.pending[storageUI.selectedIdx] || cave.pending[0];
  const grid = buildCaveGrid(cave);
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (canPlacePiece(grid, size, r, c, false)) {
        return document.querySelector(`#storageCaveFrame .cave-cell[data-r="${r}"][data-c="${c}"]`);
      }
    }
  }
  return null;
}

function startTutorial() {
  gameRunning = true;
  ['setupModal', 'profileModal', 'orderModal', 'celebrationModal', 'storageModal', 'caveCompleteModal', 'tutorialEndModal']
    .forEach(id => document.getElementById(id).classList.add('hidden'));

  const orders = getTutorialOrders();
  tutorial.active = true;
  tutorial.deliveries = 0;
  tutorial.winterTurns = 0;
  tutorial.stepIdx = 0;
  tutorial.cave = createEmptyCave();
  tutorial.queue = orders.slice(1).map(o => ({ val: o.val }));
  tutorial.cardQueue = [{ type: 'minus', val: 2 }];
  tutorial.steps = isCaveMode() ? buildWinterTutorialSteps() : buildTutorialSteps(orders);

  state.activeOrder = null;
  state.activeFoxBlock = null;
  state.activeOrderIdx = null;
  state.leftBag = [];
  state.rightBag = [];
  state.winter = createWinterTurnState();
  state.availableOrders = [{ val: orders[0].val }];
  tutorial.cave.cards = [{ type: 'plus', val: 6 }];
  storageUI.vertical = false;

  document.getElementById('tutorialBar').classList.remove('hidden');
  document.body.classList.add('tutorial-running');
  setSpeech('🎓 👆', '');
  render();
  if (!isCaveMode()) openOrderModal();

  clearInterval(tutorial.timer);
  tutorial.timer = setInterval(tutorialTick, 120);
  tutorialTick();
}

// Wird nach jeder Übungslieferung aufgerufen: nächster Übungsauftrag oder keiner mehr
function nextTutorialOrders() {
  state.availableOrders = tutorial.queue.length > 0 ? [tutorial.queue.shift()] : [];
}

function tutorialTick() {
  if (!tutorial.active) return;

  let step = tutorial.steps[tutorial.stepIdx];
  if (step && step.done()) {
    tutorial.stepIdx++;
    step = tutorial.steps[tutorial.stepIdx];
  }

  renderTutorialProgress();

  const hand = document.getElementById('tutorialHand');
  const target = step ? step.target() : null;

  document.querySelectorAll('.tutorial-target').forEach(el => {
    if (el !== target) el.classList.remove('tutorial-target');
  });

  if (!isVisible(target)) {
    hand.classList.add('hidden');
    return;
  }

  target.classList.add('tutorial-target');
  if (target !== tutorial.lastTarget) {
    tutorial.lastTarget = target;
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  const rect = target.getBoundingClientRect();
  hand.style.left = `${rect.left + rect.width / 2}px`;
  hand.style.top = `${rect.top + Math.min(rect.height / 2, 40)}px`;
  hand.classList.remove('hidden');
}

function renderTutorialProgress() {
  const dots = tutorial.steps.map((_, i) =>
    `<span class="tutorial-dot ${i < tutorial.stepIdx ? 'done' : (i === tutorial.stepIdx ? 'current' : '')}"></span>`
  ).join('');
  document.getElementById('tutorialDots').innerHTML = dots;
}

function nudgeTutorialHand() {
  const hand = document.getElementById('tutorialHand');
  hand.classList.remove('nudge');
  void hand.offsetWidth;
  hand.classList.add('nudge');
}

// Klicks außerhalb des gezeigten Ziels abfangen (Capture-Phase, vor den onclick-Handlern)
document.addEventListener('click', (event) => {
  if (!tutorial.active) return;
  if (event.target.closest('#tutorialBar')) return;
  const step = tutorial.steps[tutorial.stepIdx];
  if (step && event.target.closest(step.allow)) return;
  event.stopPropagation();
  event.preventDefault();
  nudgeTutorialHand();
}, true);

function stopTutorial() {
  tutorial.active = false;
  clearInterval(tutorial.timer);
  tutorial.timer = null;
  tutorial.lastTarget = null;
  tutorial.cave = null;
  document.getElementById('tutorialHand').classList.add('hidden');
  document.getElementById('tutorialBar').classList.add('hidden');
  document.body.classList.remove('tutorial-running');
  document.querySelectorAll('.tutorial-target').forEach(el => el.classList.remove('tutorial-target'));
}

async function markTutorialDone() {
  if (!activeProfile) return;
  activeProfile.tutorialDone = true;
  await dbSaveProfile(activeProfile);
}

// Übung regulär geschafft → kurzer Abschluss mit großem „Los geht's“
function finishTutorial() {
  stopTutorial();
  markTutorialDone();
  launchConfetti(70);
  fx('deliverPro', 'cheer');
  setTimeout(() => fx('voice', 'cheer'), 900);
  document.getElementById('tutorialEndAnimal').textContent = config.animal.icon;
  document.getElementById('tutorialEndModal').classList.remove('hidden');
}

function closeTutorialEnd() {
  document.getElementById('tutorialEndModal').classList.add('hidden');
  if (storyContinueAfterTutorial()) return;
  resetGame();
}

// Für Erwachsene: Übung abbrechen
function skipTutorial() {
  ['orderModal', 'celebrationModal', 'storageModal'].forEach(id => document.getElementById(id).classList.add('hidden'));
  state.winter = createWinterTurnState();
  stopTutorial();
  markTutorialDone();
  if (storyContinueAfterTutorial()) return;
  resetGame();
}

function startTutorialFromSetup() {
  saveActiveProfilePreferences();
  startTutorial();
}

// Initialisierung beim Laden
initPlayerManagement().then(() => {
  renderProfileModal();
  renderSetupModal();
  render();
});

// Service Worker für Offline-Fähigkeit (PWA) registrieren
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service Worker Registrierung fehlgeschlagen:', err);
    });
  });
}