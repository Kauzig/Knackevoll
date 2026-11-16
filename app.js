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
  level: 2
};

let state = {
  activeOrder: null,
  activeOrderIdx: null,
  availableOrders: [],
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
      // Standard-Profil beim allerersten Start anlegen
      const defaultProfile = {
        id: 'player_' + Date.now(),
        name: 'Karawanen-Kind',
        animalId: 'raptor',
        licenseId: 'fairy',
        level: 2,
        stats: {
          totalCargoSent: 0, // Insgesamt verschickte Frachteinheiten
          packedAnimals: 0,  // Gelieferte Tiere / Aufträge insgesamt
          proPackers: 0      // Davon optimal als Profi-Packer gepackt
        },
        createdAt: Date.now()
      };
      await dbSaveProfile(defaultProfile);
      profiles = [defaultProfile];
    }

    // Zuletzt aktives Profil aus localStorage wiederherstellen (oder erstes nehmen)
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

  // Gespeicherte Vorlieben des Profils übernehmen
  config.animal = ANIMALS.find(a => a.id === target.animalId) || ANIMALS[1];
  config.license = LICENSES.find(l => l.id === target.licenseId) || LICENSES[0];
  config.level = target.level || 2;

  if (shouldRenderSetup) {
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
    stats: {
      totalCargoSent: 0,
      packedAnimals: 0,
      proPackers: 0
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
    renderSetupModal();
  }
}

async function saveActiveProfilePreferences() {
  if (!activeProfile) return;
  activeProfile.animalId = config.animal.id;
  activeProfile.licenseId = config.license.id;
  activeProfile.level = config.level;
  await dbSaveProfile(activeProfile);
}

async function recordDeliveryStats(deliveredAmount, isProPacker) {
  if (!activeProfile) return;
  if (!activeProfile.stats) {
    activeProfile.stats = { totalCargoSent: 0, packedAnimals: 0, proPackers: 0 };
  }
  // Abwärtskompatibilität für ältere Profile
  if (typeof activeProfile.stats.totalCargoSent !== 'number') {
    activeProfile.stats.totalCargoSent = 0;
  }

  activeProfile.stats.totalCargoSent += deliveredAmount;
  activeProfile.stats.packedAnimals += 1;
  if (isProPacker) {
    activeProfile.stats.proPackers += 1;
  }
  await dbSaveProfile(activeProfile);
}

/* ============================================================================
   SPIELLOGIK & DARSTELLUNG
   ============================================================================ */

