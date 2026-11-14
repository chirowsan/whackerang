// t415u: WebKit iPhone-emulation regression — can leave the Online menu by Back, Escape, and browser-back
// in every pre-match Online state, then start a local match. Playwright WPE, not a real iPhone.
import { wk, devices, sleep } from './wklib.mjs';
import fs from 'fs';
import path from 'path';

const HTML = process.argv[2] || '/workspace/boomerang-brawl/Whackerang.html';
const OUT = '/workspace/out/net412';
const SHOT = path.join(OUT, 'shots');
fs.mkdirSync(SHOT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'logs'), { recursive: true });

let pass = 0, fail = 0;
const ok = (n, c, x) => {
  if (c) pass++; else fail++;
  const extra = x !== undefined ? ' ' + JSON.stringify(x).slice(0, 500) : '';
  console.log((c ? 'PASS ' : 'FAIL ') + n + extra);
};

const boot = async (devName, { hideRotate = false, notch = false } = {}) => {
  const { browser, page, errors, version } = await wk(devName, {});
  await page.addInitScript(() => {
    try {
      localStorage.setItem('whackerang.save.v1', JSON.stringify({
        tutorialDone: true, coins: 20,
        settings: { a2hs: true, touch: 'on', noAutoPause: true, quality: 'fast', events: 'off', autoMatch: true },
      }));
    } catch (e) {}
  });
  const url = /^(https?:|file:)/i.test(HTML) ? HTML : 'file://' + HTML;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  if (/^https?:/i.test(url)) {
    // drop a stale Pages service worker so this run sees the just-deployed build
    await page.evaluate(async () => {
      try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); } catch (e) {}
      try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch (e) {}
    });
    await page.reload({ waitUntil: 'load', timeout: 60000 });
  }
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => !!(window.__bg && __bg.UI && __bg.UI.cur))) break;
    await sleep(150);
  }
  await page.evaluate(({ hideRotate, notch }) => {
    const a = document.getElementById('a2hs'); if (a) a.remove();
    try { const S = __bg.S(); S.tutorialDone = true; S.settings.a2hs = true; } catch (e) {}
    if (hideRotate) {
      const r = document.getElementById('rotate');
      if (r) r.style.setProperty('display', 'none', 'important');
    }
    if (notch) {
      // Playwright WPE reports env(safe-area-inset-*) as 0 and input.js would overwrite --sa*.
      // --test-sa* is the hook the game CSS honors without fighting the probe.
      const root = document.documentElement;
      root.style.setProperty('--test-sail', '47px');
      root.style.setProperty('--test-sair', '47px');
      root.style.setProperty('--test-sait', '0px');
      root.style.setProperty('--test-saib', '21px');
    }
  }, { hideRotate, notch });
  await sleep(200);
  return { browser, page, errors, version };
};

const ev = (page, fn, a) => page.evaluate(fn, a);

