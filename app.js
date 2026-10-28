// app.js - the user interface: keeps the state, saves it, and draws the page.
// All degree rules live in logic.js; this file only calls them.

const STORAGE_KEY = 'course-planner.v1';
const data = window.DATA;
const courseById = Logic.byId(data);
const groupById = Object.fromEntries(data.groups.map((g) => [g.id, g]));
const nextTerm = CONFIG.planTerms[0];

// ---------- state (saved in the browser with localStorage) ----------
const emptyState = () => ({ done: [], uni: 0, plan: {}, name: '', start: '', breaks: [], major: '', minors: [], slots: Array(8).fill('') });
let state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? clean(saved) : emptyState();
  } catch (e) {
    return emptyState();
  }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: just don't save */ }
}
// Never trust saved/imported data: keep only known course ids and sensible values.
function clean(s) {
  const out = emptyState();
  if (Array.isArray(s.done)) out.done = [...new Set(s.done.filter((id) => courseById[id]))];
  out.uni = Math.max(0, Math.min(8, Math.floor(Number(s.uni) || 0)));
  out.name = String(s.name || '').slice(0, 80);
  out.start = /^\d{4}-[1-3]$/.test(s.start) ? s.start : '';
  out.major = groupById[s.major] && groupById[s.major].type === 'Major' ? s.major : '';
  if (Array.isArray(s.minors)) out.minors = s.minors.filter((id) => groupById[id] && groupById[id].type === 'Minor').slice(0, 2);
  if (Array.isArray(s.slots)) s.slots.slice(0, 8).forEach((v, i) => {
    if (v === 'none' || v === 'UNI' || (courseById[v] && !courseById[v].required)) out.slots[i] = v;
  });
  if (Array.isArray(s.breaks)) out.breaks = [...new Set(s.breaks.map(Number).filter((n) => n >= 2 && n <= 8))].sort((x, y) => x - y);
  if (s.plan && typeof s.plan === 'object')
    for (const [id, term] of Object.entries(s.plan))
      if (courseById[id] && CONFIG.planTerms.includes(term)) out.plan[id] = term;
  return out;
}

// ---------- small helpers ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const groupLabel = (g) => `${g.type}: ${g.name}`;

// ---------- progress panel ----------
function bar(n, total, cls = '') {
  const pct = total ? Math.min(100, Math.round((n / total) * 100)) : 0;
  return `<div class="bar ${cls}"><div style="width:${pct}%"></div></div>`;
}

function renderProgress() {
  const ev = Logic.evaluate(data, state);
  const groupRows = ev.statuses.map((s) => {
    const cls = s.met ? (s.group.type === 'Major' ? 'major done' : 'minor done') : '';
    const warn = s.group.listMissing
      ? '<small class="warn">No course list published for this minor</small>'
      : s.mandatoryMissing.length
        ? `<small class="warn">Needs ${s.mandatoryMissing.map((id) => esc(courseById[id].name)).join(', ')}</small>` : '';
    return `<li class="group ${cls}">
      <div class="row"><span>${esc(groupLabel(s.group))}</span><strong>${s.n} / ${s.need}</strong></div>
      ${bar(s.n, s.need, s.group.type.toLowerCase())}${warn}</li>`;
  }).join('');

  $('#progress').innerHTML = `
    <div class="card ${ev.required.done === ev.required.total ? 'done' : ''}">
      <h2>Required courses</h2>
      <div class="row"><span>Core / STEM / Capstone</span><strong>${ev.required.done} / ${ev.required.total}</strong></div>
      ${bar(ev.required.done, ev.required.total, 'required')}
    </div>

    <div class="card ${ev.electivesMet ? 'done' : ''}">
      <h2>Electives (8 courses)</h2>
      <ul class="pathways">${ev.pathways.map((p) =>
        `<li class="${p.met ? 'met' : ''}"><span>${p.met ? '✓' : '○'}</span> ${esc(p.label)}</li>`).join('')}</ul>
      <p class="result">${ev.electivesMet ? 'Elective requirement met' : 'Elective requirement not met yet'}</p>
      <label class="uni">University electives completed
        <input id="uni" type="number" min="0" max="8" value="${state.uni}"></label>
      <p class="hint">Program options completed (each course counted once): <strong>${ev.D}</strong></p>
      <ul class="groups">${groupRows}</ul>
    </div>

    <div class="card">
      <h2>Credit points</h2>
      <div class="row"><span>Required courses</span><strong>${ev.credits.required}</strong></div>
      <div class="row"><span>Program options</span><strong>${ev.credits.programOptions}</strong></div>
      <div class="row"><span>University electives</span><strong>${ev.credits.university}</strong></div>
      <div class="row total"><span>Total</span><strong>${ev.credits.total}</strong></div>
    </div>`;
}

