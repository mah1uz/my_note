# PART 5 OF 6 — REMINDERS, PLACES & LOCATION-AWARE SHOPPING

## Project
AI Context-Aware Note-Taking Web Application

## Starting point
Parts 1–4 must already provide:
- React frontend
- Django/DRF backend
- authentication/user isolation
- real Notes and NoteItems
- Groq extraction and review
- PostgreSQL + pgvector
- semantic search
- RAG Q&A

Part 5 adds contextual reminder behavior, saved places, active browser geolocation, and shopping aggregation by place.

---

## Role and working rules
Act as a senior full-stack web developer with browser API experience.

Before changing files:
1. Inspect the completed Part 4 codebase.
2. Identify existing Task/Event/Shopping structures.
3. Present the reminder/location architecture.
4. Clearly state browser limitations.
5. List backend/frontend files to create/modify.
6. Wait for `IMPLEMENT PART 5 — STEP A`.

Do not implement final Daily Briefing, final priority engine, deployment, or broad refactors yet.

---

## Goal
Implement:
- saved Places
- time reminder records
- browser notification permission flow
- active-session time notifications
- active Location Reminder Mode
- browser geolocation
- Haversine distance calculation
- location reminder linkage to shopping/tasks
- shopping grouping by place
- single aggregated nearby-shopping notification
- privacy-conscious location behavior

This remains a **web application**, not a native mobile application.

---

## Important limitation
Do not claim native background geofencing.

Location reminders are designed to work while the browser/web app is active enough for location tracking and `Location Reminder Mode` is ON.

The UI/documentation must explain this honestly.

Do not build continuous background GPS tracking.
Do not store GPS movement history.

---

## Implementation order
### Step A — Reminder/Place data-model review
### Step B — Place CRUD backend/frontend
### Step C — Map UI
### Step D — Browser notifications foundation
### Step E — Time reminders
### Step F — Active geolocation hook
### Step G — Haversine/proximity engine
### Step H — Location reminders
### Step I — Shopping place assignment/aggregation
### Step J — Nearby aggregated notifications
### Step K — Privacy/error/manual tests

---

# STEP A — DATA MODELS

## Place model
Fields approximately:
- id
- user FK
- name
- latitude
- longitude
- address nullable
- default_radius_m
- created_at
- updated_at

Use decimal/float field choices appropriate for coordinates and explain tradeoffs.

A Place belongs to exactly one user.

Do not store location history.

## Reminder model
Fields approximately:
- id
- note_item FK
- trigger_type
- scheduled_at nullable
- place nullable FK
- radius_m nullable
- is_enabled
- last_triggered_at nullable
- triggered_count
- created_at
- updated_at

Trigger types:
- TIME
- LOCATION

Validation rules:
- TIME requires `scheduled_at`
- LOCATION requires `place` and radius

A reminder may only reference NoteItems owned by the authenticated user.

## NoteItem/Place relation
For V1, location linkage may live through Reminder rather than adding several direct Place fields to NoteItem.

If a shopping task should be grouped by place, design a simple reliable relation. Explain whether to:
- use a nullable `place` FK on shopping/task NoteItem, or
- derive place through active LOCATION Reminder

Choose one clear design and document it before implementation.

Avoid duplicate/conflicting sources of truth.

---

# STEP B — PLACE CRUD

## API
Approximately:
- `GET /api/v1/places/`
- `POST /api/v1/places/`
- `GET /api/v1/places/:id/`
- `PATCH /api/v1/places/:id/`
- `DELETE /api/v1/places/:id/`

Every queryset must be user-scoped.

## Frontend
Replace mock Places page with real data.

Functions:
- list places
- add place
- edit name/radius/address
- delete

Display coordinates in a secondary/detail view, not as the main UX.

---

# STEP C — MAP UI

Use:
- Leaflet
- OpenStreetMap tiles according to appropriate attribution/usage rules
- a React integration if useful (e.g. React-Leaflet) but avoid unnecessary libraries

Allow two ways to choose a place:
1. `Use my current location`
2. click/select a point on map

User provides:
- human-readable place name
- optional address/description
- default radius

Initial radius choices may include:
- 100 m
- 250 m
- 500 m
- 1000 m

