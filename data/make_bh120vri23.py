"""Builds programs/bh120vri23.js: BH120VRI23 (Bachelor of Engineering (Software Engineering)(Honours), new edition).
The minors are the minors of BP162VI23, read from programs/bp162vi23.js, so run make_data.py first when they change.
Run from the project folder:  python3 -I data/make_bh120vri23.py programs/bh120vri23.js
Teaching periods: 1,2,3 = Vietnam Semester 1,2,3 of 2026; '-' = none listed; XXXX-TBC = code missing in the handbook text.
"""
import sys, json
TERMS = ['2026-1', '2026-2', '2026-3']
vi = json.loads(open('programs/bp162vi23.js').read().split('window.PROGRAMS["BP162VI23"] = ', 1)[1].rsplit(';', 1)[0])
vi_course = {c['id']: c for c in vi['courses']}

CORE = """
MATH2394|Engineering Mathematics|13|Core
OENG1209|Engineering Science|123|Core
OENG1181|Introduction to Professional Engineering Practice|13|Core
OENG1207|Digital Fundamentals|123|Core
OENG1272|Introduction to Engineering Design|13|Core
EEET2601|Engineering Computing 1|12|Core
EEET2603|Introduction to Electrical and Electronic Engineering|13|Core
EEET2482|Software Engineering Design|23|Core
CIVE1269|Introduction to Environmental and Sustainable Systems Engineering|2|Core
ISYS3414|Practical Database Concepts|3|Core
ISYS3416|Software Engineering Fundamentals for IT|13|Core
SREQ-TBC|Software Requirements Engineering|-|Core
COSC2769|Full Stack Development|12|Core
COSC2469|Algorithms and Analysis|12|Core
EEET2505|Introduction to Embedded Systems|13|Core
COSC2087|Computing Theory|2|Core
MIET2565|Systems Engineering Principles|3|Core
EEET2481|Embedded System Design and Implementation|12|Core
COSC2101|Software Engineering: Process and Tools|3|Core
EEET2588|Real Time Systems Engineering|2|Core
ISYS2092|Software Testing|2|Core
ISYS3461|Systems Architecture and Design|3|Core
OENG1183|Engineering Capstone Project Part A|1|Capstone
USABEN-TBC|Usability Engineering|-|Core
OENG1185|Engineering Capstone Project Part B|2|Capstone
OENG1198|Professional Engineering Experience|123|Core
"""
OPT = ('Minor course', True); UNI = ('University elective', False)
SEQUENCE = [   # suggested order: no program plan guide was available
    (1, ['MATH2394', 'OENG1181', 'OENG1272'], []),
    (2, ['OENG1209', 'CIVE1269', 'EEET2601'], []),
    (3, ['OENG1207', 'EEET2603', 'EEET2482'], []),
    (4, ['ISYS3416', 'COSC2469', 'EEET2505'], []),
    (5, ['COSC2769', 'COSC2087', 'SREQ-TBC'], []),
    (6, ['ISYS3414', 'MIET2565'], [OPT]),
    (7, ['EEET2481', 'ISYS2092'], [OPT]),
    (8, ['EEET2588', 'COSC2101'], [OPT]),
    (9, ['ISYS3461'], [OPT, UNI]),
    (10, ['OENG1183', 'OENG1198', 'USABEN-TBC'], []),
    (11, ['OENG1185'], [UNI]),
]
YEAR = lambda s: 1 if s <= 3 else 2 if s <= 6 else 3 if s <= 9 else 4

courses, offerings = {}, {}
for line in CORE.strip().splitlines():
    code, name, sems, cat = line.split('|')
    courses[code] = {'id': code, 'hn': None, 'name': name, 'credits': 12, 'required': True, 'category': cat,
                     'groups': [], 'lists': [], 'prereq': None}
    if code.endswith('-TBC'): courses[code]['codeTbc'] = True
    sems = '' if sems == '-' else sems
    if sems: offerings[code] = {t: ('Yes' if str(i + 1) in sems else '') for i, t in enumerate(TERMS)}
core_ids = list(courses)

groups, dropped = [], {}
for g in vi['groups']:
    if g['type'] != 'Minor': continue
    members = [m for m in g['members'] if m in vi_course and m not in core_ids]    # a core course cannot also be a minor course
    dropped[g['name']] = [m for m in g['members'] if m in core_ids]
    ng = {'id': g['id'], 'type': 'Minor', 'name': g['name'], 'rule': g['rule'], 'members': members,
          'mandatory': [m for m in g['mandatory'] if m in members], 'need': 4}
    if g.get('listMissing'): ng['listMissing'] = True
    groups.append(ng)
    for m in members:
        c = courses.setdefault(m, {**{k: vi_course[m][k] for k in ('id', 'hn', 'name', 'credits')}, 'required': False,
                                   'category': None, 'groups': [], 'lists': [], 'prereq': vi_course[m].get('prereq')})
        c['groups'].append(g['id'])
        if m in vi['offerings']: offerings[m] = vi['offerings'][m]

assert sorted(core_ids) == sorted(i for _, ids, _ in SEQUENCE for i in ids), 'sequence must list every core course once'
assert len(core_ids) == 26 and sum(len(o) for _, _, o in SEQUENCE) == 6
sequence = [{'sem': s, 'year': YEAR(s), 'courses': ids, 'open': len(o), 'slots': [{'label': l, 'stream': st} for l, st in o]}
            for s, ids, o in SEQUENCE]
data = {
  'code': 'BH120VRI23', 'title': 'Bachelor of Engineering (Software Engineering)(Honours) (BH120VRI23)', 'program': 'BH120VRI23 (Saigon South)',
  'ruleset': 'techoptions', 'optionName': 'minor courses', 'programCredits': 384, 'maxUni': 2,
  'handbookUrl': 'https://handbook.rmit.edu.au/ords/r/rmit/catalogue/program?p5_code=BH120VRI23',
  'labels': {'core': 'Core / Capstone', 'electives': 'Electives (6 courses)', 'options': 'Minor courses completed (4 needed)',
             'uni': 'University electives completed (2 needed)', 'group': 'Minor', 'noGroup': 'No minor (choose courses myself)'},
  'summary': '26 core courses, 4 minor courses (from one minor or from any minors) and 2 university electives over four years (384 credit points).',
  'sequenceNote': 'The handbook text has no program plan guide, so this order is a suggestion (three courses a semester, four years). The handbook says the courses in each minor must be completed in the order listed.',
  'terms': TERMS, 'courses': list(courses.values()), 'groups': groups, 'offerings': offerings, 'sequence': sequence,
}
open(sys.argv[1], 'w').write('// generated by data/make_bh120vri23.py - do not edit by hand\nwindow.PROGRAMS = window.PROGRAMS || {};\n'
                             'window.PROGRAMS["BH120VRI23"] = ' + json.dumps(data, indent=1) + ';\n')
print(len(courses), 'courses,', len(core_ids), 'core,', len(groups), 'minors')
for g in groups: print(' ', g['name'], len(g['members']), 'courses; core overlap dropped:', dropped[g['name']])
