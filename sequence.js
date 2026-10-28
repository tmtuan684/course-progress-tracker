// sequence.js - recommended course order, year 1 to year 3, with a picker for the combination boxes.
// The order (semester 1 to 8) is fixed in data.js. Starting term, breaks, major/minor choices and
// hand-picked courses are saved with the student's progress in the same localStorage entry.
const data = window.DATA;
if (!data || !Array.isArray(data.sequence)) {
  document.querySelector('#sequence').innerHTML = '<p class="card warn">This page needs the course sequence in data.js. Replace data.js with the latest version, or regenerate it with tools/make_data.py.</p>';
  throw new Error('data.js has no sequence');
}
const courseById = Logic.byId(data);
const groupById = Object.fromEntries(data.groups.map((g) => [g.id, g]));
const STORAGE_KEY = 'course-planner.v1';
const SLOTS = 8;
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const groupLabel = (g) => `${g.type}: ${g.name}`;

function readSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
}
function updateSaved(changes) {            // merge into the saved progress, keep everything else
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readSaved(), ...changes })); } catch (e) { /* not saved */ }
}

const saved = readSaved();
const state = { done: Array.isArray(saved.done) ? saved.done : [], uni: Number(saved.uni) || 0, plan: saved.plan || {} };
let start = /^\d{4}-[1-3]$/.test(saved.start) ? saved.start : CONFIG.planTerms[0];
let major = groupById[saved.major] && groupById[saved.major].type === 'Major' ? saved.major : '';
let minors = (Array.isArray(saved.minors) ? saved.minors : []).filter((id) => groupById[id] && groupById[id].type === 'Minor').slice(0, 2);
let breaks = Array.isArray(saved.breaks) ? saved.breaks.map(Number).filter((n) => n >= 2 && n <= 8) : [];
// slots[i]: '' = follow the suggestion, 'none' = left empty on purpose, 'UNI' = university elective, or a course id
let slots = Array(SLOTS).fill('');
if (Array.isArray(saved.slots)) saved.slots.slice(0, SLOTS).forEach((v, i) => {
  if (v === 'none' || v === 'UNI' || (courseById[v] && !courseById[v].required)) slots[i] = v;
});
let active = -1;                           // slot picked by clicking, waiting for a course

const electives = data.courses.filter((c) => !c.required);

// Starting-term choices: from the first term in the schedule data, three years on.
function startOptions() {
  const first = Number(data.terms[0].split('-')[0]);
  const out = [];
  for (let y = first; y <= first + 2; y++) for (let t = 1; t <= CONFIG.termsPerYear; t++) out.push(`${y}-${t}`);
  if (!out.includes(start)) out.push(start);
  return out;
}

function offeringLine(id, term) {
  if (!data.terms.includes(term)) return '<small class="muted">No schedule yet for ' + esc(term) + '</small>';
  const ok = Logic.offeredIn(data, id, term);
  return `<small class="${ok ? 'ok' : 'muted'}">${ok ? 'offered ' : 'not offered '}${esc(term)}</small>`;
}

function courseCard(id, term) {
  const c = courseById[id];
  const done = state.done.includes(id);
  return `<div class="seq-card core ${done ? 'done' : ''} ${c.credits > 12 ? 'big' : ''}">
    <span class="kind core">${esc(c.category || 'Core')}</span>
    <strong>${esc(c.id)}</strong><span>${esc(c.name)}</span>
    <small>${c.credits} cp${done ? ' - completed' : ''}</small>
    ${done ? '' : offeringLine(id, term)}
  </div>`;
}

// ---------- suggestions from the chosen major / minors ----------
function picks() { return major ? [groupById[major]] : [...new Set(minors)].map((id) => groupById[id]); }

function suggestions() {
  const used = new Set(), list = [], notes = [];
  for (const g of picks()) {
    const pool = [...g.mandatory, ...g.members].filter((id, i, arr) => arr.indexOf(id) === i)
      .filter((id) => courseById[id] && !courseById[id].required && !used.has(id));
    const take = pool.slice(0, g.need);
    take.forEach((id) => { used.add(id); list.push({ id, group: g }); });
    if (g.listMissing) notes.push(`${g.name} has no published course list.`);
    else if (take.length < g.need) notes.push(`${g.name} offers only ${take.length} course(s) that are not already required, so ${g.need - take.length} more box(es) stay open.`);
    else if (g.members.length > take.length) notes.push(`${g.name} lists ${g.members.length} courses; ${g.need} are suggested. Swap any of them using the course picker.`);
  }
  return { list, notes };
}

