// allcourses.js - every course used by any program, once, with the programs and roles that use it.
// Reads window.PROGRAMS only (no student data), so it works before a program is chosen.
const PROGRAMS = window.PROGRAMS || {};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LIST_NAMES = { it: 'IT / Advanced IT option', general: 'General option', tech: 'Technical option', uni: 'University elective' };
const TERMS = [...new Set(Object.values(PROGRAMS).flatMap((p) => p.terms))].sort();

// one record per code: name, credits, roles [{program, role, kind}], offering per term
const all = {};
Object.values(PROGRAMS).forEach((p) => {
  const groups = Object.fromEntries(p.groups.map((g) => [g.id, g]));
  p.courses.forEach((c) => {
    const r = all[c.id] = all[c.id] || { id: c.id, name: c.name, credits: c.credits, roles: [], off: {}, tbc: false };
    r.tbc = r.tbc || !!c.codeTbc;
    if (c.required) r.roles.push({ program: p.code, role: c.category || 'Core', kind: 'core' });
    c.groups.forEach((g) => r.roles.push({ program: p.code, role: `${groups[g].type}: ${groups[g].name}`, kind: groups[g].type.toLowerCase() }));
    (c.lists || []).forEach((l) => r.roles.push({ program: p.code, role: LIST_NAMES[l] || l, kind: 'option' }));
    const o = p.offerings[c.id] || {};
    p.terms.forEach((t) => { if ((o[t] || '').startsWith('Yes')) r.off[t] = true; });
  });
});
const courses = Object.values(all).sort((a, b) => a.id.localeCompare(b.id));
const roleKey = (r) => r.kind === 'core' ? 'core' : r.kind === 'option' ? r.role : r.kind;   // core | option list name | major | minor

const sel = (id, pairs) => { document.querySelector(id).innerHTML = pairs.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join(''); };
sel('#program', [['all', 'All programs'], ...Object.values(PROGRAMS).map((p) => [p.code, p.code])]);
sel('#role', [['all', 'Any role'], ['core', 'Core / Capstone'], ['minor', 'Minor course'], ['major', 'Major course'],
  ...Object.values(LIST_NAMES).map((n) => [n, n])]);
sel('#offered', [['any', 'Offered in any term'], ...TERMS.map((t) => [t, 'Offered in ' + t]), ['none', 'Not scheduled in 2026']]);

function render() {
  const q = document.querySelector('#search').value.trim().toLowerCase();
  const prog = document.querySelector('#program').value, role = document.querySelector('#role').value, off = document.querySelector('#offered').value;
  const list = courses.filter((c) => {
    if (q && !(c.id + ' ' + c.name).toLowerCase().includes(q)) return false;
    const rs = c.roles.filter((r) => prog === 'all' || r.program === prog);
    if (prog !== 'all' && !rs.length) return false;
    if (role !== 'all' && !rs.some((r) => roleKey(r) === role)) return false;
    if (off === 'none') return !Object.keys(c.off).length;
    if (off !== 'any' && !c.off[off]) return false;
    return true;
  });
  const head = `<thead><tr><th>Code</th><th>Course</th><th>Credits</th><th>Used in</th>${TERMS.map((t) => `<th>${esc(t)}</th>`).join('')}</tr></thead>`;
  const body = list.map((c) => {
    const byProg = {};
    c.roles.forEach((r) => (byProg[r.program] = byProg[r.program] || []).push(r));
    const used = Object.entries(byProg).map(([p, rs]) => `<div><strong>${esc(p)}</strong> ` +
      rs.map((r) => `<span class="chip ${r.kind === 'core' ? 'req' : r.kind}">${esc(r.role)}</span>`).join(' ') + '</div>').join('');
    return `<tr><td><strong>${esc(c.id)}</strong>${c.tbc ? ' <span class="chip muted">code to confirm</span>' : ''}</td><td>${esc(c.name)}</td><td>${c.credits}</td>
      <td>${used}</td>${TERMS.map((t) => c.off[t] ? '<td class="off yes">Offered</td>' : '<td class="off none">–</td>').join('')}</tr>`;
  }).join('');
  document.querySelector('#table').innerHTML = head + `<tbody>${body}</tbody>`;
  document.querySelector('#count').textContent = `${list.length} of ${courses.length} courses across ${Object.keys(PROGRAMS).length} programs (SGS offering)`;
}
['input', 'change'].forEach((ev) => document.querySelectorAll('.toolbar > *').forEach((el) => el.addEventListener(ev, render)));
render();
