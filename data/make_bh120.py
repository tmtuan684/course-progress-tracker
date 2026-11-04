"""Builds programs/bh120.js from the handbook text for BH120 Bachelor of Engineering (Software Engineering)(Honours), Saigon South.
Run from the project folder:  python3 -I data/make_bh120.py programs/bh120.js
Teaching periods: 1,2,3 = Vietnam Semester 1,2,3 of 2026 (terms 2026-1..3); '-' = none listed. XXXX-TBC = code missing in the handbook text.
"""
import sys, json
TERMS = ['2026-1', '2026-2', '2026-3']

CORE = """
OENG1181|Introduction to Professional Engineering Practice|13|Core
EEET2601|Engineering Computing 1|12|Core
MATH2394|Engineering Mathematics|13|Core
OENG1209|Engineering Science|123|Core
OENG1207|Digital Fundamentals|123|Core
OENG1205|Creative Engineering CAD|13|Core
EEET2603|Introduction to Electrical and Electronic Engineering|13|Core
EEET2482|Software Engineering Design|23|Core
ISYS3416|Software Engineering Fundamentals for IT|13|Core
INTE2512|Object-Oriented Programming|-|Core
ISYS3414|Practical Database Concepts|3|Core
COSC2657|Android Development|2|Core
EEET2505|Introduction to Embedded Systems|13|Core
EEET2481|Embedded System Design and Implementation|12|Core
COSC2658|Data Structures & Algorithms|12|Core
EEET2490|Embedded Systems: Operating Systems and Interfacing|3|Core
EEET2610|Engineering Design 3|23|Core
EEET2485|Research Methods for Engineers|2|Core
EEET2580|Enterprise Application Development|2|Core
EEET2578|Engineering Quality Assurance and Testing|2|Core
EEET2582|Software Engineering: Architecture and Design|3|Core
COSC2659|iOS Development|2|Core
OENG1183|Engineering Capstone Project Part A|1|Capstone
OENG1185|Engineering Capstone Project Part B|2|Capstone
OENG1130|Technology Leadership|2|Core
OENG1198|Professional Engineering Experience|123|Core
"""

TECH = """
EEET2597|Network Fundamentals and Applications|1
COSC2789|Practical Data Science|3
EEET2604|Digital Systems Design 1|3
EEET2584|Computer and Network Security|-
EEET2586|Enterprise and Cloud Networks|-
EEET2588|Real Time Systems Engineering|2
COSC2753|Machine Learning|2
EEET2574|Big Data for Engineering|3
COSC2539|Security in Computing and Information Technology|3
COSC2638|Cloud Computing|2
COSC2129|Artificial Intelligence|2
COSC2766|Cloud Foundations|1
COSC2822|Cloud Developing|3
COSC2930|Cloud Architecting|2
COSC2825|Cloud Operations|3
INTE2548|Security Testing|2
ISYS2099|Database Applications|3
COSC2767|Systems Deployment and Operations|2
COSC2156|Unix Systems Administration and Programming (Linux)|-
COSC2790|Programming Internet of Things|1
COSC2087|Computing Theory|2
ECES-TBC|Electronic Commerce and Enterprise Systems|-
COSC2101|Software Engineering: Process and Tools|3
COSC2450|Web Development Technologies|-
DISTSYS-TBC|Distributed Systems|-
"""

# Suggested order (no program plan guide was available): three courses a semester, four years.
TECHSLOT = ('Technical option', False); UNI = ('University elective', False)
SEQUENCE = [
    (1, ['OENG1181', 'EEET2601', 'MATH2394'], []),
    (2, ['OENG1209', 'OENG1207', 'EEET2482'], []),
    (3, ['OENG1205', 'EEET2603'], [UNI]),
    (4, ['ISYS3416', 'COSC2658', 'EEET2505'], []),
    (5, ['INTE2512', 'EEET2481', 'COSC2657'], []),
    (6, ['ISYS3414'], [TECHSLOT, UNI]),
    (7, ['EEET2485', 'EEET2580', 'EEET2578'], []),
    (8, ['EEET2582', 'COSC2659'], [TECHSLOT]),
    (9, ['EEET2490', 'EEET2610'], [TECHSLOT]),
    (10, ['OENG1183', 'OENG1198'], [TECHSLOT]),
    (11, ['OENG1185', 'OENG1130'], []),
]
YEAR = lambda s: 1 if s <= 3 else 2 if s <= 6 else 3 if s <= 9 else 4

def rows(block):
    for line in block.strip().splitlines():
        code, name, sems, *cat = line.split('|')
        yield code, name, ('' if sems == '-' else sems), (cat[0] if cat else None)

courses, offerings = {}, {}
def add(code, name, sems, category=None, lst=None):
    c = courses.setdefault(code, {'id': code, 'hn': None, 'name': name, 'credits': 12, 'required': category is not None,
                                  'category': category, 'groups': [], 'lists': [], 'prereq': None})
    if code.endswith('-TBC'): c['codeTbc'] = True
    if lst and lst not in c['lists']: c['lists'].append(lst)
    if sems: offerings[code] = {t: ('Yes' if str(i + 1) in sems else '') for i, t in enumerate(TERMS)}
for r in rows(CORE): add(*r)
for r in rows(TECH): add(r[0], r[1], r[2], None, 'tech')

core_ids = [c['id'] for c in courses.values() if c['required']]
assert sorted(core_ids) == sorted(i for _, ids, _ in SEQUENCE for i in ids), 'sequence must list every core course once'
assert sum(len(o) for _, _, o in SEQUENCE) == 6
assert len(core_ids) * 12 + 6 * 12 == 384
sequence = [{'sem': s, 'year': YEAR(s), 'courses': ids, 'open': len(o), 'slots': [{'label': l, 'stream': st} for l, st in o]}
            for s, ids, o in SEQUENCE]
data = {
  'code': 'BH120', 'title': 'Bachelor of Engineering (Software Engineering)(Honours) (BH120)', 'program': 'BH120 (Saigon South)',
  'ruleset': 'techoptions', 'programCredits': 384, 'maxUni': 2,
  'handbookUrl': 'https://handbook.rmit.edu.au/ords/r/rmit/catalogue/program?p5_code=BH120',
  'labels': {'core': 'Core / Capstone', 'electives': 'Electives (6 courses)', 'options': 'Technical options completed (4 needed)',
             'uni': 'University electives completed (2 needed)'},
  'summary': '26 core courses, 4 technical options and 2 university electives over four years (384 credit points).',
  'sequenceNote': 'The handbook text has no program plan guide, so this order is a suggestion (three courses a semester, four years). Replace it when you have the official plan.',
  'terms': TERMS, 'courses': list(courses.values()), 'groups': [], 'offerings': offerings, 'sequence': sequence,
}
open(sys.argv[1], 'w').write('// generated by data/make_bh120.py - do not edit by hand\nwindow.PROGRAMS = window.PROGRAMS || {};\n'
                             'window.PROGRAMS["BH120"] = ' + json.dumps(data, indent=1) + ';\n')
print(len(courses), 'courses,', len(core_ids), 'core,', len(offerings), 'offering rows')
