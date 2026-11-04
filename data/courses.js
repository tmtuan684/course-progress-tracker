// courses.js - read-only table of all courses and the terms they are offered.
const HANDBOOK_URL = data.handbookUrl;

const OFFERING_CELL = {
  yes: '<td class="off yes">Offered</td>',
  cancelled: '<td class="off cancelled">Cancelled</td>',
  no: '<td class="off no">Not offered</td>',
  none: '<td class="off none" title="Not in the schedule">–</td>',
};
const offeringCell = (c, term) => OFFERING_CELL[Logic.offering(data, c.id, term)];

// Prerequisite cell: codes in the handbook text are shown with the course name.
function prereqCell(c) {
  const p = c.prereq;
  if (!p) return '<td class="prereq none">Check the <a href="' + HANDBOOK_URL + '" target="_blank" rel="noopener">RMIT Course Handbook</a></td>';
  const note = p.note ? ` title="${esc(p.note)}"` : '';
  if (!p.text) return `<td class="prereq"${note}>None listed <small>(${esc(p.source)})</small></td>`;
  const html = esc(p.text).replace(/[A-Z]{4}\d{4}/g, (code) => {
    const r = courseById[code];
    return r ? `<strong>${code}</strong> ${esc(r.name)}` : code;
  });
  const flag = /confirm/i.test(p.note) ? ' <span class="chip muted" title="' + esc(p.note) + '">to confirm</span>' : '';
  return `<td class="prereq"${note}>${html} <small>(${esc(p.source)})</small>${flag}</td>`;
}

function matches(c, filter, offered, q) {
  if (!textMatch(c, q)) return false;
  if (filter === 'required' && !c.required) return false;
  if (filter === 'elective' && c.required) return false;
  const l = filterList(filter);
  if (l && !(c.lists || []).includes(l)) return false;
  const g = filterGroup(filter);
  if (g && !c.groups.includes(g)) return false;
  if (offered !== 'any' && !Logic.offeredIn(data, c.id, offered)) return false;
  return true;
}

function render() {
  const q = $('#search').value.trim().toLowerCase();
  const list = data.courses.filter((c) => matches(c, $('#filter').value, $('#offered').value, q));
  const head = `<thead><tr><th>Code</th><th>Course</th><th>Credits</th><th>Type</th><th>Majors / minors</th><th>Prerequisites</th>${
    data.terms.map((t) => `<th>${esc(t)}</th>`).join('')}</tr></thead>`;
  const body = list.map((c) => `<tr>
    <td><strong>${esc(c.id)}</strong></td><td>${esc(c.name)}</td><td>${c.credits}</td>
    <td>${c.required ? '<span class="chip req">' + esc(c.category || 'Core') + '</span>' : 'Elective'}</td>
    <td>${groupChips(c, ' ')}</td>
    ${prereqCell(c)}
    ${data.terms.map((t) => offeringCell(c, t)).join('')}</tr>`).join('');
  $('#table').innerHTML = head + `<tbody>${body}</tbody>`;
  $('#count').textContent = `${list.length} of ${data.courses.length} courses (SGS offering)`;
}

$('#program').textContent = data.program;
$('#filter').innerHTML = optionsHtml([['all', 'All courses'], ['required', 'Core courses'], ['elective', 'Electives only'],
  ...groupFilterPairs(), ...listFilterPairs()]);
$('#offered').innerHTML = optionsHtml([['any', 'Offered in any term'], ...data.terms.map((t) => [t, 'Offered in ' + t])]);
['input', 'change'].forEach((ev) => document.querySelectorAll('.toolbar > *').forEach((el) => el.addEventListener(ev, render)));
render();