Allow custom numeric radius if simple.

Do not implement constant geocoding calls.

If address search/geocoding is added, keep it optional, rate-conscious, and separately documented. Coordinate selection alone is sufficient for V1.

---

# STEP D — BROWSER NOTIFICATION FOUNDATION

Create reusable notification utilities/hook.

Do not request notification permission on first page load.

Good flow:
1. user creates/enables first reminder
2. UI explains why notification permission is useful
3. user explicitly chooses Allow
4. browser permission request is triggered

Handle states:
- default/not asked
- granted
- denied
- unsupported

If notifications are denied, reminders should still appear in-app when possible.

Do not add push-service infrastructure yet unless explicitly approved as an enhancement.

---

# STEP E — TIME REMINDERS

## Backend
Create Reminder CRUD/endpoints needed for a user to attach time reminder to a confirmed Task/Event.

Possible endpoints:
- `GET /api/v1/reminders/`
- `POST /api/v1/reminders/`
- `PATCH /api/v1/reminders/:id/`
- `DELETE /api/v1/reminders/:id/`

## Frontend
On Task/Event detail/edit UI, allow:
- enable reminder
- select scheduled datetime
- disable/delete reminder

## V1 runtime behavior
Implement active-session checking in a simple central place, e.g. top-level reminder provider/hook.

Do not start one `setInterval` per card.

Central flow:
```text
load enabled upcoming TIME reminders
  ↓
central scheduler checks relevant times
  ↓
when due and not already triggered
  ↓
show browser/in-app notification
  ↓
mark trigger state appropriately
```

Avoid duplicate notifications on rerender/refresh.

Document limitation: full server-side web push while browser is closed is not part of initial Part 5 baseline.

---

# STEP F — ACTIVE GEOLOCATION

Create reusable hook such as:
`useGeolocation()`

Use Browser Geolocation API.

Location mode defaults:
`OFF`

User explicitly enables:
`Location Reminders: ON`

Only then call `navigator.geolocation.watchPosition()`.

Track in memory:
- current latitude
- current longitude
- accuracy if available
- geolocation error
- watching status

When mode turns OFF:
- clear watcher
- clear unnecessary current-location state if appropriate

Do not send every GPS update to Django.
Do not store GPS samples in database.

---

# STEP G — HAVERSINE / PROXIMITY ENGINE

Create a pure utility function for distance between two coordinates.

Use Haversine or equivalent appropriate spherical distance formula.

Write unit tests for it.

Test known/simple coordinate cases.

Function behavior should be deterministic and independent of React.

Conceptual flow:
```text
current coordinate
  + saved place coordinate
  ↓
distanceMeters
  ↓
compare to reminder.radius_m
```

---

# STEP H — LOCATION REMINDERS

When Location Mode is ON:
1. load enabled LOCATION reminders/current user's relevant places
2. receive browser coordinates
3. calculate distance locally
4. detect enter/proximity state
5. trigger only when user crosses/enters threshold or when cooldown rules permit

## Avoid notification spam
Do not notify on every GPS update while inside radius.

Maintain local/session trigger state.
Use Reminder `last_triggered_at`/count where appropriate.

Define a simple cooldown/re-entry policy before implementation.

Example policy:
- trigger once upon entering
- do not re-trigger while staying inside
- reset eligible state after leaving radius by a small hysteresis margin or after explicit task changes

Keep V1 understandable.

---

# STEP I — SHOPPING PLACE ASSIGNMENT

Shopping tasks are confirmed NoteItems:
- type TASK
- Shopping domain

Allow user to assign a saved Place to a shopping task.

Example:
- Eggs → Agora
- Bread → Agora
- Rice → Rahman Grocery

AI `place_hint` may suggest a name, but it must **not** automatically bind to a saved Place unless matching is clear/user confirms.

Place assignment should be editable.

---

# STEP J — SHOPPING LOCATION AGGREGATION

Shopping page should group pending Shopping tasks by assigned Place.

Example:
```text
Agora
  - Eggs
  - Bread
  - Shampoo

Rahman Grocery
  - Rice
  - Oil

No location
  - Notebook
```

Only include pending/incomplete shopping tasks.

Completed items disappear from active shopping groups.

