// logic.js - the degree rules, as pure functions (no DOM here, so it is easy to test).
//
// state = { done: ["COSC3104", ...], uni: 0, plan: { "COSC2174": "2026-3", ... } }
// data  = window.DATA (see data.js)

const CONFIG = {
  planTerms: ['2026-3', '2027-1', '2027-2', '2027-3'], // terms a student can plan into
  uniCredits: 12,                                       // assumed credit points per university elective
};

const Logic = (() => {
  const byId = (data) => Object.fromEntries(data.courses.map((c) => [c.id, c]));

  // A course used as a REQUIRED course cannot also fill an elective slot, so only
  // non-required completed courses count towards majors/minors/program options.
  function electiveDone(data, state) {
    const done = new Set(state.done);
    return new Set(data.courses.filter((c) => !c.required && done.has(c.id)).map((c) => c.id));
  }

  function groupStatus(g, elective, done) {
    const have = g.members.filter((m) => elective.has(m));
    const mandatoryOK = g.mandatory.every((m) => done.has(m));
    return {
      group: g,
      have,
      n: have.length,
      need: g.need,
      met: !g.listMissing && have.length >= g.need && mandatoryOK,
      mandatoryMissing: g.mandatory.filter((m) => !done.has(m)),
    };
  }

  // Two minors work when each has its 4 AND there are 8 different courses between them
  // (a course shared by both minors can only be used once). This is Hall's condition,
  // which is exact for two groups.
  function twoMinorsOK(a, b) {
    if (!a.met || !b.met) return false;
    const union = new Set([...a.have, ...b.have]);
    return union.size >= a.need + b.need;
  }

  function evaluate(data, state) {
    const courses = byId(data);
    const done = new Set(state.done);
    const elective = electiveDone(data, state);
    const statuses = data.groups.map((g) => groupStatus(g, elective, done));
    const majors = statuses.filter((s) => s.group.type === 'Major');
    const minors = statuses.filter((s) => s.group.type === 'Minor');

    // D = distinct program-option courses completed (each course counted once, however many groups list it)
    const D = [...elective].filter((id) => courses[id].groups.length > 0).length;
    const U = Number(state.uni) || 0;

    let pairOK = false;
    for (let i = 0; i < minors.length; i++)
      for (let j = i + 1; j < minors.length; j++) if (twoMinorsOK(minors[i], minors[j])) pairOK = true;

    const pathways = [
      { id: 1, label: '1 major (8 courses)', met: majors.some((s) => s.met) },
      { id: 2, label: '2 minors (4 + 4 courses)', met: pairOK },
      { id: 3, label: '1 minor + 4 program options or university electives',
        met: minors.some((s) => s.met) && (D - 4) + U >= 4 },
      { id: 4, label: '4 program options + 4 university electives', met: D >= 4 && U >= 4 },
    ];

    const required = data.courses.filter((c) => c.required);
    const requiredDone = required.filter((c) => done.has(c.id));
    const sum = (list) => list.reduce((t, c) => t + c.credits, 0);
    const electiveCredits = sum([...elective].filter((id) => courses[id].groups.length > 0).map((id) => courses[id]));
    const credits = {
      required: sum(requiredDone),
      programOptions: electiveCredits,
      university: U * CONFIG.uniCredits,
    };
    credits.total = credits.required + credits.programOptions + credits.university;

    return {
      statuses, D, U, pathways,
      electivesMet: pathways.some((p) => p.met),
      required: { done: requiredDone.length, total: required.length },
      credits,
    };
  }

  // Is this course running at SGS in this term?  Same wording as the Excel "Plan check".
  function planCheck(data, state, id, term) {
    if (!term) return '';
    if (state.done.includes(id)) return 'Already completed';
    if (!data.terms.includes(term)) return 'No schedule yet';
    const row = data.offerings[id];
    if (!row) return 'Not in schedule';
    const v = row[term] || '';
    if (v.startsWith('Yes')) return 'OK';
    return v === 'Cancelled' ? 'Cancelled' : 'Not offered';
  }

  const offeredIn = (data, id, term) => ((data.offerings[id] || {})[term] || '').startsWith('Yes');

  return { evaluate, planCheck, offeredIn, byId };
})();

if (typeof module !== 'undefined') module.exports = { Logic, CONFIG }; // lets Node tests import it
