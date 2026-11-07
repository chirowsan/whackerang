// v4.10 melee + Armory online checks over the LOCAL relay with real browsers. OLD = the actual published v4.9.0 page.
// usage: node tools/net_melee410.mjs [relay=ws://localhost:8799] [new.html] [old.html]
import http from 'node:http'; import fs from 'node:fs';
import { startRelay, openN, ev, sleep, waitFor } from './netlib.mjs';
const RLY = process.argv[2] || 'ws://localhost:8799'; const NEW = process.argv[3] || '/workspace/boomerang-brawl/Whackerang.html', OLD = process.argv[4] || '/workspace/out/v4.10/published-v4.9.0.html';
const PORT = 8450 + (process.pid % 40);
const srv = http.createServer((q, r) => { const f = q.url.startsWith('/old') ? OLD : q.url.startsWith('/new') ? NEW : null; if (!f) { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(''); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(f)); }).listen(PORT);
const U = (v) => `http://localhost:${PORT}/${v}`; const sig = await startRelay(9135);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 600) : '')); };
async function room(vers, label, fn, wpns = []) {
  const T = await openN(vers.length, { relay: sig.url, rly: RLY, url: U('new'), w: 640, h: 360, extra: { forceRelay: true } });
  try { const P = T.pages.map((p) => p.page);
    for (let i = 0; i < vers.length; i++) { if (vers[i] !== 'new') { await P[i].goto(U(vers[i])); await sleep(1800); } await ev(T.pages[i], (w) => { const s = __bg.S(); s.tutorialDone = true; s.settings.events = 'off'; s.settings.speed = 'fast'; if (w) { s.hero = w.split('_')[0]; if (!s.unlockedHeroes.includes(s.hero)) s.unlockedHeroes.push(s.hero); s.loadout = [{ [s.hero]: w }, {}]; } /* v4.11 per-character */ }, wpns[i] || null); }
    await fn(T.pages, label);
  } finally { await T.browser.close(); }
}
const join = async (H, G, code) => { await ev(G, (c) => { __bg.net.join(c).catch(() => {}); }, code); return await waitFor(async () => (await ev(G, () => __bg.net.phase)) === 'lobby', 45000); };
const start = async (H, Gs, mode = 'classic') => { await ev(H, (m) => { __bg.net.setSetting('mode', m); __bg.net.setSetting('size', 'small'); __bg.net.setSetting('traps', 'off'); __bg.net.setSetting('bots', 0); }, mode); for (const G of Gs) await ev(G, () => __bg.net.setReady(true)); await sleep(1500); await ev(H, () => __bg.net.startMatch());
  return await waitFor(async () => { const all = await Promise.all([H, ...Gs].map((p) => ev(p, () => __bg.app.game && __bg.app.game.state))); return all.every((s) => s === 'play'); }, 30000, 200); };
const info = () => { const g = __bg.app.game; return { dens: g.dens, melee: !!g.melee, w: g.fighters.map((f) => f.wpn || 'n/a'), hp: g.fighters.map((f) => f.hp), humans: g.fighters.map((f) => f.isBot ? 'bot' : 'h') }; };
// pin: host keeps the guest's fighter right in front of the host's own fighter, bots frozen
const pin = () => { const g = __bg.app.game; const me = g.fighters.find((q) => !q.isBot && q.def.slot === 0); const gu = g.fighters.find((q) => q !== me && !q.isBot); g.fighters.forEach((q) => { if (q.bot) q.bot.update = () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }); }); g.sol.fill(0);
  window.__pinI = setInterval(() => { me.x = 0; me.z = 0; me.vx = me.vz = 0; gu.x = 1.0; gu.z = 0; gu.vx = gu.vz = 0; g.playTime = 5; }, 5); return { me: g.fighters.indexOf(me), gu: g.fighters.indexOf(gu) }; };
