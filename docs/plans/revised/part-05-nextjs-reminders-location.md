# PART 5 OF 6 — NEXT.JS PLACES, REMINDERS & LOCATION-AWARE SHOPPING

## Project
AI Context-Aware Note-Taking Web Application — My Notes

## Starting point

Part 4 should now provide:
- Next.js App Router + TypeScript frontend
- Django/DRF/Supabase PostgreSQL backend
- UUID AppUser ownership
- Supabase Auth
- final Dashboard information architecture
- Tasks / Events / Shopping / Transactions / Study
- authoritative Transaction ledger
- Universal Search
- deterministic modular query parser
- PostgreSQL FTS
- pgvector semantic retrieval
- hybrid ranking
- strict grounded Ask My Notes
- current-user search/source isolation

Part 5 adds:
- saved Places
- time reminders
- browser notifications
- active-session geolocation
- location reminders
- Shopping ↔ saved Place assignment
- nearby-shopping context

The Part 4 app shell and navigation are permanent.

Do not restore `Your Space`.

---

# 1. Final navigation

Keep:

```text
Dashboard
  Overview
  Tasks
  Events
  Shopping
  Transactions
  Study

Search
Places
Settings

----------------
Logout
```

Reminders are contextual, not a new top-level destination.

Reminder controls live in:
- Task detail/modal
- Event detail/modal
- Shopping detail/modal
- Settings notification/location controls

---

# 2. Privacy boundary — non-negotiable

Live GPS stays outside persistent/search intelligence.

Never put current latitude/longitude into:
- database movement-history tables
- embeddings
- FTS documents
- query-parser persistence
- RAG context
- Groq requests
- analytics logs
- URLs
- admin views

Saved Place records may persist:
- name
- coordinates
- optional address
- radius

Precise saved coordinates remain sensitive user data.

---

# 3. Data-model audit

Use the reconciled database source of truth.

## Place

Expected:

```text
id UUID
user_id -> AppUser
name
latitude
longitude
address NULL
default_radius_m
created_at
updated_at
```

## Reminder

Expected:

```text
id UUID
note_item_id -> NoteItem
trigger_type TIME | LOCATION
scheduled_at NULL
place_id NULL
radius_m NULL
is_enabled
last_triggered_at NULL
triggered_count
created_at
updated_at
```

Validation:

```text
TIME
  scheduled_at required
  place_id/radius_m null in V1

LOCATION
  place_id required
  radius_m required > 0
```

Reminder NoteItem and Place must resolve to the same AppUser.

---

# 4. Place ownership meanings

Two distinct relationships:

```text
note_item.assigned_place_id
```

means:

> where this Task/Shopping item belongs.

```text
reminder.place_id
```

means:

> where this Reminder should trigger.

They may differ.

`place_hint` remains untrusted text from AI/user input.

Never convert a place hint into a saved Place relationship without:
- explicit user confirmation, or
- a clearly safe deterministic match plus visible confirmation.

---

# 5. Place CRUD API

Approximate:

```text
GET    /api/v1/places/
POST   /api/v1/places/
GET    /api/v1/places/:id/
PATCH  /api/v1/places/:id/
DELETE /api/v1/places/:id/
```

Every queryset is scoped to current AppUser.

Delete policy:
- `note_item.assigned_place_id` -> SET NULL
- LOCATION reminders for deleted Place -> CASCADE/delete according to DB policy
- UI warns before destructive effects

---

# 6. Places page

Desktop:

```text
┌──────────────────────────────┬────────────────────────────┐
│ Saved places                 │ Map                        │
│                              │                            │
│ Agora                        │ selected marker            │
│ University                   │                            │
│ Home                         │                            │
│                              │                            │
│ + Add place                  │                            │
└──────────────────────────────┴────────────────────────────┘
```

Mobile:
- list/cards first
- map in stacked section or sheet
- no cramped split layout

Creation methods:
1. Use my current location
2. Select a point on map

