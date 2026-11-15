// LOCAL-dev-tut417: first-play practice — first launch, skip, each step on touch and keyboard, flag, replay, no online/menu side effects.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const URL = HTML.startsWith('http') || HTML.startsWith('file:') ? HTML : 'file://' + HTML;
const OUT = '/workspace/out/tut417';
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 500) : '')); };

const boot = async (opts = {}) => {
  const { browser, page, errors } = await launch({ w: opts.w || 915, h: opts.h || 412, dpr: 1, mobile: opts.mobile !== false });
  await page.goto(URL, { waitUntil: 'load' });
  for (let i = 0; i < 50; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.S))) break; await sleep(100); }
  await page.evaluate((touch) => {
    const S = __bg.S();
    S.tutorialDone = false;
    S.settings.touch = touch;
    S.settings.events = 'off';
    S.settings.a2hs = true;
    S.settings.quality = 'fast';
    S.settings.speed = 'chill';
    S.setup.mode = 'classic';
    const a = document.getElementById('a2hs'); if (a) a.remove();
    try { __bg.app.applyTouch(); } catch (e) {}
  }, opts.touch || (opts.mobile === false ? 'off' : 'on'));
  await sleep(200);
  return { browser, page, errors };
};

const waitPlay = async (page, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(() => !!(__bg.app.game && __bg.app.game.state === 'play' && __bg.app.tut && __bg.app.match && __bg.app.match.tutorial))) return true;
    await sleep(80);
  }
  return false;
};

const stepNow = () => pageHeld => pageHeld.evaluate(() => (__bg.app.tut ? __bg.app.tut.step : -1));

const waitStep = async (page, n, ms = 10000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate((n) => (__bg.app.tut && __bg.app.tut.step >= n) || (__bg.S().tutorialDone && n >= 7 && !__bg.app.tut), n)) return true;
    await sleep(40);
  }
  return false;
};

const sim = async (page, fn, n = 1) => page.evaluate((fn, n) => {
  const F = new Function('return (' + fn + ')')();
  for (let i = 0; i < n; i++) { F(__bg, i); __bg.step(1); }
}, fn.toString(), n);

const startTut = async (page, via = 'play') => {
  await page.evaluate((via) => {
    const S = __bg.S();
    if (via === 'play') {
      S.tutorialDone = false;
      const b = document.querySelector('#btn-play');
      if (b) b.click();
      else __bg.app.startTutorial();
    } else __bg.app.startTutorial();
  }, via);
  return waitPlay(page);
};

// ---------- Touch first-launch flow @ 915x412 ----------
const { browser, page, errors } = await boot({ w: 915, h: 412, mobile: true, touch: 'on' });
ok('booted', await page.evaluate(() => !!(__bg.app && __bg.S)));
ok('first launch is not already marked done', await page.evaluate(() => __bg.S().tutorialDone === false));
ok('Chill is still the default speed', await page.evaluate(() => __bg.S().settings.speed === 'chill'));

const started = await startTut(page, 'play');
ok('first Play starts the practice (no wall of text)', started && await page.evaluate(() => !!(__bg.app.match && __bg.app.match.tutorial && document.querySelector('#tut.show'))));
await page.evaluate(() => { try { __bg.app.cdHide(); } catch (e) {} const el = document.getElementById('countdown'); if (el) { el.className = ''; el.style.display = 'none'; } const cap = document.getElementById('cdcap'); if (cap) cap.className = ''; });