// What each of the 8 combination boxes shows:
// hand-picked course > suggestion > completed electives not placed anywhere > university electives completed > open.
function resolveSlots() {
  const sug = suggestions();
  const manualIds = new Set(slots.filter((v) => courseById[v]));
  const out = slots.map((v, i) => {
    if (v === 'UNI') return { kind: 'uni', manual: true };
    if (v === 'none') return { kind: 'open' };
    if (courseById[v]) return { kind: 'course', id: v, manual: true, group: picks().find((g) => g.members.includes(v)) || null };
    const s = sug.list[i];
    if (s && !manualIds.has(s.id)) return { kind: 'course', id: s.id, manual: false, group: s.group };
    return { kind: 'open' };
  });
  // fill boxes left open (not cleared on purpose) with things the student already completed
  const placed = new Set(out.filter((o) => o.id).map((o) => o.id));
  const spare = data.courses.filter((c) => !c.required && state.done.includes(c.id) && !placed.has(c.id));
  let uniLeft = state.uni;
  out.forEach((o, i) => {
    if (o.kind !== 'open' || slots[i] === 'none') return;
    const next = spare.shift();
    if (next) { Object.assign(o, { kind: 'course', id: next.id, manual: false, auto: true, group: null }); return; }
    if (uniLeft > 0) { uniLeft--; Object.assign(o, { kind: 'uni', manual: false, auto: true, done: true }); }
  });
  return { slots: out, notes: sug.notes, hasSug: sug.list.length > 0 };
}

function slotCard(info, i, term) {
  const x = `<button class="x" data-clear="${i}" title="Remove from this box" aria-label="Remove">×</button>`;
  const cls = `data-slot="${i}"`;
  if (info.kind === 'course') {
    const c = courseById[info.id], done = state.done.includes(info.id);
    const kind = info.group ? info.group.type : (c.groups.length ? 'Option' : 'Elective');
    const why = info.group ? `suggested for ${info.group.type.toLowerCase()}: ${esc(info.group.name)}`
      : info.manual ? 'chosen by you' : 'completed course';
    return `<div class="seq-card suggest ${kind.toLowerCase()} ${done ? 'done' : ''} ${active === i ? 'active' : ''}" ${cls}>
      <span class="kind ${kind.toLowerCase()}">${esc(kind)}</span>${x}
      <strong>${esc(c.id)}</strong><span>${esc(c.name)}</span>
      <small>${c.credits} cp - ${why}${done ? ' - completed' : ''}</small>
      ${done ? '' : offeringLine(c.id, term)}</div>`;
  }
  if (info.kind === 'uni') {
    return `<div class="seq-card suggest option ${info.done ? 'done' : ''} ${active === i ? 'active' : ''}" ${cls}>
      <span class="kind option">University elective</span>${info.auto ? '' : x}
      <strong>Any RMIT course</strong><span>Elective from another program</span>
      <small>${info.done ? 'completed' : 'chosen by you'}</small></div>`;
  }
  return `<div class="seq-card slot ${active === i ? 'active' : ''}" ${cls}><strong>Combination course</strong>
    <span>Drag a course here, or click this box and press Add on a course</span><small>${active === i ? 'selected' : 'open'}</small></div>`;
}

// ---------- render ----------
let lastResolved = null;

