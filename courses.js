// courses.js - read-only table of all courses and the terms they are offered.
const data = window.DATA;
const groupById = Object.fromEntries(data.groups.map((g) => [g.id, g]));
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const groupLabel = (g) => `${g.type}: ${g.name}`;

function offeringCell(c, term) {
  const row = data.offerings[c.id];
  if (!row) return '<td class="off none" title="Not in the schedule">–</td>';
  const v = row[term] || '';
  if (v.startsWith('Yes')) return '<td class="off yes">Offered</td>';
  if (v === 'Cancelled') return '<td class="off cancelled">Cancelled</td>';
  return '<td class="off no">Not offered</td>';
}

function matches(c, filter, offered, q) {
  if (q && !(c.id + ' ' + c.name).toLowerCase().includes(q)) return false;
  if (filter === 'required' && !c.required) return false;
  if (filter === 'elective' && c.required) return false;
  if (filter.startsWith('group:') && !c.groups.includes(filter.slice(6))) return false;
  if (offered !== 'any' && !Logic.offeredIn(data, c.id, offered)) return false;
  return true;
}

function render() {
  const q = $('#search').value.trim().toLowerCase();
  const list = data.courses.filter((c) => matches(c, $('#filter').value, $('#offered').value, q));
  const head = `<thead><tr><th>Code</th><th>Course</th><th>Credits</th><th>Type</th><th>Majors / minors</th>${
    data.terms.map((t) => `<th>${esc(t)}</th>`).join('')}</tr></thead>`;
  const body = list.map((c) => `<tr>
    <td><strong>${esc(c.id)}</strong></td><td>${esc(c.name)}</td><td>${c.credits}</td>
    <td>${c.required ? '<span class="chip req">' + esc(c.category || 'Required') + '</span>' : 'Elective'}</td>
    <td>${c.groups.map((id) => `<span class="chip ${groupById[id].type.toLowerCase()}">${esc(groupLabel(groupById[id]))}</span>`).join(' ')}</td>
    ${data.terms.map((t) => offeringCell(c, t)).join('')}</tr>`).join('');
  $('#table').innerHTML = head + `<tbody>${body}</tbody>`;
  $('#count').textContent = `${list.length} of ${data.courses.length} courses (SGS offering)`;
}

$('#program').textContent = data.program;
$('#filter').innerHTML = [['all', 'All courses'], ['required', 'Required courses'], ['elective', 'Electives only'],
  ...data.groups.map((g) => ['group:' + g.id, groupLabel(g)])]
  .map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
$('#offered').innerHTML = '<option value="any">Offered in any term</option>' +
  data.terms.map((t) => `<option value="${esc(t)}">Offered in ${esc(t)}</option>`).join('');
['input', 'change'].forEach((ev) => document.querySelectorAll('.toolbar > *').forEach((el) => el.addEventListener(ev, render)));
render();