/* Berechnet die minimale Kistenanzahl durch optimales Bündeln (10er -> 5er -> 1er) */
function getOptimalPacking(target) {
  let rem = target;
  const pieces = [];
  while (rem >= 10) {
    pieces.push(10);
    rem -= 10;
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

function renderSetupModal() {
  // 0. Spieler-Profile & Statistik rendern
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
    const st = activeProfile.stats || { totalCargoSent: 0, packedAnimals: 0, proPackers: 0 };
    const cargoTotal = st.totalCargoSent || 0;
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
    `;
  }

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

function openSetupModal() {
  renderSetupModal();
  document.getElementById('setupModal').classList.remove('hidden');
}

function startFromSetup() {
  saveActiveProfilePreferences();
  document.getElementById('setupModal').classList.add('hidden');
  resetGame();
}

function openOrderModal() {
  if (state.activeOrder !== null) return;

  const list = document.getElementById('popupOrdersList');
  list.innerHTML = state.availableOrders.map((num, idx) => {
    const opt = getOptimalPacking(num);
    return `
      <div class="OrderCardPopup" onclick="pickOrderCard(${idx})">
        <div class="order-badge-num">${num}</div>
        <div class="order-cargo-title">${config.license.icon} ${config.license.name}</div>
        ${renderTwentyStrip(num)}
        <div style="margin-top:8px; font-size:0.8rem; font-weight:800; color:#6b5344;">
          ⭐ Profi-Packer: <strong>${opt.minPieces} ${opt.minPieces === 1 ? 'Frachtstück' : 'Frachtstücke'}</strong>
        </div>
        <div style="margin-top:8px;">
          <span class="btn btn-oasis" style="padding:5px 12px; font-size:0.82rem;">Auftrag wählen</span>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('orderModal').classList.remove('hidden');
}

function closeOrderModal() {
  document.getElementById('orderModal').classList.add('hidden');
}

function generateOrders() {
  const maxVal = config.level === 1 ? 10 : 20;
  const minVal = config.level === 1 ? 2 : 6;
  const set = new Set();
  while (set.size < 3) {
    set.add(Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal);
  }
  return Array.from(set);
}

function generateReplacementOrder() {
  const maxVal = config.level === 1 ? 10 : 20;
  const minVal = config.level === 1 ? 2 : 6;
  let candidate = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
  while (state.availableOrders.includes(candidate)) {
    candidate = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
  }
  return candidate;
}

function resetGame() {
  state.activeOrder = null;
  state.activeOrderIdx = null;
  state.availableOrders = generateOrders();
  state.leftBag = [];
  state.rightBag = [];
  document.getElementById('celebrationModal').classList.add('hidden');
  setSpeech('Wähle deinen nächsten Auftrag für die Karawane aus!', '');
  render();
  if (document.getElementById('setupModal').classList.contains('hidden')) {
    openOrderModal();
  }
}

// Auftrag im Pop-up wählen
function pickOrderCard(index) {
  if (state.activeOrder !== null) return;

  state.activeOrderIdx = index;
  state.activeOrder = state.availableOrders[index];

  const opt = getOptimalPacking(state.activeOrder);
  closeOrderModal();
  setSpeech(
    `📜 Auftrag „${state.activeOrder}× ${config.license.name}“ angenommen! Schaffst du es als Profi-Packer mit nur ${opt.minPieces} ${opt.minPieces === 1 ? 'Frachtstück' : 'Frachtstücken'}?`,
    ''
  );
  render();
}

// Frachtstück einladen
function takeCargo(val) {
  if (state.activeOrder === null) {
    setSpeech('Bitte wähle zuerst oben einen Auftrag aus, bevor du Fracht einlädst!', 'error');
    return;
  }

  const leftSum = sumArray(state.leftBag);
  const rightSum = sumArray(state.rightBag);
  const totalSum = leftSum + rightSum;

  if (totalSum + val > state.activeOrder) {
    wobbleBag(leftSum < 10 ? 'bagLeft' : 'bagRight');
    setSpeech(`⚠️ Wackel-Regel! Dein Auftrag braucht genau ${state.activeOrder}. Mit +${val} wärst du bei ${totalSum + val}!`, 'error');
    return;
  }

  // „Erst links, dann rechts“-Regel
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

  const newTotal = sumArray(state.leftBag) + sumArray(state.rightBag);
  if (newTotal === state.activeOrder) {
    render();
    finishOrderDelivery();
    return;
  }

  const totalPieces = state.leftBag.length + state.rightBag.length;
  setSpeech(
    `✅ ${val} mal ${config.license.icon} eingeladen! Aktuell liegen ${totalPieces} ${totalPieces === 1 ? 'Stück' : 'Stücke'} (${newTotal} / ${state.activeOrder}) in den Taschen.`,
    ''
  );
  render();
}

// Frachtstück wieder auspacken
function unpackCargo(side, index) {
  if (side === 'left' && state.rightBag.length > 0) {
    wobbleBag('bagLeft');
    setSpeech('⚠️ Spiegelregel beim Auspacken: Räume zuerst die rechte Überlauf-Tasche leer, bevor du links auspackst!', 'error');
    return;
  }

  const bag = side === 'left' ? state.leftBag : state.rightBag;
  if (index < 0 || index >= bag.length) return;

  const removedVal = bag.splice(index, 1)[0];
  setSpeech(`↩️ ${removedVal} mal ${config.license.icon} wieder ausgepackt und in den Markt zurückgelegt.`, '');
  render();
}

// Tauschen: 10er-Kiste in zwei 5er-Säcke entbündeln
function unbundleTen(side) {
  const bag = side === 'left' ? state.leftBag : state.rightBag;
  const idx = bag.indexOf(10);
  if (idx === -1) return;

  bag.splice(idx, 1, 5, 5);
  setSpeech('🔄 Basar-Tausch: Die blaue 10er-Kiste wurde in zwei gelbe 5er-Säcke entbündelt!', '');
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

/* Großes Feier-Pop-up bei abgeschlossener Lieferung (Endlos-Modus) */
async function finishOrderDelivery() {
  const deliveredOrder = state.activeOrder;
  const packedPieces = [...state.leftBag, ...state.rightBag];
  const usedPiecesCount = packedPieces.length;

  const opt = getOptimalPacking(deliveredOrder);
  const isProPacker = usedPiecesCount === opt.minPieces;

  // In IndexedDB persistieren (Frachtmenge + Gepacktes Tier + ggf. Profi-Packer)
  await recordDeliveryStats(deliveredOrder, isProPacker);

  // Konfetti starten
  launchConfetti(isProPacker ? 65 : 40);

  const userChipsHTML = packedPieces.map(v => `
    <span class="mini-cargo-chip chip-${v}">${v} mal ${config.license.icon}</span>
  `).join('');

  const optChipsHTML = opt.pieces.map(v => `
    <span class="mini-cargo-chip chip-${v}">${v} mal ${config.license.icon}</span>
  `).join('');

  let ratingBadge = '';
  if (isProPacker) {
    ratingBadge = `
      <div style="background:#dcfce7; border:3px solid #16a34a; color:#14532d; padding:12px 14px; border-radius:14px; font-weight:900; margin-top:10px;">
        🏅 PROFI-PACKER! Du hast die ${deliveredOrder} optimal gebündelt und nur ${opt.minPieces} ${opt.minPieces === 1 ? 'Frachtstück' : 'Frachtstücke'} gebraucht!
      </div>
    `;
  } else {
    ratingBadge = `
      <div style="background:#ffedd5; border:3px solid #f97316; color:#9a3412; padding:12px 14px; border-radius:14px; font-weight:800; margin-top:10px; font-size:0.9rem;">
        💡 <strong>Profi-Packer-Tipp:</strong> Du hast ${usedPiecesCount} Frachtstücke genutzt. Wenn du noch größere Stücke bündelst, reichen für die <strong>${deliveredOrder}</strong> schon <strong>${opt.minPieces} ${opt.minPieces === 1 ? 'Stück' : 'Stücke'}</strong>:
        <div class="delivered-pieces-row" style="margin:8px 0 2px;">${optChipsHTML}</div>
      </div>
    `;
  }

  const pStats = activeProfile ? activeProfile.stats : { totalCargoSent: 0, packedAnimals: 0, proPackers: 0 };
  const playerStatLine = activeProfile
    ? `<div style="margin-top:12px; padding:8px 12px; background:#fff; border:2px dashed #cbb69b; border-radius:10px; font-size:0.84rem; font-weight:800; color:#57412f;">
         👤 <strong>${activeProfile.name}s Gesamtbilanz:</strong> 📦 ${pStats.totalCargoSent || 0} Fracht verschickt &nbsp;|&nbsp; 🐪 ${pStats.packedAnimals} Tiere &nbsp;|&nbsp; 🏅 ${pStats.proPackers}× Profi-Packer
       </div>`
    : '';

  const dialog = document.getElementById('celebrationDialog');

  dialog.innerHTML = `
    <div class="celebration-trophy">${isProPacker ? '🏅⭐📦' : '🎉🐪📦'}</div>
    <h2 style="margin:0; font-size:1.75rem; color:var(--wood-dark);">
      Lieferung geschafft! (+${deliveredOrder} ${config.license.icon})
    </h2>
    <p style="margin:6px 0 12px; font-weight:800; color:#6b5344; font-size:1.05rem;">
      ${config.animal.icon} Dein ${config.animal.name} hat genau <strong>${deliveredOrder}× ${config.license.name}</strong> in die Oase geliefert!
    </p>

    <div style="font-size:0.85rem; font-weight:800; color:var(--wood-dark);">Deine gepackten Frachtstücke:</div>
    <div class="delivered-pieces-row">${userChipsHTML}</div>

    <div class="celebration-stats-grid">
      <div class="stat-box ${isProPacker ? 'highlight-pro' : ''}">
        <small>Deine Kistenanzahl</small>
        <strong>${usedPiecesCount} ${usedPiecesCount === 1 ? 'Frachtstück' : 'Frachtstücke'}</strong>
      </div>
      <div class="stat-box highlight-pro">
        <small>⭐ Profi-Packer-Ziel</small>
        <strong>${opt.minPieces} ${opt.minPieces === 1 ? 'Frachtstück' : 'Frachtstücke'}</strong>
      </div>
    </div>

    ${ratingBadge}
    ${playerStatLine}

    <div style="margin-top:18px;">
      <button class="btn btn-oasis" onclick="acknowledgeCelebration()" style="font-size:1.05rem; padding:12px 24px;">
        📜 Nächsten Auftrag wählen!
      </button>
    </div>
  `;

  // Taschen leeren und Auftrag durch neuen ersetzen
  state.leftBag = [];
  state.rightBag = [];
  state.activeOrder = null;
  state.availableOrders[state.activeOrderIdx] = generateReplacementOrder();
  state.activeOrderIdx = null;

  document.getElementById('celebrationModal').classList.remove('hidden');
  setSpeech(`🎉 Lieferung (${deliveredOrder}× ${config.license.name}) erfolgreich in die Oase gebracht!`, 'success');
  render();
}

function acknowledgeCelebration() {
  document.getElementById('celebrationModal').classList.add('hidden');
  openOrderModal();
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
  if (hCargo) hCargo.textContent = pStats.totalCargoSent || 0;
  if (hAnimal) hAnimal.textContent = pStats.packedAnimals || 0;
  if (hPro) hPro.textContent = pStats.proPackers || 0;

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
    const opt = getOptimalPacking(state.activeOrder);
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

    slot.className = 'order-slot-box locked-order';
    lockLabel.textContent = '🔒 Aktiv bis zur Lieferung';
    slot.innerHTML = `
      <div class="order-main-info">
        <div class="order-badge-num">${state.activeOrder}</div>
        <div class="order-cargo-title">${config.license.icon} ${config.license.name}</div>
        ${renderTwentyStrip(state.activeOrder)}
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
          <span class="pro-counter-pill">
            Im Sattel: ${currentPieces} von optimal ${opt.minPieces} ${opt.minPieces === 1 ? 'Stück' : 'Stücken'}
          </span>
        </div>
      </div>
    `;
  }

  // Markt-Depots aktivieren/deaktivieren
  const canGrab = state.activeOrder !== null;
  ['depot10', 'depot5', 'depot1'].forEach(id => {
    document.getElementById(id).classList.toggle('disabled', !canGrab);
  });

  // Satteltaschen & Top-Down Grid
  const leftSum = sumArray(state.leftBag);
  const rightSum = sumArray(state.rightBag);
  const maxCap = config.level === 1 ? 10 : 20;

  document.getElementById('totalLoadText').textContent =
    state.activeOrder !== null
      ? `${leftSum + rightSum} / ${state.activeOrder} geladen`
      : `${leftSum + rightSum} / ${maxCap} geladen`;

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
      ? '💡 Klick auf Frachtstück = Wieder auspacken'
      : '🔒 Erst öffnen, wenn links randvoll (10) ist!';

    document.getElementById('rightBagPieces').innerHTML = state.rightBag.map((val, idx) => `
      <div class="cargo-block block-${val}"
           onclick="unpackCargo('right', ${idx})"
           title="Klicken zum Auspacken">
        ${formatPieceLabel(val)}
      </div>
    `).join('');
  }

  // Basar-Tausch Buttons
  const hasTenLeft = state.leftBag.includes(10);
  const hasTenRight = state.rightBag.includes(10);
  const btnL = document.getElementById('swapBtnLeft');
  const btnR = document.getElementById('swapBtnRight');

  btnL.style.display = hasTenLeft ? 'inline-block' : 'none';
  btnL.disabled = false;

  btnR.style.display = hasTenRight ? 'inline-block' : 'none';
  btnR.disabled = false;
}

// Initialisierung beim Laden (startet IndexedDB und rendert dann Setup + Spiel)
initPlayerManagement().then(() => {
  renderSetupModal();
  render();
});