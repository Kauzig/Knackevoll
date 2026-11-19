/* ============================================================================
   STORY-MODUS: „Der Knackevolle Schatz“
   Episoden (story-data.js) starten die vorhandene Endlos-Karawane mit festen Aufträgen und
   einem Rick-Skript. Der Fortschritt liegt pro Profil in profile.story.
   Die Story ist kein gameMode: Sie setzt gameMode / level / foxMode nur vorübergehend und
   stellt sie beim Verlassen wieder her (siehe leaveStory). Geladen wird diese Datei vor app.js,
   weil app.js beim Start schon auf `story` zugreift.
   ============================================================================ */
const story = {
  active: false,
  episode: null,
  saved: null,            // gemerkte Original-Einstellungen { gameMode, level, foxMode }
  queue: [],              // noch nicht ausgelegte Aufträge
  rickIdx: 0,             // nächster Eintrag im Rick-Skript
  deliveries: 0,
  proPackers: 0,
  pendingEpisodeId: null  // Episode, die nach der Übungsrunde starten soll
};

/* ---------- Fortschritt (pro Profil) ---------- */

function getStoryProgress(profile = activeProfile) {
  if (!profile) return { done: {} };
  if (!profile.story || typeof profile.story !== 'object') profile.story = {};
  if (!profile.story.done) profile.story.done = {};
  return profile.story;
}

function storyDone(id) {
  return Boolean(getStoryProgress().done[id]);
}

function storyUnlocked(idx) {
  return idx === 0 || storyDone(STORY_EPISODES[idx - 1].id);
}

// Gefundene Fragmente ergeben sich aus den abgeschlossenen Episoden
function storyFragments() {
  return STORY_EPISODES.filter(e => storyDone(e.id)).map(e => e.fragment);
}

/* ---------- Texte & Sprecher ---------- */

function storyText(str) {
  const art = config.animal.article;
  return str
    .replace(/\{Tier\}/g, art.charAt(0).toUpperCase() + art.slice(1))
    .replace(/\{tier\}/g, art)
    .replace(/\{fracht\}/g, config.license.name);
}

function isAnimalId(id) {
  return ANIMALS.some(a => a.id === id);
}

// Welches Tier spricht wirklich? Ist die Rolle der Held, springt ein anderes Crew-Tier ein,
// das in der Episode nicht ohnehin schon spricht.
function storyCrewMap(ep) {
  const heroId = config.animal.id;
  const pages = [...ep.briefing, ...ep.rickScene, ...ep.outro];
  const used = new Set(pages.map(p => p.who).filter(isAnimalId));
  const map = {};
  used.forEach(id => {
    if (id !== heroId) { map[id] = id; return; }
    map[id] = STORY_CREW_ORDER.find(c => c !== heroId && !used.has(c))
      || STORY_CREW_ORDER.find(c => c !== heroId);
  });
  return map;
}

function storySpeaker(page) {
  const ep = story.episode; // im Prolog noch leer
  if (page.who === 'rick') return { icon: page.icon || '🦊', name: RICK_NAME, voice: 'fox' };
  if (page.who === 'npc') return { icon: page.icon || '🧑', name: page.name || '', voice: null };
  if (isAnimalId(page.who)) {
    const id = page.exact || !ep ? page.who : storyCrewMap(ep)[page.who]; // exact: genau dieses Tier, kein Austausch
    const animal = ANIMALS.find(a => a.id === id);
    return { icon: page.icon || animal.icon, name: animal.name, voice: id };
  }
  return { icon: page.icon || (ep ? ep.place : '📖'), name: '', voice: null }; // Erzähler
}

/* ---------- Szenen ---------- */

let storyScene = null;

function playScene(pages, onDone) {
  storyScene = { pages, idx: 0, onDone };
  document.getElementById('storySceneModal').classList.remove('hidden');
  renderScene();
}

function renderScene() {
  const page = storyScene.pages[storyScene.idx];
  const sp = storySpeaker(page);
  const dots = storyScene.pages.map((_, i) =>
    `<span class="tutorial-dot ${i < storyScene.idx ? 'done' : (i === storyScene.idx ? 'current' : '')}"></span>`
  ).join('');

  document.getElementById('storySceneDialog').innerHTML = `
    <span class="story-scene-icon">${sp.icon}</span>
    <div class="story-scene-name">${sp.name}</div>
    <p class="story-scene-text">${storyText(page.text)}</p>
    <div class="tutorial-dots story-scene-dots">${dots}</div>
    <div class="story-scene-actions">
      <button class="btn btn-oasis story-scene-next" onclick="event.stopPropagation(); storySceneNext()">▶</button>
      <button class="btn story-scene-skip" onclick="event.stopPropagation(); storySceneSkip()" title="Szene überspringen">⏭</button>
    </div>
  `;

  if (window.KnackSound && sp.voice) {
    if (sp.voice === 'fox') window.KnackSound.play('fox');
    else window.KnackSound.play('voice', sp.voice);
  }
}

