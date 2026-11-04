// ui.js - shared by all three pages: DOM helpers, course chips and filters, and the saved progress.
// Load it after data.js and logic.js, and before the page's own script.
// The student picks a program on programs.html; the choice is remembered in this browser.
const PROGRAM_KEY = 'course-planner.program';
const PROGRAMS = window.PROGRAMS || {};
(function pickProgram() {
  const asked = new URLSearchParams(location.search).get('program');
  if (asked && PROGRAMS[asked]) { try { localStorage.setItem(PROGRAM_KEY, asked); } catch (e) { /* ignore */ } }
})();
// A new browser session (tab opened fresh) always begins on the program chooser, which offers to continue or start fresh.
const SESSION_KEY = 'course-planner.session';
const sessionStarted = () => { try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return true; } };
if (new URLSearchParams(location.search).get('program') && PROGRAMS[new URLSearchParams(location.search).get('program')]) {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* ignore */ }
}
if (!sessionStarted()) { location.replace('programs.html'); throw new Error('Session not started'); }
const programCode = (() => { try { return localStorage.getItem(PROGRAM_KEY); } catch (e) { return null; } })();
const data = PROGRAMS[programCode];
if (!data) { location.replace('programs.html'); throw new Error('No program chosen yet'); }
data.labels = data.labels || { core: 'Core', electives: 'Electives', options: 'Options completed', uni: 'University electives completed' };
const SEMESTERS = Array.isArray(data.sequence) ? data.sequence.length : CONFIG.semesters;
const SLOT_COUNT = Array.isArray(data.sequence) ? data.sequence.reduce((n, s) => n + s.open, 0) : CONFIG.slots;
const PROGRAM_CREDITS = data.programCredits || CONFIG.programCredits;
const courseById = Logic.byId(data);
// Interchangeable courses inside this program (same-program rows of programs/equivalences.js).
data.equiv = {};
(window.EQUIVALENCES || []).forEach((r) => {
  if (r.from_program === data.code && r.to_program === data.code && courseById[r.to_code] && r.from_code !== r.to_code)
    (data.equiv[r.to_code] = data.equiv[r.to_code] || []).push(r.from_code);
});
const groupById = Object.fromEntries(data.groups.map((g) => [g.id, g]));

// ---------- small helpers ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const groupLabel = (g) => `${g.type}: ${g.name}`;
const optionsHtml = (pairs) => pairs.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');

// ---------- course chips and filters ----------
const LIST_NAMES = { it: 'IT / Advanced IT option', general: 'General option', tech: 'Technical option', uni: 'University elective' };
const groupChips = (c, sep = '') => [
  ...c.groups.map((id) => `<span class="chip ${groupById[id].type.toLowerCase()}">${esc(groupLabel(groupById[id]))}</span>`),
  ...(c.lists || []).map((l) => `<span class="chip option">${esc(LIST_NAMES[l] || l)}</span>`)].join(sep);
const hasLists = data.courses.some((c) => (c.lists || []).length);
const listFilterPairs = () => (hasLists ? Object.entries(LIST_NAMES).filter(([k]) => data.courses.some((c) => (c.lists || []).includes(k)))
  .map(([k, v]) => ['list:' + k, v]) : []);
const filterList = (filter) => (filter.startsWith('list:') ? filter.slice(5) : null);   // list key, or null
const groupFilterPairs = () => data.groups.map((g) => ['group:' + g.id, groupLabel(g)]);
const filterGroup = (filter) => (filter.startsWith('group:') ? filter.slice(6) : null);   // group id, or null
const textMatch = (c, q) => !q || (c.id + ' ' + c.name).toLowerCase().includes(q);

// ---------- saved progress (localStorage, one entry shared by all pages) ----------
const STORAGE_KEY = data.code === 'BP162VI23' ? 'course-planner.v1' : 'course-planner.v1.' + data.code;   // one entry per program
const FOLD_KEY = 'course-planner.pool-folded';         // course picker folded on the sequence page
const clampUni = (v) => Math.max(0, Math.min(data.maxUni || CONFIG.maxUni, Math.floor(Number(v) || 0)));
const emptyState = () => ({ done: [], uni: 0, plan: {}, name: '', start: '', breaks: [], major: '', minors: [], path: '', pathGroups: [], roles: {},
  slots: Array(SLOT_COUNT).fill('') });

// University electives are placeholder courses (University elective 1..4); the count the rules use is how many are ticked.
function syncUni(s) { s.uni = data.courses.filter((c) => c.uni && s.done.includes(c.id)).length; return s; }

// Never trust saved/imported data: keep only known course ids and sensible values.
function clean(s) {
  const out = emptyState();
  if (Array.isArray(s.done)) out.done = [...new Set(s.done.filter((id) => courseById[id]))];
  out.uni = clampUni(s.uni);
  const placeholders = data.courses.filter((c) => c.uni).map((c) => c.id);   // older saves kept a typed number: tick that many
  for (const id of placeholders) { if (out.uni > data.courses.filter((c) => c.uni && out.done.includes(c.id)).length && !out.done.includes(id)) out.done.push(id); }
  out.name = String(s.name || '').slice(0, 80);
  // study path chosen on My progress, the groups it uses, and the student's own role for a course
  if (Logic.pathDefs(data).some((p) => p.id === s.path)) out.path = s.path;
  if (Array.isArray(s.pathGroups)) out.pathGroups = s.pathGroups.filter((id) => groupById[id]).slice(0, 2);
  if (s.roles && typeof s.roles === 'object') {
    const ok = Logic.validRoles(data);
    for (const [id, r] of Object.entries(s.roles)) if (courseById[id] && ok.has(r)) out.roles[id] = r;
  }
  out.start = Logic.isTerm(s.start) ? s.start : '';
  out.major = groupById[s.major] && groupById[s.major].type === 'Major' ? s.major : '';
  if (Array.isArray(s.minors)) out.minors = s.minors.filter((id) => groupById[id] && groupById[id].type === 'Minor').slice(0, 2);
  // slot values: '' = follow the suggestion, 'none' = left empty on purpose, 'UNI' = university elective, or a course id
  if (Array.isArray(s.slots)) s.slots.slice(0, SLOT_COUNT).forEach((v, i) => {
    if (v === 'none' || v === 'UNI' || (courseById[v] && !courseById[v].required)) out.slots[i] = v;
  });
  if (Array.isArray(s.breaks))
    out.breaks = [...new Set(s.breaks.map(Number).filter((n) => n >= 2 && n <= SEMESTERS))].sort((x, y) => x - y);
  if (s.plan && typeof s.plan === 'object')
    for (const [id, term] of Object.entries(s.plan))
      if (courseById[id] && CONFIG.planTerms.includes(term)) out.plan[id] = term;
  return syncUni(out);
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? clean(saved) : emptyState();
  } catch (e) {
    return emptyState();
  }
}
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY + '.at', String(Date.now()));          // shown on the chooser as "last saved"
  } catch (e) { /* private mode: just don't save */ }
}
// Ask, then clear everything this site saved. Returns false if the student cancels.
function restartPlanner() {
  if (!confirm('Restart the course planner? This clears your ticked courses, plans, name, starting term, breaks, major/minors and chosen courses.')) return false;
  try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_KEY + '.at'); localStorage.removeItem(FOLD_KEY); } catch (e) { /* nothing to clear */ }
  return true;
}