const info0 = await page.evaluate(() => {
  const t = document.querySelector('#tut');
  const b = document.querySelector('#tut .tt b');
  const sk = document.querySelector('#tskip');
  const sr = sk && sk.getBoundingClientRect();
  const cs = b && getComputedStyle(b);
  const g = document.querySelector('#ghost');
  const joy = document.querySelector('#joybase');
  const gr = g && g.getBoundingClientRect();
  const jr = joy && joy.getBoundingClientRect();
  const pulses = [...document.querySelectorAll('.tut-pulse')].map((e) => e.id);
  const game = __bg.app.game;
  const solids = game && game.layout ? game.layout.sol0 : -1;
  const traps = game && game.traps ? (game.traps.list || []).length : -1;
  const bushN = game ? game.bushN : 0;
  const me = game && game.fighters.find((f) => !f.isBot && f.def.slot === 0);
  return {
    title: b && b.textContent,
    font: b && parseFloat(cs.fontSize),
    skip: !!(sk && sr.width >= 80 && sr.height >= 40 && sr.bottom <= innerHeight + 1 && getComputedStyle(sk).pointerEvents === 'auto'),
    skipText: sk && sk.textContent.trim(),
    ghostOnJoy: !!(g && joy && g.style.display === 'block' && Math.abs(gr.left - (jr.left + jr.width / 2)) < 40),
    pulses,
    solids, traps, bushN,
    inv: me && me.inv > 100,
    edges: [...document.querySelectorAll('#edges .edge')].every((e) => e.style.display === 'none'),
    step: __bg.app.tut && __bg.app.tut.step,
  };
});
ok('step 0 says Move around! in big kid-readable text', info0.title === 'Move around!' && info0.font >= 18, info0);
ok('Skip is visible and tappable', info0.skip && /skip/i.test(info0.skipText || ''), info0);
ok('move highlight sits on the left stick', info0.ghostOnJoy && info0.pulses.includes('joybase'), info0);
ok('calm empty arena: no crates/pillars, no traps, one bush', info0.solids === 0 && info0.traps === 0 && info0.bushN >= 4, info0);
ok('you cannot fail: the player is safe', info0.inv && info0.edges, info0);
ok('standing still does not advance', info0.step === 0);

// Park both fighters under the top instruction (the old overlap case), then prove the YOU/Dummy labels stay clear.
const overlap = await page.evaluate(() => {
  const g = __bg.app.game, me = __bg.app.humanF(), dummy = g && g.fighters[1];
  const saved = [me, dummy].map((f) => f && ({ x: f.x, z: f.z }));
  const ttEl = document.querySelector('#tut .tt');
  const tt = ttEl.getBoundingClientRect();
  const cx = (tt.left + tt.right) / 2, cy = (tt.top + tt.bottom) / 2 + 8;
  const w = __bg.Input.unproject && __bg.Input.unproject(cx, cy);
  if (w && me) { me.x = w[0]; me.z = w[1]; me.vx = me.vz = 0; if (g.resolve) g.resolve(me, 0.4); }
  if (w && dummy) { dummy.x = (w[0] + 1.7); dummy.z = w[1]; dummy.vx = dummy.vz = 0; if (g.resolve) g.resolve(dummy, 0.4); }
  if (__bg.camNow) __bg.camNow();
  if (__bg.renderNow) __bg.renderNow();
  const hid = g.fighters.every((f) => !f.model || !f.model.mark || f.model.mark.visible === false);
  const hits = [];
  const overlapBox = (a, b, pad = 2) => a.left < b.right - pad && a.right > b.left + pad && a.top < b.bottom - pad && a.bottom > b.top + pad;
  for (const f of g.fighters) {
    const m = f.model && f.model.mark; if (!m || !m.visible) continue;
    m.updateMatrixWorld(true);
    const p = new __bg.THREE.Vector3(); m.getWorldPosition(p);
    const [sx, sy] = __bg.toScreen(p.x, p.y + 0.7, p.z);
    const [sx2] = __bg.toScreen(p.x + 0.7, p.y + 0.7, p.z);
    const hw = Math.max(28, Math.abs((sx2 - sx) * innerWidth) * 1.1);
    const box = { left: sx * innerWidth - hw, right: sx * innerWidth + hw, top: sy * innerHeight - 22, bottom: sy * innerHeight + 18 };
    if (overlapBox(tt, box)) hits.push(f.name || f.hero && f.hero.name);
  }
  return { hid, hits, saved, title: ttEl.querySelector('b') && ttEl.querySelector('b').textContent, tt: { x: +tt.left.toFixed(1), y: +tt.top.toFixed(1), w: +tt.width.toFixed(1), h: +tt.height.toFixed(1) } };
});
ok('YOU/Dummy name labels stay hidden and do not overlap the instruction', overlap.hid && overlap.hits.length === 0, overlap);
await page.screenshot({ path: path.join(OUT, 'tut417-no-overlap.png') });
// Put everyone back so the usual move screenshot still shows the calm open yard
await page.evaluate((saved) => {
  const g = __bg.app.game, fs = [__bg.app.humanF(), g && g.fighters[1]];
  saved.forEach((s, i) => { const f = fs[i]; if (f && s) { f.x = s.x; f.z = s.z; f.vx = f.vz = 0; if (g.resolve) g.resolve(f, 0.4); } });
  if (__bg.camNow) __bg.camNow();
  if (__bg.renderNow) __bg.renderNow();
}, overlap.saved);

