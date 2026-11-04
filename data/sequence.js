// sequence.js - recommended course order, year 1 to year 3, with a picker for the combination boxes.
// The order (semester 1 to 8) is fixed in data.js. Starting term, breaks, major/minor choices and
// hand-picked courses are saved with the student's progress in the same localStorage entry (see ui.js).
if (!Array.isArray(data.sequence)) {
  document.querySelector('#sequence').innerHTML = '<p class="card warn">This page needs the course sequence in data.js. Replace data.js with the latest version, or regenerate it with tools/make_data.py.</p>';
  throw new Error('data.js has no sequence');
}
const SLOTS = SLOT_COUNT;
const STREAMS = data.ruleset === 'streams' || (data.ruleset === 'techoptions' && data.groups.length > 0);   // one group choice only
const NOGROUPS = !data.groups.length;                 // programs with no major or minor to choose
// label and stream flag for each open box, in order (programs without labels get plain boxes)
const slotMeta = data.sequence.flatMap((sem) => Array.from({ length: sem.open }, (_, k) => (sem.slots && sem.slots[k]) || {}));
const streamRank = {};                      // box index -> position among the boxes a stream/major fills
slotMeta.reduce((n, m, i) => { if (!STREAMS || m.stream) { streamRank[i] = n; return n + 1; } return n; }, 0);
const updateSaved = (changes) => saveState({ ...loadState(), ...changes });   // keep the rest of the saved progress

const saved = loadState();
const state = { done: saved.done, uni: saved.uni };
let start = saved.start || CONFIG.planTerms[0];
let { major, minors, breaks, slots } = saved;    // slot values are explained in clean() in ui.js
let active = -1;                           // box picked by clicking, waiting for a course
const picked = new Set();                  // courses selected in the picker (click, Shift+click for a range)
let anchor = null;                         // last course clicked, start of a Shift range
let visibleIds = [];                       // picker rows currently shown, in order
let folded = false;                        // course picker folded away (remembered in this browser)
try { folded = localStorage.getItem(FOLD_KEY) === '1'; } catch (e) { /* keep default */ }

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
  const o = Logic.offering(data, id, term);
  if (o === 'unscheduled') return '<small class="muted">No schedule yet for ' + esc(term) + '</small>';
  const ok = o === 'yes';
  return `<small class="${ok ? 'ok' : 'muted'}">${ok ? 'offered ' : 'not offered '}${esc(term)}</small>`;
}

// Inside of a course card: kind badge, code, name, credits (+ note) and whether it runs that term.
function cardBody(c, kind, label, note, term, extra = '') {
  const done = state.done.includes(c.id);
  return `<span class="kind ${kind}">${esc(label)}</span>${extra}
    <strong>${esc(c.id)}</strong><span>${esc(c.name)}</span>
    <small>${c.credits} cp${note}${done ? ' - completed' : ''}</small>
    ${done ? '' : offeringLine(c.id, term)}`;
}

function courseCard(id, term) {
  const c = courseById[id];
  return `<div class="seq-card core ${state.done.includes(id) ? 'done' : ''}">${cardBody(c, 'core', c.category || 'Core', '', term)}</div>`;
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
    else if (take.length < g.need) notes.push(`${g.name} offers only ${take.length} course(s) that are not already core courses, so ${g.need - take.length} more box(es) stay open.`);
    else if (g.members.length > take.length) notes.push(`${g.name} lists ${g.members.length} courses; ${g.need} are suggested. Swap any of them using the course picker.`);
  }
  return { list, notes };
}

