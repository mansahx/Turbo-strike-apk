// Career: maps, levels, car catalog, money / rewards and unlock rules.
// Progress lives in game.settings (saved to localStorage): money, ownedCars, unlockedMaps, cleared.
window.RL = window.RL || {};
RL.CARS = [
  { id: 'octane', name: 'STRIKER', price: 0, desc: 'Balanced all-rounder. Good at everything.', spec: { drive: 1.00, boostAcc: 1.00, boostUse: 1.00, maxV: 1.00 } },
  { id: 'fennec', name: 'BULLDOG', price: 0, desc: 'Boxy and steady. Same handling as the Striker.', spec: { drive: 1.00, boostAcc: 1.00, boostUse: 1.00, maxV: 1.00 } },
  { id: 'viper', name: 'VIPER GT', price: 1500, desc: 'Low sports car. Quicker off the line.', spec: { drive: 1.06, boostAcc: 1.04, boostUse: 1.00, maxV: 1.00 } },
  { id: 'titan', name: 'TITAN', price: 2500, desc: 'Heavy truck that sips boost: 20% less boost used.', spec: { drive: 1.03, boostAcc: 1.03, boostUse: 0.80, maxV: 1.00 } },
  { id: 'phantom', name: 'PHANTOM X', price: 4000, desc: 'Hypercar. Fastest acceleration and top speed.', spec: { drive: 1.08, boostAcc: 1.10, boostUse: 0.90, maxV: 1.04 } }
];
RL.CAR_BY_ID = {}; for (const c of RL.CARS) RL.CAR_BY_ID[c.id] = c;
RL.DEFAULT_SPEC = { drive: 1, boostAcc: 1, boostUse: 1, maxV: 1 };

RL.MAPS = [
  { id: 'greenfield', name: 'GREENFIELD PARK', sub: 'DAY STADIUM', price: 0, bg: ['#2f7fd0', '#3a7f2b'] },
  { id: 'neon', name: 'NEON CITY', sub: 'NIGHT STADIUM', price: 3000, bg: ['#1a0f3a', '#08c3d1'] }
];
RL.MAP_BY_ID = {}; for (const m of RL.MAPS) RL.MAP_BY_ID[m.id] = m;

// 3 levels per map; each level must be won to unlock the next one.
RL.LEVELS = {
  greenfield: [
    { title: 'ROOKIE CUP', mode: '1v1', bots: 'rookie', reward: 500 },
    { title: 'PRO CUP', mode: '2v2', bots: 'pro', reward: 800 },
    { title: 'ALL-STAR CUP', mode: '3v3', bots: 'allstar', reward: 1200 }
  ],
  neon: [
    { title: 'NIGHT DUEL', mode: '1v1', bots: 'pro', reward: 1000 },
    { title: 'NEON DOUBLES', mode: '2v2', bots: 'allstar', reward: 1500 },
    { title: 'CITY FINALS', mode: '3v3', bots: 'allstar', reward: 2500 }
  ]
};
RL.QUICK_REWARD = 200;   // quick match win
RL.GOAL_BONUS = 50;      // per goal scored by the player, paid on a win
// TEST MODE: starting money for trying every feature. Set to 0 (or delete) for the normal game.
RL.TRIAL_MONEY = 50000;

RL.Career = (function () {
  let S = null;
  function bind(settings) {
    S = settings;
    if (typeof S.money !== 'number') S.money = 0;
    // one-time test grant (also applied to saves made before it existed)
    if (RL.TRIAL_MONEY > 0 && !S.trialGranted) { S.money += RL.TRIAL_MONEY; S.trialGranted = true; }
    if (!Array.isArray(S.ownedCars)) S.ownedCars = ['octane', 'fennec'];
    for (const id of ['octane', 'fennec']) if (!S.ownedCars.includes(id)) S.ownedCars.push(id);
    if (!Array.isArray(S.unlockedMaps)) S.unlockedMaps = ['greenfield'];
    if (!S.unlockedMaps.includes('greenfield')) S.unlockedMaps.push('greenfield');
    S.cleared = S.cleared || {};
    for (const m of RL.MAPS) { const a = S.cleared[m.id]; S.cleared[m.id] = [0, 1, 2].map((i) => !!(a && a[i])); }
    if (!RL.CAR_BY_ID[S.body] || !S.ownedCars.includes(S.body)) S.body = 'octane';
  }
  const money = () => S.money;
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const ownsCar = (id) => S.ownedCars.includes(id);
  const mapUnlocked = (id) => S.unlockedMaps.includes(id);
  function levelUnlocked(mapId, i) { return mapUnlocked(mapId) && (i === 0 || S.cleared[mapId][i - 1]); }
  const levelCleared = (mapId, i) => !!S.cleared[mapId][i];
  function clearedCount() { let n = 0; for (const m of RL.MAPS) n += S.cleared[m.id].filter(Boolean).length; return n; }
  function buyCar(id) { const c = RL.CAR_BY_ID[id]; if (!c || ownsCar(id) || S.money < c.price) return false; S.money -= c.price; S.ownedCars.push(id); return true; }
  function buyMap(id) { const m = RL.MAP_BY_ID[id]; if (!m || mapUnlocked(id) || S.money < m.price) return false; S.money -= m.price; S.unlockedMaps.push(id); return true; }
  // cfg: { map, level (index or undefined for quick match) } ; returns a result summary for the end screen
  function settle(cfg, won, goals) {
    const isLevel = typeof cfg.level === 'number';
    const base = isLevel ? RL.LEVELS[cfg.map][cfg.level].reward : RL.QUICK_REWARD;
    const res = { won, isLevel, base: won ? base : 0, goals, goalBonus: won ? goals * RL.GOAL_BONUS : 0, firstClear: false, next: null };
    res.total = res.base + res.goalBonus;
    if (won) {
      S.money += res.total;
      if (isLevel) {
        res.firstClear = !S.cleared[cfg.map][cfg.level];
        S.cleared[cfg.map][cfg.level] = true;
        if (cfg.level < 2) res.next = { map: cfg.map, level: cfg.level + 1 };
      }
    }
    return res;
  }
  // build a match config from a level / quick tile
  function levelCfg(mapId, i) { const L = RL.LEVELS[mapId][i]; return { mode: L.mode, bots: L.bots, map: mapId, level: i, label: 'LEVEL ' + (i + 1) + ' • ' + L.title + ' • ' + RL.MAP_BY_ID[mapId].name }; }
  function quickCfg(mapId, mode) { return { mode, map: mapId, label: 'QUICK MATCH • ' + mode + ' • ' + RL.MAP_BY_ID[mapId].name }; }
  return { bind, money, fmt, ownsCar, mapUnlocked, levelUnlocked, levelCleared, clearedCount, buyCar, buyMap, settle, levelCfg, quickCfg };
})();