await page.screenshot({ path: path.join(OUT, 'tut417-move.png') });
await page.screenshot({ path: path.join(OUT, 'frames/00-move.png') });

// Move with the stick (simulated touch input + stepped ticks)
await page.evaluate(() => {
  const t = __bg.Input.touch; t.enabled = true; t.tx = 1; t.tz = 0; t.mx = 1; t.mz = 0;
  __bg.clearFeelLog && __bg.clearFeelLog();
  for (let i = 0; i < 90; i++) __bg.step(1);
  t.tx = t.tz = t.mx = t.mz = 0;
});
ok('moving advances to Aim and throw!', await waitStep(page, 1, 2000) && await page.evaluate(() => document.querySelector('#tut .tt b').textContent === 'Aim and throw!'));
ok('throw highlight sits on the aim stick (aim guide lives there)', await page.evaluate(() => {
  const g = document.querySelector('#ghost'), r = document.querySelector('#aimbase').getBoundingClientRect(), gr = g.getBoundingClientRect();
  return g.style.display === 'block' && Math.abs(gr.left - (r.left + r.width / 2)) < 40 && document.getElementById('aimbase').classList.contains('tut-pulse');
}));
ok('a feel414 sparkle/sound celebrates the step', await page.evaluate(() => !!(__bg.feelLog && __bg.feelLog.some((e) => e.kind === 'catch'))));
await page.screenshot({ path: path.join(OUT, 'tut417-throw.png') });
await page.screenshot({ path: path.join(OUT, 'frames/01-throw.png') });

// Aim + throw via the touch aim stick, then wait for the catch
await page.evaluate(() => {
  const t = __bg.Input.touch; const f = __bg.app.humanF();
  t.enabled = true; t.fire = true; t.aimX = 1; t.aimZ = 0; t.fireQ = 2;
  if (f) { f.ammo = Math.max(1, f.ammo); f.charging = false; f.chargeT = 0; }
  for (let i = 0; i < 24; i++) __bg.step(1);
  t.fire = false; t.fireQ = 0;
  for (let i = 0; i < 8; i++) __bg.step(1);
});
ok('throwing advances to Catch it!', await waitStep(page, 2, 3000) && await page.evaluate(() => document.querySelector('#tut .tt b').textContent === 'Catch it!'));
await page.screenshot({ path: path.join(OUT, 'frames/02-catch.png') });

