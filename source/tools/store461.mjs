// v4.6.1 store/kids build checks (DOM only: the store build has no __bg test hooks). Usage: node tools/store461.mjs [file-or-url]
import { launch, sleep } from './lib.mjs';
const URL_ = process.argv[2] || 'file:///tmp/store461.html'; let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const { browser, page, errors } = await launch({ w: 1280, h: 720 });
await page.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('whackerang.save.v1')) localStorage.setItem('whackerang.save.v1', JSON.stringify({ tutorialDone: true })); } catch (e) {} });
await page.goto(URL_ + (URL_.includes('?') ? '&' : '?') + 'mmfill=3&norelay=1'); await sleep(3000);
const click = (re) => page.evaluate((s) => { const b = [...document.querySelectorAll('button,a')].find((x) => new RegExp(s, 'i').test(x.textContent)); if (b) b.click(); return !!b; }, re);
const txt = () => page.evaluate(() => document.body.innerText);
ok(await page.evaluate(() => typeof window.__bg === 'undefined' && typeof window.__bbNet === 'undefined'), 'no __bg test hook');
ok(await page.evaluate(() => localStorage.getItem('whk.rly') === null), '?norelay ignored (no relay override stored)');
// gold store: earn only
await page.evaluate(() => document.querySelector('.goldchip').click()); await sleep(700);
let t = await txt(); ok(/Earn free/i.test(t) && !/Buy gold/i.test(t) && !/TEST MODE/i.test(t) && !/placeholder/i.test(t), 'Gold Store shows only Earn free (no Buy gold / TEST MODE)');
await page.screenshot({ path: '/tmp/st_gold.png' });
ok(await page.evaluate(() => [...document.querySelectorAll('.tabs .tab')].length === 1), 'one tab');
await page.evaluate(() => { const b = [...document.querySelectorAll('.gs-card button')].find((x) => /Claim \+/.test(x.textContent)); if (b) b.click(); }); await sleep(600);
ok(await page.evaluate(() => +document.querySelector('#coinval, .goldchip span:nth-child(2)')?.textContent > 0 || /Claimed today/i.test(document.body.innerText)), 'earned gold still works (streak claim)');
await page.evaluate(() => document.querySelector('.back, .btn.back')?.click()); await sleep(600);
// play online: auto match hidden in kids mode
ok(await click('Play online'), 'open Play online'); await sleep(900); t = await txt();
ok(!(await page.$('#net-auto')) && !!(await page.$('#net-kids-note')), 'Kids mode: Auto match button hidden, note shown');
ok(await page.evaluate(() => document.querySelectorAll('.nm2-btn').length >= 2), 'friend room buttons present');
await page.screenshot({ path: '/tmp/st_online.png' });
const nm = await page.$('#net-name'); if (nm) ok(await page.evaluate(() => document.querySelector('#net-name').readOnly), 'name field is presets-only (read-only)');
await page.evaluate(() => document.querySelector('.back, .btn.back')?.click()); await sleep(600);
// settings: gate + privacy link
ok(await click('^Settings$'), 'open Settings'); await sleep(800);
ok(await page.evaluate(() => { const a = document.querySelector('#set-privacy'); return !!a && a.href === 'https://chirowsan.github.io/whackerang/privacy.html'; }), 'privacy link in Settings');
ok(await page.evaluate(() => !document.querySelector('#set-automatch').classList.contains('on')), 'Auto match off by default');
await page.click('#set-automatch'); await sleep(400); ok(!!(await page.$('#kgate')), 'grown-up gate shown'); await page.screenshot({ path: '/tmp/st_gate.png' });
await page.type('#kg-year', String(new Date().getFullYear() - 9)); await page.click('#kg-ok'); await sleep(300);
ok(await page.evaluate(() => !document.querySelector('#set-automatch').classList.contains('on')), 'child birth year: stays off');
await page.click('#set-automatch'); await sleep(300); ok(await page.evaluate(() => !document.querySelector('#kg-year') && /try again later/i.test(document.querySelector('#kgate').innerText)), 'retry locked after a failed try');
await page.evaluate(() => document.querySelector('#kgate button').click()); await sleep(200);
// fresh page (lock is per session) -> adult passes
await page.reload(); await sleep(2500); await click('^Settings$'); await sleep(700);
await page.click('#set-automatch'); await sleep(300); await page.type('#kg-year', '1985'); await page.click('#kg-ok'); await sleep(300);
ok(await page.evaluate(() => document.querySelector('#set-automatch').classList.contains('on')), 'adult birth year: Auto match on');
await page.click('#set-automatch'); await sleep(200); ok(await page.evaluate(() => !document.querySelector('#set-automatch').classList.contains('on') && !document.querySelector('#kgate')), 'turning off needs no gate');
await page.click('#set-automatch'); await sleep(200); await page.type('#kg-year', '1985'); await page.click('#kg-ok'); await sleep(300);
await page.evaluate(() => document.querySelector('.back, .btn.back')?.click()); await sleep(500); await click('Play online'); await sleep(900);
ok(!!(await page.$('#net-auto')), 'after grown-up turns it on: Auto match button visible');
const errs = errors.filter((e) => !/icon-192|ERR_FILE_NOT_FOUND/.test(e)); ok(!errs.length, 'no page errors ' + errs.join(' | ').slice(0, 300));
await browser.close(); console.log(fail ? `FAILED ${fail}` : 'ALL PASS'); process.exit(fail ? 1 : 0);
