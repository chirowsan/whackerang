import { launch, sleep } from './lib.mjs';
const { browser, page, errors } = await launch({ w: 640, h: 360 });
await page.goto('file:///workspace/boomerang-brawl/BoomerangBrawl.html'); await sleep(1500);
const res = await page.evaluate(async () => {
  const bg = __bg; bg.app.paused = true; bg.app.mode = 'menu'; const out = {};
  const mk = () => { const inp = [{ mx: 0, mz: 0, aimX: 1, aimZ: 0, fire: false, dash: false, deflect: false }, { mx: 0, mz: 0, aimX: 0, aimZ: 0, fire: false, dash: false, deflect: false }]; const ev = []; const g = new bg.Game({ mode: 'attract', arenaId: 'dojo', intro: 0.01, input: { read: (s) => inp[s] }, onEvent: (n, d) => ev.push(n), players: [0, 1].map((i) => ({ hero: bg.HEROES[i], hat: 'none', ctrl: 'human', slot: i, name: 'p' + i })) });
    g.update(0.02); g.fighters.forEach((f) => { f.spawnT = 1; }); // clear arena of obstacles for a clean lane
    for (let k = 0; k < g.layout.t.length; k++) { if (g.sol[k]) { g.sol[k] = 0; g.crateHp[k] = 0; g.layout.t[k] = 0; g.view.breakCrate(k); } }
    return { g, inp, ev }; };
  const shoot = (g, inp, ticks = 70) => { inp[0].fire = true; for (let i = 0; i < 6; i++) g.update(1 / 60); inp[0].fire = false; for (let i = 0; i < ticks; i++) g.update(1 / 60); };
  { const { g, inp } = mk(); const [a, b] = g.fighters; a.x = -6; a.z = 0; b.x = 0.5; b.z = 0; g.applyPowerup(a, 'extra'); out.extra = { maxAmmo: a.maxAmmo, ammo: a.ammo }; }
  { const { g, inp } = mk(); const [a, b] = g.fighters; a.x = -6; a.z = 0; b.x = 0.5; b.z = 5; g.applyPowerup(a, 'triple'); inp[0].fire = true; for (let i = 0; i < 6; i++) g.update(1 / 60); inp[0].fire = false; g.update(1 / 60); out.triple = { booms: g.booms.length }; }
  { const { g, inp } = mk(); const [a, b] = g.fighters; a.x = -6; a.z = 0; b.x = 0.5; b.z = 0; g.applyPowerup(b, 'shield'); shoot(g, inp, 90); out.shield = { bAlive: b.alive, shieldGone: !b.shield }; shoot(g, inp, 140); out.shield2 = { bAlive: b.alive }; }
  { const { g, inp } = mk(); const [a, b] = g.fighters; a.x = -6; a.z = 0; b.x = 0.5; b.z = 0; shoot(g, inp, 90); out.plain = { bAlive: b.alive, booms: g.booms.length }; }
  { const { g, inp } = mk(); const [a, b] = g.fighters; a.x = -6; a.z = 0; b.x = 0.5; b.z = 3.5; g.applyPowerup(a, 'homing'); shoot(g, inp, 90); out.homing = { bAlive: b.alive }; }
  { const { g, inp } = mk(); const [a, b] = g.fighters; a.x = -6; a.z = 0; b.x = 0.5; b.z = 1.8; g.applyPowerup(a, 'fire'); shoot(g, inp, 90); out.fire = { bAlive: b.alive }; }
  { const { g, inp } = mk(); const [a, b] = g.fighters; a.x = -6; a.z = 0; b.x = 0.5; b.z = 0; g.applyPowerup(a, 'giant'); out.giant = { scale: a.model.root.scale.x }; g.update(1 / 60); out.giantScale = a.model.body.scale.x; }
  { const { g, inp } = mk(); const [a, b] = g.fighters; a.x = -6; a.z = 0; b.x = 0.5; b.z = 0; const x0 = a.x; inp[0].mx = 1; for (let i = 0; i < 60; i++) g.update(1 / 60); const d1 = a.x - x0; g.applyPowerup(a, 'speed'); a.x = -6; const x1 = a.x; for (let i = 0; i < 60; i++) g.update(1 / 60); out.speed = { base: +d1.toFixed(2), boosted: +(a.x - x1).toFixed(2) }; }
  { const { g, inp } = mk(); const [a, b] = g.fighters; a.x = -6; a.z = 0; b.x = 0.5; b.z = 0; inp[1].deflect = false; shoot(g, inp, 0); for (let i = 0; i < 70; i++) { g.update(1 / 60); const bm = g.booms[0]; if (bm && Math.hypot(bm.x - b.x, bm.z - b.z) < 2.2 && b.deflectT <= 0 && b.deflectCd <= 0) { inp[1].deflect = true; g.update(1 / 60); inp[1].deflect = false; } } out.deflect = { bAlive: b.alive, aAlive: a.alive, owner: g.booms[0] ? g.booms[0].owner.name : null }; }
  { const { g, inp } = mk(); const [a, b] = g.fighters; a.x = -6; a.z = 0; b.x = 0.5; b.z = 0; inp[1].dash = false; shoot(g, inp, 0); let dashed = false; for (let i = 0; i < 80; i++) { g.update(1 / 60); const bm = g.booms[0]; if (!dashed && bm && Math.hypot(bm.x - b.x, bm.z - b.z) < 2.0) { inp[1].dash = true; inp[1].mx = 0; inp[1].mz = 1; g.update(1 / 60); inp[1].dash = false; dashed = true; } } out.dash = { dashed, bAlive: b.alive }; }
  return out; });
console.log(JSON.stringify(res, null, 1)); console.log(errors); await browser.close();