## Nearby notification aggregation
When user enters Agora radius, do **not** emit one notification per item.

Create one notification:
`3 things to get at Agora: Eggs, Bread, Shampoo`

If items exceed a sensible count, summarize:
`You have 7 shopping items at Agora.`

Click behavior may route user to Shopping page/place group if practical.

---

# PRIVACY AND PERMISSION REQUIREMENTS

The UI must clearly state:
- location mode is optional
- it can be turned off anytime
- current location is used locally for proximity checks
- movement history is not stored
- saved Places are stored because the user explicitly creates them

Do not send live coordinates to Groq.
Do not include live GPS coordinates in semantic search/RAG context.

---

# ERROR HANDLING

Handle:
- geolocation unsupported
- permission denied
- permission revoked
- timeout
- inaccurate location
- no saved places
- place deleted while reminder exists
- notifications denied
- notifications unsupported
- reminder API failure
- offline/network failure

Location failure must not break Notes/Tasks/Shopping functionality.

---

# TESTING

## Place security
User B cannot read/update/delete User A's places/reminders.

## Haversine
Unit-test distance function.

## Location permission
Test denied and granted behavior.

## Mode lifecycle
Turn ON → watcher created.
Turn OFF → watcher cleared.

## Radius
Mock coordinates inside/outside a saved place and verify detection.

## No spam
Repeated position updates inside radius should not produce repeated alerts.

## Aggregation
Agora has Eggs, Bread, Milk → one nearby notification, not three.

## Completion
Complete Eggs; next aggregation should omit Eggs.

## Time reminder
Mock due time and verify only one notification.

## Automated location and reminder verification
Use frontend component tests with mocked browser APIs and backend tests for ownership, validation, and persistence. Browser permission and geolocation behavior must be tested without requiring a real device or physical movement.

Required automated cases:
- Haversine known-coordinate calculations and boundary behavior
- permission granted, denied, unavailable, and browser-error paths
- watcher starts when Location Mode turns on and is cleared when it turns off
- coordinates inside, outside, and exactly on a place radius
- cooldown and re-entry behavior
- repeated updates do not spam notifications
- one aggregated nearby-shopping notification is produced
- completed shopping items are omitted
- time reminders fire once when due
- User B cannot access User A's places or reminders
- location failures do not break Notes, Tasks, or Shopping

Use fake timers, mocked coordinates, mocked notifications, and mocked geolocation. Never store GPS movement history merely to make tests easier.

---

## Documentation
Create/update:
- `docs/location-reminders.md`
- `docs/architecture.md`
- `docs/api.md`
- README browser permission notes

Document:
- web limitation vs native geofencing
- permission flow
- privacy model
- Haversine behavior
- trigger/cooldown policy
- notification fallback

---

## Acceptance criteria
Part 5 is complete only when:
1. Place CRUD uses real backend data.
2. Map/current-location place creation works.
3. Time reminders persist.
4. Browser notification permission is requested contextually.
5. Active-session time notification works.
6. Location Mode defaults OFF.
7. Enabling mode starts browser location watcher.
8. Disabling mode clears it.
9. Haversine distance works and is tested.
10. Location reminders trigger on proximity without constant server GPS upload.
11. Repeated GPS updates do not spam notifications.
12. Shopping tasks can be assigned to places.
13. Shopping page groups pending items by place.
14. Nearby shopping produces one aggregated notification.
15. GPS movement history is not stored.
16. User isolation exists for places/reminders.
17. App clearly states browser-background limitation.
18. Automated unit, component, backend, security, and browser-behavior tests pass.
19. Permission-denied and unavailable-location paths are verified.
20. No test requires real GPS movement, browser permission approval, or production data.

---

## Deliverable before implementation
Before changing files, provide:
1. current Part 4 relevant architecture summary
2. Place/Reminder schema
3. decision on shopping-task ↔ place source of truth
4. endpoint table
5. map package recommendation and reason
6. notification permission flow
7. time-reminder runtime design
8. `useGeolocation` design
9. Haversine utility design
10. enter/cooldown/re-entry policy
11. shopping aggregation design
12. privacy behavior
13. files to create/modify
14. exact step order
15. test matrix

Then wait for:

`IMPLEMENT PART 5 — STEP A`
