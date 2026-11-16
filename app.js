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
  score: 0,
  turn: 1,
  actionsUsed: 0,        // 0..2 Aktionen pro Zug (1 Kiste = 1 Aktion)
  activeOrder: null,
  activeOrderIdx: null,
  availableOrders: [],
  leftBag: [],           // Array aus Objekten: { val, turnLoaded }
  rightBag: [],
  history: []
};

/* Top-Down SVG Illustrationen der 5 Packtiere (Blick von oben auf Rücken, Sattel & Gurte) */
function getTopDownAnimalSVG(animalId) {
  const strapsAndSaddle = `
    <!-- Lederriemen zu den linken und rechten Satteltaschen -->
    <rect x="4" y="76" width="152" height="12" rx="4" fill="#6e381b" stroke="#3e2411" stroke-width="2"/>
    <rect x="4" y="114" width="152" height="12" rx="4" fill="#6e381b" stroke="#3e2411" stroke-width="2"/>
    <!-- Schnallen links & rechts -->
    <rect x="10" y="74" width="10" height="16" rx="2" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>
    <rect x="140" y="74" width="10" height="16" rx="2" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>
    <rect x="10" y="112" width="10" height="16" rx="2" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>
    <rect x="140" y="112" width="10" height="16" rx="2" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>
    <!-- Satteldecke & Sitz von oben -->
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
  document.getElementById('setupAnimals').innerHTML = ANIMALS.map(a => `
    <div class="tile-option ${a.id === config.animal.id ? 'active-tile' : ''}" onclick="chooseAnimal('${a.id}')">
      <div style="font-size:2.1rem;">${a.icon}</div>
      <strong>${a.name}</strong>
    </div>
  `).join('');

  document.getElementById('setupLicenses').innerHTML = LICENSES.map(l => `
    <div class="tile-option ${l.id === config.license.id ? 'active-tile' : ''}" onclick="chooseLicense('${l.id}')">
      <div style="font-size:2.1rem;">${l.icon}</div>
      <strong>${l.name}</strong>
    </div>
  `).join('');

  document.getElementById('lvlTile1').classList.toggle('active-tile', config.level === 1);
  document.getElementById('lvlTile2').classList.toggle('active-tile', config.level === 2);

  document.getElementById('setupMottoBox').textContent =
    `„Ich bin ${config.animal.article} und fahre heute eine offizielle ${config.license.name}-Lieferung!“`;
}

function chooseAnimal(id) {
  config.animal = ANIMALS.find(a => a.id === id);
  renderSetupModal();
}

function chooseLicense(id) {
  config.license = LICENSES.find(l => l.id === id);
  renderSetupModal();
}

function setLevel(lvl) {
  config.level = lvl;
  renderSetupModal();
}

function openSetupModal() {
  renderSetupModal();
  document.getElementById('setupModal').classList.remove('hidden');
}

function startFromSetup() {
  document.getElementById('setupModal').classList.add('hidden');
  resetGame();
}

function openOrderModal() {
  if (state.activeOrder !== null) return;

  const list = document.getElementById('popupOrdersList');
  list.innerHTML = state.availableOrders.map((num, idx) => `
    <div class="OrderCardPopup" onclick="pickOrderCard(${idx})">
      <div class="order-badge-num">${num}</div>
      <div class="order-cargo-title">${config.license.icon} ${config.license.name}</div>
      ${renderTwentyStrip(num)}
      <div style="margin-top:10px;">
        <span class="btn btn-oasis" style="padding:5px 12px; font-size:0.82rem;">Kostenlos wählen</span>
      </div>
    </div>
  `).join('');

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

function pushHistory() {
  state.history.push(JSON.stringify({
    turn: state.turn,
    actionsUsed: state.actionsUsed,
    activeOrder: state.activeOrder,
    activeOrderIdx: state.activeOrderIdx,
    leftBag: state.leftBag.map(p => ({ ...p })),
    rightBag: state.rightBag.map(p => ({ ...p }))
  }));
}

function undoStep() {
  if (state.history.length === 0) return;
  const prev = JSON.parse(state.history.pop());
  state.turn = prev.turn;
  state.actionsUsed = prev.actionsUsed;
  state.activeOrder = prev.activeOrder;
  state.activeOrderIdx = prev.activeOrderIdx;
  state.leftBag = prev.leftBag;
  state.rightBag = prev.rightBag;
  setSpeech('↩️ Letzter Schritt wurde rückgängig gemacht.', '');
  render();
}

function resetGame() {
  state.score = 0;
  state.turn = 1;
  state.actionsUsed = 0;
  state.activeOrder = null;
  state.activeOrderIdx = null;
  state.availableOrders = generateOrders();
  state.leftBag = [];
  state.rightBag = [];
  state.history = [];
  setSpeech('Wähle zuerst kostenlos deinen Auftrag für die Karawane aus!', '');
  render();
  if (document.getElementById('setupModal').classList.contains('hidden')) {
    openOrderModal();
  }
}

// Auftrag im Pop-up wählen (KOSTENLOS - beendet automatisch einen angebrochenen Vorzug)
function pickOrderCard(index) {
  if (state.activeOrder !== null) return;

  pushHistory();

  // Falls im aktuellen Zug schon Aktionen (z. B. durch den vorigen Auftrag) verbraucht wurden,
  // wird der alte Zug automatisch abgeschlossen und ein frischer Zug gestartet.
  if (state.actionsUsed > 0) {
    state.turn += 1;
    state.actionsUsed = 0;
  }

  state.activeOrderIdx = index;
  state.activeOrder = state.availableOrders[index];

  closeOrderModal();
  setSpeech(`📜 Auftrag „${state.activeOrder}× ${config.license.name}“ angenommen! Du startest mit 2 freien Aktionen in Zug ${state.turn}.`, '');
  render();
}

// AKTION: Fracht nehmen (1 Frachtkiste = 1 Aktion)
function takeCargo(val) {
  if (state.activeOrder === null) {
    setSpeech('Bitte wähle zuerst links einen Auftrag aus (kostenlos), bevor du Fracht einlädst!', 'error');
    return;
  }

  if (state.actionsUsed >= 2) {
    setSpeech('Deine 2 Aktionen für diesen Zug sind aufgebraucht! Klicke auf „Zug beenden“.', 'error');
    return;
  }

  const leftSum = sumArray(state.leftBag);
  const rightSum = sumArray(state.rightBag);
  const totalSum = leftSum + rightSum;

  // Prüfen, ob über den Auftragswert geladen würde
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
      setSpeech(`⚠️ Wackel-Regel! In der linken Satteltasche sind nur noch ${10 - leftSum} Plätze frei – ein ${val}er-Stück passt nicht!`, 'error');
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

  pushHistory();
  state.actionsUsed += 1;

  const newPiece = {
    val: val,
    turnLoaded: state.turn
  };

  if (target === 'left') {
    state.leftBag.push(newPiece);
  } else {
    state.rightBag.push(newPiece);
  }

  const newTotal = sumArray(state.leftBag) + sumArray(state.rightBag);
  if (newTotal === state.activeOrder) {
    finishOrderDelivery();
    return;
  }

  const remainingActions = 2 - state.actionsUsed;
  const msgExtra = remainingActions > 0
    ? `Du hast in diesem Zug noch ${remainingActions} Aktion frei.`
    : 'Deine 2 Aktionen für diesen Zug sind verbraucht.';
  setSpeech(`✅ ${val}er-Frachtstück eingeladen (1 Aktion). ${msgExtra}`, '');
  render();
}

// AKTION / RÜCKGABE: Frachtstück wieder auspacken
// - In der aktuellen Runde eingeladen: gibt die 1 Aktion zurück!
// - Aus einer früheren Runde: kostet 1 Aktion!
function unpackCargo(side, index) {
  // Spiegelregel zur „Erst links, dann rechts“-Regel
  if (side === 'left' && state.rightBag.length > 0) {
    wobbleBag('bagLeft');
    setSpeech('⚠️ Spiegelregel beim Auspacken: Räume zuerst die rechte Überlauf-Tasche leer, bevor du links auspackst!', 'error');
    return;
  }

  const bag = side === 'left' ? state.leftBag : state.rightBag;
  if (index < 0 || index >= bag.length) return;

  const piece = bag[index];
  const isFromCurrentTurn = piece.turnLoaded === state.turn;

  // Wenn das Stück aus einer früheren Runde stammt, kostet das Ausladen 1 freie Aktion
  if (!isFromCurrentTurn && state.actionsUsed >= 2) {
    setSpeech('Dieses Frachtstück stammt aus einer früheren Runde – zum Auspacken brauchst du 1 freie Aktion!', 'error');
    return;
  }

  pushHistory();
  bag.splice(index, 1);

  if (isFromCurrentTurn) {
    state.actionsUsed = Math.max(0, state.actionsUsed - 1);
    setSpeech(`↩️ ${piece.val}er-Frachtstück aus dieser Runde wieder ausgeladen – du bekommst deine Aktion zurück!`, '');
  } else {
    state.actionsUsed += 1;
    setSpeech(`📤 ${piece.val}er-Frachtstück (aus Zug ${piece.turnLoaded}) ausgepackt – kostet 1 Aktion.`, '');
  }

  render();
}

// AKTION: Tauschen (10er-Kiste in zwei 5er-Säcke entbündeln, kostet 1 Aktion)
function unbundleTen(side) {
  const bag = side === 'left' ? state.leftBag : state.rightBag;
  const idx = bag.findIndex(p => p.val === 10);
  if (idx === -1) return;

  if (state.actionsUsed >= 2) {
    setSpeech('Für den Basar-Tausch (Entbündeln) brauchst du 1 freie Aktion! Beende zuerst deinen Zug.', 'error');
    return;
  }

  pushHistory();
  state.actionsUsed += 1;

  // Die beiden 5er gelten als aus einer Vor-Aktion stammend (Ausladen kostet 1 Aktion; für kostenlosen Widerruf gibt es "Rückgängig")
  bag.splice(
    idx,
    1,
    { val: 5, turnLoaded: state.turn - 1 },
    { val: 5, turnLoaded: state.turn - 1 }
  );

  setSpeech('🔄 Basar-Tausch (1 Aktion): Die blaue 10er-Kiste wurde in zwei gelbe 5er-Säcke entbündelt!', '');
  render();
}

function finishOrderDelivery() {
  state.score += 1;
  const delivered = state.activeOrder;

  state.leftBag = [];
  state.rightBag = [];
  state.activeOrder = null;
  state.availableOrders[state.activeOrderIdx] = generateReplacementOrder();
  state.activeOrderIdx = null;
  state.history = [];

  if (state.score >= 3) {
    setSpeech(`🎉 KNACKEVOLL! Auftrag (${delivered}) geliefert! Du hast alle 3 Lieferungen in Zug ${state.turn} geschafft und gewinnst!`, 'success');
  } else {
    setSpeech(`🎉 Lieferung (${delivered}× ${config.license.name}) perfekt abgeschlossen! Wähle jetzt kostenlos deinen nächsten Auftrag (startet automatisch den nächsten Zug).`, 'success');
  }
  render();
}

function nextTurn() {
  state.turn += 1;
  state.actionsUsed = 0;
  state.history = [];
  setSpeech(`⏭️ Zug ${state.turn} beginnt! Du hast wieder 2 volle Aktionen zur Verfügung.`, '');
  render();
}

function sumArray(arr) {
  return arr.reduce((a, b) => a + b.val, 0);
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
  // Sterne
  for (let s = 1; s <= 3; s++) {
    document.getElementById(`star${s}`).classList.toggle('earned', state.score >= s);
  }

  // Frachtbrief & Top-Down Packtier zwischen den Taschen
  document.getElementById('waybillEmoji').textContent = config.license.icon;
  document.getElementById('waybillTitle').textContent = config.license.title;
  document.getElementById('waybillSentence').textContent =
    `„Ich bin ${config.animal.article} und fahre heute eine offizielle ${config.license.name}-Lieferung!“`;
  document.getElementById('animalBoardName').textContent = `${config.animal.name}-Tableau (Top-Down)`;
  document.getElementById('unitDepotIcon').textContent = config.license.icon;

  document.getElementById('topDownAnimalSVG').innerHTML = getTopDownAnimalSVG(config.animal.id);
  document.getElementById('mountCaptionLabel').textContent = `${config.animal.icon} ${config.animal.name}`;

  // Zug & Aktionen (1 Frachtkiste = 1 Aktion)
  document.getElementById('turnBadge').textContent = `Zug ${state.turn}`;
  const p1 = document.getElementById('actionPill1');
  const p2 = document.getElementById('actionPill2');

  if (state.actionsUsed === 0) {
    p1.className = 'action-token ready';
    p1.textContent = '⚡ Aktion 1: Frei';
  } else {
    p1.className = 'action-token';
    p1.textContent = '✓ Aktion 1: Verbraucht';
  }

  if (state.actionsUsed < 2) {
    p2.className = 'action-token ready';
    p2.textContent = '⚡ Aktion 2: Frei';
  } else {
    p2.className = 'action-token';
    p2.textContent = '✓ Aktion 2: Verbraucht';
  }

  const sub = document.getElementById('grabSubPill');
  if (sub) sub.style.display = 'none';

  document.getElementById('btnUndo').disabled = state.history.length === 0;

  // Einzel-Slot für den aktuellen Auftrag (Auswahl ist kostenlos & startet ggf. neuen Zug)
  const slot = document.getElementById('activeOrderSlot');
  const lockLabel = document.getElementById('orderLockLabel');
  if (state.activeOrder === null) {
    slot.className = 'order-slot-box';
    lockLabel.textContent = 'Kostenlose Wahl (0 Akt.)';
    const canOpen = state.score < 3;
    slot.innerHTML = `
      <div style="font-size:2.2rem; margin-bottom:6px;">📜</div>
      <p style="margin:0 0 12px; color:#6b5344; font-weight:700;">Noch kein Auftrag aktiv.</p>
      <button class="btn btn-oasis" onclick="openOrderModal()" ${!canOpen ? 'disabled' : ''}>
        📜 Auftrag auswählen (kostenlos)
      </button>
    `;
  } else {
    slot.className = 'order-slot-box locked-order';
    lockLabel.textContent = '🔒 Fest eingeloggt';
    slot.innerHTML = `
      <div class="order-badge-num">${state.activeOrder}</div>
      <div class="order-cargo-title">${config.license.icon} ${config.license.name}</div>
      ${renderTwentyStrip(state.activeOrder)}
      <small style="margin-top:10px; color:#15803d; font-weight:900;">🔒 Aktiv bis zur Lieferung</small>
    `;
  }

  // Markt-Depots aktivieren/deaktivieren
  const canGrab = state.activeOrder !== null && state.actionsUsed < 2;
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

  // Frachtstücke rendern (unterscheidet zwischen aktueller Runde = Aktion zurück vs. ältere Runde = 1 Aktion Kosten)
  document.getElementById('leftBagPieces').innerHTML = state.leftBag.map((p, idx) => {
    const isCurrentTurn = p.turnLoaded === state.turn;
    const tooltip = isCurrentTurn
      ? 'In dieser Runde eingeladen: Klicken zum Auspacken (gibt 1 Aktion zurück!)'
      : `In Zug ${p.turnLoaded} eingeladen: Klicken zum Auspacken (kostet 1 Aktion)`;
    return `
      <div class="cargo-block block-${p.val} ${isCurrentTurn ? 'current-turn-piece' : ''}"
           onclick="unpackCargo('left', ${idx})"
           title="${tooltip}">
        ${p.val === 1 ? config.license.icon : p.val + 'er'}
      </div>
    `;
  }).join('');

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
      ? '💡 Aktuelle Runde = Gratis zurück | Frühere Runde = 1 Akt.'
      : '🔒 Erst öffnen, wenn links randvoll (10) ist!';

    document.getElementById('rightBagPieces').innerHTML = state.rightBag.map((p, idx) => {
      const isCurrentTurn = p.turnLoaded === state.turn;
      const tooltip = isCurrentTurn
        ? 'In dieser Runde eingeladen: Klicken zum Auspacken (gibt 1 Aktion zurück!)'
        : `In Zug ${p.turnLoaded} eingeladen: Klicken zum Auspacken (kostet 1 Aktion)`;
      return `
        <div class="cargo-block block-${p.val} ${isCurrentTurn ? 'current-turn-piece' : ''}"
             onclick="unpackCargo('right', ${idx})"
             title="${tooltip}">
          ${p.val === 1 ? config.license.icon : p.val + 'er'}
        </div>
      `;
    }).join('');
  }

  // Basar-Tausch Buttons (Entbündeln)
  const hasTenLeft = state.leftBag.some(p => p.val === 10);
  const hasTenRight = state.rightBag.some(p => p.val === 10);
  const canSwapLeft = hasTenLeft && state.actionsUsed < 2;
  const canSwapRight = hasTenRight && state.actionsUsed < 2;
  const btnL = document.getElementById('swapBtnLeft');
  const btnR = document.getElementById('swapBtnRight');

  btnL.style.display = hasTenLeft ? 'inline-block' : 'none';
  btnL.disabled = !canSwapLeft;

  btnR.style.display = hasTenRight ? 'inline-block' : 'none';
  btnR.disabled = !canSwapRight;
}

// Initialisierung beim Laden
renderSetupModal();
render();