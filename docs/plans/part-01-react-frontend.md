# PART 1 OF 6 — REACT FRONTEND FOUNDATION

## Project
AI Context-Aware Note-Taking Web Application

## Role and working rules
Act as a senior React developer and pair programmer. This is a learning-focused university capstone. Prefer readable, beginner-friendly React and normal JavaScript over clever abstractions.

Before changing files:
1. Inspect the existing repository.
2. Explain what already exists.
3. Present the Part 1 implementation plan.
4. List files to create/modify.
5. Explain component/state flow.
6. Wait for `IMPLEMENT PART 1`.

Do not implement later parts early. Do not rewrite unrelated working files.

---

## Goal
Build a complete React frontend prototype using mock/local data only.

Use:
- React
- Vite
- JavaScript
- HTML
- plain CSS or CSS Modules
- React Router

Do **not** use Django, APIs, databases, Groq, RAG, geolocation, maps, notifications, or real authentication yet.

At the end of Part 1, the UI should feel like a working product even though the data is mocked.

---

## Product principle
**CAPTURE FIRST → ORGANIZE AUTOMATICALLY → ACT WHEN RELEVANT**

The user should be able to naturally type:
- `I have an EM quiz on September 23.`
- `I need eggs from Agora.`
- `I bought 300gm chilli for 50 taka.`

For Part 1, simulate future AI results with mock data.

---

## Routes
### Public
- `/login`
- `/register`

### Protected-looking app routes (mock auth only)
- `/app`
- `/app/notes`
- `/app/notes/new`
- `/app/notes/:id`
- `/app/tasks`
- `/app/events`
- `/app/shopping`
- `/app/expenses`
- `/app/places`
- `/app/search`
- `/app/settings`

---

## Main layout
Create a reusable `AppLayout`.

Desktop:
- sidebar navigation
- main content area

Mobile:
- compact top or bottom navigation

Navigation:
- Dashboard
- Notes
- Tasks
- Events
- Shopping
- Expenses
- Places
- Search
- Settings

Keep branding minimal.

---

## Dashboard `/app`
Include:

### Quick Capture
A prominent input/textarea:
`What do you want to remember?`

Button:
`Save Note`

For Part 1, saving creates a local/mock note.

### What Matters Now
Mock cards such as:
- Gaming show registration — Due in 45 minutes
- EM Quiz — September 23
- Buy eggs — Agora

Show title, reason, priority indicator, type/domain if useful.

### Today summary
Mock counts:
- 3 Tasks
- 1 Event
- ৳250 Expenses

### Daily Briefing
Mock copy only, clearly marked as prototype data.

---

## Notes page `/app/notes`
Display all notes.

Each note card may show:
- raw/original text
- created date
- processing status
- preview of extracted items
- domains
- View/Edit/Delete actions

Local edit/delete should work.

---

## Add Note `/app/notes/new`
Large textarea and Save button.

Do **not** ask for category before saving.

After save, simulate an AI result panel.

Example:
- Type: Expense
- Domains: Shopping, Finance
- Item: Chilli
- Amount: ৳50
- Quantity: 300g
- Confidence: 94%

Buttons:
- Correct
- Edit

UI simulation only.

---

## Note Detail `/app/notes/:id`
Display:
- original note
- created date
- extracted mock `NoteItems`
- domains
- mock confidence
- Edit/Delete

Demonstrate one Note → many NoteItems.

Example original:
`Tomorrow class at 10, buy eggs afterwards, and spent ৳250 on books.`

Mock items:
- Event — Class tomorrow 10 AM
- Task — Buy eggs
- Expense — Books ৳250

---

## Tasks `/app/tasks`
Mock task fields:
- title
- deadline
- status
- importance
- domains
- place (optional)

Example tasks:
- Buy eggs
- Submit database assignment
- Register for gaming show

Allow local completion toggle.

---

## Events `/app/events`
Show upcoming events with simple cards/list.

Examples:
- EM Quiz-1 — September 23 — Education
- Gaming Show — September 25 — Entertainment

---

## Shopping `/app/shopping`
Group mock shopping items by place.

Example:
### Agora
- Eggs
- Bread
- Shampoo

### Rahman Grocery
- Rice
- Oil

### No Location
- Notebook
- Pen

No real location behavior yet.

---

## Expenses `/app/expenses`
Show mock:
- monthly total
- totals by domain/category
- recent expenses

Example:
- September total: ৳4,850
- Shopping: ৳2,300
- Education: ৳1,200
- Transport: ৳900
- Other: ৳450

Recent:
- Chilli — 300g — ৳50

Do not add complex charts unless clearly useful.

---

## Places `/app/places`
Frontend simulation only.

Mock places:
- Agora
- University
- Home
- Rahman Grocery

Show:
- name
- mock address
- default radius
- Edit/Delete
- Add Place

Do not use Leaflet or geolocation yet.

---

## Search `/app/search`
Two tabs:

### Search Notes
Semantic-search UI mock.

Input example:
`university work`

Mock results:
- EM Quiz
- Database Assignment

