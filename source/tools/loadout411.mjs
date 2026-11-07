// v4.11 per-character weapons: roster mapping, legality (humans, bots, host), per-slot per-character save + migration, wire code,
// and deterministic mechanic differences (fixed-dt stepping with the page loop detached, seeded RNG, frozen bots). usage: node tools/loadout411.mjs
import { launch, sleep } from './lib.mjs';
const url = 'file:///workspace/boomerang-brawl/Whackerang.html';
const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 1, mobile: true }); await page.goto(url); await sleep(2500);
const R = []; const ok = (n, v, i) => { R.push(!!v); console.log((v ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' ' + JSON.stringify(i) : '')); };
// --- roster mapping
const ro = await page.evaluate(() => { const { WEAPONS, HERO_WPN } = __bg.weapons; const heroes = __bg.HEROES ? __bg.HEROES.map((h) => h.id) : Object.keys(HERO_WPN); const all = Object.values(HERO_WPN).flat();
  const sig = (id) => { const w = WEAPONS[id]; return [w.melee.pat, w.fx.home ? 'h' : '', w.fx.pierce ? 'p' : '', w.fx.stun ? 's' : '', w.mfx.stun ? 'S' : '', w.form].join('|'); };
  const vec = (id) => { const w = WEAPONS[id]; return [w.v, w.hitR, w.curve, w.melee.reach, w.melee.arc, 1 / w.melee.cd, 1 / (w.melee.wind + w.melee.rec)]; };
  const dom = []; for (const L of Object.values(HERO_WPN)) for (const a of L) for (const b of L) if (a !== b) { const A = vec(a), B = vec(b); if (A.every((x, i) => x >= B[i])) dom.push(a + '>' + b); }
  const map = {}; for (const [h, L] of Object.entries(HERO_WPN)) map[h] = L.map((id) => `${WEAPONS[id].name} [${sig(id)}]`);
  return { n: Object.keys(HERO_WPN).length, sizes: Object.values(HERO_WPN).map((l) => l.length), uniq: new Set(all).size === all.length, total: all.length, boomShared: all.includes('boom'), dom,
    sigDistinct: Object.values(HERO_WPN).every((L) => new Set(L.map(sig)).size === 3), forms: Object.fromEntries(Object.entries(HERO_WPN).map(([h, L]) => [h, L.map((id) => WEAPONS[id].form)])), map }; });
console.log('MAP ' + JSON.stringify(ro.map));
ok('8 characters x 3 own weapons, 24 total, no weapon shared between characters, base boomerang not in any list', ro.n === 8 && ro.sizes.every((x) => x === 3) && ro.uniq && ro.total === 24 && !ro.boomShared, ro);
ok('within each character the 3 weapons differ in pattern/effect/shape signature', ro.sigDistinct, ro.forms);
ok('no weapon is a straight upgrade of a sibling (every pair trades something)', ro.dom.length === 0, ro.dom);
// --- harness: deterministic game with chosen heroes/weapons
const mk = (o) => page.evaluate((o) => { let sd = 777; Math.random = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const S = __bg.S(); S.tutorialDone = true; S.settings.events = 'off'; S.setup.arena = 'dojo'; S.setup.size = 'small'; S.setup.traps = 'off'; S.setup.bots = o.bots || 1; S.setup.mode = 'classic'; S.setup.players = 1; S.hero = o.hero || 'bao';
  if (!S.unlockedHeroes.includes(S.hero)) S.unlockedHeroes.push(S.hero); S.loadout = [{ [S.hero]: o.wpn }, {}]; __bg.app.startMode('classic'); const g = __bg.app.game; const U = g.update.bind(g); g.update = () => {};
  for (let k = 0; k < 900 && g.state !== 'play'; k++) U(1 / 60); g.sol.fill(0); if (g.layout.bush) g.layout.bush.fill(0); g.bushN = 0;
  for (const f of g.fighters) { if (f !== g.fighters[0]) f.bot = { update: () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }) }; f.inv = 0; f.shield = false; f.deflectT = 0; f.stunT = 0; f.hp = f.maxHp = 3; f.lives = 9; f.slCd = 0; f.slT = -1; f.throwCd = 0; f.vx = f.vz = 0; f.revealT = 0; }
  g.fighters[0].bot = { update: () => ({ mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false, ult: false }) };
  window.__g = g; window.__U = (n) => { for (let k = 0; k < n; k++) U(1 / 60); }; return { wpn: g.fighters[0].wpn, n: g.fighters.length, bots: g.fighters.slice(1).map((f) => [f.hero.id, f.wpn]) }; }, o);
// legality for every character: each own weapon equips; another character's weapon / junk / v4.10 id falls back to the first
const leg = []; for (const h of ['bao', 'nori', 'tako', 'kuma', 'pico', 'yuki', 'gus', 'wisp']) { const L = await page.evaluate((h) => __bg.weapons.HERO_WPN[h], h);
  for (const id of L) leg.push([h, id, (await mk({ hero: h, wpn: id })).wpn === id]); const other = h === 'bao' ? 'nori_kama' : 'bao_wok'; for (const bad of [other, 'mallet', 'zzz', undefined]) leg.push([h, String(bad), (await mk({ hero: h, wpn: bad })).wpn === L[0]]); }
