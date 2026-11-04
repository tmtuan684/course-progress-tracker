// index.js - the user interface: keeps the state, saves it, and draws the page.
// All degree rules live in logic.js; shared helpers and the saved progress live in ui.js.

const nextTerm = CONFIG.planTerms[0];
let state = loadState();
const save = () => saveState(syncUni(state));

// ---------- progress panel ----------
function bar(n, total, cls = '') {
  const pct = total ? Math.min(100, Math.round((n / total) * 100)) : 0;
  return `<div class="bar ${cls}"><div style="width:${pct}%"></div></div>`;
}

// Study path card: which way of finishing the electives the student follows, and how completed courses are used in it.
function pathCard(ev) {
  const defs = Logic.pathDefs(data);
  const def = defs.find((p) => p.id === state.path);
  const picks = def ? def.picks.map((pk, i) => {
    const opts = data.groups.filter((g) => g.type === pk.type)
      .map((g) => `<option value="${esc(g.id)}" ${state.pathGroups[i] === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
    return `<label>${esc(pk.label)} <select class="pathgroup" data-i="${i}"><option value="">Choose…</option>${opts}</select></label>`;
  }).join('') : '';
  const p = ev.path;
  let detail = '';
  if (p && p.incomplete) detail = `<p class="hint">Choose ${def.picks.map((x) => x.label).join(' and ')} to check this path.</p>`;
  else if (p) {
    detail = `<ul class="groups">${p.roles.map((r) => `<li class="group ${r.have + r.uni >= r.need ? 'done' : ''}">
        <div class="row"><span>${esc(r.label)}</span><strong>${r.have}${r.uni ? ' + ' + r.uni + ' university' : ''} / ${r.need}</strong></div>${bar(r.have + r.uni, r.need)}
        ${r.courses.length ? `<small>${r.courses.map((id) => esc(id)).join(', ')}</small>` : ''}</li>`).join('')}
      ${p.uni.need ? `<li class="group ${p.uni.have >= p.uni.need ? 'done' : ''}"><div class="row"><span>University electives</span><strong>${Math.min(p.uni.have, p.uni.need)} / ${p.uni.need}</strong></div>${bar(p.uni.have, p.uni.need)}</li>` : ''}</ul>
      <p class="result">${p.met ? 'This path is complete' : `This path needs ${p.left} more course(s)`}</p>
      ${p.extra.length ? `<p class="hint">Completed but not counted in this path: ${p.extra.map((id) => esc(id)).join(', ')}. Change a course's role in the list below if one should count.</p>` : ''}`;
  }
  return `<div class="card ${p && p.met ? 'done' : ''}">
    <h2>Study path</h2>
    ${!state.path && ev.autoPath ? `<p class="hint">Best fit so far: <strong>${esc(ev.autoPath.def.label)}</strong>${ev.autoPath.sel.length ? ' (' + ev.autoPath.sel.map((id) => esc(groupById[id].name)).join(', ') + ')' : ''}${ev.autoPath.left ? `, ${ev.autoPath.left} more course(s) needed` : ', complete'}. Set a course's role in the list below, or choose a path here.</p>` : ''}
    <label>Path <select id="path"><option value="">Not chosen (any path counts)</option>${defs.map((d) =>
      `<option value="${esc(d.id)}" ${d.id === state.path ? 'selected' : ''}>${esc(d.label)}</option>`).join('')}</select></label>
    ${picks}${detail}</div>`;
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
      <h2>Core courses</h2>
      <div class="row"><span>${esc(data.labels.core)}</span><strong>${ev.required.done} / ${ev.required.total}</strong></div>
      ${bar(ev.required.done, ev.required.total, 'required')}
    </div>

    ${pathCard(ev)}

    <div class="card ${ev.electivesMet ? 'done' : ''}">
      <h2>${esc(data.labels.electives)}</h2>
      <ul class="pathways">${ev.pathways.map((p) =>
        `<li class="${p.met ? 'met' : ''}"><span>${p.met ? '✓' : '○'}</span> ${esc(p.label)}</li>`).join('')}</ul>
      <p class="result">${ev.electivesMet ? 'Elective requirement met' : 'Elective requirement not met yet'}</p>
      <p class="hint"><strong>${esc(data.labels.uni)}: ${state.uni}</strong>. Tick University elective 1 to 4 in the course list below, one for each elective course taken in another school.</p>
      <p class="hint">${esc(data.labels.options)}: <strong>${ev.D}</strong></p>
      <ul class="groups">${groupRows}</ul>
    </div>`;

  // Credit points sit in the fixed bar beside the student name, so they stay visible while ticking.
  const optionsName = { electives8: 'Major / minor / program options', streams: 'IT, stream & general options',
    techoptions: data.groups.length ? 'Minor courses' : 'Technical options' }[data.ruleset] || 'Program options';
  const count = (n) => `<em>${n} course${n === 1 ? '' : 's'}</em>`;     // completed courses of that type
  const uniDone = data.courses.filter((c) => c.uni && state.done.includes(c.id)).length;
  $('#credits').innerHTML = `
    <span class="credits-title">Credit points</span>
    <span class="credit"><small>Core</small><strong>${ev.credits.required}</strong>${count(ev.required.done)}</span>
    <span class="credit"><small>${esc(optionsName)}</small><strong>${ev.credits.programOptions}</strong>${count(ev.D)}</span>
    <span class="credit"><small>University electives</small><strong>${ev.credits.university}</strong>${count(uniDone)}</span>
    <span class="credit total"><small>Total</small><strong>${ev.credits.total} / ${PROGRAM_CREDITS}</strong>${count(ev.required.done + ev.D + uniDone)}</span>`;
}

// ---------- course list ----------
const filterOptions = () => [['all', 'All courses'], ['todo', 'Not completed'], ['next', `Offered ${nextTerm} (not completed)`],
  ['required', 'Core courses'], ...groupFilterPairs(), ...listFilterPairs()];

function matches(c, filter, q) {
  if (!textMatch(c, q)) return false;
  const done = state.done.includes(c.id);
  if (filter === 'todo') return !done;
  if (filter === 'next') return !done && Logic.offeredIn(data, c.id, nextTerm);
  if (filter === 'required') return c.required;
  const l = filterList(filter);
  if (l) return (c.lists || []).includes(l);
  const g = filterGroup(filter);
  return g ? c.groups.includes(g) : true;
}

function offeredBadge(c) {
  if (c.uni) return '<span class="chip muted">offered by other schools</span>';
  if (!data.offerings[c.id]) return '<span class="chip muted">no schedule data</span>';
  return Logic.offeredIn(data, c.id, nextTerm)
    ? `<span class="chip ok">offered ${nextTerm}</span>` : `<span class="chip muted">not ${nextTerm}</span>`;
}

// Role of a completed elective in the chosen path: automatic, or the student's own choice.
function roleSelect(c, evp, chosenOK) {
  const auto = evp.assigned[c.id];
  const own = state.roles[c.id] || '';
  const opts = chosenOK
    ? evp.roles.filter((r, i, a) => a.findIndex((x) => x.role === r.role) === i && Logic.eligible(data, r.role).has(c.id))
    : Logic.rolesFor(data, c);                    // no path chosen yet: every role this course can play in the program
  return `<select class="roleSel" aria-label="Role of ${esc(c.name)}">
    <option value="">Auto: ${esc(auto ? Logic.roleLabel(data, auto) : 'not counted')}</option>
    ${opts.map((r) => `<option value="${esc(r.role)}" ${own === r.role ? 'selected' : ''}>Counts as ${esc(r.label)}</option>`).join('')}
    <option value="none" ${own === 'none' ? 'selected' : ''}>Do not count</option></select>`;
}

function renderList() {
  const evAll = Logic.evaluate(data, state);
  const chosenOK = evAll.path && !evAll.path.incomplete;
  const evp = chosenOK ? evAll.path : evAll.autoPath;     // the chosen path, or the best fit when none is chosen (or it is not set up yet)
  const pathOn = evp && !evp.incomplete;
  const filter = $('#filter').value || 'all';
  const q = $('#search').value.trim().toLowerCase();
  const rows = data.courses.filter((c) => matches(c, filter, q)).map((c) => {
    const done = state.done.includes(c.id);
    const term = state.plan[c.id] || '';
    const check = Logic.planCheck(data, state, c.id, term);
    const chips = (c.required ? '<span class="chip req">core</span>' : '') + groupChips(c);
    return `<div class="course ${done ? 'done' : ''}" data-id="${esc(c.id)}">
      <input type="checkbox" class="tick" aria-label="Completed: ${esc(c.name)}" ${done ? 'checked' : ''}>
      <div class="info">
        <div class="title"><strong>${esc(c.id)}</strong> ${esc(c.name)} <small>${c.credits} cp</small></div>
        <div class="chips">${chips}${offeredBadge(c)}</div>
      </div>
      <div class="plan">
        ${done && pathOn && !c.required ? roleSelect(c, evp, chosenOK) : `<select class="planSel" aria-label="Plan for: ${esc(c.name)}" ${done ? 'disabled' : ''}>
          <option value="">Plan for…</option>
          ${CONFIG.planTerms.map((t) => `<option ${t === term ? 'selected' : ''}>${t}</option>`).join('')}
        </select>`}
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
    const checks = ids.map((id) => [id, Logic.planCheck(data, state, id, term)]);
    const problems = checks.filter(([, check]) => check !== 'OK').length;
    const names = checks.map(([id, check]) => {
      const ok = check === 'OK';
      return `<li class="${ok ? '' : 'bad'}">${esc(id)} ${esc(courseById[id].name)}${ok ? '' : ' - ' + esc(check)}</li>`;
    }).join('');
    return `<div class="term"><h3>${term}</h3>
      <p>${ids.length} course(s), ${credits} credit points${problems ? `, <span class="bad">${problems} problem(s)</span>` : ''}</p>
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
  } else if (e.target.classList.contains('roleSel')) {
    if (e.target.value) state.roles[id] = e.target.value; else delete state.roles[id];
  } else if (e.target.classList.contains('planSel')) {
    if (e.target.value) state.plan[id] = e.target.value; else delete state.plan[id];
  }
  save(); renderAll();
});

$('#progress').addEventListener('change', (e) => {
  if (e.target.id === 'path') {                          // a new path starts with automatic roles
    state.path = e.target.value; state.pathGroups = []; state.roles = {};
    save(); renderAll(); return;
  }
  if (e.target.classList.contains('pathgroup')) {
    state.pathGroups = [...document.querySelectorAll('.pathgroup')].map((sel) => sel.value);
    state.roles = {};
    save(); renderAll(); return;
  }
  if (e.target.id !== 'uni') return;
  state.uni = clampUni(e.target.value);
  save(); renderAll();
});

window.addEventListener('pagehide', save);     // everything is saved on each change; this is a last safety net
$('#name').addEventListener('input', (e) => { state.name = e.target.value.slice(0, 80); save(); });
$('#print').addEventListener('click', () => { renderReport(); window.print(); });

$('#filter').addEventListener('change', renderList);
$('#search').addEventListener('input', renderList);

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `my-course-progress-${data.code}.json` });
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
  if (!restartPlanner()) return;
  state = emptyState(); $('#name').value = ''; renderAll();
});

// ---------- start ----------
// Side panes stick just below the fixed student bar, whose height changes when it wraps.
new ResizeObserver(() => document.documentElement.style.setProperty('--bar-h', $('#student').offsetHeight + 'px'))
  .observe($('#student'));
$('#program').textContent = data.program;
$('#name').value = state.name;
$('#filter').innerHTML = optionsHtml(filterOptions());
renderAll();