// What each of the 8 combination boxes shows:
// hand-picked course > suggestion > completed electives not placed anywhere > university electives completed > open.
function resolveSlots() {
  const sug = suggestions();
  const manualIds = new Set(slots.filter((v) => courseById[v]));
  const chosen = picks();
  const out = slots.map((v, i) => {
    if (v === 'UNI') return { kind: 'uni', manual: true };
    if (v === 'none') return { kind: 'open' };
    if (courseById[v]) return { kind: 'course', id: v, manual: true, group: chosen.find((g) => g.members.includes(v)) || null };
    const s = streamRank[i] === undefined ? null : sug.list[streamRank[i]];
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
      ${cardBody(c, kind.toLowerCase(), kind, ' - ' + why, term, x)}</div>`;
  }
  if (info.kind === 'uni') {
    return `<div class="seq-card suggest option ${info.done ? 'done' : ''} ${active === i ? 'active' : ''}" ${cls}>
      <span class="kind option">University elective</span>${info.auto ? '' : x}
      <strong>Any RMIT course</strong><span>Elective from another program</span>
      <small>${info.done ? 'completed' : 'chosen by you'}</small></div>`;
  }
  return `<div class="seq-card slot ${active === i ? 'active' : ''}" ${cls}><strong>${esc(slotMeta[i].label || 'Combination course')}</strong>
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
  $('#sequence').innerHTML = [...new Set(data.sequence.map((x) => x.year))].map((y) => {
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
  const last = Logic.termFor(start, SEMESTERS, breaks);
  $('#summary').textContent = `${ev.required.done} of ${ev.required.total} core courses completed; ` +
    `${filled} of ${SLOTS} boxes filled. Planned finish: ${last}.`;
  $('#pick-note').textContent = res.notes.join(' ') || (res.hasSug
    ? 'Suggested courses follow the group\'s own listing order, mandatory ones first. Prerequisites are not checked.'
    : 'Pick a major or minors to get suggestions, or fill the boxes yourself from the course picker.');
  renderPool(placedSem);
}

// ---------- course picker ----------
const poolFilterOptions = () => optionsHtml([['all', 'All elective courses'], ...(NOGROUPS ? [] : [['chosen', STREAMS ? 'My minor stream' : 'My major / minors']]),
  ...groupFilterPairs(), ...listFilterPairs()]);

function renderPool(placedSem) {
  const q = $('#pool-search').value.trim().toLowerCase();
  const f = $('#pool-filter').value || 'all';
  const chosenIds = new Set(picks().flatMap((g) => g.members));
  const list = electives.filter((c) => {
    if (!textMatch(c, q)) return false;
    if (f === 'chosen') return chosenIds.has(c.id);
    const l = filterList(f);
    if (l) return (c.lists || []).includes(l);
    const g = filterGroup(f);
    return g ? c.groups.includes(g) : true;
  });
  const showUni = f === 'all' && !q;
  visibleIds = (showUni ? ['UNI'] : []).concat(list.map((c) => c.id));
  [...picked].forEach((id) => { if (!visibleIds.includes(id)) picked.delete(id); });
  const uniRow = `<div class="pool-item ${picked.has('UNI') ? 'selected' : ''}" draggable="true" data-id="UNI">
    <div><strong>University elective</strong><div class="chips"><span class="chip muted">any course from other RMIT programs</span></div></div>
    <button class="add" data-add="UNI">Add</button></div>`;
  const rows = list.map((c) => {
    const where = placedSem[c.id];
    const chips = groupChips(c);
    return `<div class="pool-item ${where ? 'placed' : ''} ${picked.has(c.id) ? 'selected' : ''}" draggable="true" data-id="${esc(c.id)}">
      <div><strong>${esc(c.id)}</strong> ${esc(c.name)} <small>${c.credits} cp</small>
        <div class="chips">${chips}${where ? `<span class="chip ok">in semester ${where}</span>` : ''}${state.done.includes(c.id) ? '<span class="chip req">completed</span>' : ''}</div></div>
      <button class="add" data-add="${esc(c.id)}">${where ? 'Move' : 'Add'}</button></div>`;
  }).join('');
  $('#pool-list').innerHTML = (showUni ? uniRow : '') + (rows || '<p class="empty">No courses match.</p>');
  $('#pool-selection').innerHTML = picked.size
    ? `<strong>${picked.size} selected</strong> <button class="add" id="add-selected">Add to boxes</button> <button class="linkbtn" id="clear-selected">Clear</button>`
    : '<span class="muted">Click a course to select it. Shift+click selects a range.</span>';
}

// ---------- placing courses ----------
function selectedIds() { return ['UNI', ...electives.map((c) => c.id)].filter((id) => picked.has(id)); }

// Put one or several courses into successive boxes. From a chosen box (clicked or dropped on) they replace what is
// there; otherwise they go into the open boxes in order.
function placeMany(ids, idx) {
  if (idx === undefined || idx < 0) idx = active;
  const targets = idx >= 0
    ? ids.map((_, k) => idx + k).filter((n) => n < SLOTS)
    : lastResolved.map((o, n) => (o.kind === 'open' ? n : -1)).filter((n) => n >= 0).slice(0, ids.length);
  if (!targets.length) { $('#pick-note').textContent = 'All combination boxes are full. Remove one with the × button, or drop the course onto a box to replace it.'; return; }
  const used = ids.slice(0, targets.length);
  used.forEach((id) => {
    if (id === 'UNI') return;
    slots = slots.map((v) => (v === id ? '' : v));                   // a course sits in one box only
    slots = slots.map((v, n) => (v === '' && lastResolved[n] && lastResolved[n].id === id ? 'none' : v));
  });
  used.forEach((id, k) => { slots[targets[k]] = id; });
  active = -1; picked.clear(); anchor = null;
  updateSaved({ slots }); render();
  if (used.length < ids.length) $('#pick-note').textContent = `${ids.length - used.length} selected course(s) did not fit in the remaining boxes.`;
}
const place = (id, idx) => placeMany([id], idx);

// ---------- controls ----------
const groupOpts = (type, current, none) => `<option value="">${none}</option>` +
  data.groups.filter((g) => g.type === type).map((g) => `<option value="${esc(g.id)}" ${g.id === current ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
function drawChoices() {
  if (NOGROUPS) { ['#major', '#minor1', '#minor2'].forEach((id) => { $(id).closest('label').style.display = 'none'; }); return; }
  if (STREAMS) {                                                  // one choice only: the minor stream
    $('#major').closest('label').style.display = $('#minor2').closest('label').style.display = 'none';
    $('#minor1').closest('label').firstChild.textContent = (data.labels.group || 'Minor stream') + ' ';
    $('#minor1').innerHTML = groupOpts('Minor', minors[0], data.labels.noGroup || 'No stream (IT route)');
    return;
  }
  $('#major').innerHTML = groupOpts('Major', major, 'No major');
  $('#minor1').innerHTML = groupOpts('Minor', minors[0], 'No minor');
  $('#minor2').innerHTML = groupOpts('Minor', minors[1], 'No second minor');
  $('#minor1').disabled = $('#minor2').disabled = !!major;      // a major already fills all 8 boxes
  $('#minor1').title = $('#minor2').title = major ? 'Choose "No major" to pick minors' : '';
}
function choose() {
  major = STREAMS ? '' : $('#major').value;
  minors = STREAMS ? [$('#minor1').value].filter(Boolean) : major ? [] : [$('#minor1').value, $('#minor2').value].filter(Boolean).filter((id, i, a) => a.indexOf(id) === i);
  // choosing a major or minors replaces whatever was in the combination boxes with that group's courses
  if (picks().length) { slots = Array(SLOTS).fill(''); active = -1; }
  updateSaved({ major, minors, slots }); drawChoices(); render();
}

$('#program').textContent = data.program;
$('.legend').innerHTML = `<span class="sw core"></span>${esc(data.labels.core)} ` +
  (NOGROUPS ? '' : (STREAMS ? '' : '<span class="sw major"></span>Major course ') + '<span class="sw minor"></span>' + (STREAMS ? 'Stream course ' : 'Minor course ')) +
  '<span class="sw slot"></span>Open slot <span class="sw done"></span>Completed';
if (data.sequenceNote) $('#seq-note').textContent = data.sequenceNote;
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
$('#pool-list').addEventListener('mousedown', (e) => { if (e.shiftKey) e.preventDefault(); });   // no text selection on Shift+click
$('#pool-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-add]');
  if (b) {
    const id = b.dataset.add;
    if (picked.has(id) && picked.size > 1) placeMany(selectedIds()); else place(id);
    return;
  }
  const row = e.target.closest('.pool-item');
  if (!row) return;
  const id = row.dataset.id;
  if (e.shiftKey && anchor && visibleIds.includes(anchor)) {          // range from the last clicked course
    const a = visibleIds.indexOf(anchor), z = visibleIds.indexOf(id);
    const range = visibleIds.slice(Math.min(a, z), Math.max(a, z) + 1);
    if (!(e.ctrlKey || e.metaKey)) picked.clear();
    range.forEach((x) => picked.add(x));
  } else if (e.ctrlKey || e.metaKey) {                                // add or remove one course
    if (picked.has(id)) picked.delete(id); else picked.add(id);
    anchor = id;
  } else {                                                            // plain click: select only this one (or deselect it)
    const only = picked.size === 1 && picked.has(id);
    picked.clear();
    if (!only) picked.add(id);
    anchor = id;
  }
  render();
});
$('#pool').addEventListener('click', (e) => {
  if (e.target.id === 'add-selected') placeMany(selectedIds());
  if (e.target.id === 'clear-selected') { picked.clear(); anchor = null; render(); }
});
$('#pool-list').addEventListener('dragstart', (e) => {
  const item = e.target.closest('.pool-item');
  if (!item) return;
  const id = item.dataset.id;
  e.dataTransfer.setData('text/plain', picked.has(id) && picked.size > 1 ? selectedIds().join(',') : id);   // drag the whole selection
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
  const ids = e.dataTransfer.getData('text/plain').split(',').filter((id) => id === 'UNI' || (courseById[id] && !courseById[id].required));
  box.classList.remove('over');
  if (ids.length) placeMany(ids, Number(box.dataset.slot));
});

// fold / unfold the course picker
function setFolded(v) {
  folded = v;
  try { localStorage.setItem(FOLD_KEY, v ? '1' : '0'); } catch (e) { /* not saved */ }
  document.querySelector('.seq-layout').classList.toggle('folded', v);
  const b = $('#pool-toggle');
  b.setAttribute('aria-expanded', String(!v));
  b.textContent = v ? '◀ Pick courses' : 'Fold ▶';
  if (v && active >= 0) { active = -1; render(); }
}
// restart everything: ticks, plans, name, starting term, breaks, major/minors and hand-picked boxes
$('#restart').addEventListener('click', () => { if (restartPlanner()) location.reload(); });
$('#pool-toggle').addEventListener('click', () => setFolded(!folded));
setFolded(folded);
render();
