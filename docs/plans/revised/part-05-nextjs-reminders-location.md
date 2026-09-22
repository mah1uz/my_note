# PART 5 OF 6 — NEXT.JS REMINDERS, PLACES & LOCATION-AWARE SHOPPING

## Project
AI Context-Aware Note-Taking Web Application

## Starting point

Part 4 should now provide:
- Next.js App Router + TypeScript frontend
- premium collapsible sidebar
- Universal Search
- Your Space
- PostgreSQL
- pgvector embeddings
- regex/query parser
- structured SQL analytics
- PostgreSQL FTS
- hybrid retrieval
- strict grounded Ask My Notes
- current-user search/source isolation

Part 5 adds saved Places, time reminders, browser notifications, active-session geolocation, location reminders, and location-aware shopping.

The Part 4 app shell is permanent. Do not redesign navigation again.

---

# Privacy boundary

Live GPS must remain outside search intelligence.

Do not put current latitude/longitude into:
- embeddings
- full-text search
- persisted regex/query-parser state
- RAG context
- Groq requests
- analytics logs
- movement-history tables

Saved Place names may be searchable where useful.

Precise coordinates and addresses remain sensitive data.

---

# Goal

Implement:
- Place CRUD
- map-based Place creation/editing
- current-location Place creation
- time reminders
- contextual Notification permission
- active Location Reminder Mode
- browser geolocation watcher
- Haversine distance
- location reminders
- Shopping ↔ saved Place assignment
- grouped Shopping inside Your Space
- one aggregated nearby-shopping alert
- polished Next.js client interactions
- privacy/error/security tests

---

# Sidebar integration

Keep:

```text
Dashboard
Search
Your Space
Places
Settings

----------------
Logout
```

Reminders do not become a new top-level sidebar destination.

Reminder controls live contextually inside:
- Task modal/detail
- Event modal/detail
- Shopping modal/detail
- Settings notification/location controls

---

# Your Space integration

Approved cards remain:
- Tasks
- Events
- Shopping
- Expenses
- Study

Do not add another card without approval.

## Shopping preview card

Example:

```text
Shopping                          7

Agora
  Eggs
  Bread

Rahman Grocery
  Rice

No location
  Notebook
```

Clicking Shopping opens the existing animated Space Modal/Sheet.

## Tasks and Events

Expanded Task/Event rows may expose:
- reminder enabled state
- scheduled reminder
- location reminder
- edit/disable actions

Keep preview cards compact.

---

# Next.js client boundaries

The following must be client-side:
- browser geolocation
- Notification API
- interactive map
- sidebar toggle
- Your Space modal
- reminder runtime
- permission prompts
- Location Mode

Do not call browser APIs from Server Components.

Map libraries that depend on `window` must be dynamically imported.

Conceptually:

```tsx
dynamic(() => import("./PlaceMap"), { ssr: false })
```

---

# STEP A — Data-model audit

Use the implemented future-proof schema.

## Place

Expected:
- UUID id
- AppUser owner
- name
- latitude
- longitude
- optional address
- default radius
- timestamps

## Reminder

Expected:
- UUID id
- NoteItem FK
- trigger type
- scheduled_at nullable
- Place FK nullable
- radius nullable
- enabled state
- last_triggered_at
- triggered_count
- timestamps

Validation:

```text
TIME
  scheduled_at required

LOCATION
  Place required
  radius required
```

Reminder NoteItem and Place must resolve to the same AppUser.

---

# STEP B — Place source of truth

Use:

```text
note_item.assigned_place_id
```

for:
> where the task/shopping item belongs

Use:

```text
reminder.place_id
```

for:
> where the reminder should trigger

They may differ.

`place_hint` remains untrusted text.

Never automatically convert an AI place hint into a saved Place relation without user confirmation or an explicitly safe deterministic match.

---

# STEP C — Place CRUD API

Approximately:

```text
GET    /api/v1/places/
POST   /api/v1/places/
GET    /api/v1/places/:id/
PATCH  /api/v1/places/:id/
DELETE /api/v1/places/:id/
```