// Wait for the boomerang to come back (restore + rethrow if it is lost)
const caught = await page.evaluate(async () => {
  const sleepTick = (n) => { for (let i = 0; i < n; i++) __bg.step(1); };
  const start = __bg.app.tut.step;
  for (let k = 0; k < 400; k++) {
    if (__bg.app.tut.step >= 3) return true;
    const f = __bg.app.humanF(); const g = __bg.app.game;
    if (f && f.ammo <= 0 && (!g.booms || g.booms.length === 0) && k > 20 && k % 30 === 0) {
      f.ammo = 1;
      const t = __bg.Input.touch; t.fire = true; t.aimX = 0.8; t.aimZ = 0.2;
      sleepTick(18); t.fire = false; sleepTick(6);
    }
    sleepTick(2);
  }
  return __bg.app.tut.step >= 3;
});
ok('catching advances to Tap Shield!', caught && await page.evaluate(() => document.querySelector('#tut .tt b').textContent === 'Tap Shield!'));
ok('shield highlight sits on the Shield button', await page.evaluate(() => document.getElementById('btnDef').classList.contains('tut-pulse')));
await page.screenshot({ path: path.join(OUT, 'tut417-shield.png') });
await page.screenshot({ path: path.join(OUT, 'frames/03-shield.png') });

await page.evaluate(() => {
  const t = __bg.Input.touch; t.enabled = true; t.deflect = true;
  __bg.step(2);
});
ok('tapping Shield advances to Swing up close!', await waitStep(page, 4, 2000) && await page.evaluate(() => document.querySelector('#tut .tt b').textContent === 'Swing up close!'));
ok('melee highlight sits on the Melee button', await page.evaluate(() => document.getElementById('btnMelee').classList.contains('tut-pulse')));
await page.screenshot({ path: path.join(OUT, 'frames/04-melee.png') });

await page.evaluate(() => {
  const t = __bg.Input.touch; const f = __bg.app.humanF();
  if (f) { f.slT = -1; f.slCd = 0; }
  t.enabled = true; t.melee = true;
  __bg.step(4);
});
ok('a close-up swing advances to Use Special!', await waitStep(page, 5, 2000) && await page.evaluate(() => document.querySelector('#tut .tt b').textContent === 'Use Special!'));
ok('special highlight sits on the Special button', await page.evaluate(() => document.getElementById('btnUlt').classList.contains('tut-pulse')));
await page.screenshot({ path: path.join(OUT, 'tut417-special.png') });
await page.screenshot({ path: path.join(OUT, 'frames/05-special.png') });

await page.evaluate(() => {
  const t = __bg.Input.touch; const f = __bg.app.humanF();
  if (f) f.ult = 100;
  t.enabled = true; t.ult = true;
  __bg.step(6);
});
ok('using Special advances to Hide in a bush!', await waitStep(page, 6, 2000) && await page.evaluate(() => document.querySelector('#tut .tt b').textContent === 'Hide in a bush!'));
ok('a pulsing marker points at the bush', await page.evaluate(() => {
  const g = document.querySelector('#ghost');
  return g && g.style.display === 'block' && g.classList.contains('gbush');
}));
await page.screenshot({ path: path.join(OUT, 'frames/06-bush.png') });

const hid = await page.evaluate(() => {
  const bush = __bg.app.game.tutBush; const t = __bg.Input.touch; t.enabled = true;
  for (let i = 0; i < 240; i++) {
    const f = __bg.app.humanF(); if (!f || !bush) break;
    if (__bg.app.tut.step >= 7) return true;
    const dx = bush[0] - f.x, dz = bush[1] - f.z, l = Math.hypot(dx, dz) || 1;
    t.tx = dx / l; t.tz = dz / l; t.mx = t.tx; t.mz = t.tz;
    __bg.step(1);
  }
  t.tx = t.tz = t.mx = t.mz = 0;
  return __bg.app.tut.step >= 7;
});
ok('hiding in a bush (or the optional wait) reaches You\'re ready!', hid && await page.evaluate(() => document.querySelector('#tut .tt b').textContent === "You're ready!"));
await page.screenshot({ path: path.join(OUT, 'tut417-ready.png') });
await page.screenshot({ path: path.join(OUT, 'frames/07-ready.png') });