ok('every character equips each of its own 3 weapons; cross-character / old v4.10 / junk ids fall back to that character\'s first weapon', leg.every((x) => x[2]), leg.filter((x) => !x[2]));
const bt = []; for (let r = 0; r < 4; r++) { const z = await mk({ hero: 'yuki', wpn: 'yuki_katana', bots: 3 }); bt.push(...z.bots); }
const bLegal = await page.evaluate((bt) => bt.every(([h, w]) => __bg.weapons.HERO_WPN[h].includes(w)), bt); ok('bots only carry their own character\'s weapons', bLegal && bt.length >= 12, bt);
// wire: 0 = base, 1..3 = own index; cross-character code decodes inside the owner's own list
const wire = await page.evaluate(() => { const { HERO_WPN, wpnCode, wpnDecode } = __bg.weapons; let ok = true; for (const [h, L] of Object.entries(HERO_WPN)) L.forEach((id) => { if (wpnDecode(h, wpnCode(h, id)) !== id || wpnCode(h, id) > 15) ok = false; }); return { ok, base: wpnDecode('bao', 0), cross: wpnCode('bao', 'nori_kama'), boss: wpnCode('bao', 'boom') }; });
ok('wire code round-trips every weapon in 4 bits; base/boss and cross-character ids encode as 0 (base boomerang)', wire.ok && wire.base === 'boom' && wire.cross === 0 && wire.boss === 0, wire);
// --- deterministic mechanic differences
const swing = (o) => page.evaluate(async (o) => { const g = __g, [a, b] = g.fighters; a.x = 0; a.z = 0; b.x = o.bx; b.z = o.bz || 0; const hp0 = b.hp; a.startSlash(o.ang || 0); const x0 = a.x, z0 = a.z; let maxStun = 0; for (let k = 0; k < 40; k++) { __U(1); maxStun = Math.max(maxStun, b.stunT); if (k < 30) { b.x = o.bx; b.z = o.bz || 0; } } return { dx: +Math.hypot(a.x - x0, a.z - z0).toFixed(3), dhp: hp0 - b.hp, stun: +maxStun.toFixed(2) }; }, o);
await mk({ hero: 'bao', wpn: 'bao_pin' }); const lp = await swing({ bx: 6, bz: 3 }); await mk({ hero: 'bao', wpn: 'bao_wok' }); const lw = await swing({ bx: 6, bz: 3 });
ok('Bao: Rolling Pin LUNGES (steps much farther during its swing than the Iron Wok sweep)', lp.dx > lw.dx * 2 && lp.dx > 0.25, { pin: lp, wok: lw });
await mk({ hero: 'tako', wpn: 'tako_drone' }); const sp = await swing({ bx: -1.0, ang: 0 }); await mk({ hero: 'tako', wpn: 'tako_wrench' }); const wr = await swing({ bx: -1.0, ang: 0 });
ok('Bolt: Rotor Drone SPIN 360 hits a rival directly behind; Wrench sweep (100°) does not', sp.dhp === 1 && wr.dhp === 0, { drone: sp, wrench: wr });
await mk({ hero: 'tako', wpn: 'tako_wrench' }); const ws = await swing({ bx: 1.0, ang: Math.PI / 2 });
ok('Bolt: Wrench hit = exactly one heart and a short stun', ws.dhp === 1 && ws.stun > 0.2, ws);
await mk({ hero: 'pico', wpn: 'pico_staff' }); const ps = await swing({ bx: 2.45, ang: Math.PI / 2 }); await mk({ hero: 'pico', wpn: 'pico_chakram' }); const pc = await swing({ bx: 2.45, ang: Math.PI / 2 });
ok('Pico: Bo Staff THRUST reaches 2.45 away (one heart); Chakram swing does not', ps.dhp === 1 && pc.dhp === 0, { staff: ps, chakram: pc });
await mk({ hero: 'pico', wpn: 'pico_staff' }); const pn = await swing({ bx: 1.2, bz: 1.0, ang: Math.PI / 2 }); await mk({ hero: 'pico', wpn: 'pico_chakram' }); const cw = await swing({ bx: 1.2, bz: 1.0, ang: Math.PI / 2 });
ok('Pico: Bo Staff is narrow (misses 40° off-line), Chakram sweep catches it', pn.dhp === 0 && cw.dhp === 1, { staff: pn, chakram: cw });
// throws: homing vs not, pierce vs not, stun on throw
const thr = (o) => page.evaluate(async (o) => { const g = __g, [a, ...rs] = g.fighters; a.x = 0; a.z = 0; a.face = o.ang; rs.forEach((r, i) => { r.x = o.pos[i][0]; r.z = o.pos[i][1]; }); const hp0 = rs.map((r) => r.hp); if (o.noHome) { const B = g.booms; }
  g.throwFrom(a, o.ang, true, 0.4); if (o.noHome) g.booms.forEach((b) => (b.homeK = 0)); let minD = 99, stun = 0; for (let k = 0; k < 120; k++) { __U(1); rs.forEach((r, i) => { r.x = o.pos[i][0]; r.z = o.pos[i][1]; }); for (const b of g.booms) if (b.owner === a) minD = Math.min(minD, Math.hypot(b.x - rs[0].x, b.z - rs[0].z)); stun = Math.max(stun, rs[0].stunT); }
  return { dhp: rs.map((r, i) => hp0[i] - r.hp), minD: +minD.toFixed(2), stun: +stun.toFixed(2) }; }, o);
