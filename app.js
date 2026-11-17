const ANIMALS = [
  { id: 'unicorn', name: 'Einhorn', article: 'das Einhorn', icon: '🦄' },
  { id: 'raptor', name: 'Raptor', article: 'der Raptor', icon: '🦖' },
  { id: 'bear', name: 'Bär', article: 'der Bär', icon: '🐻' },
  { id: 'cat', name: 'Katze', article: 'die Katze', icon: '🐱' },
  { id: 'camel', name: 'Kamel', article: 'das Kamel', icon: '🐪' }
];

const LICENSES = [
  { id: 'fairy', name: 'Feenstaub', title: 'Königliche Feenstaub-Lizenz', icon: '✨' },
  { id: 'dino', name: 'Dino-Knochen', title: 'Große Dino-Knochen-Lizenz', icon: '🍖' },
  { id: 'honey', name: 'Meister-Honig', title: 'Meister-Honig-Lizenz', icon: '🍯' },
  { id: 'fish', name: 'Edel-Stinkefisch', title: 'Edel-Stinkefisch-Lizenz', icon: '🐟' }
];

let config = {
  animal: ANIMALS[1],
  license: LICENSES[0],
  level: 2,
  foxMode: false,        // Modul 2: Der schlaue Wüstenfuchs (im Setup zuschaltbar)
  gameMode: 'endless'    // 'endless' = Endlos-Karawane, 'cave' = Höhle füllen (Modul 3)
};

let state = {
  activeOrder: null,     // Zielzahl (z. B. 14)
  activeFoxBlock: null,  // Welches Depot blockiert der Fuchs aktuell? (null, 10, 5 oder 1)
  activeOrderIdx: null,
  availableOrders: [],   // Array aus { val, foxBlock }
  leftBag: [],           // Array aus Zahlenwerten: [10, 5, 1, ...]
  rightBag: []
};

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

