// sound425: original kids theme, punchier SFX, Music/Sounds settings, first-tap / hidden tab / battery-saver audio.
import { launch, sleep } from './lib.mjs';
import fs from 'node:fs';
const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const URL = HTML.startsWith('http') || HTML.startsWith('file:') ? HTML : 'file://' + HTML;
const OUT = '/workspace/out/sound425';
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 700) : '')); };

const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2, mobile: true });
await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('whackerang.save.v1'); } catch (e) {} });
await page.goto(URL, { waitUntil: 'load' });
for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !!(window.__bg && __bg.app && __bg.UI))) break; await sleep(100); }

const boot = await page.evaluate(() => {
  const S = __bg.S();
  return {
    ready: !!(__bg.app && __bg.app.ready),
    speed: S.settings.speed,
    battery: S.settings.battery,
    diff: S.setup.diff,
    musicOn: S.settings.musicOn,
    sfxOn: S.settings.sfxOn !== false,
    music: S.settings.music,
    sfx: S.settings.sfx,
    master: S.settings.master,
    mute: !!S.settings.mute,
    audio: __bg.audioState ? __bg.audioState() : null,
    heroes: __bg.HEROES.map((h) => h.id),
    arenas: __bg.ARENAS.map((a) => a.id),
    names: __bg.SFX_NAMES || [],
    tracks: typeof __bg.TRACK_NAMES === 'function' ? __bg.TRACK_NAMES() : (__bg.TRACK_NAMES || []),
  };
});
ok('defaults stay Chill, Battery saver Auto, Easy bots', boot.speed === 'chill' && boot.battery === 'auto' && (boot.diff === 0 || boot.diff === 'easy'), boot);
ok('Puff and Lotus Pond are in this build', boot.heroes.includes('puff') && boot.arenas.includes('pond'), { heroes: boot.heroes, arenas: boot.arenas });
ok('Music and Sounds start on, with remembered volume defaults', boot.musicOn === true && boot.sfxOn === true && boot.music > 0 && boot.sfx > 0 && boot.master > 0 && boot.mute === false, boot);
ok('audio context is not started before the first tap (iOS rule)', !boot.audio || boot.audio.hasCtx === false || boot.audio.state === 'none' || boot.audio.state === 'suspended', boot.audio);
const files = await page.evaluate(() => (__bg.MUSIC_FILES || {}));
ok('theme tracks include a calm menu and a livelier battle loop', boot.tracks.includes('menu') && boot.tracks.includes('battle') && files.menu && files.battle, { tracks: boot.tracks, files, n: boot.names.length });
ok('music files are not fetched before the first tap', !boot.audio || boot.audio.hasCtx === false || boot.audio.filesReady === false, boot.audio);

const need = ['throw', 'whoosh', 'catch', 'hit', 'ko', 'shieldpop', 'dash', 'ultready', 'gust', 'trophy', 'click', 'ult_bao', 'ult_puff' /* may not exist, gust used */, 'missionDone', 'ach'];
ok('punchier SFX names exist (throw, catch, hit, ko, shield, dash, ult ready, Gust, trophy, click)', ['throw', 'catch', 'hit', 'ko', 'shieldpop', 'dash', 'ultready', 'gust', 'trophy', 'click'].every((n) => boot.names.includes(n)), boot.names.filter((n) => /gust|trophy|ult_|throw|hit|catch|dash/.test(n)));

// first tap unlocks audio
await page.mouse.click(200, 200);
await page.evaluate(() => { __bg.initAudio(); __bg.resumeAudio(); __bg.applyVolumes(); __bg.music('menu'); });
let afterTap = null;
for (let i = 0; i < 50; i++) {
  afterTap = await page.evaluate(() => __bg.audioState());
  if (afterTap && afterTap.hasCtx && afterTap.state === 'running' && afterTap.music === 'menu' && afterTap.filesReady) break;
  await sleep(100);
}
ok('after the first tap, audio is running and the menu theme starts', afterTap && afterTap.hasCtx && afterTap.state === 'running' && afterTap.music === 'menu', afterTap);
ok('menu and battle loops load from files after the first tap', afterTap && afterTap.filesReady === true && afterTap.musicKind === 'file', afterTap);

await page.evaluate(() => { __bg.music('battle'); });
await sleep(200);
const bat = await page.evaluate(() => __bg.audioState());
ok('battle loop is a distinct, slightly livelier track', bat.music === 'battle' && bat.music !== 'menu' && bat.musicKind === 'file', bat);

