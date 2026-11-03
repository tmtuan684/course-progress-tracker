# Course Planner (RMIT Bachelor of IT, Saigon South: BP162VI23 and BP162OPVI)

A small web app where a student ticks completed courses, sees progress toward the degree, and plans courses for upcoming semesters. It is plain HTML, CSS and JavaScript with no framework, no build step and no server. It does the same job as `Course_List.xlsx`, but handles course-selection rules that were awkward in Excel.

## Run it

Keep all files in one folder and double-click `index.html`. To share it with students, upload the site files (everything except `tools/` and `README.md`) to any static host (GitHub Pages, Netlify, a university web space).

## Files

| File | Purpose |
|---|---|
| `index.html`, `index.js` | My progress page: tick completed courses, plan terms, see progress and credit points. `index.js` keeps the page's state and draws it; it contains no degree rules. |
| `courses.html`, `courses.js` | Course list page: every course with its offering per term (read-only). |
| `sequence.html`, `sequence.js` | Course sequence page: the recommended order from semester 1 to 8 (years 1 to 3), with completed courses highlighted from saved progress. |
| `style.css` | Appearance: RMIT colours (red `#e60028`, navy `#000054`) in `:root`, plus a compact print layout for the one-page PDF. |
| `ui.js` | Shared by every page: small page helpers, course chips and filters, and reading/saving the student's progress in the browser. |
| `logic.js` | The degree rules as pure functions (no page code), so they can be tested in Node. |
| `programs.html`, `programs.js` | The first page: the student chooses a program. Every other page redirects here until a program is chosen. |
| `programs/*.js` | One data file per program (`bp162vi23.js`, `bp162opvi.js`), each adding itself to `window.PROGRAMS`. |
| `data/make_data.py` | Regenerates `programs/bp162vi23.js` from `Course_List.xlsx` and the handbook text. Not needed to run the site. |
| `data/make_opvi.py` | Regenerates `programs/bp162opvi.js` from the course lists written inside it. |

Every page loads its scripts in this order: `data.js`, `logic.js`, `ui.js`, then its own script.

`data.js` is a JavaScript file rather than JSON because browsers block loading a local JSON file when a page is opened directly from disk.

## The degree rule it models

- Complete all core courses (Core, STEM Future Tech, Capstone: 14 courses).
- Complete 8 elective courses in one of four ways:
  1. 1 major (8 courses)
  2. 2 minors (4 + 4)
  3. 1 minor + 4 program options or university electives
  4. 4 program options + 4 university electives
- A *program option* is a course from the program's major/minor lists. A *university elective* is any course from other RMIT programs. These are not in the data, so the student types how many they have completed.

## How it works

**One record per course.** Each of the 53 courses is stored once with a list of the groups (majors/minors) it belongs to. Ticking a course once counts it everywhere, which is the main limitation the Excel version had.

**State.** `{ done: [course ids], uni: number, plan: { course id: term } }`. It is saved in the browser's localStorage, so it stays on that student's browser only.

**Rules in `logic.js`:**
- A core course cannot also fill an elective slot (for example Cloud Foundations is Core and also listed in the Cloud Computing minor).
- Program options are counted as distinct courses, however many groups list them.
- Two minors are accepted only if each is complete and the two together have at least 8 different courses, since a shared course can be used once.
- Pathway checks: (1) any major complete; (2) two minors as above; (3) a minor complete and (distinct program options − 4) + university electives ≥ 4; (4) at least 4 program options and 4 university electives.
- Planning check per course: OK, Cancelled, Not offered, Not in schedule, No schedule yet, or Already completed.

## Using the app

The header menu switches between **My progress** and **Course list**.