function storySceneNext() {
  if (!storyScene) return;
  storyScene.idx += 1;
  if (storyScene.idx >= storyScene.pages.length) storySceneSkip();
  else renderScene();
}

function storySceneSkip() {
  if (!storyScene) return;
  const done = storyScene.onDone;
  storyScene = null;
  document.getElementById('storySceneModal').classList.add('hidden');
  if (done) done();
}

/* ---------- Karte ---------- */

// Die Karte ist der Reiter „Abenteuer“ im Setup. Beim ersten Öffnen erzählt zuerst der Prolog.
function openStoryMap() {
  if (!getStoryProgress().introSeen) {
    playPrologue();
    return;
  }
  showStoryTab();
}

function showStoryTab() {
  setupView = 'story';
  renderSetupModal();
  document.getElementById('setupModal').classList.remove('hidden');
}

function buildPrologue() {
  const hero = config.animal;
  const team = ANIMALS.filter(a => a.id !== hero.id)
    .map(a => ({ who: a.id, exact: true, text: STORY_TEAM[a.id] }));
  return [
    ...STORY_PROLOGUE,
    { who: hero.id, exact: true, text: 'Ich bin {tier}, dein Packtier. Zusammen führen wir die Karawane an!' },
    { who: 'narrator', icon: '👥', text: 'Und ihr seid nicht allein. Das ist dein Team:' },
    ...team,
    ...STORY_PROLOGUE_END,
    { who: hero.id, exact: true, text: STORY_PROLOGUE_HERO_END }
  ];
}

function playPrologue() {
  playScene(buildPrologue(), async () => {
    const progress = getStoryProgress();
    if (!progress.introSeen) {
      progress.introSeen = true;
      if (activeProfile) await dbSaveProfile(activeProfile);
    }
    showStoryTab();
  });
}

function renderStoryMap() {
  const found = new Set(storyFragments());
  const slots = Array.from({ length: STORY_FRAGMENT_TOTAL }, (_, i) =>
    `<span class="story-fragment ${found.has(i + 1) ? 'found' : ''}">${found.has(i + 1) ? '🧩' : '❔'}</span>`
  ).join('');

  const cards = STORY_EPISODES.map((ep, i) => {
    const done = storyDone(ep.id);
    const open = storyUnlocked(i);
    return `
      <button class="story-episode ${done ? 'done' : ''} ${open ? '' : 'locked'}" ${open ? '' : 'disabled'} onclick="startEpisode('${ep.id}')">
        <span class="story-episode-place">${open ? ep.place : '🔒'}</span>
        <span class="story-episode-text"><strong>Folge ${i + 1}</strong><small>${open ? ep.title : '???'}</small></span>
        <span class="story-episode-state">${done ? '✅' : (open ? '▶' : '')}</span>
      </button>`;
  }).join('');

  const more = STORY_EPISODES.length < STORY_FRAGMENT_TOTAL
    ? `<div class="story-episode locked"><span class="story-episode-place">🔒</span><span class="story-episode-text"><small>Bald geht es weiter …</small></span></div>`
    : '';

  document.getElementById('storyMapBody').innerHTML = `
    <div class="story-fragments" title="Teile des Packplans">${slots}</div>
    <div class="story-episode-list">${cards}${more}</div>
    <div style="text-align:center; margin-top:6px;">
      <button class="btn" onclick="playPrologue()" title="Die Legende und das Team noch einmal ansehen">📜 Legende &amp; Team</button>
    </div>
  `;
}

/* ---------- Episoden-Ablauf: Karte → Szenen → Spiel → Abspann → Karte ---------- */

function startEpisode(id) {
  const idx = STORY_EPISODES.findIndex(e => e.id === id);
  if (idx < 0 || !storyUnlocked(idx)) return;

  ['setupModal', 'profileModal', 'orderModal', 'celebrationModal', 'storageModal', 'caveCompleteModal']
    .forEach(m => document.getElementById(m).classList.add('hidden'));

  // Wer das Spiel noch nicht kennt, übt zuerst; danach geht es mit der Episode weiter
  if (!isTutorialDone()) {
    story.pendingEpisodeId = id;
    startTutorial();
    return;
  }

  const ep = STORY_EPISODES[idx];
  story.episode = ep;
  playScene(ep.briefing, () => playScene(ep.rickScene, beginEpisodePlay));
}