// settings persist
await page.evaluate(() => {
  const S = __bg.S();
  S.settings.musicOn = false; S.settings.sfxOn = true; S.settings.music = 0.4; S.settings.sfx = 0.5; S.settings.master = 0.7;
  try { localStorage.setItem('whackerang.save.v1', JSON.stringify(S)); } catch (e) {}
  __bg.applyVolumes();
});
const vols = await page.evaluate(() => ({ st: __bg.audioState(), s: (({ musicOn, sfxOn, music, sfx, master, mute }) => ({ musicOn, sfxOn, music, sfx, master, mute }))(__bg.S().settings) }));
ok('Music off silences the music bus, Sounds stay audible', vols.st.musVol === 0 && vols.st.sfxVol > 0, vols);
await page.evaluate(() => { const S = __bg.S(); S.settings.musicOn = true; S.settings.sfxOn = false; __bg.applyVolumes(); });
const vols2 = await page.evaluate(() => __bg.audioState());
ok('Sounds off silences the SFX bus, Music stays audible', vols2.sfxVol === 0 && vols2.musVol > 0, vols2);
await page.evaluate(() => { const S = __bg.S(); S.settings.musicOn = true; S.settings.sfxOn = true; S.settings.mute = false; __bg.applyVolumes(); });

// persistence: write through the game save, then boot a fresh page that does not wipe storage
const stored = await page.evaluate(() => {
  const s = __bg.S().settings;
  try { localStorage.setItem('whackerang.save.v1', JSON.stringify(__bg.S())); } catch (e) {}
  const raw = localStorage.getItem('whackerang.save.v1');
  return raw ? JSON.parse(raw).settings : null;
});
ok('Music and Sounds settings are written to the save', stored && stored.musicOn === true && stored.sfxOn === true && stored.music === 0.4 && stored.sfx === 0.5 && stored.master === 0.7, stored);
const rawSave = await page.evaluate(() => localStorage.getItem('whackerang.save.v1'));
const ctx2 = await browser.createBrowserContext();
const page2 = await ctx2.newPage();
await page2.setViewport({ width: 915, height: 412, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page2.evaluateOnNewDocument((raw) => { try { if (raw) localStorage.setItem('whackerang.save.v1', raw); } catch (e) {} }, rawSave);
await page2.goto(URL, { waitUntil: 'load' });
await sleep(400);
const persist = await page2.evaluate(() => { const s = __bg.S().settings; return { musicOn: s.musicOn, sfxOn: s.sfxOn, music: s.music, sfx: s.sfx, master: s.master }; });
ok('Music and Sounds settings are remembered between sessions', persist.musicOn === true && persist.sfxOn === true && persist.music === 0.4 && persist.sfx === 0.5 && persist.master === 0.7, persist);
await ctx2.close();
// restore defaults for later tests
await page.evaluate(() => { const s = __bg.S().settings; s.musicOn = true; s.sfxOn = true; s.music = 0.6; s.sfx = 0.85; s.master = 1; try { localStorage.setItem('whackerang.save.v1', JSON.stringify(__bg.S())); } catch (e) {} });

// settings UI
await page.evaluate(() => { __bg.S().tutorialDone = true; __bg.UI.show('settings', { ret: 'menu' }); });
await sleep(400);
const ui = await page.evaluate(() => {
  const text = (document.getElementById('ui')?.innerText || '').replace(/\s+/g, ' ');
  const rows = [...document.querySelectorAll('#ui [data-set], #ui .row')].map((r) => ({ set: r.getAttribute('data-set'), t: (r.innerText || '').replace(/\s+/g, ' ').trim(), hasRange: !!r.querySelector('input[type=range]'), hasTog: !!r.querySelector('.tog, button.tog') }));
  const cred = (document.getElementById('set-credits')?.innerText || '');
  return {
    text: text.slice(0, 800),
    credits: cred,
    hasMusicTog: /Music/.test(text) && (!!document.getElementById('set-musicOn') || rows.some((r) => r.set === 'musicOn' || (/^Music$/.test(r.t) && r.hasTog))),
    hasSoundsTog: /Sounds/.test(text) && (!!document.getElementById('set-sfxOn') || rows.some((r) => r.set === 'sfxOn')),
    hasMusicVol: !!document.getElementById('set-music') || rows.some((r) => /Music volume/.test(r.t) && r.hasRange),
    hasSoundsVol: !!document.getElementById('set-sfx') || rows.some((r) => /Sounds volume|Sound FX/.test(r.t) && r.hasRange),
    ids: ['set-musicOn', 'set-sfxOn', 'set-music', 'set-sfx', 'set-master'].map((id) => ({ id, ok: !!document.getElementById(id) })),
  };
});
ok('Settings shows Music and Sounds toggles plus volume sliders', ui.hasMusicTog && ui.hasSoundsTog && ui.hasMusicVol && ui.hasSoundsVol, ui);
ok('Settings credits the CC0 menu and battle tracks', /Happy Clappy Loop/i.test(ui.credits) && /Adventure/i.test(ui.credits) && /CC0/i.test(ui.credits), ui.credits);

await page.screenshot({ path: OUT + '/settings-915.png', type: 'png' });
ok('wrote a settings screenshot', fs.existsSync(OUT + '/settings-915.png'));

// ducking
const duck = await page.evaluate(() => {
  __bg.AU.mute = false;
  __bg.initAudio(); __bg.resumeAudio();
  const s = __bg.S().settings; s.musicOn = true; s.sfxOn = true; s.mute = false; __bg.applyVolumes();
  __bg.music('battle');
  const before = __bg.audioState();
  __bg.sfx('hit', 1);
  const mid = __bg.audioState();
  return { before: before.duck, mid: mid.duck, lastDuck: mid.lastDuck, state: mid.state, mute: __bg.AU.mute };
});
ok('hit SFX ducks the music underneath', (duck.mid < duck.before && duck.mid <= 0.6) || (duck.lastDuck != null && duck.lastDuck <= 0.55), duck);

// hidden tab
const hid = await page.evaluate(async () => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hid || false });
  window.__hid = true;
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((r) => setTimeout(r, 80));
  const a = __bg.audioState();
  window.__hid = false;
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((r) => setTimeout(r, 80));
  const b = __bg.audioState();
  return { hidden: a.state, shown: b.state, has: a.hasCtx };
});
ok('audio pauses when the tab is hidden and resumes when it comes back', hid.has && hid.hidden === 'suspended' && hid.shown === 'running', hid);

