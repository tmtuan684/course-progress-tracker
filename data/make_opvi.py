"""Builds programs/bp162opvi.js from the handbook text for BP162OPVI (Saigon South).
Run from the project folder:  python3 -I data/make_opvi.py programs/bp162opvi.js
Edit the lists below when the handbook changes. Semesters: 1,2,3 = Vietnam Semester 1,2,3 of 2026 (terms 2026-1..3).
A course with no teaching period in the handbook has '-' (it then shows as "not in the schedule").
Codes that the handbook paste did not include are written as XXXX-TBC and flagged "code to confirm".
"""
import sys, json

TERMS = ['2026-1', '2026-2', '2026-3']

# code | name | teaching periods | category
CORE = """
COSC2083|Essentials of Information Technology|-|Core
COSC2429|Introduction to Programming|-|Core
COSC2500|Introduction to Computer Systems|-|Core
ISYS3414|Practical Database Concepts|3|Core
COSC2634|Building IT Systems|-|Core
COSC2652|Topics in Human Computer Interaction|-|Core
WEBPROG-TBC|Web Programming|-|Core
COSC2130|Professional Computing Practice|-|Core
COSC2539|Security in Computing and Information Technology|3|Core
ISYS3416|Software Engineering Fundamentals for IT|13|Core
ISYS2101|Software Engineering Project Management|13|Core
COSC2502|Programming Project 1|1|Capstone
COSC2503|Programming Project 2|2|Capstone
"""

# IT options = Advanced IT options (the handbook lists one set of courses for both)
IT = """
COSC2659|iOS Development|2
COSC2740|Flagship Internship (Information Technology)|-
COSC2082|Advanced Programming Techniques|23
COSC2469|Algorithms and Analysis|12
COSC2638|Cloud Computing|2
COSC2087|Computing Theory|2
ECES-TBC|Electronic Commerce and Enterprise Systems|-
COSC2753|Machine Learning|2
COSC2543|Mobile Application Development|2
COSC2101|Software Engineering: Process and Tools|3
COSC2450|Web Development Technologies|-
COSC2930|Cloud Architecting|2
COSC2825|Cloud Operations|3
EEET2574|Big Data for Engineering|3
"""

# minor streams: 4 courses each (2 in year 2, 2 in year 3)
STREAMS = {
 'Artificial Intelligence': """
COSC2469|Algorithms and Analysis|12
COSC2753|Machine Learning|2
COSC2087|Computing Theory|2
COSC2129|Artificial Intelligence|2
""",
 'Data Analytics': """
COSC2469|Algorithms and Analysis|12
COSC2753|Machine Learning|2
COSC2638|Cloud Computing|2
EEET2574|Big Data for Engineering|3
""",
 'Mobile & Web Development': """
COSC2469|Algorithms and Analysis|12
COSC2769|Full Stack Development|12
COSC2659|iOS Development|2
COSC2543|Mobile Application Development|2
""",
 'Cloud Technologies': """
COSC2766|Cloud Foundations|1
COSC2822|Cloud Developing|3
COSC2930|Cloud Architecting|2
COSC2825|Cloud Operations|3
""",
 'DevOps': """
COSC2174|Data Communication and Net-Centric Computing|13
COSC2156|Unix Systems Administration and Programming (Linux)|-
COSC2767|Systems Deployment and Operations|2
COSC2638|Cloud Computing|2
""",
}

GENERAL = """
ACCT2105|Accounting in Organisations and Society|123
ACCT2126|Managerial Advisory Finance|3
ACCT2158|Financial Accounting and Analysis|12
ACCT2159|Financial Accountability and Reporting|3
ACCT2188|Business Advisory Services|-
ACCT2195|Accounting, Behaviour and Organisations|3
ACCT2197|Strategic Accounting and Leadership|2
BAFI3182|Financial Markets and Institutions|123
BAFI3184|Corporate Finance|13
BUSM2301|Organisations|13
BUSM3299|The Foundations of Entrepreneurship|123
BUSM3309|Strategy|13
BUSM3310|Human Resource Management|123
BUSM3311|Global Business|123
BUSM3314|Entrepreneurial Strategy and Growth|-
BUSM3320|Business Communications|-
BUSM4092|Applied Entrepreneurship|1
BUSM4171|Family Business and Entrepreneurship|-
BUSM4185|Introduction to Management|-
BUSM4187|International Human Resources Management|23
BUSM4188|Leadership|123
BUSM4294|Driving Innovation in Organisations|3
COMM2374|Foundations of Public Relations|-
COMM2377|Modern Asia|-
COMM2379|Mass Media in Asia|-
COMM2386|Interdisciplinary Communication Project|123
COMM2495|Professional Writing|12
ECON1193|Business Statistics 1|-
GRAP2411|Visual Language|-
GRAP2552|Digital Strategies for Fashion|-
HUSO2325|Art History and Theory 1|-
INTE2431|Business IT Infrastructure|-
INTE2432|Networking in Business|-
ISYS2110|Internet for Business|-
ISYS2115|Introduction to Information Systems Development|-
ISYS2117|Business Systems Analysis|-
ISYS2126|Computerised Accounting Systems|-
ISYS2422|Business Data Management|-
ISYS2426|Intelligent Enterprise Systems|-
LAW2452|Company and Finance Law|23
MKTG1205|Marketing Principles|123
MKTG1253|Buyer Behaviour|-
MKTG1254|Market Research|-
MKTG1255|Services Marketing|-
MKTG1257|Marketing Communication|-
MKTG1294|Introduction to Advertising|123
OMGT2085|Introduction to Logistics and Supply Chain Management|123
OMGT2197|Procurement Management and Global Sourcing|2
OMGT2215|Logistics and Supply Chain - Work Integrated Learning 1|-
OMGT2216|Logistics and Supply Chain - Work Integrated Learning 2|-
OMGT2267|Supply Chain Technologies|13
SOCU2251|Negotiating Transnational Agreements|-
SOCU2252|Intercultural Communication|13
VART3412|Photography via www|-
VART3589|Photography: An Introduction|-
"""