const inspect = (page) => ev(page, () => {
  const back = document.querySelector('#ui [data-back], #ui header .btn.back, #ui-back, #net-search-back, #net-search-cancel');
  const r = back && back.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : 0, y = r ? r.top + r.height / 2 : 0;
  const top = r ? document.elementFromPoint(x, y) : null;
  const rot = document.getElementById('rotate');
  const rotOn = !!(rot && getComputedStyle(rot).display !== 'none' && getComputedStyle(rot).visibility !== 'hidden');
  const sail = getComputedStyle(document.documentElement).getPropertyValue('--sail').trim();
  return {
    uiCur: window.__bg && __bg.UI && __bg.UI.cur,
    mode: window.__bg && __bg.app && __bg.app.mode,
    match: window.__bg && __bg.Match && __bg.Match.state,
    netActive: !!(window.__bg && __bg.net && __bg.net.active),
    focused: document.activeElement && (document.activeElement.id || document.activeElement.tagName),
    rotateOn: rotOn,
    sail,
    vw: innerWidth, vh: innerHeight,
    back: back && {
      id: back.id, text: (back.textContent || '').trim().slice(0, 24),
      pe: getComputedStyle(back).pointerEvents,
      box: { t: +r.top.toFixed(1), l: +r.left.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
      hitsSelf: !!top && (top === back || back.contains(top)),
      top: top && (top.id || top.tagName + '.' + String(top.className).slice(0, 60)),
    },
  };
});

const tapSel = async (page, sel, textRe) => {
  const p = await ev(page, ({ sel, textRe }) => {
    let e = sel ? document.querySelector(sel) : null;
    if (!e && textRe) {
      const re = new RegExp(textRe, 'i');
      e = [...document.querySelectorAll('#ui button, #menu button')].find((b) => re.test(b.textContent));
    }
    if (!e) return null;
    const b = e.getBoundingClientRect();
    const x = b.left + b.width / 2, y = b.top + b.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, w: b.width, h: b.height, vis: b.width > 8 && b.height > 8, hitsSelf: !!top && (top === e || e.contains(top)), id: e.id, text: (e.textContent || '').trim().slice(0, 40), top: top && (top.id || String(top.className).slice(0, 40)) };
  }, { sel, textRe });
  if (p && p.vis) await page.touchscreen.tap(p.x, p.y);
  await sleep(450);
  return p;
};

const tapBack = async (page) => {
  const st = await inspect(page);
  if (!st.back) return { missing: true, st };
  const { l, t, w, h } = st.back.box;
  await page.touchscreen.tap(l + w / 2, t + h / 2);
  await sleep(450);
  return { st, after: await inspect(page) };
};

const openOnline = async (page) => {
  const t = await tapSel(page, null, 'Play online');
  let st = await inspect(page);
  if (st.uiCur !== 'netMenu') {
    const shown = await ev(page, () => { if (!(window.__bg && __bg.UI)) return false; __bg.UI.show('netMenu'); return true; });
    await sleep(250);
    st = await inspect(page);
    st.touchOpenFailed = true;
    st.playTap = t;
    st.shown = shown;
  }
  return st;
};

const waitMenu = async (page, ms = 2500) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const st = await inspect(page);
    if (st.uiCur === 'menu' || st.mode === 'menu') return st;
    await sleep(80);
  }
  return inspect(page);
};

const startLocal = async (page) => {
  let st = await inspect(page);
  if (st.uiCur !== 'menu') return { from: st, ok: false, reason: 'not-on-menu' };
  const play = await tapSel(page, null, '^\\s*▶?\\s*Play\\s*$');
  await sleep(200);
  st = await inspect(page);
  const start = await tapSel(page, null, 'START');
  await sleep(800);
  const after = await ev(page, () => ({
    mode: __bg.app && __bg.app.mode,
    state: __bg.app && __bg.app.game && __bg.app.game.state,
    uiCur: __bg.UI && __bg.UI.cur,
  }));
  // leave the match so the next case starts from the menu
  if (after.mode === 'play' || after.state === 'play' || after.state === 'countdown') {
    await ev(page, () => { try { __bg.app.quitToMenu(); } catch (e) {} });
    await sleep(400);
  }
  return { play, start, after, ok: after.mode === 'play' || after.state === 'play' || after.state === 'countdown' };
};

const log = [];

