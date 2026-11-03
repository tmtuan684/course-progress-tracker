// ui.js - shared by all three pages: DOM helpers, course chips and filters, and the saved progress.
// Load it after data.js and logic.js, and before the page's own script.
const data = window.DATA;
const courseById = Logic.byId(data);
const groupById = Object.fromEntries(data.groups.map((g) => [g.id, g]));

// ---------- small helpers ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const groupLabel = (g) => `${g.type}: ${g.name}`;
const optionsHtml = (pairs) => pairs.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');

// ---------- course chips and filters ----------
const groupChips = (c, sep = '') => c.groups
  .map((id) => `<span class="chip ${groupById[id].type.toLowerCase()}">${esc(groupLabel(groupById[id]))}</span>`).join(sep);
const groupFilterPairs = () => data.groups.map((g) => ['group:' + g.id, groupLabel(g)]);
const filterGroup = (filter) => (filter.startsWith('group:') ? filter.slice(6) : null);   // group id, or null
const textMatch = (c, q) => !q || (c.id + ' ' + c.name).toLowerCase().includes(q);

// ---------- saved progress (localStorage, one entry shared by all pages) ----------
const STORAGE_KEY = 'course-planner.v1';
const FOLD_KEY = 'course-planner.pool-folded';         // course picker folded on the sequence page
const clampUni = (v) => Math.max(0, Math.min(CONFIG.maxUni, Math.floor(Number(v) || 0)));
const emptyState = () => ({ done: [], uni: 0, plan: {}, name: '', start: '', breaks: [], major: '', minors: [],
  slots: Array(CONFIG.slots).fill('') });

// Never trust saved/imported data: keep only known course ids and sensible values.
function clean(s) {
  const out = emptyState();
  if (Array.isArray(s.done)) out.done = [...new Set(s.done.filter((id) => courseById[id]))];
  out.uni = clampUni(s.uni);
  out.name = String(s.name || '').slice(0, 80);
  out.start = Logic.isTerm(s.start) ? s.start : '';
  out.major = groupById[s.major] && groupById[s.major].type === 'Major' ? s.major : '';
  if (Array.isArray(s.minors)) out.minors = s.minors.filter((id) => groupById[id] && groupById[id].type === 'Minor').slice(0, 2);
  // slot values: '' = follow the suggestion, 'none' = left empty on purpose, 'UNI' = university elective, or a course id
  if (Array.isArray(s.slots)) s.slots.slice(0, CONFIG.slots).forEach((v, i) => {
    if (v === 'none' || v === 'UNI' || (courseById[v] && !courseById[v].required)) out.slots[i] = v;
  });
  if (Array.isArray(s.breaks))
    out.breaks = [...new Set(s.breaks.map(Number).filter((n) => n >= 2 && n <= CONFIG.semesters))].sort((x, y) => x - y);
  if (s.plan && typeof s.plan === 'object')
    for (const [id, term] of Object.entries(s.plan))
      if (courseById[id] && CONFIG.planTerms.includes(term)) out.plan[id] = term;
  return out;
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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: just don't save */ }
}
// Ask, then clear everything this site saved. Returns false if the student cancels.
function restartPlanner() {
  if (!confirm('Restart the course planner? This clears your ticked courses, plans, name, starting term, breaks, major/minors and chosen courses.')) return false;
  try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(FOLD_KEY); } catch (e) { /* nothing to clear */ }
  return true;
}