await room(['new', 'new'], 'A new host + new guest', async ([H, G], L) => { const h = await ev(H, async () => await __bg.net.host()); ok(`${L}: lobby`, await join(H, G, h.code)); ok(`${L}: both playing`, await start(H, [G]));
  const [a, b] = [await ev(H, info), await ev(G, info)]; ok(`${L}: room negotiates dens 5 with melee on both screens`, a.dens === 5 && b.dens === 5 && a.melee && b.melee, { a, b });
  ok(`${L}: host-validated weapon choice (host Bao Rolling Pin, guest Salty Hook Hand) identical on both screens`, a.w.join() === b.w.join() && a.w.includes('bao_pin') && a.w.includes('kuma_hook'), { a: a.w, b: b.w });
  const ix = await ev(H, pin); await sleep(400);
  // 1) GUEST swings with the real key binding -> host sim applies one heart to the host fighter; guest sees the host's hp drop
  await ev(H, () => { window.__hs = 0; const g = __bg.app.game; g.fighters.forEach((f) => { const o = f.startSlash.bind(f); f.startSlash = (x) => { window.__hs++; o(x); }; }); });
  await ev(G, () => { window.__gslash = 0; const W = __bg.app.game; const iv = setInterval(() => { W.fighters.forEach((f) => { if (f.slV >= 0 && !f.__c) { f.__c = 1; window.__gslash++; } if (f.slV < 0) f.__c = 0; }); }, 5); window.__giv = iv; });
  const hp0 = (await ev(H, info)).hp[ix.me]; await ev(G, () => { __bg.Input.edge.add('KeyG'); }); await sleep(900);
  const aH = await ev(H, info), aG = await ev(G, info); ok(`${L}: guest key-G swing is simulated by the host: host fighter loses exactly one heart, guest screen agrees`, aH.hp[ix.me] === hp0 - 1 && aG.hp[ix.me] === hp0 - 1, { hp0, host: aH.hp, guest: aG.hp });
  ok(`${L}: guest saw the swing animation from the host event`, (await ev(G, () => window.__gslash)) >= 1);
  // 2) cooldown: two key presses in quick succession -> only one swing
  await ev(H, () => { const g = __bg.app.game; g.fighters.forEach((f) => { f.inv = 0; }); window.__hs = 0; }); await sleep(1600); await ev(H, () => { __bg.app.game.fighters.forEach((f) => { f.inv = 0; }); window.__hs = 0; });
  await ev(G, () => { __bg.Input.edge.add('KeyG'); setTimeout(() => __bg.Input.edge.add('KeyG'), 120); }); await sleep(900); const n2 = await ev(H, () => window.__hs); ok(`${L}: two presses 0.12 s apart -> one swing (cooldown on the host)`, n2 === 1, n2);
  // 3) HOST swings at the guest -> guest's own fighter hp drops on the guest screen
  await sleep(1600); const hpG0 = (await ev(G, info)).hp[ix.gu]; await ev(H, (i) => { const g = __bg.app.game; g.fighters.forEach((f) => { f.inv = 0; }); const me = g.fighters[i.me], gu = g.fighters[i.gu]; me.slCd = 0; me.startSlash(Math.atan2(gu.x - me.x, gu.z - me.z)); }, ix); await sleep(900);
  ok(`${L}: host swing hits the guest; guest screen shows one heart lost`, (await ev(G, info)).hp[ix.gu] === hpG0 - 1, { hpG0, now: (await ev(G, info)).hp });
  // 4) guest throws: its projectile carries the hook weapon on the host, and the guest renders a hook
  await ev(H, () => clearInterval(window.__pinI)); await sleep(1600);
  await ev(G, () => { __bg.Input.edge.add('KeyF'); __bg.Input.keys.add('KeyF'); setTimeout(() => __bg.Input.keys.delete('KeyF'), 200); }); 
  const bw = await waitFor(async () => { const h2 = await ev(H, () => __bg.app.game.booms.map((b) => b.wpn)); const g2 = await ev(G, () => __bg.app.game.booms.map((b) => b.wpn)); return h2.includes('kuma_hook') && g2.includes('kuma_hook') ? { h2, g2 } : null; }, 4000, 50);
  ok(`${L}: guest's Hook Hand projectile is the same character weapon on both screens (per-owner wire code)`, !!bw, bw);
}, ['bao_pin', 'kuma_hook']);
for (const [bad, tag] of [['laser9000', 'B unknown weapon id'], ['bao_wok', 'B2 another character\'s weapon (cross-character)']]) await room(['new', 'new'], `${tag} from a modified Nori guest`, async ([H, G], L) => { await ev(G, (bad) => { const S = __bg.S(); S.hero = 'nori'; S.loadout = [{ nori: bad }, {}]; const N = __bg.net; const o = N.profile.bind(N); N.profile = () => ({ ...o(), hero: 'nori', weapon: bad }); }, bad); await ev(H, () => { __bg.S().hero = 'bao'; __bg.S().loadout = [{ bao: 'bao_cleaver' }, {}]; });
  const h = await ev(H, async () => await __bg.net.host()); ok(`${L}: lobby`, await join(H, G, h.code)); ok(`${L}: playing`, await start(H, [G])); const a = await ev(H, info), b = await ev(G, info); const heroes = await ev(H, () => __bg.app.game.fighters.map((f) => f.hero.id));
  const gi = heroes.indexOf('nori'); ok(`${L}: host validates to Nori's own first weapon (Shuriken); host keeps its Cleaver; guest screen agrees`, gi >= 0 && a.w[gi] === 'nori_shuriken' && a.w[heroes.indexOf('bao')] === 'bao_cleaver' && a.w.join() === b.w.join(), { heroes, a: a.w, b: b.w }); });