// ---------- landscape: real phone Online path ----------
for (const dev of ['iPhone 13 landscape', 'iPhone 15 landscape']) {
  for (const notch of [false, true]) {
    const tag = dev.replace(/\s+/g, '-') + (notch ? '-notch' : '');
    const { browser, page, errors, version } = await boot(dev, { notch });
    const booted = await ev(page, () => !!(window.__bg && __bg.UI && __bg.UI.cur === 'menu'));
    ok(`${tag}: booted (webkit ${version})`, booted);
    if (!booted) { await browser.close(); continue; }

    // 3 repeats of open + touch Back
    for (let i = 1; i <= 3; i++) {
      const opened = await openOnline(page);
      ok(`${tag}: touch opens Play online (${i})`, opened.uiCur === 'netMenu' && !opened.touchOpenFailed, opened);
      const b = opened.back;
      ok(`${tag}: Back is visible and tappable (${i})`, !!(b && b.hitsSelf && b.pe !== 'none' && b.box.h >= 40 && b.box.w >= 60), b);
      if (notch) {
        ok(`${tag}: Back sits inside the 47px left safe area (${i})`, !!(b && b.box.l >= 46), b && b.box);
      }
      if (i === 1 && !notch) await page.screenshot({ path: path.join(SHOT, `after-netmenu-${tag}.png`) });
      const tb = await tapBack(page);
      const backToMenu = tb.after && tb.after.uiCur === 'menu';
      ok(`${tag}: touch Back returns to the main menu (${i})`, backToMenu, tb.after);
    }

    // Escape from netMenu
    await openOnline(page);
    await page.keyboard.press('Escape');
    await sleep(350);
    ok(`${tag}: Escape leaves Online for the main menu`, (await waitMenu(page)).uiCur === 'menu', await inspect(page));

    // browser back
    await openOnline(page);
    await ev(page, () => history.back());
    await sleep(400);
    ok(`${tag}: browser Back leaves Online for the main menu`, (await waitMenu(page)).uiCur === 'menu', await inspect(page));

    // join + input focused + Escape, then Back from netMenu
    await openOnline(page);
    const join = await tapSel(page, '#net-joinroom', 'Join room');
    let jst = await inspect(page);
    ok(`${tag}: Join room opens`, jst.uiCur === 'netJoin', { join, jst });
    if (!notch) await page.screenshot({ path: path.join(SHOT, `after-netjoin-${tag}.png`) }).catch(() => {});
    await ev(page, () => { const i = document.getElementById('net-code'); if (i) i.focus(); });
    await sleep(150);
    const focused = await ev(page, () => document.activeElement && document.activeElement.id);
    ok(`${tag}: room-code field can take focus`, focused === 'net-code', { focused });
    await page.keyboard.press('Escape');
    await sleep(400);
    const afterEscJoin = await inspect(page);
    ok(`${tag}: Escape with the keyboard open leaves Join (not stuck)`, afterEscJoin.uiCur === 'netMenu' || afterEscJoin.uiCur === 'menu', afterEscJoin);
    if (afterEscJoin.uiCur === 'netMenu') {
      const tb = await tapBack(page);
      ok(`${tag}: then touch Back reaches the main menu`, tb.after && tb.after.uiCur === 'menu', tb.after);
    }

    // Auto match / searching or offline: Cancel/Back + cancel pending
    await openOnline(page);
    await tapSel(page, '#net-auto', 'Auto match');
    await sleep(700);
    const search = await inspect(page);
    ok(`${tag}: Auto match leaves netMenu (search / connect / offline)`, search.uiCur === 'netSearch' || search.uiCur === 'netConnect' || search.uiCur === 'netMsg', search);
    if (!notch) await page.screenshot({ path: path.join(SHOT, `after-netsearch-${tag}.png`) }).catch(() => {});
    const pendingBefore = search.match;
    const tbS = await tapBack(page);
    const afterS = tbS.after || await inspect(page);
    // Cancel on search goes to netMenu (one step). Back again to menu.
    if (afterS.uiCur === 'netMenu') {
      ok(`${tag}: search/offline Cancel returns to Online menu and cancels`, afterS.match === 'idle' || !afterS.match, afterS);
      const tb2 = await tapBack(page);
      ok(`${tag}: then Back reaches the main menu`, tb2.after && tb2.after.uiCur === 'menu' && !tb2.after.netActive, tb2.after);
    } else {
      ok(`${tag}: search/offline Back returns to the main menu and cancels`, afterS.uiCur === 'menu' && (afterS.match === 'idle' || !afterS.match) && !afterS.netActive, { pendingBefore, afterS });
    }

    // connecting state (forced)
    await openOnline(page);
    await ev(page, () => __bg.UI.show('netConnect', { title: 'Connecting...' }));
    await sleep(200);
    const conn = await inspect(page);
    ok(`${tag}: connecting screen has a Cancel/Back`, !!(conn.uiCur === 'netConnect' && conn.back && conn.back.hitsSelf), conn);
    const tbC = await tapBack(page);
    const afterC = tbC.after;
    if (afterC.uiCur === 'netMenu') {
      const tb2 = await tapBack(page);
      ok(`${tag}: Cancel on connecting then Back reaches the main menu`, tb2.after && tb2.after.uiCur === 'menu', tb2.after);
    } else {
      ok(`${tag}: Cancel on connecting reaches the main menu`, afterC && afterC.uiCur === 'menu', afterC);
    }

    // error / offline message
    await openOnline(page);
    await ev(page, () => __bg.UI.show('netMsg', { err: { code: 'no-signal' } }));
    await sleep(200);
    const msg = await inspect(page);
    ok(`${tag}: error screen has Main menu`, !!(msg.uiCur === 'netMsg' && msg.back), msg);
    if (!notch) await page.screenshot({ path: path.join(SHOT, `after-netmsg-${tag}.png`) }).catch(() => {});
    const tbM = await tapBack(page);
    ok(`${tag}: Main menu on the error screen returns to the main menu`, tbM.after && tbM.after.uiCur === 'menu', tbM.after);

    // after returning, a local match still starts
    const local = await startLocal(page);
    ok(`${tag}: after leaving Online, a local match still starts`, local.ok, local.after || local);

    if (!notch) {
      await ev(page, () => { if (__bg.UI.cur !== 'menu') __bg.UI.show('menu'); });
      await sleep(200);
      await page.screenshot({ path: path.join(SHOT, `after-menu-${tag}.png`) });
    }

    log.push({ tag, errors: errors.filter((e) => !/audio device/i.test(e)).slice(0, 5) });
    await browser.close();
  }
}