### Ask My Notes
RAG UI mock.

Question:
`What academic deadlines do I have?`

Mock answer plus mock source notes.

No embeddings or Groq yet.

---

## Settings `/app/settings`
Prototype preferences:
- Notification preferences
- Default currency: BDT
- Timezone: Asia/Dhaka
- Location Reminder Mode: OFF

No real browser APIs yet.

---

## Login `/login`
Fields:
- email/username
- password

Simulate success and redirect to `/app`.

No JWT/backend.

---

## Register `/register`
Fields:
- name
- email
- password
- confirm password

Basic frontend validation only.

---

## Mock data
Create one central file, e.g.:
`src/data/mockData.js`

Include mock:
- user
- notes
- noteItems
- tasks
- events
- expenses
- places
- shopping groups
- dashboard items
- search results

Initial item types:
- TASK
- EVENT
- EXPENSE
- INFORMATION

Initial domains:
- Education
- Shopping
- Finance
- Work
- Personal
- Health
- Entertainment
- Travel
- Other

Type and Domain must remain separate concepts.

---

## Suggested frontend structure
Use only what is needed.

```text
src/
  components/
    common/
    layout/
  features/
    auth/
    dashboard/
    notes/
    tasks/
    events/
    shopping/
    expenses/
    places/
    search/
  pages/
  data/
    mockData.js
  context/
  utils/
  App.jsx
  main.jsx
```

Do not create API files yet unless they are empty placeholders with a clear reason.

---

## React concepts to reinforce
- components
- props
- `useState`
- `useEffect` only where appropriate
- events
- conditional rendering
- list rendering
- forms
- React Router
- Context only if sharing state broadly

Do not use Redux/Zustand/MobX.

---

## Reusable components (only when useful)
Potential components:
- AppLayout
- Sidebar
- MobileNav
- QuickCapture
- NoteCard
- NoteList
- NoteItemCard
- DomainBadge
- AIReviewPanel
- TaskCard
- EventCard
- ExpenseCard
- ShoppingGroup
- PlaceCard
- SearchResultCard
- WhatMattersCard
- DailyBriefingCard

Avoid componentization for its own sake.

---

## UI style
The product should feel like a modern productivity app:
- clean
- minimal
- readable
- calm
- responsive
- strong hierarchy
- quick access to capture

Avoid flashy marketing visuals and excessive animation.

---

## Local interactions required
- add note
- edit note
- delete note
- mark task complete
- switch Search / Ask tabs
- navigate all routes
- open note detail
- mock login/logout
- basic form validation

`localStorage` is optional; use only if it simplifies the prototype and explain why.

---

## Empty states
Include simple states such as:
- No notes yet
- No upcoming events
- No shopping items
- No expenses recorded
- No search results

---

## Explicitly forbidden in Part 1
Do not implement:
- Django
- Python backend
- SQLite/PostgreSQL
- Groq
- real AI
- RAG
- embeddings
- pgvector
- JWT
- real authentication
- Leaflet/OpenStreetMap
- browser GPS
- notifications
- deployment

---

## Automated testing and verification
Use a Vite-compatible frontend test stack:
- Vitest for Jest-like test running and assertions
- React Testing Library for user-facing component behavior
- `@testing-library/jest-dom` for DOM assertions
- `@testing-library/user-event` for realistic interactions
- `jsdom` for the browser-like test environment
- `@vitest/coverage-v8` for coverage reports
- Playwright for browser-level smoke tests

Required automated coverage:
- all planned routes render
- login, registration validation, and mock logout behavior
- Quick Capture creates a note
- notes can be viewed, edited, and deleted
- one Note renders multiple NoteItems
- tasks can be completed and uncompleted
- Search Notes and Ask My Notes tabs switch correctly
- shopping groups, empty states, and responsive navigation render

Add at least one Playwright smoke flow covering login, Quick Capture, and opening the created note. Tests must run without a backend, network service, AI provider, or production secret. Run the automated suite and the manual checklist before declaring Part 1 complete.

## Acceptance criteria
Part 1 is complete only if:
1. React + Vite runs.
2. All planned pages exist.
3. React Router works.
4. Layout is responsive.
5. Dashboard is usable.
6. Quick Capture adds local notes.
7. Notes can be edited/deleted locally.
8. Tasks can be marked complete.
9. One Note can visually contain multiple NoteItems.
10. Shopping items are grouped by mock place.
11. Expenses page renders mock data.
12. Places page renders saved places.
13. Search Notes prototype works.
14. Ask My Notes prototype shows mock answer/sources.
15. Login/register UI exists.
16. Code is understandable to a learner.
17. Automated frontend tests pass.
18. The Playwright smoke flow passes.
19. Critical interaction and failure/empty-state paths have been verified.

---

## Deliverable before implementation
Before writing code, provide:
1. page structure
2. route table
3. component tree
4. folder structure
5. mock data schema
6. state ownership plan
7. UI build order
8. package list
9. why each package is needed
10. manual testing checklist

Then wait for:

`IMPLEMENT PART 1`