// Wird nach der Übungsrunde aufgerufen. true = eine wartende Episode wurde gestartet.
function storyContinueAfterTutorial() {
  const id = story.pendingEpisodeId;
  if (!id) return false;
  story.pendingEpisodeId = null;
  startEpisode(id);
  return true;
}

function beginEpisodePlay() {
  const ep = story.episode;
  story.saved = { gameMode: config.gameMode, level: config.level, foxMode: config.foxMode };
  config.gameMode = ep.mode;
  config.level = ep.level;
  config.foxMode = Boolean(ep.rick && ep.rick.length > 0);

  story.active = true;
  document.getElementById('storyBar').classList.remove('hidden');
  resetGame(); // setzt über storyResetRun() auch die Folge auf Anfang
}

// Folge von vorn: Aufträge, Rick-Skript und Zähler zurücksetzen.
// Wird von resetGame() aufgerufen, also auch beim „🔄 Neustart“ mitten in der Folge.
function storyResetRun() {
  const ep = story.episode;
  story.queue = [...ep.orders];
  story.rickIdx = 0;
  story.deliveries = 0;
  story.proPackers = 0;
  updateStoryBar();
}

function updateStoryBar() {
  const ep = story.episode;
  document.getElementById('storyBarTitle').textContent = `${ep.place} ${story.deliveries}/${ep.orders.length}`;
}

// Alle Einstellungen zurück, Setup (= Startbildschirm) zeigen, optional die Karte darüber
function leaveStory(openMap = true) {
  if (story.active) {
    story.active = false;
    Object.assign(config, story.saved);
    story.saved = null;
  }
  story.pendingEpisodeId = null;
  ['storyBar', 'storySceneModal', 'orderModal', 'celebrationModal']
    .forEach(m => document.getElementById(m).classList.add('hidden'));
  storyScene = null;
  snapshotSetup(); // Einstellungen sind wieder die des Profils: Schließen setzt die Runde nur fort
  setupView = openMap ? 'story' : 'mode'; // nach einer Folge zeigt das Setup wieder den Abenteuer-Reiter
  renderSetupModal();
  document.getElementById('setupModal').classList.remove('hidden');
  resetGame(); // Setup ist offen → öffnet kein Auftrags-Pop-up
}

function storyConfirmLeave() {
  return confirm('Folge abbrechen? Der Fortschritt in dieser Folge geht verloren.');
}

function abortEpisode() {
  if (!storyConfirmLeave()) return;
  leaveStory(true);
}

// Für Setup und Profilwechsel: fragt nach, beendet die Folge und zeigt das Setup.
// Gibt true zurück, wenn gerade keine Folge läuft oder sie beendet wurde.
function storyLeaveForMenu() {
  if (!story.active) return true;
  if (!storyConfirmLeave()) return false;
  leaveStory(false);
  return true;
}

async function completeEpisode() {
  const ep = story.episode;
  const first = !storyDone(ep.id);
  const progress = getStoryProgress();
  const prev = progress.done[ep.id];
  progress.done[ep.id] = {
    at: prev ? prev.at : Date.now(),
    pro: Math.max(prev ? prev.pro : 0, story.proPackers)
  };
  if (activeProfile) await dbSaveProfile(activeProfile);

  document.getElementById('storyBar').classList.add('hidden');
  launchConfetti(80);
  fx('deliverPro', 'cheer');

  const pages = [...ep.outro];
  if (first) {
    pages.push({ who: 'narrator', icon: '🧩', text: `Teil ${ep.fragment} von ${STORY_FRAGMENT_TOTAL} des Packplans gefunden!` });
  }
  playScene(pages, () => leaveStory(true));
}

/* ---------- Hooks für app.js ---------- */

// Die ersten drei Aufträge liegen gleichzeitig aus
function storyInitialOrders() {
  return story.queue.splice(0, 3).map(val => ({ val }));
}

// Gelieferte Karte durch den nächsten Auftrag ersetzen – oder entfernen, wenn keiner mehr folgt
function storyRefillOrders(idx) {
  story.deliveries += 1;
  const next = story.queue.shift();
  if (next !== undefined) state.availableOrders[idx] = { val: next };
  else state.availableOrders.splice(idx, 1);
  updateStoryBar();
}

// Nächste Sperre aus dem Skript; null, wenn das Skript zu Ende ist
function storyNextRickBlock() {
  const script = story.episode.rick || [];
  const block = script[story.rickIdx];
  story.rickIdx += 1;
  return block === undefined ? null : block;
}
