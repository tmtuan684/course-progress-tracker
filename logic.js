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

  // Courses that count as completed: the ticked ones plus any course declared equivalent to a ticked one.
  // data.equiv = { courseId: [codes that count for it] } (built from programs/equivalences.js in ui.js).
  function expandDone(data, done) {
    const out = new Set(done);
    for (const [id, alts] of Object.entries(data.equiv || {})) if (alts.some((a) => out.has(a))) out.add(id);
    return out;
  }

  // University electives completed = ticked University elective placeholder courses (older data: the typed number).
  function uniCount(data, state, done) {
    const placeholders = data.courses.filter((c) => c.uni);
    if (!placeholders.length) return Number(state.uni) || 0;
    return placeholders.filter((c) => done.has(c.id)).length;
  }

  // A course used as a REQUIRED course cannot also fill an elective slot, so only
  // non-required completed courses count towards majors/minors/program options.
  function electiveDone(data, done) {
    return new Set(data.courses.filter((c) => !c.required && !c.uni && done.has(c.id)).map((c) => c.id));
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

  // Largest number of courses that can be placed in distinct slots (simple augmenting paths).
  // slots = array of Sets of course ids that may fill that slot.
  function maxMatch(slots, ids) {
    const owner = {};                                       // course id -> slot index
    const tryFill = (i, seen) => {
      for (const id of ids) {
        if (!slots[i].has(id) || seen.has(id)) continue;
        seen.add(id);
        if (owner[id] === undefined || tryFill(owner[id], seen)) { owner[id] = i; return true; }
      }
      return false;
    };
    return slots.reduce((n, _, i) => n + (tryFill(i, new Set()) ? 1 : 0), 0);
  }

  // Programs with IT options, a minor stream, general options and university electives (BP162OPVI).
  // Route A: 3 IT options + 4 stream courses + 2 general; Route B: 7 IT options + 2 general; both + 2 university electives.
  function evaluateStreams(data, state) {
    const courses = byId(data);
    const done = expandDone(data, state.done);
    const elective = electiveDone(data, done);
    const ids = [...elective];
    const listSet = (name) => new Set(data.courses.filter((c) => !c.required && (c.lists || []).includes(name)).map((c) => c.id));
    const IT = listSet('it'), GEN = listSet('general');
    const statuses = data.groups.map((g) => groupStatus(g, elective, done));
    const U = uniCount(data, state, done);
    const uniNeed = Math.max(0, 2 - U);
    const fill = (parts) => parts.flatMap(([set, n]) => Array(n).fill(set));
    const total = (slots) => slots.length;
    const routeA = statuses.map((s) => {
      const slots = fill([[IT, 3], [new Set(s.group.members), 4], [GEN, 2]]);
      const left = total(slots) - maxMatch(slots, ids) + uniNeed;
      return { s, left };
    });
    const bestA = routeA.reduce((a, b) => (b.left < a.left ? b : a), routeA[0]);
    const slotsB = fill([[IT, 7], [GEN, 2]]);
    const leftB = total(slotsB) - maxMatch(slotsB, ids) + uniNeed;
    const note = (left) => (left ? ` (${left} more needed)` : '');
    const pathways = [
      { id: 1, label: `Minor stream route: 3 IT options + 4 stream courses + 2 general options + 2 university electives${bestA.left ? ` - closest: ${bestA.s.group.name}${note(bestA.left)}` : ` - ${bestA.s.group.name}`}`, met: bestA.left === 0 },
      { id: 2, label: `IT route: 7 IT / Advanced IT options + 2 general options + 2 university electives${note(leftB)}`, met: leftB === 0 },
    ];
    const required = data.courses.filter((c) => c.required);
    const requiredDone = required.filter((c) => done.has(c.id));
    const sum = (list) => list.reduce((t, c) => t + c.credits, 0);
    const credits = { required: sum(requiredDone), programOptions: sum(ids.map((id) => courses[id])), university: U * CONFIG.uniCredits };
    credits.total = credits.required + credits.programOptions + credits.university;
    return { statuses, D: ids.length, U, pathways, electivesMet: pathways.some((p) => p.met),
      required: { done: requiredDone.length, total: required.length }, credits };
  }

  // Core courses + 4 technical options (from the technical option list) + 2 university electives (BH120).
  function evaluateTech(data, state) {
    const courses = byId(data);
    const done = expandDone(data, state.done);
    const isOption = (c) => !c.required && ((c.lists || []).includes('tech') || c.groups.length > 0);   // on a technical-option list or in a minor
    const tech = data.courses.filter((c) => isOption(c) && done.has(c.id));
    const elective = electiveDone(data, done);
    const statuses = data.groups.map((g) => groupStatus(g, elective, done));
    const name = data.optionName || 'technical options';
    const U = uniCount(data, state, done);
    const techLeft = Math.max(0, 4 - tech.length), uniLeft = Math.max(0, 2 - U);
    const required = data.courses.filter((c) => c.required);
    const requiredDone = required.filter((c) => done.has(c.id));
    const sum = (list) => list.reduce((t, c) => t + c.credits, 0);
    const credits = { required: sum(requiredDone), programOptions: sum(tech.slice(0, 4)), university: Math.min(U, 2) * CONFIG.uniCredits };
    credits.total = credits.required + credits.programOptions + credits.university;
    const pathways = [{ id: 1, label: `4 ${name} (${Math.min(4, tech.length)} / 4) + 2 university electives (${Math.min(2, U)} / 2)`,
      met: !techLeft && !uniLeft }];
    return { statuses, D: Math.min(4, tech.length), U, pathways, electivesMet: pathways[0].met,
      required: { done: requiredDone.length, total: required.length }, credits };
  }

  function evaluateAny(data, state) {
    if (data.ruleset === 'techoptions') return evaluateTech(data, state);
    if (data.ruleset === 'streams') return evaluateStreams(data, state);
    const courses = byId(data);
    const done = expandDone(data, state.done);
    const elective = electiveDone(data, done);
    const statuses = data.groups.map((g) => groupStatus(g, elective, done));
    const majors = statuses.filter((s) => s.group.type === 'Major');
    const minors = statuses.filter((s) => s.group.type === 'Minor');

    // program options = completed electives listed by at least one group (each course counted once)
    const options = [...elective].filter((id) => courses[id].groups.length > 0).map((id) => courses[id]);
    const D = options.length;
    const U = uniCount(data, state, done);

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


  // ---------- study paths ----------
  // A path is one way to finish the electives. The student picks one; every completed elective course then plays
  // one role in it (counts towards a major, a minor, program options ...), chosen automatically and changeable.
  const ROLE_NAMES = { it: 'IT / Advanced IT option', general: 'General option', tech: 'Technical option' };
  function pathDefs(data) {
    const g = (id) => data.groups.find((x) => x.id === id);
    const need = (id) => (g(id) ? g(id).need : 4);
    if (data.ruleset === 'electives8') return [
      { id: 'major', label: '1 major (8 courses)', picks: [{ type: 'Major', label: 'Major' }], uni: 0,
        slots: (s) => [{ role: s[0], n: need(s[0]) }] },
      { id: 'minors2', label: '2 minors (4 + 4 courses)', picks: [{ type: 'Minor', label: 'Minor 1' }, { type: 'Minor', label: 'Minor 2' }], uni: 0,
        slots: (s) => s.map((id) => ({ role: id, n: need(id) })) },
      { id: 'minor-options', label: '1 minor + 4 program options or university electives', picks: [{ type: 'Minor', label: 'Minor' }], uni: 0,
        slots: (s) => [{ role: s[0], n: need(s[0]) }, { role: 'option', n: 4, uniFill: true }] },
      { id: 'options-uni', label: '4 program options + 4 university electives', picks: [], uni: 4, slots: () => [{ role: 'option', n: 4 }] },
    ];
    if (data.ruleset === 'streams') return [
      { id: 'stream', label: 'Minor stream route: 3 IT options + 4 stream courses + 2 general options', picks: [{ type: 'Minor', label: 'Minor stream' }], uni: 2,
        slots: (s) => [{ role: 'it', n: 3 }, { role: s[0], n: need(s[0]) }, { role: 'general', n: 2 }] },
      { id: 'it-route', label: 'IT route: 7 IT / Advanced IT options + 2 general options', picks: [], uni: 2,
        slots: () => [{ role: 'it', n: 7 }, { role: 'general', n: 2 }] },
    ];
    if (data.groups.length) return [
      { id: 'one-minor', label: '4 courses from one minor', picks: [{ type: 'Minor', label: 'Minor' }], uni: 2,
        slots: (s) => [{ role: s[0], n: need(s[0]) }] },
      { id: 'any-minors', label: '4 courses from any minors', picks: [], uni: 2, slots: () => [{ role: 'option', n: 4 }] },
    ];
    return [{ id: 'tech', label: '4 technical options', picks: [], uni: 2, slots: () => [{ role: 'tech', n: 4 }] }];
  }
  function roleLabel(data, role) {
    const g = data.groups.find((x) => x.id === role);
    if (g) return `${g.type}: ${g.name}`;
    if (role === 'option') return data.ruleset === 'electives8' ? 'Program option' : 'Minor course (any minor)';
    return ROLE_NAMES[role] || role;
  }
  // Courses that may play a role.
  function eligible(data, role) {
    const g = data.groups.find((x) => x.id === role);
    if (g) return new Set(g.members.filter((id) => byId(data)[id] && !byId(data)[id].required));
    return new Set(data.courses.filter((c) => !c.required && (role === 'option' ? c.groups.length > 0 : (c.lists || []).includes(role))).map((c) => c.id));
  }
  function validRoles(data) {
    return new Set(['none', 'option', 'it', 'general', 'tech', ...data.groups.map((g) => g.id)]);
  }

  // Place completed elective courses into the path's places (largest matching), honouring the student's own role choices.
  function evaluatePath(data, state, done) {
    const def = pathDefs(data).find((p) => p.id === state.path);
    if (!def) return null;
    const sel = (state.pathGroups || []).filter((id, i) => data.groups.some((x) => x.id === id && x.type === (def.picks[i] || {}).type));
    if (sel.length < def.picks.length || new Set(sel).size < sel.length) return { def, incomplete: true, sel, met: false };
    const groups = def.slots(sel);
    const slots = groups.flatMap((gr) => Array.from({ length: gr.n }, () => ({ role: gr.role, ok: eligible(data, gr.role) })));
    const elective = [...electiveDone(data, done)];
    const ov = state.roles || {};
    const allowed = (id, i) => ov[id] !== 'none' && (!ov[id] || ov[id] === slots[i].role) && slots[i].ok.has(id);
    const owner = Array(slots.length).fill(null);
    const tryFill = (i, seen) => {
      for (const id of elective) {
        if (!allowed(id, i) || seen.has(id)) continue;
        seen.add(id);
        const j = owner.indexOf(id);
        if (j < 0 || tryFill(j, seen)) { owner[i] = id; return true; }
      }
      return false;
    };
    slots.forEach((_, i) => tryFill(i, new Set()));
    const U = uniCount(data, state, done);
    const assigned = {};
    owner.forEach((id, i) => { if (id) assigned[id] = slots[i].role; });
    let uniLeft = U;
    const roles = groups.map((gr) => {
      const have = Object.values(assigned).filter((r) => r === gr.role).length;
      const used = gr.uniFill ? Math.min(Math.max(0, gr.n - Math.min(have, gr.n)), uniLeft) : 0;
      uniLeft -= used;
      return { role: gr.role, label: roleLabel(data, gr.role), need: gr.n, have: Math.min(have, gr.n), uni: used,
        courses: owner.filter((id, i) => id && slots[i].role === gr.role) };
    });
    const uniNeed = def.uni, uniOK = uniLeft >= uniNeed;
    const left = roles.reduce((n, r) => n + r.need - r.have - r.uni, 0) + Math.max(0, uniNeed - uniLeft);
    return { def, sel, roles, assigned, extra: elective.filter((id) => !assigned[id]), uni: { need: uniNeed, have: uniLeft },
      met: left === 0 && uniOK, left };
  }

  // Roles a course could play anywhere in this program (for the role dropdown when no path is chosen yet).
  function rolesFor(data, c) {
    const out = c.groups.map((id) => ({ role: id, label: roleLabel(data, id) }));
    if (c.groups.length && data.ruleset !== 'streams') out.push({ role: 'option', label: roleLabel(data, 'option') });   // streams programs have no free 'option' role
    (c.lists || []).filter((l) => l !== 'uni').forEach((l) => out.push({ role: l, label: roleLabel(data, l) }));
    return out;
  }

  // No path chosen: find the path (and groups) that the completed courses and the student's role choices fit best.
  function bestPath(data, state, done) {
    let best = null;
    for (const def of pathDefs(data)) {
      const combos = def.picks.reduce((acc, pk) => acc.flatMap((c) =>
        data.groups.filter((g) => g.type === pk.type && !c.includes(g.id)).map((g) => [...c, g.id])), [[]]);
      for (const combo of combos) {
        const r = evaluatePath(data, { ...state, path: def.id, pathGroups: combo }, done);
        if (r && !r.incomplete && (!best || r.left < best.left)) best = r;
      }
    }
    return best;
  }

  // Check the elective requirement. With a study path chosen, only that path counts; otherwise any path may satisfy it.
  function evaluate(data, state) {
    const ev = evaluateAny(data, state);
    const res = evaluatePath(data, state, expandDone(data, state.done));
    ev.path = res;
    if (!state.path || (res && res.incomplete)) {   // no path chosen (or not set up yet): show the best fit; role choices then decide the result
      ev.autoPath = bestPath(data, state, expandDone(data, state.done));
      if (ev.autoPath && Object.keys(state.roles || {}).length) {
        const a = ev.autoPath;
        ev.pathways = [{ id: a.def.id, label: a.def.label + (a.left ? ` (${a.left} more needed)` : ''), met: a.met }];
        ev.electivesMet = a.met;
      }
    }
    if (res && !res.incomplete) {
      ev.pathways = [{ id: res.def.id, label: res.def.label + (res.left ? ` (${res.left} more needed)` : ''), met: res.met }];
      ev.electivesMet = res.met;
    }
    return ev;
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

  return { evaluate, evaluatePath, bestPath, rolesFor, pathDefs, roleLabel, eligible, validRoles, expandDone, planCheck, offering, offeredIn, byId, isTerm, termFor };
})();

if (typeof module !== 'undefined') module.exports = { Logic, CONFIG }; // lets Node tests import it