# Suggested order. The handbook paste has no program plan guide, so this follows the layout of the earlier
# BP162OPVI planning workbook (three courses a semester) using the courses in the handbook.
# Each open slot: (label, counts towards a minor stream?)
IT_ = ('IT option', False); ITA = ('IT / Advanced IT option', False)
STR = ('Minor stream or IT option', True); GEN = ('General option', False)
STA = ('Minor stream or Advanced IT option', True); UNI = ('University elective', False)
SEQUENCE = [
    (1, ['COSC2083', 'COSC2429', 'ISYS3414'], []),
    (2, ['COSC2500', 'COSC2652'], [IT_]),
    (3, ['WEBPROG-TBC', 'COSC2634'], [IT_]),
    (4, ['ISYS3416', 'COSC2539'], [ITA]),
    (5, ['COSC2130'], [STR, GEN]),
    (6, ['ISYS2101'], [STR, GEN]),
    (7, ['COSC2502'], [STA, UNI]),
    (8, ['COSC2503'], [STA, UNI]),
]

def rows(block):
    for line in block.strip().splitlines():
        code, name, sems, *cat = line.split('|')
        yield code, name, ('' if sems == '-' else sems), (cat[0] if cat else None)

courses = {}
offerings = {}
def add(code, name, sems, category=None, group=None, lst=None):
    c = courses.setdefault(code, {'id': code, 'hn': None, 'name': name, 'credits': 12, 'required': category is not None,
                                  'category': category, 'groups': [], 'lists': [], 'prereq': None})
    if code.endswith('-TBC'):
        c['codeTbc'] = True
    if group and group not in c['groups']:
        c['groups'].append(group)
    if lst and lst not in c['lists']:
        c['lists'].append(lst)
    if sems:
        offerings[code] = {t: ('Yes' if str(i + 1) in sems else '') for i, t in enumerate(TERMS)}

for r in rows(CORE): add(*r)
for r in rows(IT): add(r[0], r[1], r[2], None, None, 'it')
groups = []
for name, block in STREAMS.items():
    gid = 'minor:' + name.lower().replace(' & ', '-').replace(' ', '-')
    members = []
    for code, n, sems, _ in rows(block):
        add(code, n, sems, None, gid)
        members.append(code)
    groups.append({'id': gid, 'type': 'Minor', 'name': name, 'rule': 'Complete 48 credit points (4 courses)',
                   'members': members, 'mandatory': [], 'need': 4})
for r in rows(GENERAL): add(r[0], r[1], r[2], None, None, 'general')

core_ids = [c['id'] for c in courses.values() if c['required']]
seq_core = [i for _, ids, _ in SEQUENCE for i in ids]
assert sorted(core_ids) == sorted(seq_core), 'sequence must list every core course once'
slots = sum(len(s) for _, _, s in SEQUENCE)
assert slots == 11, slots
sequence = [{'sem': s, 'year': 1 if s <= 3 else 2 if s <= 6 else 3, 'courses': ids, 'open': len(op),
             'slots': [{'label': l, 'stream': st} for l, st in op]} for s, ids, op in SEQUENCE]
total = sum(c['credits'] for c in courses.values() if c['required']) + 11 * 12
assert total == 288, total

data = {
  'code': 'BP162OPVI', 'title': 'Bachelor of Information Technology (BP162OPVI)', 'program': 'BP162OPVI (Saigon South)',
  'ruleset': 'streams', 'programCredits': 288, 'maxUni': 2,
  'handbookUrl': 'https://handbook.rmit.edu.au/ords/r/rmit/catalogue/program?p5_code=BP162OPVI',
  'labels': {'core': 'Core / Capstone', 'electives': 'Electives (11 courses)', 'options': 'IT, stream and general options completed',
             'uni': 'University electives completed (2 needed)'},
  'summary': '13 core courses, 11 elective courses: IT options, a minor stream or more IT options, 2 general options and 2 university electives.',
  'sequenceNote': 'The handbook text has no program plan guide, so this order is a suggestion (three courses a semester) based on the earlier planning workbook. Replace it when you have the official plan.',
  'terms': TERMS, 'courses': list(courses.values()), 'groups': groups, 'offerings': offerings, 'sequence': sequence,
}
out = sys.argv[1]
open(out, 'w').write('// generated by data/make_opvi.py - do not edit by hand\nwindow.PROGRAMS = window.PROGRAMS || {};\n'
                     'window.PROGRAMS["BP162OPVI"] = ' + json.dumps(data, indent=1) + ';\n')
print(len(courses), 'courses,', len(groups), 'streams,', len(offerings), 'offering rows,', len(core_ids), 'core')
