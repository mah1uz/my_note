# Part 1 Testing and Corrections

## Scope

Part 1 is a standalone React/Vite prototype using mock data only. No Django, API, database, Groq, RAG, geolocation, or real authentication is included.

## Tests executed

- Vitest component and integration suite.
- React Testing Library interaction tests.
- V8 coverage report.
- Playwright Chromium smoke test.
- Vite production build.
- Production dependency audit.

Commands:

```text
npm test
npm run test:coverage
npm run test:e2e
npm run build
npm audit --omit=dev
```

## Coverage

- 6 automated frontend tests passed.
- Source statement/line coverage: approximately 92%.
- Configured minimum gates: 80% statements and lines, 75% branches, 50% functions.
- Playwright smoke flow passed for login, Quick Capture, Notes, and Note Detail.
- Production build passed.
- Production dependency audit reported zero vulnerabilities.

## Problems found and corrections

1. Vitest initially collected the Playwright file as a unit test.
   - Correction: restricted Vitest collection to `src/**/*.test.{js,jsx}`.
2. Rendered test trees were not cleaned between tests.
   - Correction: added an explicit React Testing Library cleanup hook.
3. Tests had ambiguous locators because desktop and mobile navigation both render.
   - Correction: selected the intended navigation link explicitly.
4. The Playwright test initially matched both a note title and its extracted-item preview.
   - Correction: changed the assertion to target the exact note link.
5. Playwright browsers were not installed in the environment.
   - Correction: installed the Chromium test browser before running the smoke test.
6. React Router 6 produced security audit findings.
   - Correction: upgraded to React Router 7 and reran tests, build, and smoke verification.
7. The dashboard summary did not match the plan's prototype values.
   - Correction: changed the dashboard to show the specified 3 Tasks, 1 Event, and ৳250 Expenses summary.
8. A Quick Capture task was saved as a Note and `NoteItem`, but was not added to the shared task collection. The dashboard task count was also hardcoded.
   - Correction: task-shaped captures now create a pending local task, task deletion removes its generated task, and the dashboard count is derived from open tasks.

The regression test confirms that saving `Buy coffee from Agora` increases the dashboard task count from 3 to 4.

## Remaining Part 1 notes

- Notes and task changes are in-memory mock state and are not intended to persist after a full browser refresh.
- The full audit still reports development-tool advisories; the production dependency audit is clean. These will be reviewed when the tooling versions are refreshed.
