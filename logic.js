// logic.js - the degree rules, as pure functions (no DOM here, so it is easy to test).
//
// state = { done: ["COSC3104", ...], uni: 0, plan: { "COSC2174": "2026-3", ... } }
// data  = window.DATA (see data.js)

const CONFIG = {
  planTerms: ['2026-3', '2027-1', '2027-2', '2027-3'], // terms a student can plan into
  termsPerYear: 3,                                      // RMIT runs three terms a year
  semesters: 8,                                         // semesters in the program plan guide
  slots: 8,                                             // open "Combination course" boxes in the sequence
  maxUni: 8,                                            // most university electives a student can count
  uniCredits: 12,                                       // assumed credit points per university elective
  programCredits: 288,                                  // credit points needed to complete the program
};

const Logic = (() => {
  const lookups = new WeakMap();                        // data -> { id: course }, built once per data object
  function byId(data) {
    if (!lookups.has(data)) lookups.set(data, Object.fromEntries(data.courses.map((c) => [c.id, c])));
    return lookups.get(data);
  }

  // A course used as a REQUIRED course cannot also fill an elective slot, so only
  // non-required completed courses count towards majors/minors/program options.
  function electiveDone(data, done) {
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
    const elective = electiveDone(data, done);
    const statuses = data.groups.map((g) => groupStatus(g, elective, done));
    const majors = statuses.filter((s) => s.group.type === 'Major');
    const minors = statuses.filter((s) => s.group.type === 'Minor');

    // program options = completed electives listed by at least one group (each course counted once)
    const options = [...elective].filter((id) => courses[id].groups.length > 0).map((id) => courses[id]);
    const D = options.length;
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
    const credits = {
      required: sum(requiredDone),
      programOptions: sum(options),
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

  // Is this course running at SGS in this term?
  // 'yes' | 'cancelled' | 'no' | 'none' (course not in the schedule) | 'unscheduled' (no schedule for that term)
  function offering(data, id, term) {
    if (!data.terms.includes(term)) return 'unscheduled';
    const row = data.offerings[id];
    if (!row) return 'none';
    const v = row[term] || '';
    return v.startsWith('Yes') ? 'yes' : v === 'Cancelled' ? 'cancelled' : 'no';
  }
  const offeredIn = (data, id, term) => offering(data, id, term) === 'yes';

  // Same wording as the Excel "Plan check".
  const PLAN_CHECK = { yes: 'OK', cancelled: 'Cancelled', no: 'Not offered', none: 'Not in schedule', unscheduled: 'No schedule yet' };
  function planCheck(data, state, id, term) {
    if (!term) return '';
    if (state.done.includes(id)) return 'Already completed';
    return PLAN_CHECK[offering(data, id, term)];
  }

  // A term written as "2027-1" (year, then term number within the year).
  const isTerm = (t) => new RegExp(`^\\d{4}-[1-${CONFIG.termsPerYear}]$`).test(t);

  // Turn a relative semester (1, 2, 3 ...) into a real term such as "2027-1".
  // start = the term of semester 1; breaks = semesters that are preceded by a skipped term.
  function termFor(start, sem, breaks) {
    const [y, t] = String(start).split('-').map(Number);
    const gaps = (breaks || []).filter((b) => b <= sem).length;
    const i = y * CONFIG.termsPerYear + (t - 1) + (sem - 1) + gaps;
    return Math.floor(i / CONFIG.termsPerYear) + '-' + ((i % CONFIG.termsPerYear) + 1);
  }

  return { evaluate, planCheck, offering, offeredIn, byId, isTerm, termFor };
})();

if (typeof module !== 'undefined') module.exports = { Logic, CONFIG }; // lets Node tests import it