await room(['new', 'old'], 'C new host + PUBLISHED v4.9.0 guest', async ([H, G], L) => { const h = await ev(H, async () => await __bg.net.host()); ok(`${L}: v4.9 guest reached the lobby`, await join(H, G, h.code)); ok(`${L}: both playing`, await start(H, [G])); const a = await ev(H, info); const gd = await ev(G, () => __bg.app.game.dens);
  ok(`${L}: room falls back to dens 4: no melee, boomerang-only, same v4.9 bush map`, a.dens === 4 && !a.melee && a.w.every((w) => w === 'boom') && gd === 4, { a, gd });
  const ix = await ev(H, pin); await sleep(300); await ev(G, () => { __bg.Input.edge.add('KeyG'); }); await ev(H, (i) => { const f = __bg.app.game.fighters[i.me]; window.__cs = f.canSlash(); }, ix); await sleep(600); const a2 = await ev(H, info); ok(`${L}: no swing possible on either side (legacy attack only)`, (await ev(H, () => window.__cs)) === false && a2.hp.join() === a.hp.join(), { a: a.hp, a2: a2.hp }); });
await room(['old', 'new'], 'D PUBLISHED v4.9.0 host + new guest', async ([H, G], L) => { const h = await ev(H, async () => await __bg.net.host()); ok(`${L}: lobby`, await join(H, G, h.code)); ok(`${L}: both playing`, await start(H, [G])); const b = await ev(G, info); ok(`${L}: new guest plays the v4.9 rules: dens 4, melee off, boomerang only`, b.dens === 4 && !b.melee && b.w.every((w) => w === 'boom'), b); });
await room(['new', 'new', 'old'], 'E published v4.9.0 guest joins a running melee round', async ([H, G, O], L) => { const h = await ev(H, async () => await __bg.net.host()); ok(`${L}: lobby`, await join(H, G, h.code)); ok(`${L}: playing dens 5`, (await start(H, [G])) && (await ev(H, () => __bg.app.game.dens)) === 5);
  await ev(O, (c) => { window.__jerr = null; __bg.net.join(c).catch((e) => { window.__jerr = (e && (e.code || e.message)) || String(e); }); }, h.code);
  const got = await waitFor(async () => { const r = await ev(O, () => ({ ph: __bg.net.phase, err: window.__jerr, last: __bg.net.lastErr, e: __bg.net.error })); return /version/.test(JSON.stringify(r)) ? r : null; }, 40000, 300);
  const st = await ev(O, () => ({ game: !!(__bg.app.game && __bg.app.game.mode === 'vs') })); ok(`${L}: v4.9 client gets the update-required version reject and never enters the round`, !!got && !st.game, { got, st }); });
console.log(`${pass}/${pass + fail} passed`); srv.close(); sig.stop(); process.exit(fail ? 1 : 0);
