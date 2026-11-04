// programs.js - the first page: the student chooses a program, then the other pages follow it.
const PROGRAM_KEY = 'course-planner.program';          // same key as ui.js
const PROGRAMS = window.PROGRAMS || {};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const storageKey = (p) => (p.code === 'BP162VI23' ? 'course-planner.v1' : 'course-planner.v1.' + p.code);
const SESSION_KEY = 'course-planner.session';          // same key as ui.js
let current = null;
try { current = localStorage.getItem(PROGRAM_KEY); } catch (e) { /* none */ }

const startSession = () => { try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* ignore */ } };
const savedAt = (p) => { try { return Number(localStorage.getItem(storageKey(p) + '.at')) || 0; } catch (e) { return 0; } };

function saved(p) {                                     // how many courses this student has ticked in that program
  try { const s = JSON.parse(localStorage.getItem(storageKey(p))); return s && Array.isArray(s.done) ? s.done.length : 0; } catch (e) { return 0; }
}

const others = (p) => Object.values(PROGRAMS).filter((q) => q.code !== p.code && saved(q) > 0);

document.querySelector('#programs').innerHTML = Object.values(PROGRAMS).map((p) => {
  const core = p.courses.filter((c) => c.required).length;
  const done = saved(p);
  const isCurrent = p.code === current;
  return `<article class="card program ${isCurrent ? 'current' : ''}">
    <h3>${esc(p.code)}</h3>
    <p><strong>${esc(p.title.replace(/ \(.*\)$/, ''))}</strong></p>
    <p class="hint">${esc(p.summary || '')}</p>
    <p class="hint">${core} core courses, ${p.courses.length} courses in total, ${p.programCredits} credit points.</p>
    ${done ? `<p class="hint"><strong>${done}</strong> course(s) ticked so far.</p>` : ''}
    <button class="choose" data-code="${esc(p.code)}">${done || isCurrent ? 'Continue with this program' : 'Choose this program'}</button>
    ${others(p).length ? `<details class="copy"><summary>Copy my progress from another program</summary>
      <select aria-label="Copy progress from">${others(p).map((q) => `<option value="${esc(q.code)}">${esc(q.code)} (${saved(q)} ticked)</option>`).join('')}</select>
      <button class="copy-btn" data-to="${esc(p.code)}">Copy courses</button></details>` : ''}
  </article>`;
}).join('');

document.querySelector('#programs').addEventListener('click', (e) => {
  const b = e.target.closest('.choose');
  if (!b) return;
  startSession();
  try { localStorage.setItem(PROGRAM_KEY, b.dataset.code); } catch (err) { /* then ?program= below still works */ }
  location.href = 'index.html?program=' + encodeURIComponent(b.dataset.code);
});

// Copy completed courses from one program to another (a new edition, say). A course with the same code matches
// automatically; others match through programs/equivalences.js. Anything without a match is listed, never dropped silently.
function copyProgress(fromCode, toCode) {
  const from = PROGRAMS[fromCode], to = PROGRAMS[toCode];
  let src;
  try { src = JSON.parse(localStorage.getItem(storageKey(from))); } catch (e) { src = null; }
  if (!src || !Array.isArray(src.done)) return alert('Nothing to copy from ' + fromCode + '.');
  const toIds = new Set(to.courses.map((c) => c.id));
  const nameOf = (id) => (from.courses.find((c) => c.id === id) || { name: '' }).name;
  const rows = (window.EQUIVALENCES || []).filter((r) => r.from_program === fromCode && r.to_program === toCode);
  const gain = new Set(), lost = [];
  src.done.forEach((id) => {
    const alt = rows.filter((r) => r.from_code === id && toIds.has(r.to_code)).map((r) => r.to_code);
    if (toIds.has(id)) gain.add(id);
    else if (alt.length) alt.forEach((a) => gain.add(a));
    else lost.push(id);
  });
  let cur = null;
  try { cur = JSON.parse(localStorage.getItem(storageKey(to))); } catch (e) { cur = null; }
  const merged = { ...(cur || {}), done: [...new Set([...((cur && cur.done) || []), ...gain])],
    uni: Math.min(Math.max(Number(src.uni) || 0, Number(cur && cur.uni) || 0), to.maxUni || 8),
    name: (cur && cur.name) || src.name || '' };
  const msg = `Copy ${gain.size} course(s) from ${fromCode} to ${toCode}?` +
    (lost.length ? `\n\nNo matching course in ${toCode} for:\n` + lost.map((id) => `${id} ${nameOf(id)}`).join('\n') : '');
  if (!confirm(msg)) return;
  try { localStorage.setItem(storageKey(to), JSON.stringify(merged)); } catch (e) { return alert('Could not save in this browser.'); }
  location.reload();
}
document.querySelector('#programs').addEventListener('click', (e) => {
  const b = e.target.closest('.copy-btn');
  if (b) copyProgress(b.closest('.copy').querySelector('select').value, b.dataset.to);
});

// On a new browser session with saved progress, ask whether to continue or start fresh.
function savedName(p) { try { return (JSON.parse(localStorage.getItem(storageKey(p))) || {}).name || ''; } catch (e) { return ''; } }
const withData = Object.values(PROGRAMS).filter((p) => saved(p) > 0 || savedAt(p) > 0);
let asked = false;
try { asked = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { asked = true; }
const welcome = document.querySelector('#welcome');
if (withData.length && !asked && welcome && typeof welcome.showModal === 'function') {
  document.querySelector('#welcome-list').innerHTML = withData.map((p) => {
    const when = savedAt(p) ? ', last saved ' + new Date(savedAt(p)).toLocaleString() : '';
    const who = savedName(p) ? esc(savedName(p)) + ': ' : '';
    return `<li>${who}<strong>${esc(p.code)}</strong>, ${saved(p)} course(s) ticked${when}</li>`;
  }).join('');
  welcome.showModal();
  document.querySelector('#welcome-continue').addEventListener('click', () => { startSession(); welcome.close(); });
  document.querySelector('#welcome-fresh').addEventListener('click', () => {
    if (!confirm('Erase all saved progress in this browser and start fresh?')) return;
    try {
      Object.values(PROGRAMS).forEach((p) => { localStorage.removeItem(storageKey(p)); localStorage.removeItem(storageKey(p) + '.at'); });
      localStorage.removeItem(PROGRAM_KEY); localStorage.removeItem('course-planner.pool-folded');
    } catch (e) { /* nothing to erase */ }
    startSession(); location.reload();
  });
} else if (!asked && !withData.length) { /* nothing saved: a fresh start already */ }