// ---------- portrait: rotate overlay is expected; with it hidden, Back still works ----------
for (const dev of ['iPhone 13', 'iPhone 15']) {
  const tag = dev.replace(/\s+/g, '-');
  // 1. rotate overlay present
  const A = await boot(dev, { hideRotate: false });
  const st0 = await inspect(A.page);
  const rot = await ev(A.page, () => {
    const r = document.getElementById('rotate');
    if (!r) return { missing: true };
    const cs = getComputedStyle(r);
    return { display: cs.display, z: cs.zIndex, w: r.getBoundingClientRect().width, h: r.getBoundingClientRect().height };
  });
  ok(`${tag} portrait: rotate-to-landscape overlay is shown`, rot && rot.display === 'flex' && rot.w > 200, rot);
  await A.page.screenshot({ path: path.join(SHOT, `after-portrait-rotate-${tag}.png`) });
  await A.browser.close();

  // 2. overlay hidden (as if the phone was already landscape but we still check a tall viewport)
  const B = await boot(dev, { hideRotate: true, notch: true });
  const opened = await openOnline(B.page);
  ok(`${tag} portrait (overlay hidden): Online opens and Back is tappable in the safe area`,
    opened.uiCur === 'netMenu' && opened.back && opened.back.hitsSelf && opened.back.box.h >= 40 && opened.back.box.l >= 46, opened.back);
  await B.page.screenshot({ path: path.join(SHOT, `after-netmenu-portrait-${tag}.png`) });
  const tb = await tapBack(B.page);
  ok(`${tag} portrait (overlay hidden): touch Back returns to the main menu`, tb.after && tb.after.uiCur === 'menu', tb.after);
  const local = await startLocal(B.page);
  ok(`${tag} portrait (overlay hidden): a local match still starts afterwards`, local.ok, local.after || local);
  await B.browser.close();
}

fs.writeFileSync(path.join(OUT, 'logs/net-back-wk.json'), JSON.stringify({ pass, fail, log }, null, 2));
console.log(`net-back-wk: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
