/**
 * Game Data for KNACKEVOLL!
 * This file contains the definitions for animals, licenses, and their associated themes.
 */

const ANIMALS = [
  { id: 'unicorn', name: 'Einhorn', article: 'das Einhorn', icon: '🦄' },
  { id: 'raptor', name: 'Raptor', article: 'der Raptor', icon: '🦖' },
  { id: 'bear', name: 'Bär', article: 'der Bär', icon: '🐻' },
  { id: 'cat', name: 'Katze', article: 'die Katze', icon: '🐱' },
  { id: 'camel', name: 'Kamel', article: 'das Kamel', icon: '🐪' }
];

const LICENSES = [
  // loot = Schatzstück, das der Wüstenfuchs fallen lässt, wenn sein Streich vereitelt wird
  { id: 'fairy', name: 'Feenstaub', title: 'Königliche Feenstaub-Lizenz', icon: '✨', loot: '👛', lootName: 'Goldener Feenstaub-Beutel' },
  { id: 'dino', name: 'Dino-Knochen', title: 'Große Dino-Knochen-Lizenz', icon: '🍖', loot: '🦴', lootName: 'Goldener Fossil-Knochen' },
  { id: 'honey', name: 'Meister-Honig', title: 'Meister-Honig-Lizenz', icon: '🍯', loot: '🍯', lootName: 'Goldener Honigtopf' },
  { id: 'fish', name: 'Edel-Stinkefisch', title: 'Edel-Stinkefisch-Lizenz', icon: '🐟', loot: '🐠', lootName: 'Goldfisch' }
];

const CAVE_THEMES = {
  unicorn: { name: 'Regenbogen-Schatzkammer', deco: ['☁️', '💎', '🌈'] },
  raptor:  { name: 'Urzeit-Vorratsnest',      deco: ['🌿', '🌋', '🦴'] },
  bear:    { name: 'Bärenhöhle',              deco: ['🪵', '🍂', '🍯'] },
  cat:     { name: 'Kratzbaum-Palast',        deco: ['🧶', '🛋️', '🐾'] },
  camel:   { name: 'Oasen-Warenhaus',         deco: ['🌴', '🏺', '⛺'] }
};