1. Tick **Completed** on each finished course. **Shift+click** a second tick box to tick (or untick) every course between it and the last box you clicked; the list order follows the current search and filter. The left panel updates: core courses, the four pathways, per-major/minor progress, and credit points.
2. Enter the number of university electives completed.
3. Use the search box and filter (all, not completed, offered next term, core, or a single major/minor) to find courses.
4. Pick a term in **Plan for…** to check the course is offered. The Semester plan section shows courses, credits and problems per term.
5. **Download PDF report** opens the print dialog with a one-page report (name, date, progress, completed courses, semester plan); choose "Save as PDF". Type your name in the box under the header first.
6. **Export progress** saves a JSON file; **Import** loads it back (for another computer or a backup). **Restart planner** (on both My progress and Course sequence) clears everything: ticks, plans, name, starting term, breaks, major/minors and chosen courses.

### Course list page

Open **Course list** to browse all courses with their type, credits, majors/minors and a column per term showing Offered, Not offered or Cancelled. Search by code or name, filter by core, elective or a single major/minor, or show only courses offered in a chosen term. It does not change the student's progress. A **Prerequisites** column shows the enforced requisites we could confirm, and otherwise tells the student to check the RMIT Course Handbook (with a link). The handbook only flags that a course has a requisite and does not name it, and the RMIT course pages describe City-campus and older versions, so only clear cases are recorded. They come from `tools/prerequisites.csv` (columns: `code`, `requisites`, `source`, `note`), which `make_data.py` reads into `data.js`. Paste the handbook's "Enforced Course Requisites" text into the `requisites` column (SGS codes), leave it empty when none are listed, and rerun `make_data.py`. A note containing the word "confirm" shows a "to confirm" tag.

### Course sequence page

Shows the program plan guide: each core course in its recommended semester, plus the eight open "Combination course" slots (filled in order as the student completes program options or university electives). The order lives in the `SEQUENCE` list in `tools/make_data.py` (copied from `ProgramStructure-BP162VI23.pdf`), which writes it into `data.js` as `sequence`. Prerequisites are not stored yet.

The order is stable but the dates are flexible. `data.js` only knows relative semesters 1 to 8. The page converts them into real terms from a **Starting term** dropdown (three terms a year, via `Logic.termFor` in `logic.js`), and a student can add a **break** before any semester to push the rest back one term. The starting term and breaks are saved with the student's progress (`start` and `breaks`), so they come back on the next visit and travel with an exported file. Terms with no schedule data show "No schedule yet".

The page also has **Major**, **Minor 1** and **Minor 2** dropdowns. Choosing a major (8 courses) or one or two minors (4 each) fills the combination boxes with suggested courses from that group: mandatory courses first, then the group's own order, skipping core courses and repeats. With one minor, the other four boxes stay open. The choices are saved as `major` and `minors`. Suggestions are only a starting order; prerequisites are not checked.

The **Pick courses** panel (right side, below on phones) lists every elective course with search and a filter (all, my major/minors, or one group). Click a course to select it; **Shift+click** selects a range and **Ctrl/Cmd+click** adds or removes one. Drag the selection onto a combination box, or press **Add to boxes**: the courses fill successive boxes, starting at the box you drop on or click (replacing what is there), otherwise the open boxes in order. A single course can still be dragged onto any combination box, or placed by clicking a box and pressing **Add** (with no box selected, Add uses the first open one). A **University elective** card can be added any number of times. The × on a box removes its course, and **Reset my choices** returns to the suggestions. Courses the student has already completed, and the university electives count from My progress, fill any boxes left open. Choosing a major or minors overrides the boxes: it clears earlier hand-picked courses and fills them with that group's courses (swap any afterwards). Hand-picked boxes are saved as `slots` (8 entries: empty = follow the suggestion, `none` = left empty, `UNI`, or a course code). A new intake needs no data change, only a different starting term.

## Updating the data

Majors and minors come from the handbook text. Each major or minor has its own file in `tools/handbook/` (see the README there). To update one, paste the handbook page text into its file (the first line must read `Major: <name>` or `Minor: <name>`); the credit points, courses and 2026 teaching periods are read from it. The core courses and the offering schedule still come from `Course_List.xlsx`.

