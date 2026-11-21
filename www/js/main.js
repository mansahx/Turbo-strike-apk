// Bootstrap: renderer, scene, lighting, arena + stadium, environment reflections, game state, main loop.
window.RL = window.RL || {};
RL.Game = (function () {
  const U = RL.U, C = RL.C;
  const game = {
    renderer: null, scene: null, camera: null, arena: null, stadium: null, ball: null, env: null,
    settings: null, match: null, state: 'boot', time: 0, paused: false, quality: 'high', fps: 0, sunDir: new THREE.Vector3(-0.48, -0.36, 0.8).normalize()
  };
  const DEFAULTS = {
    name: 'ROOKIE', level: 1, xp: 0, body: 'octane',
    money: 0, ownedCars: ['octane', 'fennec'], unlockedMaps: ['greenfield'], cleared: { greenfield: [false, false, false], neon: [false, false, false] }, lastMap: 'greenfield',
    colors: { 0: { primary: '#3b1f8c', accent: '#cfd4dc', wheel: '#ff2a2a' }, 1: { primary: '#ff8a00', accent: '#1a1a1e', wheel: '#cfd4dc' } },
    camera: { fov: 110, distance: 270, height: 110, angle: -3, stiffness: 0.45, swivel: 5, transition: 1.2 },
    audio: { master: 0.8, sfx: 0.9, music: 0.5 }, musicInMatch: false,
    video: { quality: 'auto', showFps: false },
    bots: 'pro', matchLength: 300, touchControls: 'auto',
    stats: { matches: 0, wins: 0, goals: 0, saves: 0, shots: 0 }
  };
  function loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('turbostrike.save') || '{}'); } catch (e) { }
    const out = JSON.parse(JSON.stringify(DEFAULTS));
    const merge = (dst, src) => { for (const k in src) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k]) merge(dst[k], src[k]); else if (src[k] !== undefined) dst[k] = src[k]; } };
    merge(out, s);
    return out;
  }
  function saveSettings() { try { localStorage.setItem('turbostrike.save', JSON.stringify(game.settings)); } catch (e) { } }
  function applySettings(key) {
    const s = game.settings;
    Object.assign(game.camera.settings, s.camera); game.camera.applyFov();
    RL.Audio.setVolumes(s.audio);
    document.getElementById('fps').classList.toggle('hidden', !s.video.showFps);
    RL.HUD.setTouchEnabled(s.touchControls);
    if (key === 'video.quality' && s.video.quality !== 'auto' && s.video.quality !== game.quality) setQuality(s.video.quality);
    if (key === 'musicInMatch' && game.state === 'match') { if (s.musicInMatch) RL.Audio.startMusic(); else RL.Audio.stopMusic(); }
  }
  function pixelRatioFor(q) {
    const dpr = window.devicePixelRatio || 1;
    if (RL.IS_MOBILE) {
      if (q === 'high') return Math.min(dpr, 1.25);
      if (q === 'medium') return Math.min(dpr, 0.9);
      return Math.min(dpr, 0.72);
    }
    if (q === 'high') return Math.min(dpr, 1.5);
    if (q === 'medium') return Math.min(dpr, game.iGPU ? 0.9 : 1.0);
    return Math.min(dpr, 0.75);
  }
  function setQuality(q) {
    if (q === 'auto') q = game.quality;
    game.quality = q;
    const r = game.renderer;
    r.setPixelRatio(pixelRatioFor(q));
    const useShadows = q !== 'low';
    r.shadowMap.enabled = useShadows;
    r.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : (RL.IS_MOBILE ? THREE.BasicShadowMap : THREE.PCFShadowMap);
    const size = q === 'high' ? (RL.IS_MOBILE ? 1024 : 2048) : (RL.IS_MOBILE ? 512 : 1024);
    const crowdScale = q === 'low' ? (RL.IS_MOBILE ? 0 : 0.25) : (q === 'medium' ? (RL.IS_MOBILE ? 0.35 : 1) : (RL.IS_MOBILE ? 0.6 : 1));
    if (game.stadium) game.stadium.group.traverse((o) => { if (o.isInstancedMesh && o.userData.crowd) { o.count = Math.floor(o.userData.full * crowdScale); o.visible = o.count > 0; } });
    if (useShadows && game.sun.shadow.mapSize.x !== size) { game.sun.shadow.mapSize.set(size, size); if (game.sun.shadow.map) { game.sun.shadow.map.dispose(); game.sun.shadow.map = null; } }
    game.sun.castShadow = useShadows;
    RL.FX.setQuality(q, r);
    onResize();
  }
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    game.renderer.setSize(w, h, false);
    game.camera.setAspect(w / h);
    RL.FX.resizeBloom(game.renderer);
  }
  // ---------- boot ----------
  const bootbar = () => document.getElementById('bootbar');
  function progress(p) { const b = bootbar(); if (b) b.style.width = Math.round(p * 100) + '%'; }
  const defer = (fn) => new Promise((res) => setTimeout(() => { fn(); res(); }, 16));
  async function init() {
    game.settings = loadSettings();
    RL.Career.bind(game.settings);
    game.quality = game.settings.video.quality === 'auto' ? 'high' : game.settings.video.quality;
    THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
    const canvas = document.getElementById('gl');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, game.quality === 'high' ? 1.5 : 1.0));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    game.renderer = renderer;
    if (game.settings.video.quality === 'auto') {
      // integrated GPUs start on the balanced preset
      let gpu = ''; try { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''; } catch (e) { }
      game.gpuName = gpu;
      game.iGPU = /intel|uhd|iris|hd graphics|apple|adreno|mali|swiftshader|llvmpipe/i.test(gpu) || /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
      game.quality = game.iGPU ? 'medium' : 'high';
      renderer.setPixelRatio(pixelRatioFor(game.quality));
      renderer.shadowMap.type = game.quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    }
    const scene = new THREE.Scene(); game.scene = scene;
    scene.fog = new THREE.FogExp2(0xc9dcf2, 0.000015);
    // lights
    const sun = new THREE.DirectionalLight(0xfff1dc, 3.1); sun.position.copy(game.sunDir).multiplyScalar(20000); sun.castShadow = game.quality !== 'low';
    const shSize = game.quality === 'high' ? (RL.IS_MOBILE ? 1024 : 2048) : (RL.IS_MOBILE ? 512 : 1024);
    renderer.shadowMap.enabled = game.quality !== 'low';
    renderer.shadowMap.type = game.quality === 'high' ? THREE.PCFSoftShadowMap : (RL.IS_MOBILE ? THREE.BasicShadowMap : THREE.PCFShadowMap);
    sun.shadow.mapSize.set(shSize, shSize);
    sun.shadow.camera.near = 8000; sun.shadow.camera.far = 32000; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 3;
    sun.shadow.camera.left = -3000; sun.shadow.camera.right = 3000; sun.shadow.camera.top = 3000; sun.shadow.camera.bottom = -3000;
    scene.add(sun); scene.add(sun.target); game.sun = sun;
    game.hemi = new THREE.HemisphereLight(0xa9c8ff, 0x4f6b3a, 0.75); scene.add(game.hemi);
    game.amb = new THREE.AmbientLight(0xffffff, 0.22); scene.add(game.amb);
    game.camera = new RL.Camera(window.innerWidth / window.innerHeight);
    Object.assign(game.camera.settings, game.settings.camera); game.camera.applyFov();
    progress(0.1);
    const bt = { start: performance.now() }; game.bootTimes = bt;
    await defer(() => { game.stadium = RL.Stadium.build(scene, game.sunDir); bt.stadium = performance.now() - bt.start; if (game.quality !== 'high' || RL.IS_MOBILE) { const cs = game.quality === 'low' ? (RL.IS_MOBILE ? 0 : 0.25) : (RL.IS_MOBILE ? 0.35 : 1); game.stadium.group.traverse((o) => { if (o.isInstancedMesh && o.userData.crowd) { o.count = Math.floor(o.userData.full * cs); o.visible = o.count > 0; } }); } });
    progress(0.35);
    const cubeSize = RL.IS_MOBILE ? 128 : 256;
    await defer(() => {
      // first environment capture (stadium only) so the arena glass and walls can reflect it
      const rt = new THREE.WebGLCubeRenderTarget(cubeSize, { type: THREE.HalfFloatType });
      const cc = new THREE.CubeCamera(50, 80000, rt); cc.position.set(0, 0, 400);
      cc.update(renderer, scene);
      game.envCube = rt.texture; game.envCubeRT = rt;
      bt.env0 = performance.now() - bt.start;
    });
    progress(0.5);
    await defer(() => { game.arena = RL.Arena.build(scene, game.envCube); bt.arena = performance.now() - bt.start; });
    progress(0.7);
    await defer(() => {
      // full environment (arena included) for car / ball reflections
      const rt = new THREE.WebGLCubeRenderTarget(cubeSize, { type: THREE.HalfFloatType });
      const cc = new THREE.CubeCamera(50, 80000, rt); cc.position.set(0, 0, 400);
      const glass = game.arena.volume; const gv = glass.visible; glass.visible = true;
      cc.update(renderer, scene);
      glass.visible = gv;
      const pm = new THREE.PMREMGenerator(renderer);
      game.env = pm.fromCubemap(rt.texture).texture;
      scene.environment = game.env;
      pm.dispose(); rt.dispose();
      game.mapId = 'greenfield';
      bt.env = performance.now() - bt.start;
    });
    progress(0.85);
    await defer(() => {
      game.ball = new RL.Ball(scene);
      RL.FX.init(scene, game.quality, renderer); RL.FX.setPads(game.arena.pads);
      RL.HUD.init(); RL.HUD.setTouchEnabled(game.settings.touchControls); RL.Input.init(); RL.Audio.ensure();
      RL.Menu.init(game);
      RL.Menu.setTileImages(makeTileImages());
      bt.tiles = performance.now() - bt.start;
      // warm up shaders while the loading screen is still up
      const c0 = performance.now(); renderer.compile(scene, game.camera.cam); bt.compile = performance.now() - c0; bt.total = performance.now() - bt.start;
      console.info('boot ms', JSON.stringify(bt));
    });
    progress(1);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
    document.getElementById('fps').classList.toggle('hidden', !game.settings.video.showFps);
    // start
    const params = new URLSearchParams(location.search);
    const autoMatch = params.get('match');
    const boot = document.getElementById('boot');
    const teamIntro = document.getElementById('team-intro');
    const showTeamIntro = () => {
      if (!teamIntro) { toMenu(); return; }
      game.state = 'intro';
      RL.Audio.startMusic();
      const tih = document.getElementById('tihint');
      if (tih && RL.HUD.isTouchDevice()) tih.textContent = 'TAP ANYWHERE TO CONTINUE';
      teamIntro.classList.remove('hidden');
      requestAnimationFrame(() => teamIntro.classList.add('show'));
      let done = false, autoTimer = null, gpTimer = null;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(autoTimer); clearInterval(gpTimer);
        window.removeEventListener('keydown', finish);
        window.removeEventListener('mousedown', finish);
        window.removeEventListener('touchstart', finish);
        window.removeEventListener('pointerdown', finish);
        teamIntro.classList.remove('show');
        setTimeout(() => teamIntro.remove(), 480);
        toMenu();
        setTimeout(() => RL.Input.clearEdges(), 0);
      };
      // short delay so the key/tap that dismissed boot doesn't instantly skip the team intro
      setTimeout(() => {
        if (done) return;
        window.addEventListener('keydown', finish);
        window.addEventListener('mousedown', finish);
        window.addEventListener('touchstart', finish, { passive: true });
        window.addEventListener('pointerdown', finish);
        gpTimer = setInterval(() => { const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of pads) if (p && p.buttons.some((b) => b.pressed)) finish(); }, 200);
      }, 350);
      autoTimer = setTimeout(finish, 6500);
    };
    const go = () => {
      if (game.state !== 'boot') return;
      RL.Audio.unlock(); RL.Audio.setVolumes(game.settings.audio);
      boot.style.transition = 'opacity .5s'; boot.style.opacity = '0'; setTimeout(() => boot.remove(), 550);
      if (autoMatch) { if (teamIntro) teamIntro.remove(); startMatch({ mode: autoMatch, botPlayer: params.get('botplayer') === '1', map: params.get('map') || undefined }); }
      else showTeamIntro();
      setTimeout(() => RL.Input.clearEdges(), 0);
    };
    if (autoMatch) go();
    else {
      const bh = document.getElementById('boothint');
      if (bh) { if (RL.HUD.isTouchDevice()) bh.textContent = 'TAP ANYWHERE TO START'; bh.classList.add('show'); }
      const once = () => {
        window.removeEventListener('keydown', once);
        window.removeEventListener('mousedown', once);
        window.removeEventListener('touchstart', once);
        window.removeEventListener('pointerdown', once);
        go();
      };
      window.addEventListener('keydown', once);
      window.addEventListener('mousedown', once);
      window.addEventListener('touchstart', once, { passive: true });
      window.addEventListener('pointerdown', once);
      // gamepad start
      const gpPoll = setInterval(() => { const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of pads) if (p && p.buttons.some((b) => b.pressed)) { clearInterval(gpPoll); once(); } }, 200);
    }
    requestAnimationFrame(loop);
  }
  // render car thumbnails for the playlist tiles
  function makeTileImages() {
    const r = game.renderer; const out = [];
    const W = RL.IS_MOBILE ? 256 : 512, Hh = RL.IS_MOBILE ? 180 : 360;
    const rt = new THREE.WebGLRenderTarget(W, Hh, { samples: RL.IS_MOBILE ? 0 : 4 });
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xa9c8ff, 0x203040, 1.2));
    const dl = new THREE.DirectionalLight(0xffffff, 2.5); dl.position.set(-300, -200, 500); sc.add(dl);
    sc.environment = game.env;
    const cam = new THREE.PerspectiveCamera(32, W / Hh, 10, 5000); cam.up.set(0, 0, 1);
    const specs = [
      { body: 'octane', colors: { primary: '#1f6fe0', accent: '#cfd4dc', wheel: '#cfd4dc' }, bg: ['#0b2a6b', '#1f7fff'] },
      { body: 'fennec', colors: { primary: '#ff8a00', accent: '#1a1a1e', wheel: '#1a1a1e' }, bg: ['#5a2d0c', '#ff8a00'] },
      { body: 'viper', colors: { primary: '#26d97a', accent: '#1a1a1e', wheel: '#ffd400' }, bg: ['#0a3d2a', '#26d97a'] },
      { body: 'titan', colors: { primary: '#c21f1f', accent: '#ffd400', wheel: '#cfd4dc' }, bg: ['#3a0a0a', '#c21f1f'] },
      { body: 'phantom', colors: { primary: '#ff5fa2', accent: '#ffffff', wheel: '#00e5ff' }, bg: ['#2a0a3a', '#6c3fe0'] },
      { body: 'viper', colors: { primary: '#6c3fe0', accent: '#00e5ff', wheel: '#39ff14' }, bg: ['#0a1a3a', '#08c3d1'] }
    ];
    const pixels = new Uint8Array(W * Hh * 4);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const g = cv.getContext('2d');
    for (const sp of specs) {
      const m = RL.CarModel.build(sp.body, sp.colors);
      m.group.rotation.z = 0.55; m.group.position.set(0, 0, C.REST_Z); sc.add(m.group);
      cam.position.set(210, -260, 120); cam.lookAt(10, 0, 20);
      r.setClearColor(0x000000, 0);
      r.setRenderTarget(rt); r.clear(); r.render(sc, cam); r.readRenderTargetPixels(rt, 0, 0, W, Hh, pixels); r.setRenderTarget(null);
      const grd = g.createLinearGradient(0, 0, W, Hh); grd.addColorStop(0, sp.bg[0]); grd.addColorStop(1, sp.bg[1]);
      g.fillStyle = grd; g.fillRect(0, 0, W, Hh);
      g.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(i * 130 - 60, Hh); g.lineTo(i * 130 + 90, 0); g.lineTo(i * 130 + 130, 0); g.lineTo(i * 130 - 20, Hh); g.fill(); }
      const img = g.createImageData(W, Hh);
      for (let y = 0; y < Hh; y++) { const src = (Hh - 1 - y) * W * 4; img.data.set(pixels.subarray(src, src + W * 4), y * W * 4); }
      const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = Hh; tmp.getContext('2d').putImageData(img, 0, 0);
      g.drawImage(tmp, 0, 0);
      out.push(cv.toDataURL('image/jpeg', 0.85));
      sc.remove(m.group); m.dispose();
    }
    rt.dispose(); r.setClearColor(0x000000, 1);
    return out;
  }
  // ---------- maps ----------
  const MAP_LOOK = {
    greenfield: { sunDir: [-0.48, -0.36, 0.8], sun: 0xfff1dc, sunI: 3.1, hemiSky: 0xa9c8ff, hemiGround: 0x4f6b3a, hemiI: 0.75, amb: 0xffffff, ambI: 0.22, fog: 0xc9dcf2, fogD: 0.000015, exposure: 1.05 },
    neon: { sunDir: [0.42, 0.5, 0.76], sun: 0xc6ceff, sunI: 2.6, hemiSky: 0x8a70e0, hemiGround: 0x2a1a40, hemiI: 1.1, amb: 0x9aa4ff, ambI: 0.4, fog: 0x120c26, fogD: 0.00002, exposure: 1.1 }
  };
  // re-render the reflection cubemaps after the scenery changed
  function captureEnv() {
    const r = game.renderer, scene = game.scene;
    const hidden = [];
    for (const o of scene.children) if (o !== game.stadium.group && o !== game.arena.group && !o.isLight && o.visible) { o.visible = false; hidden.push(o); }
    game.arena.group.visible = false;
    const cubeSize = RL.IS_MOBILE ? 128 : 256;
    const rt0 = new THREE.WebGLCubeRenderTarget(cubeSize, { type: THREE.HalfFloatType });
    const c0 = new THREE.CubeCamera(50, 80000, rt0); c0.position.set(0, 0, 400); c0.update(r, scene);
    game.arena.group.visible = true;
    if (game.arena.glassMat.uniforms) game.arena.glassMat.uniforms.envMap.value = rt0.texture;
    if (game.envCubeRT) game.envCubeRT.dispose(); game.envCubeRT = rt0; game.envCube = rt0.texture;
    const rt = new THREE.WebGLCubeRenderTarget(cubeSize, { type: THREE.HalfFloatType });
    const cc = new THREE.CubeCamera(50, 80000, rt); cc.position.set(0, 0, 400);
    const glass = game.arena.volume; const gv = glass.visible; glass.visible = true;
    cc.update(r, scene); glass.visible = gv;
    const pm = new THREE.PMREMGenerator(r); const old = game.env;
    game.env = pm.fromCubemap(rt.texture).texture; scene.environment = game.env;
    pm.dispose(); rt.dispose(); if (old) old.dispose();
    for (const o of hidden) o.visible = true;
    const sc = RL.Menu.showcase; if (sc) sc.setEnv(game.env);
  }
  function applyMap(id) {
    if (!RL.MAP_BY_ID[id]) id = 'greenfield';
    if (game.mapId === id) return;
    const L = MAP_LOOK[id];
    game.sunDir.set(L.sunDir[0], L.sunDir[1], L.sunDir[2]).normalize();
    game.sun.color.setHex(L.sun); game.sun.intensity = L.sunI;
    game.hemi.color.setHex(L.hemiSky); game.hemi.groundColor.setHex(L.hemiGround); game.hemi.intensity = L.hemiI;
    game.amb.color.setHex(L.amb); game.amb.intensity = L.ambI;
    game.scene.fog.color.setHex(L.fog); game.scene.fog.density = L.fogD;
    game.renderer.toneMappingExposure = L.exposure;
    RL.Stadium.setTheme(game.stadium, id, game.sunDir);
    RL.Arena.setTheme(game.arena, id);
    game.mapId = id;
    captureEnv();
  }
  // ---------- state ----------
  function toMenu() {
    if (game.match) { game.match.dispose(); game.match = null; }
    game.state = 'menu'; game.paused = false;
    RL.HUD.hide();
    RL.Menu.show('main');
    RL.Audio.startMusic(); RL.Audio.stopCrowd();
    fade(false);
  }
  function startMatch(cfg) {
    fade(true);
    setTimeout(() => {
      RL.Menu.hide();
      if (game.match) { game.match.dispose(); game.match = null; }
      cfg.length = game.settings.matchLength;
      cfg.map = cfg.map || game.mapId || 'greenfield';
      applyMap(cfg.map);
      game.settings.lastMap = cfg.map;
      game.lastCfg = cfg;
      game.state = 'match';
      game.camera.applyFov();
      game.match = new RL.Match(game, cfg);
      if (!game.settings.musicInMatch) RL.Audio.stopMusic();
      fade(false);
      game.fpsSamples = [];
    }, 380);
  }
  function rematch() { const cfg = Object.assign({}, game.lastCfg || { mode: '1v1' }); startMatch(cfg); }
  function fade(on) { const f = document.getElementById('fade'); f.style.opacity = on ? '1' : '0'; }
  function setPaused(p) { game.paused = p; }
  game.onMatchEnd = (match, won) => {
    const st = game.settings.stats; st.matches++; if (won) st.wins++;
    const ps = match.player.stats; st.goals += ps.goals; st.saves += ps.saves; st.shots += ps.shots;
    game.settings.xp += 250 + ps.score; game.settings.level = 1 + Math.floor(game.settings.xp / 1000);
    const res = RL.Career.settle(match.cfg, won, ps.goals);
    saveSettings();
    return res;
  };
  // ---------- loop ----------
  let last = performance.now(), fpsAcc = 0, fpsN = 0, fpsT = 0, autoChecked = false;
  function loop(now) {
    requestAnimationFrame(loop);
    try { loopBody(now); } catch (e) { window.__lastError = (e && e.stack) || String(e); if (!window.__errCount) window.__errCount = 0; if (window.__errCount++ < 5) console.error('loop error', e); }
  }
  function loopBody(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
    game.time += dt;
    RL.Input.update();
    if (game.stadium) game.stadium.update(game.time);
    const t0 = performance.now();
    if (game.state === 'match' && game.match) {
      game.match.update(dt);
      RL.Arena.updatePads(game.arena.pads, dt, game.time);
      // shadow frustum follows the action
      if (game.sun.castShadow) {
        const m = game.match; const c = m.player.pos, b = m.ball.visible ? m.ball.pos : c;
        const cx = (c.x + b.x) * 0.5, cy = (c.y + b.y) * 0.5;
        const size = U.clamp(Math.hypot(c.x - b.x, c.y - b.y) * 0.6 + 1400, 2000, 4200);
        const sc = game.sun.shadow.camera; sc.left = -size; sc.right = size; sc.top = size; sc.bottom = -size; sc.updateProjectionMatrix();
        game.sun.position.set(cx, cy, 0).addScaledVector(game.sunDir, 20000); game.sun.target.position.set(cx, cy, 0); game.sun.target.updateMatrixWorld();
      }
    } else if (game.state === 'menu') {
      RL.Menu.update(dt, game.time);
      const sc = RL.Menu.showcase; const cx = sc ? sc.pos.x : 0, cy = sc ? sc.pos.y : 0;
      const s = game.sun.shadow.camera; s.left = -600; s.right = 600; s.top = 600; s.bottom = -600; s.updateProjectionMatrix();
      game.sun.position.set(cx, cy, 0).addScaledVector(game.sunDir, 20000); game.sun.target.position.set(cx, cy, 0); game.sun.target.updateMatrixWorld();
      game.ball.setVisible(false);
      RL.Input.clearEdges();
    }
    const t1 = performance.now();
    if (game.state !== 'boot') RL.FX.render(game.renderer, game.scene, game.camera.cam);
    const t2 = performance.now();
    game.perf = game.perf || { upd: 0, ren: 0 }; game.perf.upd += (t1 - t0 - game.perf.upd) * 0.05; game.perf.ren += (t2 - t1 - game.perf.ren) * 0.05;
    // fps
    fpsAcc += dt; fpsN++; fpsT += dt;
    if (fpsT >= 0.5) { game.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; fpsT = 0; const el = document.getElementById('fps'); if (el && !el.classList.contains('hidden')) el.textContent = Math.round(game.fps) + ' FPS'; autoQuality(); }
  }
  function autoQuality() {
    // one-time automatic downgrade if the match runs slowly on this machine
    if (autoChecked || game.state !== 'match' || !game.match || game.match.phase === 'intro') return;
    game.fpsSamples = game.fpsSamples || []; game.fpsSamples.push(game.fps);
    if (game.fpsSamples.length < 6) return;
    autoChecked = true;
    const avg = game.fpsSamples.reduce((a, b) => a + b, 0) / game.fpsSamples.length;
    if (new URLSearchParams(location.search).get('noauto')) return;
    const minFps = RL.IS_MOBILE ? 45 : 40;
    if (avg < minFps && game.quality !== 'low') { const q = game.quality === 'high' ? 'medium' : 'low'; game.settings.video.quality = q; setQuality(q); saveSettings(); console.info('Auto quality ->', q, 'avg fps', avg.toFixed(1)); }
  }
  Object.assign(game, { init, applyMap, startMatch, rematch, toMenu, saveSettings, applySettings, setQuality, setPaused });
  // harness / debug API
  window.RLDebug = {
    game,
    startMatch: (mode, botPlayer, map, level) => startMatch(typeof level === 'number' ? Object.assign(RL.Career.levelCfg(map, level), { botPlayer: !!botPlayer }) : { mode: mode || '1v1', botPlayer: !!botPlayer, map }),
    applyMap: (id) => applyMap(id),
    endNow: (blue, orange) => { const m = game.match; if (!m) return; m.score = [blue, orange]; m.player.stats.goals = blue; RL.HUD.setScore(blue, orange); m.endMatch(); return m.result; },
    phase: () => game.match ? game.match.phase : game.state,
    skipIntro: () => { if (game.match && game.match.phase === 'intro') game.match.phaseT = 10; },
    skipCountdown: () => { if (game.match && game.match.phase === 'countdown') game.match.phaseT = 10; },
    forcePlay: () => { const m = game.match; if (!m) return 'nomatch'; if (m.phase === 'intro') m.startCountdown(); if (m.phase === 'countdown') { m.phase = 'play'; m.phaseT = 0; m.kickoffActive = true; m.kickoffT = 0; m.touchedSinceKickoff = false; m.acc = 0; RL.HUD.hideCenter(); } return m.phase; },
    inputState: () => JSON.stringify({ state: RL.Input.state, car: game.match ? game.match.player.input : null }),
    snapshot: () => { const m = game.match; if (!m) return null; return { phase: m.phase, time: m.time, score: m.score, clock: m.clock, ball: [m.ball.pos.x, m.ball.pos.y, m.ball.pos.z], ballSpeed: m.ball.vel.length(), cars: m.cars.map((c) => ({ name: c.name, team: c.team, pos: [Math.round(c.pos.x), Math.round(c.pos.y), Math.round(c.pos.z)], speed: Math.round(c.speed), boost: Math.round(c.boost), grounded: c.grounded, demolished: c.demolished, stats: c.stats })), fps: Math.round(game.fps) }; },
    setInput: (o) => { RL.Input._override = o; },
    botInfo: () => { const m = game.match; if (!m) return null; return JSON.stringify(m.bots.map((b) => ({ n: b.car.name, role: b.role, mode: b.plan.mode, sp: Math.round(b.car.speed), dBall: Math.round(b.car.pos.distanceTo(m.ball.pos)), g: b.car.grounded, wall: b.car.gNormal.z < 0.5, z: Math.round(b.car.pos.z), js: b.jumpSeq ? b.jumpSeq.type : null, aer: b.aerials, boost: Math.round(b.car.boost), tgt: [Math.round(b.plan.target.x), Math.round(b.plan.target.y)] }))); },
    shootBall: (team, vx, vy, vz) => { const m = game.match; if (!m) return; m.ball.pos.set(vx === undefined ? 0 : vx, team === 0 ? 3000 : -3000, 300); m.ball.vel.set(0, team === 0 ? 2600 : -2600, vz === undefined ? 200 : vz); m.ball.lastTouch = m.player; m.ball.lastTouchT = m.time; return 'shot'; },
    fastForward: (sec) => { const m = game.match; if (!m) return; RL.Input.update(); const steps = Math.round(sec * C.PHYS_HZ); for (let i = 0; i < steps; i++) { if (m.phase === 'play' || m.phase === 'goal') { if (!m.player.isBot) RL.Input.applyTo(m.player); m.stepSim(1 / C.PHYS_HZ); if (m.phase === 'play') { if (!m.overtime) m.clock -= 1 / C.PHYS_HZ; } if (i % 2 === 0) m.recordFrame(); } } for (const c of m.cars) c.syncVisual(1); m.ball.syncVisual(); },
    menu: (s) => RL.Menu.show(s),
    frames: () => game.fps,
    lastError: () => window.__lastError || null,
    boot: () => JSON.stringify(game.bootTimes),
    perf: () => JSON.stringify({ fps: Math.round(game.fps), updMs: +(game.perf ? game.perf.upd : 0).toFixed(2), renderMs: +(game.perf ? game.perf.ren : 0).toFixed(2), q: game.quality, gpu: game.gpuName, calls: game.renderer.info.render.calls, tris: game.renderer.info.render.triangles }),
    advance: (sec, hz) => { const m = game.match; if (!m) return 'nomatch'; const step = 1 / (hz || 60); const n = Math.round(sec / step); for (let i = 0; i < n; i++) { game.time += step; RL.Input.update(); m.update(step); } for (const c of m.cars) c.syncVisual(step); m.ball.syncVisual(); return m.phase; },
    probe: () => JSON.stringify({ t: game.time, ph: game.match && game.match.phase, pt: game.match && game.match.phaseT, paused: game.paused, mp: game.match && game.match.paused, ended: game.match && game.match.ended })
  };
  return game;
})();
window.addEventListener('DOMContentLoaded', () => { RL.Game.init(); });
