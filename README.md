# Course Planner (RMIT Bachelor of IT, BP162VI23, Saigon South)

A small web app where a student ticks completed courses, sees progress toward the degree, and plans courses for upcoming semesters. It is plain HTML, CSS and JavaScript with no framework, no build step and no server. It does the same job as `Course_List.xlsx`, but handles course-selection rules that were awkward in Excel.

## Run it

Keep all files in one folder and double-click `index.html`. To share it with students, upload the site files (everything except `tools/` and `README.md`) to any static host (GitHub Pages, Netlify, a university web space).

## Files

| File | Purpose |
|---|---|
| `index.html` | My progress page. Script order matters: data, logic, app. |
| `courses.html`, `courses.js` | Course list page: every course with its offering per term (read-only). |
| `sequence.html`, `sequence.js` | Course sequence page: the recommended order from semester 1 to 8 (years 1 to 3), with completed courses highlighted from saved progress. |
| `style.css` | Appearance: RMIT colours (red `#e60028`, navy `#000054`) in `:root`, plus a compact print layout for the one-page PDF. |
| `app.js` | User interface: keeps state, saves it, draws the page. Contains no degree rules. |
| `logic.js` | The degree rules as pure functions (no page code), so they can be tested in Node. |
| `data.js` | All course data, generated from the Excel file. Sets the global `window.DATA`, which every page reads. |
| `tools/make_data.py` | Regenerates `data.js` from `Course_List.xlsx`. Not needed to run the site. |

`data.js` is a JavaScript file rather than JSON because browsers block loading a local JSON file when a page is opened directly from disk.

## The degree rule it models

- Complete all required courses (Core, STEM Future Tech, Capstone: 14 courses).
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
- A required course cannot also fill an elective slot (for example Cloud Foundations is Core and also listed in the Cloud Computing minor).
- Program options are counted as distinct courses, however many groups list them.
- Two minors are accepted only if each is complete and the two together have at least 8 different courses, since a shared course can be used once.
- Pathway checks: (1) any major complete; (2) two minors as above; (3) a minor complete and (distinct program options − 4) + university electives ≥ 4; (4) at least 4 program options and 4 university electives.
- Planning check per course: OK, Cancelled, Not offered, Not in schedule, No schedule yet, or Already completed.

## Using the app

The header menu switches between **My progress** and **Course list**.

1. Tick **Completed** on each finished course. **Shift+click** a second tick box to tick (or untick) every course between it and the last box you clicked; the list order follows the current search and filter. The left panel updates: required courses, the four pathways, per-major/minor progress, and credit points.
2. Enter the number of university electives completed.
3. Use the search box and filter (all, not completed, offered next term, required, or a single major/minor) to find courses.
4. Pick a term in **Plan for…** to check the course is offered. The Semester plan section shows courses, credits and problems per term.
5. **Download PDF report** opens the print dialog with a one-page report (name, date, progress, completed courses, semester plan); choose "Save as PDF". Type your name in the box under the header first.
6. **Export progress** saves a JSON file; **Import** loads it back (for another computer or a backup). **Reset** clears everything.

### Course list page

Open **Course list** to browse all courses with their type, credits, majors/minors and a column per term showing Offered, Not offered or Cancelled. Search by code or name, filter by required, elective or a single major/minor, or show only courses offered in a chosen term. It does not change the student's progress.

### Course sequence page

Shows the program plan guide: each required course in its recommended semester, plus the eight open "Combination course" slots (filled in order as the student completes program options or university electives). The order lives in the `SEQUENCE` list in `tools/make_data.py` (copied from `ProgramStructure-BP162VI23.pdf`), which writes it into `data.js` as `sequence`. Prerequisites are not stored yet.

The order is stable but the dates are flexible. `data.js` only knows relative semesters 1 to 8. The page converts them into real terms from a **Starting term** dropdown (three terms a year, via `Logic.termFor` in `logic.js`), and a student can add a **break** before any semester to push the rest back one term. The starting term and breaks are saved with the student's progress (`start` and `breaks`), so they come back on the next visit and travel with an exported file. Terms with no schedule data show "No schedule yet".

The page also has **Major**, **Minor 1** and **Minor 2** dropdowns. Choosing a major (8 courses) or one or two minors (4 each) fills the combination boxes with suggested courses from that group: mandatory courses first, then the group's own order, skipping required courses and repeats. With one minor, the other four boxes stay open. The choices are saved as `major` and `minors`. Suggestions are only a starting order; prerequisites are not checked.

The **Pick courses** panel (right side, below on phones) lists every elective course with search and a filter (all, my major/minors, or one group). Click a course to select it; **Shift+click** selects a range and **Ctrl/Cmd+click** adds or removes one. Drag the selection onto a combination box, or press **Add to boxes**: the courses fill successive boxes, starting at the box you drop on or click (replacing what is there), otherwise the open boxes in order. A single course can still be dragged onto any combination box, or placed by clicking a box and pressing **Add** (with no box selected, Add uses the first open one). A **University elective** card can be added any number of times. The × on a box removes its course, and **Reset my choices** returns to the suggestions. Courses the student has already completed, and the university electives count from My progress, fill any boxes left open. Choosing a major or minors overrides the boxes: it clears earlier hand-picked courses and fills them with that group's courses (swap any afterwards). Hand-picked boxes are saved as `slots` (8 entries: empty = follow the suggestion, `none` = left empty, `UNI`, or a course code). A new intake needs no data change, only a different starting term.

## Updating the data

1. Update `Course_List.xlsx` (course lists, or the offering schedule sheet).
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
- About 11 major/minor courses are not in the 2026 schedule and show "Not in schedule".
- Digital Economy has no published course list, so it can't be completed.
- A required course is assumed not to count toward a minor. Change `electiveDone` in `logic.js` if the rule allows it.
- Progress lives in each student's own browser; there are no accounts and no shared records.
- Tested in headless Chromium only; not yet checked on phones or other browsers.

## Ideas for extending it

- A "target group" view listing the remaining courses of a chosen major or minor with their availability.
- More terms and the Hanoi campus (change which code column `make_data.py` reads).
- Automated tests for `logic.js` using Node (it exports `Logic` and `CONFIG`).