1. Update the files in `tools/handbook/` and, if needed, `Course_List.xlsx`.
2. From this folder run: `python3 -I tools/make_data.py ../Course_List.xlsx data.js`
3. Refresh the page.

To add a planning term, add it to `planTerms` in `logic.js` and make sure the schedule sheet has a matching column. The first entry in `planTerms` is also what "offered next term" uses, so roll it forward each term.

For a new academic year, also check:
- `make_data.py` expects a sheet named "Offering Schedule 2026" with three term columns (E to G); change it if the sheet name or number of terms differs.
- Saved progress is keyed by course code, so a renamed, recoded or removed course loses its tick. Keep a code map or ask students to export first.
- Use a separate folder per cohort if program versions differ, and link `data.js?v=2027` so browsers don't serve a cached copy.
- Review the assumptions below, since the pathway rules are written in `logic.js`, not in the data.

## Assumptions and limits

- Elective credits are assumed to be 12 each (Studio core courses 24); university electives count 12 each (`uniCredits` in `logic.js`).
- Offering data covers 2026-3 at Saigon South only. Later terms show "No schedule yet".
- Majors and minors come from the handbook text in `tools/handbook/`. Courses the handbook lists with no 2026 sessions (for example Developing Blockchain Applications) show as not offered. Where the schedule file and the handbook disagree on terms (so far only Principles of Psychology), the schedule file is used.
- The handbook says the Enterprise Systems Development minor is 36 credit points (3 courses), but every other minor is 48 and the degree needs 96 elective points, so `NEED_OVERRIDE` in `make_data.py` keeps it at 4 courses until that is confirmed. Remove that line to follow the handbook.
- A core course is assumed not to count toward a minor. Change `electiveDone` in `logic.js` if the rule allows it.
- Progress lives in each student's own browser; there are no accounts and no shared records.
- Tested in headless Chromium only; not yet checked on phones or other browsers.

## Ideas for extending it

- A "target group" view listing the remaining courses of a chosen major or minor with their availability.
- More terms and the Hanoi campus (change which code column `make_data.py` reads).
- Automated tests for `logic.js` using Node (it exports `Logic` and `CONFIG`).


## Several programs

The student chooses a program on `programs.html`; the choice is kept in the browser (`course-planner.program`) and shown in each page's header. **Change program** in the menu returns to the chooser. Progress is saved per program (`course-planner.v1` for BP162VI23, `course-planner.v1.BP162OPVI` for the other), so switching never loses ticks.

Each program file carries its own `ruleset`, labels, credit total, handbook link, sequence and offering schedule:

- `electives8` (BP162VI23): the original rules, with a major or minors.
- `streams` (BP162OPVI): 13 core courses (11 electives, 288 credit points). Route A is 3 IT / Advanced IT options + one minor stream (4 courses) + 2 general options; Route B is 7 IT / Advanced IT options + 2 general options; both need 2 university electives. A course counts once, so a course that is both an IT option and a stream course fills only one place (this is checked with a small matching routine in `logic.js`). The handbook lists the same 14 courses as IT options and Advanced IT options, so they are one list.

To add a third program, create `programs/<code>.js` the same way (copy `data/make_opvi.py` and edit the lists), load it in the three page files and `programs.html`, and add its rule set to `logic.js` if it needs a new one.

### BP162OPVI assumptions to check

- No program plan guide was available, so the sequence is a suggestion: three courses a semester, shaped by the earlier BP162OPVI planning workbook.
- Web Programming and Electronic Commerce and Enterprise Systems had no course code in the handbook text; they use `WEBPROG-TBC` and `ECES-TBC` until the real codes are known.
- Courses with no teaching period in the handbook show as not in the schedule.
- Prerequisites are not recorded yet, so the course list links to the handbook.
