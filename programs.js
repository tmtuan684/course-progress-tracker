// programs.js - the first page: the student chooses a program, then the other pages follow it.
const PROGRAM_KEY = 'course-planner.program';          // same key as ui.js
const PROGRAMS = window.PROGRAMS || {};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const storageKey = (p) => (p.code === 'BP162VI23' ? 'course-planner.v1' : 'course-planner.v1.' + p.code);
let current = null;
try { current = localStorage.getItem(PROGRAM_KEY); } catch (e) { /* none */ }

function saved(p) {                                     // how many courses this student has ticked in that program
  try { const s = JSON.parse(localStorage.getItem(storageKey(p))); return s && Array.isArray(s.done) ? s.done.length : 0; } catch (e) { return 0; }
}

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
  </article>`;
}).join('');

document.querySelector('#programs').addEventListener('click', (e) => {
  const b = e.target.closest('.choose');
  if (!b) return;
  try { localStorage.setItem(PROGRAM_KEY, b.dataset.code); } catch (err) { /* then ?program= below still works */ }
  location.href = 'index.html?program=' + encodeURIComponent(b.dataset.code);
});