User supplies:
- name
- optional address
- radius

Suggested radii:
- 100m
- 250m
- 500m
- 1000m
- custom

---

# 7. Map implementation

Use Leaflet + OpenStreetMap or an equivalent approved low-complexity map setup.

Requirements:
- correct attribution
- client-only dynamic import
- no SSR access to `window`
- lazy load map bundle
- graceful load failure
- no constant geocoding calls

Example:

```tsx
dynamic(() => import("./PlaceMap"), { ssr: false })
```

Address search/geocoding is optional, not required for V1.

Coordinate selection is sufficient.

---

# 8. Notification permission

Never request Notification permission on first app load.

Flow:

```text
user creates/enables first reminder
       ↓
explain benefit
       ↓
user clicks Enable notifications
       ↓
browser permission request
```

Handle:
- default
- granted
- denied
- unsupported

Denied browser notifications must not break reminder data or in-app reminder UI.

---

# 9. Reminder API

Approximate:

```text
GET    /api/v1/reminders/
POST   /api/v1/reminders/
GET    /api/v1/reminders/:id/
PATCH  /api/v1/reminders/:id/
DELETE /api/v1/reminders/:id/
```

All querysets owner-scoped through NoteItem/AppUser.

Cross-user Place references are rejected.

---

# 10. Central reminder runtime

Use one centralized client runtime/provider.

Do not create one timer per card.

Concept:

```text
AppReminderProvider
  ↓
load enabled upcoming TIME reminders
  ↓
schedule/check relevant times
  ↓
due
  ↓
browser notification if permitted
+ in-app notification
  ↓
mark trigger metadata
```

Avoid duplicate triggers on:
- rerender
- route navigation
- refresh
- React Strict Mode behavior

---

# 11. V1 reminder limitation

This is an active-session/browser implementation.

Document honestly:

> Browser reminders work while My Notes is open/active. Full server push or
> operating-system scheduling while the browser is closed is outside V1.

Do not market this as native/background reminders.

Part 6 deployment docs must keep this limitation.

---

# 12. Active geolocation

Create client-only hook/service:

```text
useGeolocation()
```

Location Mode defaults:

```text
OFF
```

Only after explicit user action:

```text
navigator.geolocation.watchPosition()
```

Keep in memory only:
- latitude
- longitude
- accuracy
- error
- watcher status

When OFF:
- clear watcher
- clear current live-location memory

Do not persist GPS samples.

Do not send every GPS update to Django.

---

# 13. Haversine proximity

Pure deterministic utility:

```text
distanceMeters(current, savedPlace)
```

Use Haversine or equivalent.

Test:
- same coordinate
- known distance
- inside radius
- outside radius
- boundary
- invalid input
- tolerance

No Groq.

---

# 14. Entry / hysteresis / cooldown

Prevent GPS jitter spam.

Recommended state machine:

```text
OUTSIDE
  ↓ enter radius
INSIDE -> trigger once
  ↓ remain inside
no repeat
  ↓ leave beyond radius + hysteresis
OUTSIDE / eligible again
```

Use:
- small hysteresis margin
- short cooldown
- in-memory inside/outside state

`last_triggered_at` and `triggered_count` are reminder metadata, not movement history.

---

# 15. Shopping definition

Shopping means confirmed active Task with Shopping Domain.

Conceptually:

```text
item_type = TASK
primary/associated Domain = Shopping
status = PENDING/active
```

Group by:

```text
assigned_place_id
```

Example:

```text
Agora
  Eggs
  Bread
  Shampoo

Rahman Grocery
  Rice
  Oil

No location
  Notebook
```

Completed items disappear from active Shopping groups.

---

# 16. Dashboard Shopping integration

The Dashboard -> Shopping destination/card uses saved Place grouping.

Do not create a new `Your Space` surface.

Compact preview may show:

```text
Shopping 7

Agora
  Eggs
  Bread

No location
  Notebook
```