function render() {
  const ev = Logic.evaluate(data, state);
  const res = resolveSlots();
  lastResolved = res.slots;
  let slotIdx = 0;
  const placedSem = {};
  $('#sequence').innerHTML = [1, 2, 3].map((y) => {
    const sems = data.sequence.filter((s) => s.year === y).map((s) => {
      const term = Logic.termFor(start, s.sem, breaks);
      const hasBreak = breaks.includes(s.sem);
      const breakBtn = s.sem < 2 ? '' :
        `<button class="linkbtn" data-break="${s.sem}">${hasBreak ? 'Remove break before' : 'Add a break before'}</button>`;
      const open = Array.from({ length: s.open }, () => {
        const i = slotIdx++;
        if (res.slots[i].id) placedSem[res.slots[i].id] = s.sem;
        return slotCard(res.slots[i], i, term);
      }).join('');
      return `<div class="seq-sem"><div><h3>Semester ${s.sem}</h3><div class="term-name">${esc(term)}</div>${breakBtn}
        ${hasBreak ? '<small class="warn">one term break before this</small>' : ''}</div>
        <div class="seq-cards">${s.courses.map((id) => courseCard(id, term)).join('')}${open}</div></div>`;
    }).join('');
    return `<section class="seq-year card"><h2>Year ${y}</h2>${sems}</section>`;
  }).join('');

  const filled = res.slots.filter((o) => o.kind !== 'open').length;
  const last = Logic.termFor(start, 8, breaks);
  $('#summary').textContent = `${ev.required.done} of ${ev.required.total} required courses completed; ` +
    `${filled} of ${SLOTS} combination boxes filled. Planned finish: ${last}.`;
  $('#pick-note').textContent = res.notes.join(' ') || (res.hasSug
    ? 'Suggested courses follow the group\'s own listing order, mandatory ones first. Prerequisites are not checked.'
    : 'Pick a major or minors to get suggestions, or fill the boxes yourself from the course picker.');
  renderPool(placedSem);
}

// ---------- course picker ----------
function poolFilterOptions() {
  return [['all', 'All elective courses'], ['chosen', 'My major / minors'],
    ...data.groups.map((g) => ['group:' + g.id, groupLabel(g)])]
    .map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
}

function renderPool(placedSem) {
  const q = $('#pool-search').value.trim().toLowerCase();
  const f = $('#pool-filter').value || 'all';
  const chosenIds = new Set(picks().flatMap((g) => g.members));
  const list = electives.filter((c) => {
    if (q && !(c.id + ' ' + c.name).toLowerCase().includes(q)) return false;
    if (f === 'chosen') return chosenIds.has(c.id);
    if (f.startsWith('group:')) return c.groups.includes(f.slice(6));
    return true;
  });
  const uniRow = `<div class="pool-item" draggable="true" data-id="UNI">
    <div><strong>University elective</strong><div class="chips"><span class="chip muted">any course from other RMIT programs</span></div></div>
    <button class="add" data-add="UNI">Add</button></div>`;
  const rows = list.map((c) => {
    const where = placedSem[c.id];
    const chips = c.groups.map((id) => `<span class="chip ${groupById[id].type.toLowerCase()}">${esc(groupLabel(groupById[id]))}</span>`).join('');
    return `<div class="pool-item ${where ? 'placed' : ''}" draggable="true" data-id="${esc(c.id)}">
      <div><strong>${esc(c.id)}</strong> ${esc(c.name)} <small>${c.credits} cp</small>
        <div class="chips">${chips}${where ? `<span class="chip ok">in semester ${where}</span>` : ''}${state.done.includes(c.id) ? '<span class="chip req">completed</span>' : ''}</div></div>
      <button class="add" data-add="${esc(c.id)}">${where ? 'Move' : 'Add'}</button></div>`;
  }).join('');
  $('#pool-list').innerHTML = (f === 'all' && !q ? uniRow : '') + (rows || '<p class="empty">No courses match.</p>');
}

// ---------- placing courses ----------
function place(id, idx) {
  if (idx === undefined || idx < 0) idx = active;
  if (idx < 0) idx = lastResolved.findIndex((o) => o.kind === 'open');
  if (idx < 0) { $('#pick-note').textContent = 'All combination boxes are full. Remove one with the × button, or drop the course onto a box to replace it.'; return; }
  if (id !== 'UNI') slots = slots.map((v) => (v === id ? '' : v));   // a course sits in one box only
  if (id !== 'UNI') slots = slots.map((v, i) => (v === '' && lastResolved[i] && lastResolved[i].id === id ? 'none' : v));
  slots[idx] = id;
  active = -1;
  updateSaved({ slots }); render();
}