const sig = await page.evaluate(() => typeof __bg.app.game.throwFrom); 
await mk({ hero: 'tako', wpn: 'tako_magnet' }); const hm = await thr({ ang: 0.7, pos: [[0, 5]] }); await mk({ hero: 'tako', wpn: 'tako_magnet' }); const hn = await thr({ ang: 0.7, pos: [[0, 5]], noHome: true });
ok('Bolt: Magnet Disc throw HOMES (gets much closer to an off-line rival than the same throw with homing off)', hm.minD < hn.minD - 0.4, { home: hm, off: hn });
await mk({ hero: 'pico', wpn: 'pico_chakram', bots: 2 }); const pr = await thr({ ang: 0, pos: [[0, 2.2], [0, 4.0]] }); await mk({ hero: 'pico', wpn: 'pico_staff', bots: 2 }); const np = await thr({ ang: 0, pos: [[0, 2.2], [0, 4.0]] });
ok('Pico: Chakram PIERCES (both rivals in line lose one heart); Bo Staff throw stops at the first', pr.dhp[0] === 1 && pr.dhp[1] === 1 && np.dhp[0] === 1 && np.dhp[1] === 0, { chakram: pr, staff: np });
await mk({ hero: 'gus', wpn: 'gus_kettle' }); const kt = await thr({ ang: 0, pos: [[0, 2.5]] });
ok('Gus: Kettlebell throw = one heart and a stun', kt.dhp[0] === 1 && kt.stun > 0.2, kt);
// --- save: per slot per character, switching restores, migration
const sv = await page.evaluate(() => { const S = __bg.S(); S.loadout = [{}, {}]; const set = (sl, h, id) => { S.loadout[sl][h] = id; }; S.setup.players = 2; S.hero = 'bao'; S.hero2 = 'nori';
  set(0, 'bao', 'bao_pin'); set(0, 'nori', 'nori_tanto'); set(1, 'nori', 'nori_kama'); set(1, 'bao', 'bao_cleaver'); const d = (sl) => __bg.app.humanDef(sl).weapon; const r = { p1bao: d(0) };
  S.hero = 'nori'; S.hero2 = 'bao'; r.p1nori = d(0); r.p2bao = d(1); S.hero = 'bao'; S.hero2 = 'nori'; r.p1baoBack = d(0); r.p2nori = d(1); S.hero = 'gus'; r.p1gusDefault = d(0); return r; });
ok('loadout saved per slot AND per character; switching character restores that character\'s own choice; unset character = its first weapon', sv.p1bao === 'bao_pin' && sv.p1nori === 'nori_tanto' && sv.p2bao === 'bao_cleaver' && sv.p1baoBack === 'bao_pin' && sv.p2nori === 'nori_kama' && sv.p1gusDefault === 'gus_dumbbell', sv);
await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem('whackerang.save.v1')); delete raw.loadout; raw.wpn = ['mallet', 'hook']; raw.hero = 'bao'; raw.hero2 = 'kuma'; localStorage.setItem('whackerang.save.v1', JSON.stringify(raw)); });
await page.reload(); await sleep(2500); const mg = await page.evaluate(() => __bg.S().loadout);
ok('migration: v4.10 global P1 Mallet / P2 Hook -> P1 Bao Rolling Pin, P2 Salty Hook Hand (only for the selected characters)', mg[0].bao === 'bao_pin' && mg[1].kuma === 'kuma_hook' && Object.keys(mg[0]).length === 1 && Object.keys(mg[1]).length === 1, mg);
await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem('whackerang.save.v1')); raw.loadout = [{ bao: 'nori_kama', gus: 'junk' }, { tako: 'tako_drone' }]; localStorage.setItem('whackerang.save.v1', JSON.stringify(raw)); });
await page.reload(); await sleep(2500); const iv = await page.evaluate(() => __bg.S().loadout); ok('invalid saved entries (another character\'s weapon, junk) are repaired on load; valid ones kept', iv[0].bao === 'bao_wok' && iv[0].gus === 'gus_dumbbell' && iv[1].tako === 'tako_drone', iv);
const pe = errors.filter((e) => !/REQFAIL|ERR_FILE/.test(e)); ok('no page errors', !pe.length, pe.slice(0, 3));
const f = R.filter((x) => !x).length; console.log(JSON.stringify({ summary: { pass: R.length - f, fail: f } })); await browser.close(); process.exit(f ? 1 : 0);
