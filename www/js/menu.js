// Menus: main menu (with the 3D showcase backdrop), play screen (maps + career levels + quick match), car shop,
// garage, options, profile, news. Money / unlocks come from RL.Career.
window.RL = window.RL || {};
RL.Menu = (function () {
  const U = RL.U;
  const $ = (id) => document.getElementById(id);
  let game, screen = 'none', mainSel = 0, tileSel = 0, optionsReturn = null, mapSel = 0, shopSel = 0;
  let showcase = null, orbit = { a: 0.9, drag: false, lastX: 0, vel: 0 }, garageTeam = 0;
  const MAIN_ITEMS = [
    { id: 'play', label: 'PLAY', sub: 'CAREER • QUICK MATCH' }, { id: 'shop', label: 'CAR SHOP', cls: 'orange' }, { id: 'garage', label: 'GARAGE' }, { id: 'profile', label: 'PROFILE' }, { id: 'options', label: 'OPTIONS' }, { id: 'quit', label: 'QUIT' }
  ];
  // play screen: row 1 = the 3 career levels of the selected map, row 2 = quick matches on that map
  const TILES = [
    { level: 0, img: 0 }, { level: 1, img: 1 }, { level: 2, img: 2 },
    { quick: '1v1', small: 'DUEL', img: 3 }, { quick: '2v2', small: 'DOUBLES', img: 4 }, { quick: '3v3', small: 'STANDARD', img: 5 }
  ];
  const BOT_LABEL = { rookie: 'ROOKIE', pro: 'PRO', allstar: 'ALL-STAR' };
  const curMap = () => RL.MAPS[mapSel];
  function tileLocked(t) { const m = curMap(); return t.quick ? !RL.Career.mapUnlocked(m.id) : !RL.Career.levelUnlocked(m.id, t.level); }
  const _v = new THREE.Vector3(), _t = new THREE.Vector3();

  function init(g) {
    game = g;
    mapSel = Math.max(0, RL.MAPS.findIndex((m) => m.id === game.settings.lastMap));
    buildMain(); buildMapTabs(); buildTiles(); buildShop(); buildGarage(); buildOptions(); buildProfile();
    $('shopback').onclick = () => back();
    $('shopbuy').onclick = () => shopAction();
    window.addEventListener('keydown', (e) => { if (screen === 'play' && !searching && (e.code === 'KeyQ' || e.code === 'KeyE')) { setMap((mapSel + (e.code === 'KeyQ' ? RL.MAPS.length - 1 : 1)) % RL.MAPS.length); RL.Audio.ui('hover'); } });
    $('newstab').onclick = () => { RL.Audio.ui('select'); show('news'); };
    $('newsback').onclick = () => back();
    $('playback').onclick = () => back();
    $('garageback').onclick = () => back();
    $('optback').onclick = () => back();
    $('profback').onclick = () => back();
    $('findmatch').onclick = () => findMatch();
    $('skiptrack').onclick = () => { RL.Audio.ui('select'); $('trackname').textContent = RL.Audio.nextTrack(); };
    drawAvatar(); drawAlbum();
    // garage / shop orbit drag (mouse + touch)
    window.addEventListener('mousedown', (e) => { if ((screen === 'garage' || screen === 'shop') && !(e.target.closest && e.target.closest('.panel'))) { orbit.drag = true; orbit.lastX = e.clientX; } });
    window.addEventListener('mousemove', (e) => { if (orbit.drag) { const dx = e.clientX - orbit.lastX; orbit.lastX = e.clientX; orbit.a -= dx * 0.008; orbit.vel = -dx * 0.25; } });
    window.addEventListener('mouseup', () => { orbit.drag = false; });
    window.addEventListener('touchstart', (e) => { if ((screen === 'garage' || screen === 'shop') && e.touches.length === 1 && !(e.target.closest && e.target.closest('.panel'))) { orbit.drag = true; orbit.lastX = e.touches[0].clientX; } }, { passive: true });
    window.addEventListener('touchmove', (e) => { if (orbit.drag && e.touches.length === 1) { const dx = e.touches[0].clientX - orbit.lastX; orbit.lastX = e.touches[0].clientX; orbit.a -= dx * 0.008; orbit.vel = -dx * 0.25; } }, { passive: true });
    window.addEventListener('touchend', () => { orbit.drag = false; });
    window.addEventListener('touchcancel', () => { orbit.drag = false; });
  }
  function drawAvatar() {
    const c = $('avatar'), g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 96, 96); grd.addColorStop(0, '#1f7fff'); grd.addColorStop(1, '#0b2a6b');
    g.fillStyle = grd; g.fillRect(0, 0, 96, 96);
    g.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(i * 22 - 10, 0); g.lineTo(i * 22 + 30, 96); g.lineTo(i * 22 + 18, 96); g.lineTo(i * 22 - 22, 0); g.fill(); }
    U.drawEmblem(g, 48, 48, 0.5, '#ffffff');
    g.fillStyle = '#0b2a6b'; g.beginPath(); g.arc(48, 46, 15, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(48, 46, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#0b2a6b'; g.fillRect(38, 43, 20, 6);
  }
  function drawAlbum() {
    const c = $('albumart'), g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 96, 96); grd.addColorStop(0, '#0b2a6b'); grd.addColorStop(0.5, '#1f7fff'); grd.addColorStop(1, '#ff8a00');
    g.fillStyle = grd; g.fillRect(0, 0, 96, 96);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 60, 96, 36);
    g.fillStyle = '#fff'; g.font = 'italic 900 13px "Titillium Web", "Segoe UI Black", Impact, sans-serif'; g.fillText('TURBO', 8, 76); g.fillText('RADIO', 8, 90);
    g.beginPath(); g.arc(70, 30, 16, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.fillStyle = '#1f7fff'; g.beginPath(); g.arc(70, 30, 6, 0, Math.PI * 2); g.fill();
  }
  // ---------- main ----------
  function buildMain() {
    const list = $('mainlist'); list.innerHTML = '';
    MAIN_ITEMS.forEach((it, i) => {
      const el = document.createElement('div');
      el.className = 'mitem ' + (it.id === 'play' ? 'play' : '') + ' ' + (it.cls || '');
      el.innerHTML = it.id === 'play' ? `<span class="glyph a">A</span><div class="txt"><b>PLAY</b><small>${it.sub}</small></div>` : it.label;
      el.onmouseenter = () => { if (mainSel !== i) { mainSel = i; refreshMain(); RL.Audio.ui('hover'); } };
      el.onclick = () => { mainSel = i; activateMain(); };
      list.appendChild(el);
    });
    refreshMain();
  }
  function refreshMain() { [...$('mainlist').children].forEach((el, i) => el.classList.toggle('sel', i === mainSel)); }
  function activateMain() {
    const it = MAIN_ITEMS[mainSel]; RL.Audio.ui('select');
    switch (it.id) {
      case 'play': show('play'); break;
      case 'garage': show('garage'); break;
      case 'profile': show('profile'); break;
      case 'options': show('options'); break;
      case 'shop': show('shop'); break;
      case 'quit': quit(); break;
    }
  }
  function quit() {
    document.body.innerHTML = '<div style="position:fixed;inset:0;background:#05080f;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font);color:#fff"><div style="font-size:64px;font-weight:900;font-style:italic">THANKS FOR PLAYING</div><div style="margin-top:12px;color:#9fb8ff;letter-spacing:4px;font-weight:700">YOU CAN CLOSE THIS TAB</div></div>';
    try { window.close(); } catch (e) { }
  }
  // ---------- wallet / toast ----------
  function refreshWallet() { $('wallet').innerHTML = '<span>MONEY</span>' + RL.Career.fmt(RL.Career.money()); }
  let toastT = null;
  function toast(msg, bad) {
    const t = $('toast'); t.textContent = msg; t.className = bad ? 'bad' : ''; void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }
  // ---------- play ----------
  function buildMapTabs() {
    const wrap = $('maptabs'); wrap.innerHTML = '';
    RL.MAPS.forEach((m, i) => {
      const el = document.createElement('div'); el.className = 'mapcard'; el.style.background = `linear-gradient(120deg, ${m.bg[0]}, ${m.bg[1]})`;
      el.onclick = () => { if (mapSel !== i) { setMap(i); RL.Audio.ui('select'); } else if (!RL.Career.mapUnlocked(m.id)) buyMap(m); };
      el.onmouseenter = () => RL.Audio.ui('hover');
      wrap.appendChild(el);
    });
    refreshMapTabs();
  }
  function refreshMapTabs() {
    [...$('maptabs').children].forEach((el, i) => {
      const m = RL.MAPS[i]; const open = RL.Career.mapUnlocked(m.id);
      const done = RL.LEVELS[m.id].filter((_, k) => RL.Career.levelCleared(m.id, k)).length;
      el.classList.toggle('sel', i === mapSel); el.classList.toggle('locked', !open);
      el.innerHTML = `<div class="mn">${m.name}</div><div class="ms">${m.sub}${open ? ' • ' + done + '/3 LEVELS CLEARED' : ''}</div>` +
        (open ? '' : `<div class="buy">🔒 UNLOCK ${RL.Career.fmt(m.price)}</div>`);
    });
  }
  function setMap(i) { mapSel = i; refreshMapTabs(); buildTiles(); }
  function buyMap(m) {
    if (RL.Career.buyMap(m.id)) { game.saveSettings(); RL.Audio.ui('found'); toast(m.name + ' UNLOCKED!'); refreshWallet(); refreshMapTabs(); buildTiles(); }
    else { RL.Audio.ui('back'); toast('NOT ENOUGH MONEY — NEED ' + RL.Career.fmt(m.price - RL.Career.money()) + ' MORE. WIN MATCHES TO EARN IT.', true); }
  }
  function buildTiles() {
    const wrap = $('tiles'); wrap.innerHTML = '';
    const m = curMap();
    TILES.forEach((t, i) => {
      const locked = tileLocked(t);
      const el = document.createElement('div'); el.className = 'tile' + (locked ? ' locked' : '') + (i === tileSel ? ' sel' : '');
      let big, small, reward, done = false;
      if (t.quick) { big = t.quick; small = 'QUICK • ' + t.small; reward = RL.QUICK_REWARD; }
      else { const L = RL.LEVELS[m.id][t.level]; big = 'LEVEL ' + (t.level + 1); small = L.mode + ' • ' + BOT_LABEL[L.bots] + ' BOTS'; reward = L.reward; done = RL.Career.levelCleared(m.id, t.level); }
      el.innerHTML = `<div class="shade"></div><div class="badge ${t.quick ? 'q' : ''}">${t.quick ? 'QUICK MATCH' : 'CAREER'}</div>` +
        `<div class="chip">${RL.Career.fmt(reward)}</div>${done ? '<div class="done">✓ CLEARED</div>' : ''}<div class="lbl"><b>${big}</b><small>${small}</small></div>`;
      if (game.tileImgs && game.tileImgs[t.img]) el.style.backgroundImage = `url(${game.tileImgs[t.img]})`;
      el.onmouseenter = () => { if (tileSel !== i) { tileSel = i; refreshTiles(); RL.Audio.ui('hover'); } };
      el.onclick = () => { tileSel = i; refreshTiles(); findMatch(); };
      wrap.appendChild(el);
    });
    refreshTiles();
  }
  function setTileImages(urls) { game.tileImgs = urls; buildTiles(); }
  function tileInfo() {
    const t = TILES[tileSel], m = curMap();
    if (!RL.Career.mapUnlocked(m.id)) return `<b>${m.name}</b> is locked. Unlock it for <b>${RL.Career.fmt(m.price)}</b> — click the map card. You have ${RL.Career.fmt(RL.Career.money())}.`;
    if (t.quick) return `<b>QUICK MATCH ${t.quick}</b> on ${m.name} • bots: ${BOT_LABEL[game.settings.bots]} (Options) • win to earn <b>${RL.Career.fmt(RL.QUICK_REWARD)}</b> + ${RL.Career.fmt(RL.GOAL_BONUS)} per goal`;
    const L = RL.LEVELS[m.id][t.level];
    if (tileLocked(t)) return `<b>LEVEL ${t.level + 1} — ${L.title}</b> is locked. Win LEVEL ${t.level} first.`;
    return `<b>LEVEL ${t.level + 1} — ${L.title}</b> • ${L.mode} vs ${BOT_LABEL[L.bots]} bots • win to earn <b>${RL.Career.fmt(L.reward)}</b> + ${RL.Career.fmt(RL.GOAL_BONUS)} per goal`;
  }
  function refreshTiles() { [...$('tiles').children].forEach((el, i) => el.classList.toggle('sel', i === tileSel)); $('tileinfo').innerHTML = tileInfo(); }
  let searching = false;
  function findMatch() {
    const t = TILES[tileSel], m = curMap();
    if (searching) return;
    if (tileLocked(t)) { RL.Audio.ui('back'); if (!RL.Career.mapUnlocked(m.id)) buyMap(m); else toast('WIN LEVEL ' + t.level + ' TO UNLOCK THIS LEVEL', true); return; }
    const cfg = t.quick ? RL.Career.quickCfg(m.id, t.quick) : RL.Career.levelCfg(m.id, t.level);
    searching = true; RL.Audio.ui('select');
    const s = $('searching'); s.classList.remove('hidden');
    $('searchtext').textContent = t.quick ? 'SEARCHING FOR MATCH' : 'LEVEL ' + (t.level + 1) + ' — ' + RL.LEVELS[m.id][t.level].title;
    $('searchsub').textContent = m.name + ' • ' + cfg.mode;
    $('tiles').style.opacity = '0.25';
    setTimeout(() => { $('searchtext').textContent = 'MATCH FOUND'; $('searchsub').textContent = 'JOINING • ' + m.name; RL.Audio.ui('found'); }, 1100);
    setTimeout(() => { s.classList.add('hidden'); $('tiles').style.opacity = ''; searching = false; game.startMatch(cfg); }, 2000);
  }
  // ---------- car shop ----------
  function statPct(v) { return Math.max(8, Math.min(100, 55 + (v - 1) * 450)); }
  function buildShop() {
    const list = $('shoplist'); list.innerHTML = '';
    RL.CARS.forEach((c, i) => {
      const el = document.createElement('div'); el.className = 'mitem shopitem';
      el.onclick = () => { if (shopSel !== i) { shopSel = i; refreshShop(); RL.Audio.ui('select'); } };
      el.onmouseenter = () => RL.Audio.ui('hover');
      list.appendChild(el);
    });
  }
  function refreshShop(rebuild) {
    const prevBody = showcase && showcase.bodyId;
    [...$('shoplist').children].forEach((el, i) => {
      const c = RL.CARS[i]; const own = RL.Career.ownsCar(c.id); const eq = game.settings.body === c.id;
      el.classList.toggle('sel', i === shopSel);
      el.innerHTML = `<span>${c.name}</span><span class="pr ${own ? 'own' : ''}">${eq ? 'EQUIPPED' : own ? 'OWNED' : RL.Career.fmt(c.price)}</span>`;
    });
    const c = RL.CARS[shopSel]; const own = RL.Career.ownsCar(c.id); const eq = game.settings.body === c.id; const sp = c.spec;
    const bar = (lbl, v) => `<div class="stat"><span>${lbl}</span><div class="sb"><i style="width:${statPct(v)}%"></i></div></div>`;
    const canBuy = RL.Career.money() >= c.price;
    $('shopinfo').innerHTML = `<h2>${c.name}</h2><p>${c.desc}</p>` + bar('TOP SPEED', sp.maxV) + bar('ACCELERATION', sp.drive) + bar('BOOST POWER', sp.boostAcc) + bar('BOOST ECONOMY', 1 / sp.boostUse) +
      `<button class="btn ${own ? '' : 'orange'} ${!own && !canBuy ? 'dis' : ''}" id="shopbtn"><span>${eq ? 'EQUIPPED' : own ? 'EQUIP' : 'BUY ' + RL.Career.fmt(c.price)}</span></button>` +
      (!own && !canBuy ? `<div class="need">NEED ${RL.Career.fmt(c.price - RL.Career.money())} MORE — WIN MATCHES TO EARN MONEY</div>` : '');
    $('shopbtn').onclick = () => shopAction();
    $('shopbuy').innerHTML = `<span class="glyph a">A</span> ${eq ? 'EQUIPPED' : own ? 'EQUIP' : 'BUY'}`;
    if (rebuild !== false && prevBody !== c.id) { rebuildShowcase(c.id); if (showcase) { showcase.reset(0, 0, 0, 100); showcase.syncVisual(1); } }
    refreshWallet();
  }
  function shopAction() {
    const c = RL.CARS[shopSel];
    if (RL.Career.ownsCar(c.id)) {
      if (game.settings.body !== c.id) { game.settings.body = c.id; game.saveSettings(); RL.Audio.ui('select'); toast(c.name + ' EQUIPPED'); }
    } else if (RL.Career.buyCar(c.id)) {
      game.settings.body = c.id; game.saveSettings(); RL.Audio.ui('found'); toast('YOU BOUGHT THE ' + c.name + '!');
    } else { RL.Audio.ui('back'); toast('NOT ENOUGH MONEY FOR THE ' + c.name, true); }
    refreshShop(false); buildGarage();
  }
  // ---------- garage ----------
  function buildGarage() {
    const bl = $('bodylist'); bl.innerHTML = '';
    for (const id of game.settings.ownedCars) {
      const el = document.createElement('div'); el.className = 'mitem'; el.textContent = RL.CAR_BY_ID[id].name; el.dataset.id = id;
      el.onclick = () => { RL.Audio.ui('select'); game.settings.body = id; game.saveSettings(); refreshGarage(); rebuildShowcase(); };
      el.onmouseenter = () => RL.Audio.ui('hover');
      bl.appendChild(el);
    }
    $('teamtabs').querySelectorAll('.tab').forEach((tab) => { tab.onclick = () => { RL.Audio.ui('select'); garageTeam = +tab.dataset.team; refreshGarage(); rebuildShowcase(); }; });
    refreshGarage();
  }
  function swatches(id, list, key) {
    const wrap = $(id); wrap.innerHTML = '';
    const cur = game.settings.colors[garageTeam][key];
    for (const hex of list) {
      const el = document.createElement('div'); el.className = 'sw' + (hex === cur ? ' sel' : ''); el.style.background = hex;
      el.onclick = () => { RL.Audio.ui('select'); game.settings.colors[garageTeam][key] = hex; game.saveSettings(); refreshGarage(); if (showcase) showcase.model.setColors(game.settings.colors[garageTeam]); };
      el.onmouseenter = () => RL.Audio.ui('hover');
      wrap.appendChild(el);
    }
  }
  function refreshGarage() {
    [...$('bodylist').children].forEach((el) => el.classList.toggle('sel', el.dataset.id === game.settings.body));
    $('teamtabs').querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('sel', +tab.dataset.team === garageTeam));
    swatches('swPrimary', garageTeam === 0 ? RL.PALETTE.blue : RL.PALETTE.orange, 'primary');
    swatches('swAccent', RL.PALETTE.accent, 'accent');
    swatches('swWheel', RL.PALETTE.wheel, 'wheel');
  }
  // ---------- options ----------
  const OPTS = [
    { h: 'CAMERA' },
    { k: 'camera.fov', label: 'FIELD OF VIEW', min: 60, max: 110, step: 5 },
    { k: 'camera.distance', label: 'DISTANCE', min: 100, max: 400, step: 10 },
    { k: 'camera.height', label: 'HEIGHT', min: 40, max: 200, step: 10 },
    { k: 'camera.angle', label: 'ANGLE', min: -15, max: 0, step: 1 },
    { k: 'camera.stiffness', label: 'STIFFNESS', min: 0, max: 1, step: 0.05 },
    { k: 'camera.swivel', label: 'SWIVEL SPEED', min: 1, max: 10, step: 0.5 },
    { h: 'GAMEPLAY' },
    { k: 'bots', label: 'BOT DIFFICULTY', seg: [['rookie', 'ROOKIE'], ['pro', 'PRO'], ['allstar', 'ALL-STAR']] },
    { k: 'matchLength', label: 'MATCH LENGTH', seg: [[180, '3 MIN'], [300, '5 MIN'], [420, '7 MIN']] },
    { k: 'touchControls', label: 'TOUCH CONTROLS', seg: [['auto', 'AUTO'], ['on', 'ON'], ['off', 'OFF']] },
    { h: 'AUDIO' },
    { k: 'audio.master', label: 'MASTER VOLUME', min: 0, max: 1, step: 0.05 },
    { k: 'audio.sfx', label: 'GAMEPLAY VOLUME', min: 0, max: 1, step: 0.05 },
    { k: 'audio.music', label: 'MUSIC VOLUME', min: 0, max: 1, step: 0.05 },
    { k: 'musicInMatch', label: 'MUSIC DURING MATCH', seg: [[false, 'OFF'], [true, 'ON']] },
    { h: 'VIDEO' },
    { k: 'video.quality', label: 'QUALITY', seg: [['auto', 'AUTO'], ['low', 'PERFORMANCE'], ['medium', 'BALANCED'], ['high', 'QUALITY']] },
    { k: 'video.showFps', label: 'SHOW FPS', seg: [[false, 'OFF'], [true, 'ON']] },
    { h: 'CONTROLS' },
    { ctrl: [['THROTTLE / REVERSE', 'W / S'], ['STEER', 'A / D'], ['JUMP', 'SPACE or RMB'], ['BOOST', 'SHIFT or LMB'], ['POWERSLIDE / AIR ROLL', 'CTRL (hold)'], ['AIR ROLL LEFT / RIGHT', 'Q / E'], ['BALL CAM', 'Y or C'], ['REAR VIEW', 'R (hold)'], ['SCOREBOARD', 'TAB (hold)'], ['PAUSE', 'ESC'], ['GAMEPAD', 'A jump • B boost • X slide • Y ball cam • RT/LT drive'], ['MOBILE / TOUCH', 'Left joystick drive/steer/air • Right buttons BOOST / JUMP / DRIFT']] }
  ];
  const get = (obj, path) => path.split('.').reduce((o, k) => o[k], obj);
  const set = (obj, path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], obj)[last] = v; };
  function buildOptions() {
    const p = $('optpanel'); p.innerHTML = '';
    for (const o of OPTS) {
      if (o.h) { const h = document.createElement('h3'); h.textContent = o.h; p.appendChild(h); continue; }
      if (o.ctrl) { for (const [a, b] of o.ctrl) { const r = document.createElement('div'); r.className = 'orow'; r.innerHTML = `<div>${a}</div><div style="color:#dbe4f2;font-weight:700">${b}</div><div></div>`; p.appendChild(r); } continue; }
      const r = document.createElement('div'); r.className = 'orow';
      const cur = get(game.settings, o.k);
      if (o.seg) {
        r.innerHTML = `<div>${o.label}</div><div class="seg"></div><div></div>`;
        const seg = r.querySelector('.seg');
        for (const [val, lbl] of o.seg) { const d = document.createElement('div'); d.textContent = lbl; d.classList.toggle('sel', val === cur); d.onclick = () => { RL.Audio.ui('select'); set(game.settings, o.k, val); [...seg.children].forEach((c) => c.classList.remove('sel')); d.classList.add('sel'); game.applySettings(o.k); game.saveSettings(); }; seg.appendChild(d); }
      } else {
        r.innerHTML = `<div>${o.label}</div><input type="range" min="${o.min}" max="${o.max}" step="${o.step}" value="${cur}"><div class="val">${fmtVal(o, cur)}</div>`;
        const inp = r.querySelector('input'); const val = r.querySelector('.val');
        inp.oninput = () => { const v = parseFloat(inp.value); set(game.settings, o.k, v); val.textContent = fmtVal(o, v); game.applySettings(o.k); };
        inp.onchange = () => { game.saveSettings(); RL.Audio.ui('hover'); };
      }
      p.appendChild(r);
    }
  }
  function fmtVal(o, v) { if (o.step < 1) return Math.round(v * 100) / 100; return v; }
  // ---------- profile ----------
  function buildProfile() {
    const inp = $('nameinput'); inp.value = game.settings.name;
    inp.onchange = () => { const v = inp.value.trim().slice(0, 16) || 'ROOKIE'; game.settings.name = v; inp.value = v; game.saveSettings(); refreshCard(); };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') inp.blur(); };
    inp.onkeyup = (e) => e.stopPropagation();
  }
  function refreshProfile() {
    const st = game.settings.stats;
    $('profstats').innerHTML = `<div><b>${st.matches}</b><span>MATCHES</span></div><div><b>${st.wins}</b><span>WINS</span></div><div><b>${st.goals}</b><span>GOALS</span></div><div><b>${st.saves}</b><span>SAVES</span></div><div><b>${st.shots}</b><span>SHOTS</span></div><div><b>${game.settings.level}</b><span>LEVEL</span></div><div><b>${RL.Career.fmt(RL.Career.money())}</b><span>MONEY</span></div><div><b>${RL.Career.clearedCount()}/6</b><span>LEVELS CLEARED</span></div><div><b>${game.settings.ownedCars.length}/${RL.CARS.length}</b><span>CARS OWNED</span></div>`;
  }
  function refreshCard() {
    $('pname').textContent = game.settings.name.toUpperCase(); $('lvl').textContent = game.settings.level;
    $('xpbar').style.width = Math.round((game.settings.xp % 1000) / 10) + '%';
    $('trackname').textContent = RL.Audio.trackName();
  }
  // ---------- showcase car (menu backdrop / garage) ----------
  function rebuildShowcase(bodyId) {
    if (showcase) { game.scene.remove(showcase.group); showcase.model.dispose(); showcase = null; }
    const team = screen === 'garage' ? garageTeam : 0;
    const colors = game.settings.colors[team];
    showcase = new RL.Car({ team, name: 'showcase', body: bodyId || game.settings.body, colors });
    if (game.env) showcase.setEnv(game.env);
    showcase.reset(-900, -2500, 0.75, 100); showcase.syncVisual(1);
    game.scene.add(showcase.group);
  }
  function removeShowcase() { if (showcase) { game.scene.remove(showcase.group); showcase.model.dispose(); showcase = null; } }
  // ---------- navigation ----------
  function show(name) {
    if (screen === 'none') blockInput(0.35);
    screen = name;
    $('menu').classList.remove('hidden');
    for (const id of ['play', 'shop', 'garage', 'options', 'profile', 'news']) $(id).classList.toggle('hidden', id !== name);
    refreshWallet();
    $('mainmenu').classList.toggle('hidden', name !== 'main');
    if (name === 'main') { refreshCard(); if (!showcase) rebuildShowcase(); showcase.reset(-900, -2500, 0.75, 100); showcase.syncVisual(1); }
    if (name === 'garage') { rebuildShowcase(); showcase.reset(0, 0, 0, 100); showcase.syncVisual(1); orbit.a = 0.9; refreshGarage(); }
    if (name === 'shop') { shopSel = Math.max(0, RL.CARS.findIndex((c) => c.id === game.settings.body)); if (showcase) { game.scene.remove(showcase.group); showcase.model.dispose(); showcase = null; } refreshShop(); orbit.a = 0.9; }
    if (name === 'play') { refreshMapTabs(); buildTiles(); }
    if (name === 'profile') refreshProfile();
    if (name === 'options') buildOptions();
    game.camera.mode = 'free';
  }
  function hide() { screen = 'none'; $('menu').classList.add('hidden'); removeShowcase(); }
  function back() {
    RL.Audio.ui('back');
    if (screen === 'options' && optionsReturn) { const cb = optionsReturn; optionsReturn = null; hide(); cb(); return; }
    if (screen !== 'main') { if (screen === 'shop' || screen === 'garage') rebuildShowcase(); show('main'); }
  }
  function openOptions(returnCb) { optionsReturn = returnCb; show('options'); }
  let blockUntil = 0;
  function blockInput(sec) { blockUntil = performance.now() + sec * 1000; }
  function update(dt, time) {
    if (screen === 'none') return;
    const inp = RL.Input;
    if (performance.now() < blockUntil) inp.clearEdges();
    if (screen === 'main') {
      if (inp.consume('menuUp')) { mainSel = (mainSel + MAIN_ITEMS.length - 1) % MAIN_ITEMS.length; refreshMain(); RL.Audio.ui('hover'); }
      if (inp.consume('menuDown')) { mainSel = (mainSel + 1) % MAIN_ITEMS.length; refreshMain(); RL.Audio.ui('hover'); }
      if (inp.consume('menuAccept')) activateMain();
      inp.consume('menuBack');
    } else if (screen === 'shop') {
      if (inp.consume('menuUp')) { shopSel = (shopSel + RL.CARS.length - 1) % RL.CARS.length; refreshShop(); RL.Audio.ui('hover'); }
      if (inp.consume('menuDown')) { shopSel = (shopSel + 1) % RL.CARS.length; refreshShop(); RL.Audio.ui('hover'); }
      if (inp.consume('menuAccept')) shopAction();
      if (inp.consume('menuBack')) back();
      inp.consume('menuLeft'); inp.consume('menuRight');
    } else if (screen === 'play') {
      if (inp.consume('menuLeft')) { tileSel = (tileSel + 5) % 6; refreshTiles(); RL.Audio.ui('hover'); }
      if (inp.consume('menuRight')) { tileSel = (tileSel + 1) % 6; refreshTiles(); RL.Audio.ui('hover'); }
      if (inp.consume('menuUp') || inp.consume('menuDown')) { tileSel = (tileSel + 3) % 6; refreshTiles(); RL.Audio.ui('hover'); }
      if (inp.consume('menuAccept')) findMatch();
      if (inp.consume('menuBack') && !searching) back();
    } else {
      if (inp.consume('menuBack')) back();
      inp.consume('menuAccept'); inp.consume('menuUp'); inp.consume('menuDown'); inp.consume('menuLeft'); inp.consume('menuRight');
    }
    // 3D backdrop camera
    const cam = game.camera;
    if ((screen === 'garage' || screen === 'shop') && showcase) {
      if (!orbit.drag) { orbit.a += (0.12 + orbit.vel * 0.02) * dt; orbit.vel *= Math.exp(-dt * 3); }
      const c = showcase.pos;
      _v.set(c.x + Math.cos(orbit.a) * 330, c.y + Math.sin(orbit.a) * 330, c.z + 105); _t.set(c.x, c.y, c.z + 22);
      cam.setFree(_v, _t, 12, dt);
    } else if (showcase) {
      // main menu: 3/4 front-right view, car sitting right of center; subtle drift
      const c = showcase.pos; const f = showcase.fwd;
      const ang = Math.atan2(f.y, f.x) - 0.78 + Math.sin(time * 0.15) * 0.04;
      _v.set(c.x + Math.cos(ang) * 330, c.y + Math.sin(ang) * 330, c.z + 78 + Math.sin(time * 0.2) * 4);
      // look left of the car (camera-left = (sin a, -cos a)) so the car sits right of center
      const lx = Math.sin(ang), ly = -Math.cos(ang);
      _t.set(c.x + lx * 48, c.y + ly * 48, c.z + 40);
      cam.setFree(_v, _t, 6, dt);
    }
    cam.cam.fov = 40; cam.cam.updateProjectionMatrix();
    cam.finalize(dt);
    if (showcase) { showcase.syncVisual(dt); }
  }
  return { init, show, hide, update, back, openOptions, setTileImages, refreshCard, toast, blockInput, get screen() { return screen; }, get showcase() { return showcase; } };
})();