Every queryset must be current-user scoped.

Delete behavior must follow the implemented DB policy.

UI must warn the user when deleting a Place affects:
- shopping assignments
- location reminders

---

# STEP D — Places page / map UX

Use Leaflet + OpenStreetMap with correct attribution.

Desktop concept:

```text
┌────────────────────────────┬──────────────────────────────┐
│ Saved places               │ Map                          │
│                            │                              │
│ Agora                      │ ● selected place            │
│ University                 │                              │
│ Home                       │                              │
│                            │                              │
│ + Add place                │                              │
└────────────────────────────┴──────────────────────────────┘
```

Mobile:
- cards/list first
- map in sheet/modal or stacked section
- no cramped two-column map layout

Place creation methods:
1. Use my current location
2. Click/select point on map

User enters:
- name
- optional address/description
- radius

Suggested radii:
- 100m
- 250m
- 500m
- 1000m
- custom

Do not add constant geocoding calls.

---

# STEP E — Notification permission

Never request permission on initial page load.

Flow:

```text
user enables/creates first reminder
        ↓
explain benefit
        ↓
user presses Enable notifications
        ↓
browser permission request
```

Handle:
- default
- granted
- denied
- unsupported

Denied notifications must not break reminders.

Provide an in-app reminder state when browser notification is unavailable.

---

# STEP F — Time reminder runtime

Create one centralized runtime/provider.

Do not create one interval/timer per card.

Concept:

```text
AppReminderProvider
    ↓
load enabled upcoming TIME reminders
    ↓
schedule/check relevant reminder times
    ↓
when due
    ↓
browser notification if permitted
+ in-app alert
    ↓
mark trigger state
```

Avoid duplicate triggers after rerender/refresh.

Document V1 limitation:

> time reminders are active-session/browser reminders; full server push while the browser is closed is not required.

---

# STEP G — Active geolocation

Create a client-only hook/service such as:

```text
useGeolocation()
```

Location Mode default:

```text
OFF
```

Only after explicit user action call:

```text
navigator.geolocation.watchPosition()
```

Keep in memory:
- current latitude
- current longitude
- accuracy
- current error
- watcher status

When OFF:
- clear watcher
- clear unnecessary current-location memory

Do not store GPS samples.

---

# STEP H — Haversine proximity

Create deterministic pure utility:

```text
distanceMeters(current, savedPlace)
```

Use Haversine or equivalent.

Unit test:
- same coordinate
- known coordinate distance
- inside radius
- outside radius
- exactly on radius
- invalid input
- tolerance behavior

---

# STEP I — Entry / cooldown / re-entry

Avoid notification spam.

Recommended policy:
1. outside -> eligible
2. enter radius -> trigger once
3. remain inside -> no repeat
4. leave past radius + hysteresis -> eligible again
5. short cooldown prevents GPS jitter

Keep inside/outside state in client memory.

Use durable `last_triggered_at` / `triggered_count` only as reminder metadata, not tracking history.

---

# STEP J — Shopping assignment and grouping

Shopping means confirmed:
- `item_type = TASK`
- Shopping domain
- active/pending status

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

Completed items disappear from active shopping groups.

---

# STEP K — Aggregated nearby notification

When entering a Place radius:

Do not emit one notification per Shopping item.

Example:

```text
3 things to get at Agora: Eggs, Bread, Shampoo
```

If many:

```text
You have 7 shopping items at Agora.
```

A notification may deep-link to:

```text
/app/space?open=shopping&place=<uuid>
```

or equivalent UI state.

Never put coordinates in the URL.

---

# Search integration

Universal Search remains globally available.

Queries may use saved Place names:

```text
things to buy at Agora
shopping items without a place
tasks connected to University
```

Search may use:
- saved Place name
- assigned Place metadata
- place_hint as lower-trust text

Search must **not** use:
- current GPS
- movement history
- precise coordinates

Ask My Notes must not answer:
> where am I right now?

from persisted data, because current location is not persisted.

---

# Motion / interaction