async function initPlayerManagement() {
  try {
    profiles = await dbGetAllProfiles();
    if (profiles.length === 0) {
      const defaultProfile = {
        id: 'player_' + Date.now(),
        name: 'Karawanen-Kind',
        animalId: 'raptor',
        licenseId: 'fairy',
        level: 2,
        foxMode: false,
        stats: {
          totalCargoSent: 0,
          packedAnimals: 0,
          proPackers: 0
        },
        createdAt: Date.now()
      };
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
  config.level = target.level || 2;
  config.foxMode = Boolean(target.foxMode);
  config.gameMode = target.gameMode === 'cave' ? 'cave' : 'endless';

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
    stats: {
      totalCargoSent: 0,
      packedAnimals: 0,
      proPackers: 0,
      foxOutsmarted: 0
    },
    createdAt: Date.now()
  };

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
  if (!activeProfile) return;
  activeProfile.animalId = config.animal.id;
  activeProfile.licenseId = config.license.id;
  activeProfile.level = config.level;
  activeProfile.foxMode = config.foxMode;
  activeProfile.gameMode = config.gameMode;
  await dbSaveProfile(activeProfile);
}

async function recordDeliveryStats(deliveredAmount, isProPacker, wasFoxOutsmarted) {
  if (!activeProfile) return;
  if (!activeProfile.stats) {
    activeProfile.stats = { totalCargoSent: 0, packedAnimals: 0, proPackers: 0, foxOutsmarted: 0 };
  }
  // Abwärtskompatibilität für bestehende Profile
  if (typeof activeProfile.stats.totalCargoSent !== 'number') activeProfile.stats.totalCargoSent = 0;
  if (typeof activeProfile.stats.foxOutsmarted !== 'number') activeProfile.stats.foxOutsmarted = 0;

  activeProfile.stats.totalCargoSent += deliveredAmount;
  activeProfile.stats.packedAnimals += 1;
  if (isProPacker) {
    activeProfile.stats.proPackers += 1;
  }
  if (wasFoxOutsmarted) {
    activeProfile.stats.foxOutsmarted += 1;
  }
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

/* Wählt für einen Auftragswert ein spannendes, garantiert lösbares Fuchs-Hindernis */
function pickFoxBlockForValue(val) {
  const candidates = [];
  // 10er-Blockade ist spannend, wenn die Zahl >= 10 ist (man muss auf 5er ausweichen)
  if (val >= 10) candidates.push(10);
  // 5er-Blockade fordert Entbündeln einer 10er-Kiste, wenn eine 5er-Einheit gebraucht wird oder val >= 5
  if (val >= 5) candidates.push(5);
  // 1er-Blockade fordert das Aufschnüren eines 5er-Sacks, wenn Einerstellen (nicht durch 5 teilbar) gebraucht werden
  if (val % 5 !== 0) candidates.push(1);

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/* Top-Down SVG Illustrationen der 5 Packtiere */
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

  const statsEl = document.getElementById('activeProfileStatsBanner');
    if (statsEl && activeProfile) {
      const st = activeProfile.stats || { totalCargoSent: 0, packedAnimals: 0, proPackers: 0, foxOutsmarted: 0 };
      const cargoTotal = st.totalCargoSent || 0;
      const foxTotal = st.foxOutsmarted || 0;
      const rate = st.packedAnimals > 0 ? Math.round((st.proPackers / st.packedAnimals) * 100) : 0;
      statsEl.innerHTML = `
        <div class="p-stat-item">
          <span class="p-stat-icon">📦</span>
          <div class="p-stat-text">
            <small>Verschickte Fracht</small>
            <strong>${cargoTotal} Einh.</strong>
          </div>
        </div>
        <div class="p-stat-item">
          <span class="p-stat-icon">🐪</span>
          <div class="p-stat-text">
            <small>Gepackte Tiere</small>
            <strong>${st.packedAnimals}</strong>
          </div>
        </div>
        <div class="p-stat-item">
          <span class="p-stat-icon">🏅</span>
          <div class="p-stat-text">
            <small>Profi-Packer</small>
            <strong>${st.proPackers} <span style="font-size:0.8rem; font-weight:700; color:#15803d;">(${rate}%)</span></strong>
          </div>
        </div>
        <div class="p-stat-item">
          <span class="p-stat-icon">🦊</span>
          <div class="p-stat-text">
            <small>Schlauer als Fuchs</small>
            <strong>${foxTotal}×</strong>
          </div>
        </div>
        <div class="p-stat-item">
          <span class="p-stat-icon">🏠</span>
          <div class="p-stat-text">
            <small>Höhlen gefüllt</small>
            <strong>${st.cavesFilled || 0}</strong>
          </div>
        </div>
      `;
    }
}

function renderSetupModal() {
  const nameEl = document.getElementById('setupActivePlayerName');
  if (nameEl) nameEl.textContent = activeProfile ? activeProfile.name : 'Gast';

  // 1. Packtiere
  document.getElementById('setupAnimals').innerHTML = ANIMALS.map(a => `
    <div class="tile-option ${a.id === config.animal.id ? 'active-tile' : ''}" onclick="chooseAnimal('${a.id}')">
      <div style="font-size:2.1rem;">${a.icon}</div>
      <strong>${a.name}</strong>
    </div>
  `).join('');

  // 2. Lizenzen
  document.getElementById('setupLicenses').innerHTML = LICENSES.map(l => `
    <div class="tile-option ${l.id === config.license.id ? 'active-tile' : ''}" onclick="chooseLicense('${l.id}')">
      <div style="font-size:2.1rem;">${l.icon}</div>
      <strong>${l.name}</strong>
    </div>
  `).join('');

  // 3. Zahlenraum
  document.getElementById('lvlTile1').classList.toggle('active-tile', config.level === 1);
  document.getElementById('lvlTile2').classList.toggle('active-tile', config.level === 2);

  // 4. Wüstenfuchs-Erweiterung (Modul 2)
  const foxOff = document.getElementById('foxOffTile');
  const foxOn = document.getElementById('foxOnTile');
  if (foxOff && foxOn) {
    foxOff.classList.toggle('active-tile', !config.foxMode);
    foxOn.classList.toggle('active-tile', config.foxMode);
  }

  // 5. Spielmodus
  const modeEndless = document.getElementById('modeEndlessTile');
  const modeCave = document.getElementById('modeCaveTile');
  if (modeEndless && modeCave) {
    modeEndless.classList.toggle('active-tile', config.gameMode !== 'cave');
    modeCave.classList.toggle('active-tile', config.gameMode === 'cave');
    const dims = getCaveDims();
    document.getElementById('modeCaveSub').textContent =
      `Fülle die ${getCaveTheme().name} (${dims.rows}×${dims.cols} Felder)`;
  }

  const playerName = activeProfile ? activeProfile.name : 'Karawanen-Kind';
  document.getElementById('setupMottoBox').textContent =
    `${playerName}: „Ich bin ${config.animal.article} und fahre heute eine offizielle ${config.license.name}-Lieferung!“`;
}

function chooseAnimal(id) {
  config.animal = ANIMALS.find(a => a.id === id);
  saveActiveProfilePreferences();
  renderSetupModal();
}

function chooseLicense(id) {
  config.license = LICENSES.find(l => l.id === id);
  saveActiveProfilePreferences();
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

function setGameMode(mode) {
  config.gameMode = mode === 'cave' ? 'cave' : 'endless';
  saveActiveProfilePreferences();
  renderSetupModal();
}

function openSetupModal() {
  renderSetupModal();
  document.getElementById('setupModal').classList.remove('hidden');
}

let profileIdOnModalOpen = null;

function openProfileModal() {
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
    const foxBlock = orderObj.foxBlock;
    const opt = getOptimalPacking(num, foxBlock);

    const foxBadgeHTML = foxBlock
      ? `<div class="fox-card-badge" title="Der Wüstenfuchs blockiert das ${foxBlock}er-Depot">🦊 🚫 ${foxBlock}er</div>`
      : `<div style="margin-top:6px; font-size:1.1rem;" title="Freier Markt">🌿</div>`;

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

function createOrderEntry(val, forceFox = false) {
  let foxBlock = null;
  if (config.foxMode && forceFox) {
    foxBlock = pickFoxBlockForValue(val);
  }
  return { val, foxBlock };
}

// Wertebereich für Aufträge. Im Höhlen-Modus nie mehr, als noch in die Höhle passt.
function getOrderRange() {
  let maxVal = config.level === 1 ? 9 : 19; // Bis 9 bzw. 19, damit beim Entbündeln immer Platz in der Tasche ist
  let minVal = config.level === 1 ? 2 : 6;
  if (isCaveMode()) {
    maxVal = Math.min(maxVal, getCaveFreeForOrders());
    minVal = Math.min(minVal, maxVal);
  }
  return { minVal, maxVal };
}

function generateOrders() {
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
  // Wenn der Wüstenfuchs-Modus aktiv ist, bekommen die ersten 2 Karten einen Wüstenfuchs
  return values.map((val, idx) => createOrderEntry(val, config.foxMode && idx < 2));
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
  // Im Fuchs-Modus haben ~70% der nachrückenden Karten ein Fuchs-Symbol
  const hasFox = config.foxMode && Math.random() < 0.7;
  return createOrderEntry(candidate, hasFox);
}

function resetGame() {
  state.activeOrder = null;
  state.activeFoxBlock = null;
  state.activeOrderIdx = null;
  state.availableOrders = generateOrders();
  state.leftBag = [];
  state.rightBag = [];
  document.getElementById('celebrationModal').classList.add('hidden');
  setSpeech('Wähle deinen nächsten Auftrag für die Karawane aus!', '');
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
  state.activeFoxBlock = chosen.foxBlock;

  const opt = getOptimalPacking(state.activeOrder, state.activeFoxBlock);
  closeOrderModal();

  if (state.activeFoxBlock) {
    let tip = '';
    if (state.activeFoxBlock === 5) {
      tip = 'Tipp: Lade eine 10er-Kiste ein, schnüre sie in zwei 5er auf und packe einen 5er wieder aus!';
    } else if (state.activeFoxBlock === 1) {
      tip = 'Tipp: Lade einen 5er-Sack ein, schnüre ihn in fünf 1er auf und packe die überzähligen 1er wieder aus!';
    } else {
      tip = 'Tipp: Nutze zwei 5er-Säcke, um die linke 10er-Tasche vollzumachen!';
    }
    setSpeech(`🦊 Oh! Der Wüstenfuchs schläft auf den ${state.activeFoxBlock}er-Kisten! ${tip}`, '');
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
  if (state.activeOrder === null) {
    setSpeech('Bitte wähle zuerst oben einen Auftrag aus, bevor du Fracht einlädst!', 'error');
    return;
  }

  // Prüfen, ob der Wüstenfuchs auf diesem Markt-Depot schläft
  if (state.activeFoxBlock === val) {
    const foxHint = val === 1
      ? 'Hol dir stattdessen einen 5er-Sack und schnüre ihn an der Satteltasche in fünf 1er auf!'
      : (val === 5
          ? 'Hol dir stattdessen eine 10er-Kiste und teile sie an der Satteltasche in zwei 5er!'
          : 'Nimm stattdessen zwei 5er-Säcke für die linke Tasche!');
    setSpeech(`🦊💤 Pssst! Der Wüstenfuchs schläft auf den ${val}er-Kisten! ${foxHint}`, 'error');
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
  if (side === 'left' && state.rightBag.length > 0) {
    wobbleBag('bagLeft');
    setSpeech('⚠️ Spiegelregel beim Auspacken: Räume zuerst die rechte Überlauf-Tasche leer, bevor du links auspackst!', 'error');
    return;
  }

  const bag = side === 'left' ? state.leftBag : state.rightBag;
  if (index < 0 || index >= bag.length) return;

  const removedVal = bag.splice(index, 1)[0];

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
  setSpeech('🔄 Clever entbündelt: Die blaue 10er-Kiste wurde in zwei gelbe 5er-Säcke geteilt! Du kannst einzelne Stücke per Klick auspacken.', '');
  render();
}

// Entbündeln 2: Gelben 5er-Sack in fünf rote 1er-Einheiten aufschnüren
function unbundleFive(side) {
  const bag = side === 'left' ? state.leftBag : state.rightBag;
  const idx = bag.lastIndexOf(5);
  if (idx === -1) return;

  bag.splice(idx, 1, 1, 1, 1, 1, 1);
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
  const foxWasActive = state.activeFoxBlock;
  const packedPieces = [...state.leftBag, ...state.rightBag];
  const usedPiecesCount = packedPieces.length;

  const opt = getOptimalPacking(deliveredOrder, foxWasActive);
  const isProPacker = usedPiecesCount <= opt.minPieces;

  if (!tutorial.active) {
    await recordDeliveryStats(deliveredOrder, isProPacker, Boolean(foxWasActive));
  } else {
    tutorial.deliveries += 1;
  }

  // Höhlen-Modus: Fracht wandert nicht zurück in den Markt, sondern wartet aufs Einlagern
  const caveMode = isCaveMode();
  const storeInCave = caveMode && (!tutorial.active || tutorial.queue.length === 0);
  if (storeInCave) {
    const cave = getActiveCave();
    cave.pending = [...cave.pending, ...packedPieces];
    cave.deliveries += 1;
    await saveCave();
  }
  launchConfetti(isProPacker ? 65 : 40);

  const chip = v => `<span class="mini-cargo-chip chip-${v}">${v} ${config.license.icon}</span>`;
  const userChipsHTML = packedPieces.map(chip).join('');
  const optChipsHTML = opt.pieces.map(chip).join('');

  // Ergebnis als Bild: Profi = Medaille, sonst Glühbirne + ideale Aufteilung
  const resultBadge = isProPacker
    ? `<div class="result-badge result-pro" title="Profi-Packer">🏅 ${'⭐'.repeat(Math.min(opt.minPieces, 5))}</div>`
    : `<div class="result-badge result-tip" title="So geht es mit weniger Stücken">💡 <span class="result-arrow">➔</span> ${optChipsHTML}</div>`;

  const foxBadge = foxWasActive
    ? `<div class="result-badge result-fox" title="Wüstenfuchs ausgetrickst">🦊 ✔</div>`
    : '';

  // Ausführliche Auswertung & Gesamtbilanz nur auf Nachfrage (für Eltern & Lehrkräfte)
  const pStats = (activeProfile && activeProfile.stats) || {};
  const playerStatLine = activeProfile
    ? `<p>👤 <strong>${activeProfile.name}s Gesamtbilanz:</strong> 📦 ${pStats.totalCargoSent || 0} Fracht · 🐪 ${pStats.packedAnimals || 0} Tiere · 🏅 ${pStats.proPackers || 0}× Profi · 🦊 ${pStats.foxOutsmarted || 0}× Fuchs ausgetrickst</p>`
    : '';

  const adultDetails = `
    <details class="adult-details text-detail">
      <summary>👩‍🏫 Für Erwachsene</summary>
      <p>${config.animal.icon} ${config.animal.article} hat genau <strong>${deliveredOrder}× ${config.license.name}</strong> geliefert.</p>
      <p>Benutzte Frachtstücke: <strong>${usedPiecesCount}</strong> · Profi-Packer-Ziel: <strong>${opt.minPieces}</strong>
        ${isProPacker ? ' – optimal gebündelt! 🏅' : ' – mit größeren Bündeln wäre es mit weniger Stücken gegangen.'}</p>
      ${foxWasActive ? `<p>🦊 Die ${foxWasActive}er-Sperre des Wüstenfuchses wurde durch Tauschen/Entbündeln umgangen.</p>` : ''}
      ${playerStatLine}
    </details>
  `;

  const nextLabel = storeInCave ? '🏠 ▶' : (tutorial.active ? '👍' : '📜 ▶');

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
  } else {
    state.availableOrders[state.activeOrderIdx] = generateReplacementOrder();
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

  const pStats = (activeProfile && activeProfile.stats)
    ? activeProfile.stats
    : { totalCargoSent: 0, packedAnimals: 0, proPackers: 0 };

  const hCargo = document.getElementById('headerCargoCount');
  const hAnimal = document.getElementById('headerAnimalCount');
  const hPro = document.getElementById('headerProCount');
  const hFox = document.getElementById('headerFoxCount');
  if (hCargo) hCargo.textContent = pStats.totalCargoSent || 0;
  if (hAnimal) hAnimal.textContent = pStats.packedAnimals || 0;
  if (hPro) hPro.textContent = pStats.proPackers || 0;
  if (hFox) hFox.textContent = pStats.foxOutsmarted || 0;

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
  if (state.activeOrder === null) {
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
      ? `<div class="fox-card-badge" style="margin-top:8px;">🦊 Wüstenfuchs blockiert ${state.activeFoxBlock}er-Depot!</div>`
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

  // Markt-Depots aktivieren/deaktivieren + Wüstenfuchs-Overlay rendern
  const canGrab = state.activeOrder !== null;
  [
    { id: 'depot10', val: 10 },
    { id: 'depot5', val: 5 },
    { id: 'depot1', val: 1 }
  ].forEach(d => {
    const el = document.getElementById(d.id);
    if (!el) return;
    el.classList.toggle('disabled', !canGrab);

    // Vorheriges Fuchs-Overlay entfernen
    const oldFox = el.querySelector('.fox-blocker-overlay');
    if (oldFox) oldFox.remove();

    const isFoxHere = state.activeOrder !== null && state.activeFoxBlock === d.val;
    el.classList.toggle('fox-blocked', isFoxHere);

    if (isFoxHere) {
      const overlay = document.createElement('div');
      overlay.className = 'fox-blocker-overlay';
      overlay.innerHTML = `
        <div class="fox-emoji">🦊💤</div>
        <strong>Vom Wüstenfuchs besetzt!</strong>
        <small>Tipp: Größeres Stück am Sattel entbündeln!</small>
      `;
      el.appendChild(overlay);
    }
  });

  // Satteltaschen & Top-Down Grid
  const maxCap = config.level === 1 ? 10 : 20;

  document.getElementById('totalLoadText').textContent =
    state.activeOrder !== null
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

  renderCavePanel();
}

/* ============================================================================
   MODUL 3: HÖHLE FÜLLEN (Stufe 1: 5×10-, Stufe 2: 10×10-Lager pro Tier)
   Gelieferte Fracht wandert nicht zurück in den Markt, sondern wird als
   Puzzleteil (10er = 1×10, 5er = 1×5, 1er = 1×1) in die Höhle gelegt.
   ============================================================================ */
const CAVE_THEMES = {
  unicorn: { name: 'Regenbogen-Schatzkammer', deco: ['☁️', '💎', '🌈'] },
  raptor:  { name: 'Urzeit-Vorratsnest',      deco: ['🌿', '🌋', '🦴'] },
  bear:    { name: 'Bärenhöhle',              deco: ['🪵', '🍂', '🍯'] },
  cat:     { name: 'Kratzbaum-Palast',        deco: ['🧶', '🛋️', '🐾'] },
  camel:   { name: 'Oasen-Warenhaus',         deco: ['🌴', '🏺', '⛺'] }
};

const fallbackCaves = {}; // Falls kein Profil geladen werden konnte

// Zustand der Einlager-Ansicht (nicht gespeichert)
const storageUI = { selectedIdx: 0, vertical: false, hover: null, justPlaced: null };

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
  return { pieces: [], pending: [], deliveries: 0, batch: 0, completed: false };
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

// Freier Platz für neue Aufträge (bereits gelieferte, noch nicht eingelagerte Fracht zählt mit)
function getCaveFreeForOrders() {
  const cave = getActiveCave();
  return getCaveCapacity() - getCaveUsedCells(cave) - sumArray(cave.pending);
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
function renderCaveHTML(cave, interactive = false) {
  const { rows, cols } = getCaveDims();
  const theme = getCaveTheme();
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
    return renderCavePieceHTML(
      p.size, p.r, p.c, p.vertical,
      `${removable ? 'removable' : ''} ${isNew ? 'piece-new' : ''}`,
      removable ? `onclick="removeStoredPiece(${idx})" title="Antippen = zurück in die Ablage"` : ''
    );
  }).join('');

  const preview = interactive ? renderCavePreviewHTML(cave) : '';

  return `
    <div class="cave-frame cave-theme-${config.animal.id}">
      <div class="cave-frame-title">${theme.deco[0]} ${theme.name} ${theme.deco[1]}</div>
      <div class="cave-grid ${rows === 5 ? 'cave-half' : ''}"
           style="grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${rows}, 1fr);"
           ${interactive ? 'onpointerleave="caveHoverLeave()"' : ''}>
        ${cells}${pieces}${preview}
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

function getCaveProgressLine(cave) {
  const grid = buildCaveGrid(cave);
  return `📦 ${getCaveUsedCells(cave)} / ${getCaveCapacity()} Felder &nbsp;|&nbsp; 💎 ${countFullRows(grid)} ${countFullRows(grid) === 1 ? 'Reihe' : 'Reihen'} voll &nbsp;|&nbsp; 🚚 ${cave.deliveries} ${cave.deliveries === 1 ? 'Lieferung' : 'Lieferungen'}`;
}

/* Kleine Höhlen-Ansicht unterhalb des Packtier-Tableaus */
function renderCavePanel() {
  const panel = document.getElementById('cavePanel');
  if (!panel) return;
  if (!isCaveMode()) {
    panel.classList.add('hidden');
    return;
  }
  const cave = getActiveCave();
  panel.classList.remove('hidden');
  document.getElementById('cavePanelGrid').innerHTML = renderCaveHTML(cave, false);
  document.getElementById('cavePanelStats').innerHTML = getCaveProgressLine(cave);
}

/* ---------- Ablauf-Steuerung ---------- */

// Entscheidet, was als Nächstes passiert: Einlagern, Abschlussbildschirm oder neuer Auftrag
function continueGameFlow() {
  if (tutorial.active) {
    if (isCaveMode() && getActiveCave().pending.length > 0) {
      openStorageModal();
    } else if (state.availableOrders.length === 0) {
      finishTutorial();
    } else {
      openOrderModal();
    }
    return;
  }
  if (isCaveMode()) {
    const cave = getActiveCave();
    if (cave.completed) {
      showCaveComplete();
      return;
    }
    if (cave.pending.length > 0) {
      openStorageModal();
      return;
    }
  }
  openOrderModal();
}

// Aufträge, die nicht mehr in die Höhle passen würden, werden ersetzt
function refreshOrdersForCave() {
  const free = getCaveFreeForOrders();
  const kept = state.availableOrders.map(o => (o && o.val <= free ? o : null));
  state.availableOrders = kept;
  for (let i = 0; i < kept.length; i++) {
    if (kept[i] === null) state.availableOrders[i] = generateReplacementOrder();
  }
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

function caveHoverLeave() {
  if (!storageUI.hover) return;
  storageUI.hover = null;
  updateCavePreview();
}

function caveCellClick(r, c) {
  const cave = getActiveCave();
  if (cave.pending.length === 0) return;

  const sameSpot = storageUI.hover && storageUI.hover.r === r && storageUI.hover.c === c;
  if (!sameSpot) {
    storageUI.hover = { r, c };
    renderStorage();
    return;
  }
  placeSelectedPiece(r, c);
}

function placeSelectedPiece(r, c) {
  const cave = getActiveCave();
  const size = cave.pending[storageUI.selectedIdx];
  const vertical = size > 1 && storageUI.vertical;
  const grid = buildCaveGrid(cave);
  const a = clampAnchor(size, r, c, vertical);

  if (!canPlacePiece(grid, size, a.r, a.c, vertical)) {
    renderStorage(`⚠️ Da passt der ${size}er nicht hin! Probier eine andere Stelle${size > 1 ? ' oder drehe das Teil' : ''}.`, 'error');
    return;
  }

  const rowsBefore = countFullRows(grid);
  const newPiece = { size, r: a.r, c: a.c, vertical, batch: cave.batch };
  cave.pieces.push(newPiece);
  storageUI.justPlaced = newPiece;
  cave.pending.splice(storageUI.selectedIdx, 1);
  const rowsAfter = countFullRows(buildCaveGrid(cave));

  saveCave();

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
      if (!activeProfile.stats) activeProfile.stats = {};
      activeProfile.stats.cavesFilled = (activeProfile.stats.cavesFilled || 0) + 1;
      const key = getCaveKey();
      if (!activeProfile.caveRecords) activeProfile.caveRecords = {};
      const best = activeProfile.caveRecords[key];
      cave.isNewRecord = !best || cave.deliveries < best;
      if (cave.isNewRecord) activeProfile.caveRecords[key] = cave.deliveries;
    }
    await saveCave();
    render();
    showCaveComplete();
    return;
  }

  await saveCave();
  refreshOrdersForCave();
  render();
  setSpeech('🏠 Alles verstaut! Wähle deinen nächsten Auftrag.', '');
  openOrderModal();
}

/* ---------- Abschlussbildschirm ---------- */

function showCaveComplete() {
  const cave = getActiveCave();
  const theme = getCaveTheme();
  const capacity = getCaveCapacity();
  const minPieces = capacity / 10;
  const minDeliveries = Math.ceil(capacity / (config.level === 1 ? 9 : 19));
  const best = activeProfile && activeProfile.caveRecords ? activeProfile.caveRecords[getCaveKey()] : null;
  const playerName = activeProfile ? activeProfile.name : 'Du';

  launchConfetti(90);

  document.getElementById('caveCompleteDialog').innerHTML = `
    <div class="celebration-trophy">${theme.deco[0]}🏠💎${theme.deco[2]}</div>
    <h2 style="margin:0; font-size:1.75rem; color:var(--wood-dark);">KNACKEVOLL!</h2>
    <p style="margin:6px 0 12px; font-weight:800; color:#6b5344; font-size:1.05rem;">
      ${playerName} hat die <strong>${theme.name}</strong> von ${config.animal.article} randvoll gepackt!
    </p>

    ${renderCaveHTML(cave, false)}

    <div class="celebration-stats-grid">
      <div class="stat-box ${cave.deliveries <= minDeliveries ? 'highlight-pro' : ''}">
        <small>🚚 Lieferungen</small>
        <strong>${cave.deliveries}</strong>
        <small style="text-transform:none;">Schnellstmöglich: ${minDeliveries}</small>
      </div>
      <div class="stat-box ${cave.pieces.length <= minPieces ? 'highlight-pro' : ''}">
        <small>📦 Frachtstücke</small>
        <strong>${cave.pieces.length}</strong>
        <small style="text-transform:none;">Profi-Packer: ${minPieces}</small>
      </div>
    </div>

    ${cave.isNewRecord
      ? `<div style="background:#dcfce7; border:3px solid #16a34a; color:#14532d; padding:10px 14px; border-radius:14px; font-weight:900;">⭐ Neuer Rekord für diese Höhle!</div>`
      : (best ? `<div style="font-weight:800; color:#6b5344;">Dein Rekord: ${best} Lieferungen</div>` : '')}

    <div style="margin-top:18px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
      <button class="btn" onclick="openSetupFromCaveComplete()">⚙️ Spiel-Setup</button>
      <button class="btn btn-oasis" onclick="startNewCave()" style="font-size:1.05rem; padding:12px 24px;">
        🏠 Neue Höhle beginnen
      </button>
    </div>
  `;

  document.getElementById('caveCompleteModal').classList.remove('hidden');
  setSpeech(`🏠 Die ${theme.name} ist randvoll – KNACKEVOLL!`, 'success');
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
   GEFÜHRTE ÜBUNGSRUNDE (Tutorial)
   Eine Zeige-Hand führt durch zwei kleine Aufträge (und im Höhlen-Modus durch
   einmal Einlagern). Klicks außerhalb des gezeigten Ziels werden ignoriert,
   damit das Kind nur durch Nachmachen lernt – ganz ohne Lesen.
   ============================================================================ */
const tutorial = {
  active: false,
  steps: [],
  stepIdx: 0,
  queue: [],        // noch folgende Übungsaufträge
  deliveries: 0,
  cave: null,       // Übungs-Höhle (wird nicht gespeichert)
  timer: null,
  lastTarget: null
};

function isTutorialDone(profile = activeProfile) {
  if (!profile) return false;
  // Wer schon Tiere gepackt hat, kennt das Spiel bereits
  return Boolean(profile.tutorialDone) || Boolean(profile.stats && profile.stats.packedAnimals > 0);
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

  // Im Höhlen-Modus: die Fracht der letzten Übungslieferung einmal einlagern
  if (isCaveMode()) {
    const lastPlan = orders[orders.length - 1].plan;
    lastPlan.forEach((_, k) => {
      steps.push({
        allow: '#storageCaveFrame .cave-cell',
        target: () => getTutorialStorageCell(),
        done: () => tutorial.cave.pieces.length >= k + 1
      });
    });
    steps.push({
      allow: '#storageDoneBtn',
      target: () => document.getElementById('storageDoneBtn'),
      done: () => isHidden('storageModal')
    });
  }
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
  ['setupModal', 'profileModal', 'orderModal', 'celebrationModal', 'storageModal', 'caveCompleteModal', 'tutorialEndModal']
    .forEach(id => document.getElementById(id).classList.add('hidden'));

  const orders = getTutorialOrders();
  tutorial.active = true;
  tutorial.deliveries = 0;
  tutorial.stepIdx = 0;
  tutorial.cave = createEmptyCave();
  tutorial.queue = orders.slice(1).map(o => ({ val: o.val, foxBlock: null }));
  tutorial.steps = buildTutorialSteps(orders);

  state.activeOrder = null;
  state.activeFoxBlock = null;
  state.activeOrderIdx = null;
  state.leftBag = [];
  state.rightBag = [];
  state.availableOrders = [{ val: orders[0].val, foxBlock: null }];
  storageUI.vertical = false;

  document.getElementById('tutorialBar').classList.remove('hidden');
  document.body.classList.add('tutorial-running');
  setSpeech('🎓 👆', '');
  render();
  openOrderModal();

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
  document.getElementById('tutorialEndAnimal').textContent = config.animal.icon;
  document.getElementById('tutorialEndModal').classList.remove('hidden');
}

function closeTutorialEnd() {
  document.getElementById('tutorialEndModal').classList.add('hidden');
  resetGame();
}

// Für Erwachsene: Übung abbrechen
function skipTutorial() {
  ['orderModal', 'celebrationModal', 'storageModal'].forEach(id => document.getElementById(id).classList.add('hidden'));
  stopTutorial();
  markTutorialDone();
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