// ---------- controls ----------
const groupOpts = (type, current, none) => `<option value="">${none}</option>` +
  data.groups.filter((g) => g.type === type).map((g) => `<option value="${esc(g.id)}" ${g.id === current ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
function drawChoices() {
  $('#major').innerHTML = groupOpts('Major', major, 'No major');
  $('#minor1').innerHTML = groupOpts('Minor', minors[0], 'No minor');
  $('#minor2').innerHTML = groupOpts('Minor', minors[1], 'No second minor');
  $('#minor1').disabled = $('#minor2').disabled = !!major;      // a major already fills all 8 boxes
  $('#minor1').title = $('#minor2').title = major ? 'Choose "No major" to pick minors' : '';
}
function choose() {
  major = $('#major').value;
  minors = major ? [] : [$('#minor1').value, $('#minor2').value].filter(Boolean).filter((id, i, a) => a.indexOf(id) === i);
  // choosing a major or minors replaces whatever was in the combination boxes with that group's courses
  if (picks().length) { slots = Array(SLOTS).fill(''); active = -1; }
  updateSaved({ major, minors, slots }); drawChoices(); render();
}

$('#program').textContent = data.program;
$('#start').innerHTML = startOptions().map((t) => `<option ${t === start ? 'selected' : ''}>${esc(t)}</option>`).join('');
$('#pool-filter').innerHTML = poolFilterOptions();
drawChoices();
['major', 'minor1', 'minor2'].forEach((id) => $('#' + id).addEventListener('change', choose));
$('#start').addEventListener('change', (e) => { start = e.target.value; updateSaved({ start }); render(); });
$('#pool-search').addEventListener('input', render);
$('#pool-filter').addEventListener('change', render);
$('#pool-reset').addEventListener('click', () => { slots = Array(SLOTS).fill(''); active = -1; updateSaved({ slots }); render(); });

$('#sequence').addEventListener('click', (e) => {
  const clr = e.target.closest('[data-clear]');
  if (clr) { slots[Number(clr.dataset.clear)] = 'none'; active = -1; updateSaved({ slots }); render(); return; }
  const br = e.target.closest('[data-break]');
  if (br) {
    const n = Number(br.dataset.break);
    breaks = breaks.includes(n) ? breaks.filter((b) => b !== n) : [...breaks, n].sort((a, b) => a - b);
    updateSaved({ breaks }); render(); return;
  }
  const box = e.target.closest('[data-slot]');
  if (box && !folded) { const i = Number(box.dataset.slot); active = active === i ? -1 : i; render(); }
});

// drag and drop (mouse); touch screens use the Add button instead
$('#pool-list').addEventListener('click', (e) => { const b = e.target.closest('[data-add]'); if (b) place(b.dataset.add); });
$('#pool-list').addEventListener('dragstart', (e) => {
  const item = e.target.closest('.pool-item');
  if (!item) return;
  e.dataTransfer.setData('text/plain', item.dataset.id);
  e.dataTransfer.effectAllowed = 'copy';
});
$('#sequence').addEventListener('dragover', (e) => {
  const box = e.target.closest('[data-slot]');
  if (!box) return;
  e.preventDefault();
  box.classList.add('over');
});
$('#sequence').addEventListener('dragleave', (e) => { const b = e.target.closest('[data-slot]'); if (b) b.classList.remove('over'); });
$('#sequence').addEventListener('drop', (e) => {
  const box = e.target.closest('[data-slot]');
  if (!box) return;
  e.preventDefault();
  const id = e.dataTransfer.getData('text/plain');
  if (id === 'UNI' || (courseById[id] && !courseById[id].required)) place(id, Number(box.dataset.slot));
});

// fold / unfold the course picker (remembered in this browser)
let folded = false;
try { folded = localStorage.getItem('course-planner.pool-folded') === '1'; } catch (e) { /* keep default */ }
function setFolded(v) {
  folded = v;
  try { localStorage.setItem('course-planner.pool-folded', v ? '1' : '0'); } catch (e) { /* not saved */ }
  document.querySelector('.seq-layout').classList.toggle('folded', v);
  const b = $('#pool-toggle');
  b.setAttribute('aria-expanded', String(!v));
  b.textContent = v ? '◀ Pick courses' : 'Fold ▶';
  if (v && active >= 0) { active = -1; render(); }
}
$('#pool-toggle').addEventListener('click', () => setFolded(!folded));
setFolded(folded);
render();