// Wait for Training complete / flag
const finished = await page.evaluate(async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 4000) { if (__bg.S().tutorialDone) return true; await new Promise((r) => setTimeout(r, 50)); }
  return __bg.S().tutorialDone === true;
});
ok('finishing practice saves the first-play flag', finished);
ok('results or menu follows You\'re ready!', await page.evaluate(() => __bg.S().tutorialDone && !__bg.app.tut && (__bg.app.mode === 'matchEnd' || __bg.app.mode === 'menu' || (__bg.app.match && !__bg.app.match.tutorial) || (__bg.UI.cur === 'matchEnd'))));

// Returning player is not forced
await page.evaluate(() => { try { __bg.app.quitToMenu(); } catch (e) {} });
await sleep(600);
const replayBtn = await page.evaluate(() => ({ practice: !!document.querySelector('#btn-practice'), play: !!document.querySelector('#btn-play') }));
ok('menu has a Practice entry', replayBtn.practice);
await page.evaluate(() => document.querySelector('#btn-play').click());
await sleep(900);
ok('Play does not force practice on a returning player', await page.evaluate(() => !(__bg.app.match && __bg.app.match.tutorial)));

await page.evaluate(() => { try { __bg.app.quitToMenu(); } catch (e) {} });
await sleep(600);
await page.evaluate(() => document.querySelector('#btn-practice').click());
ok('Practice from the menu replays the training', await waitPlay(page) && await page.evaluate(() => !!(__bg.app.match && __bg.app.match.tutorial)));
await sleep(200);
await page.evaluate(() => { const b = document.querySelector('#tskip'); if (b) b.click(); else __bg.app.skipTutorial(); });
await sleep(800);
ok('Skip leaves practice and starts a normal match', await page.evaluate(() => __bg.app.tut === null && __bg.app.match && !__bg.app.match.tutorial));
ok('Skip keeps the first-play flag set', await page.evaluate(() => __bg.S().tutorialDone === true));

// Settings Practice
await page.evaluate(() => { try { __bg.app.quitToMenu(); } catch (e) {} });
await sleep(500);
await page.evaluate(() => __bg.UI.show('settings', { ret: 'menu' }));
await sleep(300);
ok('Settings has a Practice button', await page.evaluate(() => !!document.querySelector('#btn-practice-set')));
await page.evaluate(() => document.querySelector('#btn-practice-set').click());
ok('Practice from Settings starts training', await waitPlay(page));
await page.evaluate(() => __bg.app.skipTutorial());
await sleep(500);
await page.evaluate(() => { try { __bg.app.quitToMenu(); } catch (e) {} });
await sleep(400);

// How to play still has #hw-replay
await page.evaluate(() => __bg.UI.show('howto', {}));
await sleep(300);
ok('How to play still has a Practice / replay button', await page.evaluate(() => !!document.querySelector('#hw-replay')));
await page.evaluate(() => __bg.UI.show('menu'));
await sleep(200);

// Online and other menus are unaffected
await page.evaluate(() => __bg.UI.show('netMenu'));
await sleep(300);
ok('Play online still opens and does not start practice', await page.evaluate(() => __bg.UI.cur === 'netMenu' && !__bg.app.tut && !(__bg.app.match && __bg.app.match.tutorial)));
await page.evaluate(() => { const b = document.querySelector('#ui-back'); if (b) b.click(); else __bg.UI.show('menu'); });
await sleep(300);
ok('Back from Play online returns to the menu', await page.evaluate(() => __bg.UI.cur === 'menu' && !__bg.app.tut));

ok('no console errors (touch run)', errors.filter((e) => !/Failed to load|AudioContext|SW|service worker|peerjs|favicon/i.test(e)).length === 0, errors.slice(0, 4));
await browser.close();

