# Course Planner (RMIT Bachelor of IT, BP162VI23, Saigon South)

A small web app where a student ticks completed courses, sees progress toward the degree, and plans courses for upcoming semesters. It is plain HTML, CSS and JavaScript with no framework, no build step and no server. It does the same job as `Course_List.xlsx`, but handles course-selection rules that were awkward in Excel.

## Run it

Keep all files in one folder and double-click `index.html`. To share it with students, upload the site files (everything except `tools/` and `README.md`) to any static host (GitHub Pages, Netlify, a university web space).

## Files

| File | Purpose |
|---|---|
| `index.html` | My progress page. Script order matters: data, logic, app. |
| `courses.html`, `courses.js` | Course list page: every course with its offering per term (read-only). |
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

1. Tick **Completed** on each finished course. The left panel updates: required courses, the four pathways, per-major/minor progress, and credit points.
2. Enter the number of university electives completed.
3. Use the search box and filter (all, not completed, offered next term, required, or a single major/minor) to find courses.
4. Pick a term in **Plan for…** to check the course is offered. The Semester plan section shows courses, credits and problems per term.
5. **Download PDF report** opens the print dialog with a one-page report (name, date, progress, completed courses, semester plan); choose "Save as PDF". Type your name in the box under the header first.
6. **Export progress** saves a JSON file; **Import** loads it back (for another computer or a backup). **Reset** clears everything.

### Course list page

Open **Course list** to browse all courses with their type, credits, majors/minors and a column per term showing Offered, Not offered or Cancelled. Search by code or name, filter by required, elective or a single major/minor, or show only courses offered in a chosen term. It does not change the student's progress.

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