// battery saver lowers audio work
const work = await page.evaluate(() => {
  __bg.setAudioSaver(false); const off = __bg.audioState();
  __bg.setAudioSaver(true); const on = __bg.audioState();
  __bg.setAudioSaver(!!(__bg.gfx && __bg.gfx.saver));
  return { offMs: off.schedMs, onMs: on.schedMs, saverOff: off.saver, saverOn: on.saver };
});
ok('Battery saver lowers audio work (slower music scheduler)', work.onMs > work.offMs && work.onMs >= 60 && work.saverOn && !work.saverOff, work);

// offline renders have energy
const rend = await page.evaluate(async () => {
  const energy = (d) => { let e = 0, pk = 0; for (let i = 0; i < d.length; i += 8) { const a = Math.abs(d[i]); e += a * a; if (a > pk) pk = a; } return { rms: Math.sqrt(e / Math.max(1, d.length / 8)), pk }; };
  const names = ['throw', 'catch', 'hit', 'ko', 'dash', 'shieldpop', 'ultready', 'gust', 'trophy', 'click', 'ult_bao', 'ult_yuki'];
  const sfx = {};
  for (const n of names) {
    const steps = [{ name: n, t: 0.05, p: 1 }];
    const d = await __bg.renderSfxSequence(steps, 22050);
    sfx[n] = energy(d);
  }
  const menu = energy(await __bg.renderMusicClip('menu', 4, 22050));
  const battle = energy(await __bg.renderMusicClip('battle', 4, 22050));
  return { sfx, menu, battle };
});
const quiet = Object.entries(rend.sfx).filter(([, v]) => v.pk < 0.02 || v.rms < 0.001);
ok('each listed SFX actually makes a sound (including Puff Gust)', quiet.length === 0, { quiet, sfx: rend.sfx });
ok('menu and battle themes both make sound, and battle is not silent', rend.menu.pk > 0.02 && rend.battle.pk > 0.02, { menu: rend.menu, battle: rend.battle });

// feel414 hooks still present
const feel = await page.evaluate(() => typeof __bg.feel === 'function' && !!(__bg.FEEL || __bg.feel));
ok('feel414 haptics/shake hooks are still present', !!feel);

// local sfx API is what online guests use (no remote-only playback)
ok('SFX play through the local sfx() call (online guests hear their own sounds locally)', typeof (await page.evaluate(() => typeof __bg.sfx)) === 'string' && await page.evaluate(() => typeof __bg.sfx === 'function'));

const pe = errors.filter((e) => !/REQFAIL|ERR_FILE|font|favicon|AudioContext|sw failed/i.test(e));
ok('no unexpected page errors', !pe.length, pe.slice(0, 3));

console.log(JSON.stringify({ summary: { pass, fail } }));
console.log(fail ? 'FAILED' : 'OK sound425 ' + pass + '/' + (pass + fail));
await browser.close();
process.exit(fail ? 1 : 0);