View all opens the existing category page/modal/sheet pattern.

---

# 17. Assigning Shopping to Places

User can:
- assign saved Place
- change assignment
- clear assignment

Never trust client owner IDs.

Backend validates:
- item belongs to current AppUser
- Place belongs to current AppUser

AI `place_hint` may be shown as a suggestion only.

---

# 18. Nearby Shopping alert

When entering a saved Place radius:

Do not emit one notification per Shopping item.

Example:

```text
3 things to get at Agora: Eggs, Bread, Shampoo
```

For many items:

```text
You have 7 shopping items at Agora.
```

Deep link may use:

```text
/app/shopping?place=<uuid>
```

or equivalent UI state.

Never put coordinates in the URL.

---

# 19. Nearby state and Part 6 priority contract

Live coordinates remain browser-only.

Part 5 may expose to the frontend:

```text
nearbyPlaceId
```

derived locally from current GPS + saved Places.

For Part 6 What Matters Now:

```text
Django -> base deterministic priority
Frontend -> optional small local boost for Shopping assigned to nearbyPlaceId
```

The boost must:
- be deterministic
- be modest
- expose reason `Nearby saved place`
- disappear when Location Mode turns OFF

No live GPS needs to reach the priority backend.

---

# 20. Search integration

Part 4 Universal Search may use saved Place metadata:

```text
things to buy at Agora
shopping items without a place
tasks connected to University
```

Search may use:
- saved Place name
- assigned Place ID/name
- lower-trust `place_hint`

Search must not use:
- current GPS
- movement history
- precise coordinates

Ask My Notes cannot answer:
> where am I right now?

from persisted data.

---

# 21. RAG privacy regression

Verify:
- live GPS absent from context
- Place coordinates absent from RAG
- precise addresses excluded unless a future explicit product requirement changes policy
- saved Place names may be used only when relevant
- prompt injection in Place names/Notes remains untrusted text

---

# 22. Next.js client boundaries

Client-side:
- map
- geolocation
- Notification API
- reminder runtime
- Location Mode
- permission prompts
- category modal/sheet
- sidebar interactions

Server Components:
- may render static wrappers/shell where useful

Do not access browser APIs in Server Components.

---

# 23. Settings additions

Settings may include:

```text
Notifications
  browser permission status

Location
  Location Mode OFF/ON
  explanation of privacy behavior

Saved Places
  shortcut/manage

Reminder limitations
  active-session explanation
```

Do not imply background GPS.

---

# 24. Motion

Use the reconciled motion guide.

Part 5-specific motion:
- Place list small stagger
- selected Place highlight
- Add/Edit Place dialog
- map fade after load
- Location Mode tactile toggle
- one subtle acquisition pulse
- Shopping group layout animation
- nearby alert slide/fade
- reminder status transition

Avoid:
- perpetual radar
- animated GPS background
- giant map zoom choreography
- constant pulsing

Reduced motion uses immediate state changes.

---

# 25. Error handling

Handle:
- geolocation unsupported
- permission denied
- permission revoked
- timeout
- low accuracy
- no saved Places
- deleted Place
- Notification denied
- Notification unsupported
- reminder API error
- cross-user Place
- offline/network error
- map load failure
- stale NoteItem

Location failures must not break:
- Notes
- Transactions
- Search
- Tasks
- Shopping
- Dashboard

---

# 26. Backend tests — ownership

User B cannot:
- list A's Places
- retrieve A's Place
- edit/delete A's Place
- assign A's Place to B's item
- create Reminder with A's Place
- read/edit/delete A's Reminder

---

# 27. Backend tests — lifecycle

Place:
- create
- edit
- delete
- item assignment cleared
- dependent location reminder deleted
- account cascade

Reminder:
- valid TIME
- TIME missing scheduled_at
- valid LOCATION
- LOCATION missing Place
- invalid radius
- mixed-owner Place/NoteItem
- duplicate/trigger metadata behavior as implemented

