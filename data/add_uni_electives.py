"""Adds the four placeholder courses 'University elective 1..4' to every programs/*.js file (safe to run again).
Run from the project folder AFTER the make_*.py scripts:  python3 -I data/add_uni_electives.py
Universities electives are courses from other schools that the student may enrol in; the list changes, so they are placeholders.
Ticking one counts one university elective (12 credit points) in the progress checks and the study paths.
"""
import glob, json, re
PLACEHOLDERS = [{'id': f'UELEC{i}', 'hn': None, 'name': f'University elective {i}', 'credits': 12, 'required': False,
                 'category': None, 'groups': [], 'lists': ['uni'], 'uni': True, 'prereq': None} for i in range(1, 5)]
for path in sorted(glob.glob('programs/*.js')):
    s = open(path).read()
    m = re.search(r'(window\.PROGRAMS\["[^"]+"\] = )(\{.*\});\s*$', s, re.S)
    if not m: continue                                   # equivalences.js and others
    d = json.loads(m.group(2))
    d['courses'] = [c for c in d['courses'] if not c.get('uni')] + PLACEHOLDERS
    open(path, 'w').write(s[:m.start(2)] + json.dumps(d, indent=1) + ';\n')
    print(path, len(d['courses']), 'courses')