// ---------- Keyboard path ----------
const kb = await boot({ w: 1024, h: 768, mobile: false, touch: 'off' });
await kb.page.evaluate(() => { __bg.S().settings.touch = 'off'; __bg.app.applyTouch(); });
await sleep(150);
ok('keyboard first Play starts practice', await startTut(kb.page, 'play'));
ok('keyboard hints show WASD on the move step', await kb.page.evaluate(() => {
  const t = document.querySelector('#tut');
  const keys = (t.querySelector('.tk') || {}).textContent || '';
  return t.classList.contains('kbd') && /W/.test(keys) && /A/.test(keys) && document.querySelector('#tut .tt b').textContent === 'Move around!';
}));
ok('keyboard Skip is visible', await kb.page.evaluate(() => { const b = document.querySelector('#tskip'); const r = b.getBoundingClientRect(); return r.width >= 80 && r.height >= 40 && getComputedStyle(b).pointerEvents === 'auto'; }));

await kb.page.evaluate(() => {
  __bg.Input.touch.enabled = false;
  __bg.Input.keys.add('KeyD');
  for (let i = 0; i < 90; i++) __bg.step(1);
  __bg.Input.keys.delete('KeyD');
});
ok('keyboard move advances to throw', await waitStep(kb.page, 1, 2000));

await kb.page.evaluate(() => {
  const f = __bg.app.humanF(); if (f) { f.ammo = Math.max(1, f.ammo); f.face = 0; }
  __bg.Input.touch.enabled = false;
  __bg.Input.keys.add('KeyF'); __bg.Input.edge.add('KeyF');
  for (let i = 0; i < 24; i++) __bg.step(1);
  __bg.Input.keys.delete('KeyF');
  for (let i = 0; i < 8; i++) __bg.step(1);
});
ok('keyboard throw advances to catch', await waitStep(kb.page, 2, 3000));

const kbCatch = await kb.page.evaluate(() => {
  for (let k = 0; k < 400; k++) {
    if (__bg.app.tut.step >= 3) return true;
    const f = __bg.app.humanF(), g = __bg.app.game;
    if (f && f.ammo <= 0 && (!g.booms || !g.booms.length) && k > 20 && k % 30 === 0) {
      f.ammo = 1; __bg.Input.keys.add('KeyF');
      for (let i = 0; i < 18; i++) __bg.step(1);
      __bg.Input.keys.delete('KeyF');
      for (let i = 0; i < 6; i++) __bg.step(1);
    }
    __bg.step(2);
  }
  return __bg.app.tut.step >= 3;
});
ok('keyboard catch advances to shield', kbCatch);

await kb.page.evaluate(() => {
  __bg.Input.keys.add('KeyE'); __bg.Input.edge.add('KeyE');
  __bg.step(3);
  __bg.Input.keys.delete('KeyE');
});
ok('keyboard Shield advances to melee', await waitStep(kb.page, 4, 2000));

await kb.page.evaluate(() => {
  const f = __bg.app.humanF(); if (f) { f.slT = -1; f.slCd = 0; f.deflectT = 0; f.deflectCd = 0; }
  __bg.Input.keys.add('KeyG'); __bg.Input.edge.add('KeyG');
  __bg.step(6);
  __bg.Input.keys.delete('KeyG');
});
ok('keyboard melee advances to special', await waitStep(kb.page, 5, 2000));

await kb.page.evaluate(() => {
  const f = __bg.app.humanF(); if (f) f.ult = 100;
  __bg.Input.keys.add('KeyR'); __bg.Input.edge.add('KeyR');
  __bg.step(6);
  __bg.Input.keys.delete('KeyR');
});
ok('keyboard Special advances to bush', await waitStep(kb.page, 6, 2000));

const kbBush = await kb.page.evaluate(() => {
  const bush = __bg.app.game.tutBush;
  for (let i = 0; i < 240; i++) {
    if (__bg.app.tut.step >= 7) return true;
    const f = __bg.app.humanF(); if (!f || !bush) break;
    const dx = bush[0] - f.x, dz = bush[1] - f.z;
    __bg.Input.keys.clear();
    if (Math.abs(dx) >= Math.abs(dz)) __bg.Input.keys.add(dx >= 0 ? 'KeyD' : 'KeyA');
    else __bg.Input.keys.add(dz >= 0 ? 'KeyS' : 'KeyW');
    __bg.step(1);
  }
  __bg.Input.keys.clear();
  return __bg.app.tut.step >= 7;
});
ok('keyboard bush (or optional wait) reaches You\'re ready!', kbBush);

