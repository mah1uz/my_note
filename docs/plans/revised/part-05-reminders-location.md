# PART 5 - PLACES, REMINDERS AND LOCATION-AWARE SHOPPING

## Starting assumption

Use the existing frontend, auth, database, and persistence models from earlier work.

Do not create Place/Reminder tables or new assignment columns from this plan. If required persistence is absent, report the mismatch.

## 1. Goals

Add behavior around existing data for:
- saved Places;
- time reminders;
- browser notifications;
- active-session geolocation;
- location reminders;
- Shopping-to-Place assignment;
- nearby Shopping context.

## 2. Privacy boundary

Live GPS stays in browser memory.

Never put current coordinates into:
- movement-history persistence;
- embeddings;
- lexical search documents;
- parser persistence;
- RAG context;
- Groq requests;
- analytics logs;
- URLs;
- admin views.

Saved Place data remains sensitive user data.

## 3. Data behavior

Use existing Place, Reminder, NoteItem assignment, and ownership relationships exactly as implemented.

Keep these meanings distinct:

```text
item assigned place = where the item belongs
reminder place      = where the reminder triggers
```

`place_hint` remains lower-trust text until user-confirmed or safely matched with visible confirmation.

## 4. Place API/UI

Use existing owner-scoped CRUD paths.

Places UI should support, where implemented:
- saved-place list;
- add/edit/delete;
- map selection;
- current-location capture after explicit action;
- name, optional address, radius.

Map implementation should be lazy/client-only and must fail gracefully.

No new persistence is authorized here.

## 5. Notification permission

Never request Notification permission on first load.

Flow:

```text
user enables/creates reminder
-> explain benefit
-> user clicks enable notifications
-> browser permission request
```

Handle default, granted, denied, and unsupported states.

Denied notifications must not break reminder data or in-app reminder behavior.

## 6. Central reminder runtime

Use one centralized runtime/provider, not one timer per card.

```text
load enabled upcoming reminders
-> evaluate due reminders
-> browser notification if permitted
-> in-app notification
-> update existing trigger metadata if supported
```

Prevent duplicate triggers from rerenders, navigation, refresh, or development double-render behavior.

## 7. V1 limitation

Browser reminders are active-session behavior.

Do not claim reliable native/background notification while the browser is closed.

## 8. Active geolocation

Location Mode defaults OFF.

After explicit user action:

```text
navigator.geolocation.watchPosition()
```

Keep only in memory:
- latitude;
- longitude;
- accuracy;
- error;
- watcher status.

When OFF:
- clear watcher;
- clear live-location memory.

Do not continuously send GPS to Django.

## 9. Proximity

Use deterministic Haversine or equivalent distance calculation.

Test:
- same coordinate;
- known distance;
- inside/outside radius;
- boundary;
- invalid input;
- tolerance.

No Groq.

## 10. Hysteresis/cooldown

Prevent GPS jitter spam:

```text
OUTSIDE
-> enter radius
INSIDE -> trigger once
-> remain inside: no repeat
-> leave beyond hysteresis
OUTSIDE / eligible again
```

Use small hysteresis and cooldown in runtime state.

## 11. Shopping behavior

Shopping uses the existing structured item/domain semantics.

Conceptually:

```text
active Task + Shopping Domain
```

Group by existing assigned Place relationship:

```text
Agora
  Eggs
  Bread

No location
  Notebook
```

Completed items are excluded from active groups.

## 12. Nearby Shopping alert

On entering a saved Place radius, aggregate items into one alert.

Example:

```text
3 things to get at Agora: Eggs, Bread, Shampoo
```

Do not send one notification per item.
Do not put coordinates in links/URLs.

## 13. Priority contract

Live coordinates remain browser-only.

Frontend may derive a local `nearbyPlaceId` and apply a small deterministic Shopping boost later.

Requirements:
- modest effect;
- visible reason such as `Nearby saved place`;
- removed immediately when Location Mode is OFF;
- never outranks genuinely urgent deadlines.

## 14. Search/RAG boundary

Search may use existing saved Place names/assignments where relevant.

Search/RAG must not use:
- current GPS;
- movement history;
- precise coordinates.

Precise addresses stay out of RAG unless a separate explicit product decision changes that rule.

## 15. Error handling

Handle:
- geolocation unsupported/denied/revoked;
- timeout/low accuracy;
- no saved Places;
- deleted Place;
- Notification denied/unsupported;
- reminder API failure;
- cross-user Place reference;
- offline/network failure;
- map load failure;
- stale item.

Location failures must not break Notes, Transactions, Search, Tasks, Shopping, or Dashboard.

## 16. Tests

Ownership:
- user B cannot access user A Places/Reminders or cross-link them.

Browser:
- ON creates one watcher;
- rerender does not duplicate watcher;
- OFF clears watcher/state;
- permission failures handled.

Proximity:
- known Haversine distances;
- repeated inside updates trigger once;
- boundary jitter does not spam;
- leave/re-enter can trigger again;
- multiple Shopping items produce one aggregated alert.

Privacy regression:
- live GPS absent from embeddings/search context/RAG/Groq/logs/admin/source cards.

## 17. Demo simulation

A clearly marked development/test-only location simulator is allowed if:
- disabled in production;
- obvious as DEV ONLY;
- uses the same proximity logic;
- does not bypass authorization.

## 18. Acceptance

Part 5 is complete when existing Place/Reminder persistence is used safely, active-session reminders and nearby Shopping work, Location Mode is opt-in, GPS stays browser-only, ownership tests pass, and no new database schema is introduced.