---

# 28. Browser tests

Mock:
- `navigator.geolocation`
- Notification API
- timers
- map lazy load

Required:
- Location Mode ON creates one watcher
- rerender does not duplicate watcher
- OFF clears watcher
- permission denied handled
- timeout handled
- unsupported handled
- state cleared appropriately

---

# 29. Proximity tests

Haversine:
- known distances
- boundary

Spam:
- repeated updates inside -> one alert
- jitter at boundary -> no spam
- leave + re-enter -> next eligible alert

Shopping:
- multiple items same Place -> one aggregated alert
- completed excluded
- no-location group
- deleted Place -> item becomes no-location

---

# 30. Next.js UI tests

Test:
- Places route
- no hydration errors
- dynamic map
- mobile layout
- Shopping destination
- place grouping
- reminder dialogs
- Settings permission state
- Location Mode
- reduced motion
- search remains functional
- Transactions unaffected

---

# 31. Search/privacy regression tests

Verify current/live location never appears in:
- embeddings
- FTS source
- persisted parser debug data
- RAG context
- source cards
- admin content
- Groq payloads
- logs

Saved Place name search remains allowed.

---

# 32. Playwright flow

1. login
2. add saved Place
3. create/assign Shopping item
4. create time reminder
5. enable mocked notification permission
6. enable mocked Location Mode
7. simulate outside
8. simulate entering Place
9. verify one aggregated alert
10. open Dashboard -> Shopping
11. complete item
12. verify group updates
13. disable Location Mode
14. verify watcher cleared
15. verify Search still works
16. logout

No physical movement required.

---

# 33. Development/demo location simulation

Provide a clearly marked dev/test-only mechanism.

Requirements:
- disabled in production
- obvious `DEV ONLY` label
- selects saved Place or mock coordinate
- feeds same proximity logic
- cannot bypass production authorization
- no hidden production query parameter/backdoor

This keeps the capstone demo repeatable.

---

# 34. Explicitly forbidden in Part 5

Do not add:
- server push infrastructure
- continuous background GPS
- movement-history database
- geofencing vendor SDK
- native mobile background services
- RAG over coordinates
- Groq location reasoning
- banking/financial features
- final What Matters Now implementation
- final Daily Briefing

---

# 35. Acceptance criteria

Part 5 is complete only when:

1. Place CRUD is real and user-scoped.
2. map selection works.
3. current-location Place creation works.
4. time reminders persist.
5. notification permission is contextual.
6. active-session runtime works centrally.
7. product states the browser-open limitation honestly.
8. Location Mode defaults OFF.
9. ON starts one watcher.
10. OFF clears watcher/live state.
11. Haversine is deterministic/tested.
12. hysteresis/cooldown prevents spam.
13. Shopping can be assigned to Places.
14. Dashboard Shopping groups by Place.
15. nearby shopping creates one aggregated alert.
16. no top-level Your Space is reintroduced.
17. Transactions/finance behavior remains unchanged.
18. no movement history is stored.
19. live GPS never enters search/RAG/Groq.
20. Part 6 receives only the client-side nearby-context contract.
21. cross-user access is blocked.
22. mobile/accessibility/reduced motion work.
23. automated + E2E tests pass.

---

# 36. Deliverable before implementation

Provide:

1. current Part 4 architecture summary
2. final navigation confirmation
3. Place/Reminder DB audit
4. delete/cascade policy
5. endpoint table
6. client/server boundaries
7. map loading strategy
8. permission flow
9. centralized reminder runtime
10. geolocation hook
11. Haversine utility
12. hysteresis/cooldown policy
13. Shopping assignment/grouping
14. nearby alert design
15. Part 6 nearby-priority contract
16. search/privacy regression plan
17. motion/UX plan
18. files to create/modify
19. complete test matrix
20. known V1 browser limitations

Then wait for:

`IMPLEMENT PART 5 — STEP A`