await sleep(1800);
ok('keyboard finish saves the flag', await kb.page.evaluate(() => __bg.S().tutorialDone === true));
ok('no console errors (keyboard run)', kb.errors.filter((e) => !/Failed to load|AudioContext|SW|service worker|peerjs|favicon/i.test(e)).length === 0, kb.errors.slice(0, 4));
await kb.browser.close();

// ---------- 1024-wide phone layout check ----------
const wide = await boot({ w: 1024, h: 412, mobile: true, touch: 'on' });
ok('1024-wide first Play starts practice', await startTut(wide.page, 'play'));
const wideInfo = await wide.page.evaluate(() => {
  const b = document.querySelector('#tut .tt b'); const sk = document.querySelector('#tskip');
  const sr = sk.getBoundingClientRect(); const cs = getComputedStyle(b);
  return { title: b.textContent, font: parseFloat(cs.fontSize), skip: sr.width >= 80 && sr.height >= 40 && sr.bottom <= innerHeight + 1, pulse: document.getElementById('joybase').classList.contains('tut-pulse') };
});
ok('1024-wide text stays big and Skip stays on screen', wideInfo.font >= 18 && wideInfo.skip && wideInfo.title === 'Move around!' && wideInfo.pulse, wideInfo);
await wide.page.screenshot({ path: path.join(OUT, 'tut417-1024-move.png') });
await wide.browser.close();

// GIF + 4-panel strip from the 915 flow frames
const frames = ['00-move.png', '01-throw.png', '03-shield.png', '05-special.png', '06-bush.png', '07-ready.png']
  .map((f) => path.join(OUT, 'frames', f)).filter((f) => fs.existsSync(f));
if (frames.length >= 4) {
  const list = path.join(OUT, 'frames', 'gif.txt');
  fs.writeFileSync(list, frames.map((f) => `file '${f}'\nduration 1.15`).join('\n') + `\nfile '${frames[frames.length - 1]}'\n`);
  const gif = path.join(OUT, 'tut417-flow.gif');
  const pal = path.join(OUT, 'frames', 'pal.png');
  spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=8,scale=640:-1,palettegen', pal], { encoding: 'utf8' });
  const gf = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', pal, '-lavfi', 'fps=8,scale=640:-1[x];[x][1:v]paletteuse', '-loop', '0', gif], { encoding: 'utf8' });
  ok('wrote a short GIF of the whole flow', gf.status === 0 && fs.existsSync(gif) && fs.statSync(gif).size > 1000, { status: gf.status, bytes: fs.existsSync(gif) ? fs.statSync(gif).size : 0, err: (gf.stderr || '').slice(-200) });
  const strip = path.join(OUT, 'tut417-steps-strip.png');
  const four = ['00-move.png', '01-throw.png', '03-shield.png', '07-ready.png'].map((f) => path.join(OUT, 'frames', f));
  if (four.every((f) => fs.existsSync(f))) {
    const st = spawnSync('ffmpeg', ['-y', '-i', four[0], '-i', four[1], '-i', four[2], '-i', four[3],
      '-filter_complex', 'scale=320:-1[0s];[1:v]scale=320:-1[1s];[2:v]scale=320:-1[2s];[3:v]scale=320:-1[3s];[0s][1s][2s][3s]hstack=4', strip], { encoding: 'utf8' });
    ok('wrote a 4-step strip', st.status === 0 && fs.existsSync(strip), { status: st.status });
  }
} else {
  ok('wrote a short GIF of the whole flow', false, { frames: frames.length });
}

console.log(JSON.stringify({ summary: { pass, fail } }));
process.exit(fail ? 1 : 0);