Follow the shared `fluid-interactive-website-prompt.md`.

Part 5-specific interactions:
- Place list stagger on first load
- selected Place uses shared layout highlight
- Add/Edit Place opens springy dialog/sheet
- map container fades in after lazy load
- Location Mode toggle is tactile
- location acquisition may use one subtle pulse
- Shopping groups use layout animation
- completed Shopping item exits gracefully
- nearby alert slides/fades into view

Do not create decorative radar loops or perpetual GPS animation.

Respect reduced motion.

---

# Error handling

Handle:
- geolocation unsupported
- permission denied
- permission revoked
- timeout
- inaccurate location
- no saved Places
- deleted Place
- Notification denied
- Notification unsupported
- reminder API error
- cross-user Place reference
- offline/network failure
- map lazy-load failure
- stale NoteItem

Location problems must not break:
- Notes
- Search
- Your Space
- Tasks
- Shopping

---

# Testing

## Backend ownership

User B cannot:
- list User A Places
- retrieve User A Place
- modify/delete User A Place
- attach User A Place to their item
- create Reminder using User A Place
- read/update/delete User A Reminder

## Place lifecycle
Test:
- create
- edit
- delete
- assignment clearing
- dependent reminder policy

## Reminder validation
Test:
- valid TIME
- TIME missing scheduled_at
- valid LOCATION
- LOCATION missing Place
- invalid radius
- mixed-owner Place/NoteItem

## Browser APIs
Mock:
- Notification API
- geolocation
- timers
- map lazy loading

Required:
- ON creates watcher
- OFF clears watcher
- denied permission
- revoked permission
- timeout
- unsupported browser
- no duplicate watcher on rerender

## Haversine
Known distances and radius boundary.

## Spam prevention
Repeated updates inside radius => one alert.

Leave/re-enter => new alert according to policy.

## Shopping aggregation
Test:
- multiple items same Place
- one nearby alert
- completed item omitted
- no-location group
- deleting Place moves assignment to no-location as expected

## Next.js UI
Test:
- Places route
- client-only map
- no hydration error
- sidebar remains functional
- Shopping Space Modal
- reminder dialogs
- mobile sheets
- reduced-motion branch

## Search privacy regression
Verify precise/current location never appears in:
- embeddings
- query parser debug persistence
- RAG context
- source cards
- admin content views

## Playwright

Flow:
1. login
2. add Place
3. assign Shopping item
4. enable mocked Location Mode
5. simulate outside
6. simulate entry
7. verify one aggregated alert
8. open Shopping in Your Space
9. complete item
10. verify group updates
11. disable Location Mode
12. verify watcher cleared

No physical movement required.

---

# Acceptance criteria

Part 5 is complete only when:
1. Place CRUD is real and user-scoped.
2. map selection works.
3. current-location Place creation works.
4. time reminders persist.
5. notification permission is contextual.
6. centralized active-session reminder runtime works.
7. Location Mode defaults OFF.
8. ON starts watcher.
9. OFF clears watcher.
10. Haversine is deterministic/tested.
11. cooldown prevents spam.
12. Shopping items can be assigned to Places.
13. Shopping Your Space card groups pending items by Place.
14. nearby Shopping generates one aggregated alert.
15. no movement history is stored.
16. live GPS never enters embeddings/search/RAG/Groq.
17. cross-user Place/Reminder access is blocked.
18. Next.js client/browser API boundaries are correct.
19. mobile/map/reminder UX is polished.
20. all automated + E2E tests pass.

---

# Deliverable before implementation

Provide:
1. current Part 4 architecture summary
2. Place/Reminder DB audit
3. source-of-truth confirmation
4. endpoint table
5. client/server component boundaries
6. map loading strategy
7. notification permission flow
8. reminder runtime
9. geolocation hook design
10. Haversine design
11. cooldown/re-entry policy
12. Shopping grouping
13. search/privacy integration
14. motion/UX plan
15. files to create/modify
16. complete test matrix

Then wait for:

`IMPLEMENT PART 5 — STEP A`
