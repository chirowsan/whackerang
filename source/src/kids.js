// Kids mode (KIDS=1 builds): a grown-up gate (year of birth, neutral: no hint about the age needed) protects turning on Auto match.
import { h } from './ui.js';
import { sfx } from './audio.js';
let lockUntil = 0; // after a failed try the gate stays shut for a while (no guessing)
export function adultGate(onPass, what = 'turn on Auto match') {
  const old = document.getElementById('kgate'); if (old) old.remove();
  const ov = h('div', 'kgate', null, { id: 'kgate' }); const box = h('div', 'kgate-box panel');
  const close = () => ov.remove();
  if (Date.now() < lockUntil) {
    box.innerHTML = '<h3>Grown-ups only</h3><p>Please try again later.</p>';
    const ok = h('button', 'btn primary', 'OK', { 'data-nav': 1 }); ok.addEventListener('click', () => { sfx('click'); close(); }); box.appendChild(ok);
  } else {
    box.innerHTML = `<h3>Grown-ups only</h3><p>To ${what}, a parent or guardian needs to enter their year of birth.</p><p class="kg-small">Auto match lets players join games with other people who are searching at the same time. There is no chat; everyone shows only a preset name like \u201cZippy Fox\u201d. You can turn it off again any time in Settings.</p><p class="kg-small"><b>Online safety:</b> the people in Auto match are strangers. Talk with your child about never sharing their real name, address, school or photos with people they meet online.</p>`;
    const inp = h('input', 'kg-in', null, { type: 'text', inputmode: 'numeric', maxlength: 4, placeholder: 'YYYY', autocomplete: 'off', 'aria-label': 'Year of birth', id: 'kg-year' });
    const row = h('div', 'kg-row'); const ok = h('button', 'btn primary', 'Continue', { 'data-nav': 1, id: 'kg-ok' }); const no = h('button', 'btn', 'Cancel', { 'data-nav': 1, id: 'kg-cancel' });
    ok.addEventListener('click', () => {
      const y = parseInt(inp.value, 10), now = new Date().getFullYear(); close();
      if (y >= 1900 && y <= now && now - y >= 18) { sfx('buy'); onPass(); } else { sfx('deny'); lockUntil = Date.now() + 30 * 60 * 1000; }
    });
    no.addEventListener('click', () => { sfx('click'); close(); });
    box.appendChild(inp); row.appendChild(no); row.appendChild(ok); box.appendChild(row);
    setTimeout(() => inp.focus(), 50);
  }
  ov.appendChild(box); ov.addEventListener('click', (e) => { if (e.target === ov) close(); }); document.body.appendChild(ov);
}