// ---------- course list ----------
function filterOptions() {
  const opts = [['all', 'All courses'], ['todo', 'Not completed'], ['next', `Offered ${nextTerm} (not completed)`],
    ['required', 'Required courses']];
  data.groups.forEach((g) => opts.push(['group:' + g.id, groupLabel(g)]));
  return opts;
}

function matches(c, filter, q) {
  if (q && !(c.id + ' ' + c.name).toLowerCase().includes(q)) return false;
  const done = state.done.includes(c.id);
  if (filter === 'todo') return !done;
  if (filter === 'next') return !done && Logic.offeredIn(data, c.id, nextTerm);
  if (filter === 'required') return c.required;
  if (filter.startsWith('group:')) return c.groups.includes(filter.slice(6));
  return true;
}

function offeredBadge(c) {
  if (!data.offerings[c.id]) return '<span class="chip muted">no schedule data</span>';
  return Logic.offeredIn(data, c.id, nextTerm)
    ? `<span class="chip ok">offered ${nextTerm}</span>` : `<span class="chip muted">not ${nextTerm}</span>`;
}

function renderList() {
  const filter = $('#filter').value || 'all';
  const q = $('#search').value.trim().toLowerCase();
  const rows = data.courses.filter((c) => matches(c, filter, q)).map((c) => {
    const done = state.done.includes(c.id);
    const term = state.plan[c.id] || '';
    const check = Logic.planCheck(data, state, c.id, term);
    const chips = (c.required ? '<span class="chip req">required</span>' : '') +
      c.groups.map((id) => `<span class="chip ${groupById[id].type.toLowerCase()}">${esc(groupLabel(groupById[id]))}</span>`).join('');
    return `<div class="course ${done ? 'done' : ''}" data-id="${esc(c.id)}">
      <input type="checkbox" class="tick" aria-label="Completed: ${esc(c.name)}" ${done ? 'checked' : ''}>
      <div class="info">
        <div class="title"><strong>${esc(c.id)}</strong> ${esc(c.name)} <small>${c.credits} cp</small></div>
        <div class="chips">${chips}${offeredBadge(c)}</div>
      </div>
      <div class="plan">
        <select class="planSel" aria-label="Plan for: ${esc(c.name)}" ${done ? 'disabled' : ''}>
          <option value="">Plan for…</option>
          ${CONFIG.planTerms.map((t) => `<option ${t === term ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <small class="check ${check === 'OK' ? 'ok' : check ? 'bad' : ''}">${esc(check)}</small>
      </div>
    </div>`;
  });
  $('#list').innerHTML = rows.join('') || '<p class="empty">No courses match.</p>';
}

// ---------- semester plan summary ----------
function renderPlanSummary() {
  const rows = CONFIG.planTerms.map((term) => {
    const ids = Object.keys(state.plan).filter((id) => state.plan[id] === term && !state.done.includes(id));
    const credits = ids.reduce((t, id) => t + courseById[id].credits, 0);
    const problems = ids.filter((id) => Logic.planCheck(data, state, id, term) !== 'OK');
    const names = ids.map((id) => {
      const ok = Logic.planCheck(data, state, id, term) === 'OK';
      return `<li class="${ok ? '' : 'bad'}">${esc(id)} ${esc(courseById[id].name)}${ok ? '' : ' - ' + esc(Logic.planCheck(data, state, id, term))}</li>`;
    }).join('');
    return `<div class="term"><h3>${term}</h3>
      <p>${ids.length} course(s), ${credits} credit points${problems.length ? `, <span class="bad">${problems.length} problem(s)</span>` : ''}</p>
      <ul>${names}</ul></div>`;
  });
  $('#plan-summary').innerHTML = rows.join('');
}

// Completed courses: hidden on screen, shown only in the printed/PDF report.
function renderReport() {
  const list = data.courses.filter((c) => state.done.includes(c.id));
  $('#report-completed').innerHTML = `<h2>Completed courses (${list.length})</h2>` +
    (list.length ? `<ul>${list.map((c) => `<li>${esc(c.id)} ${esc(c.name)} - ${c.credits} cp</li>`).join('')}</ul>`
      : '<p>None yet.</p>');
  $('#report-date').textContent = 'Report date: ' + new Date().toLocaleDateString();
}

function renderAll() { renderProgress(); renderList(); renderPlanSummary(); renderReport(); }

// ---------- events (one listener per area, using event delegation) ----------
// Shift+click on a tick box applies the same state to every course between it and the last box clicked.
let lastTick = null;
let lastIds = [];            // rows shown when the last box was clicked (a ticked row may vanish from a filtered list)
$('#list').addEventListener('mousedown', (e) => { if (e.shiftKey && e.target.classList.contains('tick')) e.preventDefault(); });
$('#list').addEventListener('click', (e) => {
  if (!e.target.classList.contains('tick')) return;
  const id = e.target.closest('.course').dataset.id;
  if (e.shiftKey && lastTick) {
    const now = [...document.querySelectorAll('#list .course')].map((row) => row.dataset.id);
    const ids = lastIds.includes(lastTick) && lastIds.includes(id) ? lastIds : now;
    const from = ids.indexOf(lastTick), to = ids.indexOf(id);
    if (from >= 0 && to >= 0) {
      const range = ids.slice(Math.min(from, to), Math.max(from, to) + 1);
      if (e.target.checked) { state.done = [...new Set([...state.done, ...range])]; range.forEach((x) => delete state.plan[x]); }
      else state.done = state.done.filter((x) => !range.includes(x));
      lastTick = id; lastIds = ids.filter((x) => now.includes(x) || x === id);
      save(); renderAll();
      return;
    }
  }
  lastTick = id;
  lastIds = [...document.querySelectorAll('#list .course')].map((row) => row.dataset.id);
});

$('#list').addEventListener('change', (e) => {
  const id = e.target.closest('.course')?.dataset.id;
  if (!id) return;
  if (e.target.classList.contains('tick')) {
    state.done = e.target.checked ? [...new Set([...state.done, id])] : state.done.filter((x) => x !== id);
    if (e.target.checked) delete state.plan[id];          // finished courses need no plan
  } else if (e.target.classList.contains('planSel')) {
    if (e.target.value) state.plan[id] = e.target.value; else delete state.plan[id];
  }
  save(); renderAll();
});

$('#progress').addEventListener('change', (e) => {
  if (e.target.id !== 'uni') return;
  state.uni = Math.max(0, Math.min(8, Math.floor(Number(e.target.value) || 0)));
  save(); renderAll();
});

$('#name').addEventListener('input', (e) => { state.name = e.target.value.slice(0, 80); save(); });
$('#print').addEventListener('click', () => { renderReport(); window.print(); });

$('#filter').addEventListener('change', renderList);
$('#search').addEventListener('input', renderList);

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'my-course-progress.json' });
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#import').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { state = clean(JSON.parse(reader.result)); $('#name').value = state.name; save(); renderAll(); }
    catch (err) { alert('That file is not a valid progress file.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

$('#reset').addEventListener('click', () => {
  if (confirm('Clear all progress and plans?')) { state = emptyState(); $('#name').value = ''; save(); renderAll(); }
});

// ---------- start ----------
$('#program').textContent = data.program;
$('#name').value = state.name;
$('#filter').innerHTML = filterOptions().map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
renderAll();
