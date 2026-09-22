# FLUID, INTERACTIVE NEXT.JS PRODUCT EXPERIENCE PROMPT

## Project

AI Context-Aware Note-Taking Web Application

## Purpose

Transform the frontend into a **high-end, animation-forward, tactile productivity experience** using Next.js while preserving the app's real functionality and information hierarchy.

The target feeling is:

> visually impressive and memorable on first use, but still fast, clear, and practical enough for everyday productivity.

The app should feel more animated and polished than a generic CRUD dashboard.

It should **not** feel like a portfolio animation demo pasted on top of a note-taking product.

---

# 1. Frontend platform

Use:

- Next.js App Router
- TypeScript
- React
- Tailwind CSS or an equivalent token-driven styling system
- Motion / Framer Motion for coordinated animation
- TanStack Query for Django API server-state
- Zustand only for small transient UI state when local state is not enough
- accessible Dialog / Popover / Tooltip primitives such as Radix UI
- one consistent icon library such as Lucide
- Lenis only when it improves long-page scrolling without harming accessibility or responsiveness

Backend remains:

```text
Next.js frontend
      ↓
Django REST API
      ↓
PostgreSQL
```

Do not duplicate Django business logic in Next.js route handlers without a concrete reason.

---

# 2. Frontend organization

Use a feature-oriented Next.js structure.

```text
frontend/
  src/
    app/
      (auth)/
        login/
          page.tsx
        register/
          page.tsx

      app/
        layout.tsx
        page.tsx

        search/
          page.tsx

        space/
          page.tsx

        notes/
          [id]/
            page.tsx

        places/
          page.tsx

        settings/
          page.tsx

      layout.tsx
      providers.tsx
      globals.css

    components/
      layout/
        AppShell.tsx
        Sidebar.tsx
        SidebarItem.tsx
        MobileNavDrawer.tsx
        TopBar.tsx

      search/
        UniversalSearchBar.tsx
        SearchOverlay.tsx
        SplitSearchResults.tsx
        SearchResultCard.tsx
        GroundedAnswerPanel.tsx
        SearchEmptyState.tsx

      space/
        YourSpaceGrid.tsx
        SpacePreviewCard.tsx
        SpaceModal.tsx
        SpaceItemRow.tsx

      ui/
        Button.tsx
        Card.tsx
        Dialog.tsx
        Tooltip.tsx
        Badge.tsx
        Skeleton.tsx
        Toast.tsx
        EmptyState.tsx

      motion/
        MotionProvider.tsx
        RouteTransition.tsx
        Reveal.tsx
        AnimatedNumber.tsx

    features/
      auth/
      dashboard/
      notes/
      search/
      space/
      places/
      reminders/
      settings/

    hooks/
      useSidebar.ts
      useUniversalSearch.ts
      useReducedMotionSafe.ts
      useMediaQuery.ts

    lib/
      api/
      search/
      motion/
      utils/

    stores/
      ui-store.ts

    types/
```

Use TanStack Query for remote server-state.

Do not put API payloads into Zustand.

Use local state or Zustand only for things such as:
- sidebar collapsed state
- universal search open state
- active Space modal
- harmless UI preferences

Do not add Redux unless a demonstrated need appears.

---

# 3. Core visual direction

The app should feel:

- premium
- futuristic but usable
- crisp
- responsive
- tactile
- animation-rich
- slightly playful
- visually memorable
- productivity-first

Use:
- calm neutral base surfaces
- one strong accent color
- controlled accent gradients
- subtle glass treatment on overlays/sidebar/popovers
- layered depth
- high-quality typography
- excellent spacing
- clear hierarchy
- high-contrast active/focus states

Avoid a boring enterprise-dashboard feel.

Also avoid:
- giant looping animated backgrounds
- particle systems
- cursor trails
- decorative WebGL
- constant neon glow
- noise everywhere

The **interface elements** should provide the spectacle.

---

# 4. Motion philosophy

Motion should be:
- smooth
- fast
- slightly springy
- responsive
- intentional
- physically connected to the user's action

Most interactions should finish quickly.

Recommended tokens:

```css
--motion-instant: 120ms;
--motion-fast: 180ms;
--motion-normal: 300ms;
--motion-panel: 420ms;
--motion-reveal: 650ms;

--ease-out: cubic-bezier(.22, 1, .36, 1);
--ease-soft: cubic-bezier(.16, 1, .3, 1);
```

Spring-like interactions may use roughly:

```text
stiffness: 320–450
damping: 26–36
mass: 0.7–1
```

Never make bounce/overshoot so large that it slows work.

---

# 5. App shell

Authenticated layout:

```text
┌──────────────┬─────────────────────────────────────────────┐
│ Sidebar      │ top / universal search                     │
│              ├─────────────────────────────────────────────┤
│ Dashboard    │                                             │
│ Search       │ page content                                │
│ Your Space   │                                             │
│ Places       │                                             │
│ Settings     │                                             │
│              │                                             │
│ Logout       │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

The shell should remain visually stable while inner routes/views animate.

---

# 6. ChatGPT/Claude-style collapsible sidebar

Expanded:

```text
[app mark + name]                      [collapse]

Dashboard
Search
Your Space
Places
Settings

---------------------------------
Logout
```

Collapsed:

```text
[mark]  [expand]

[dashboard]
[search]
[space]
[places]
[settings]

[logout]
```

Requirements:
- smooth width transition
- labels fade/slide instead of compressing
- icons stay visually anchored
- active indicator glides between destinations
- hover moves icons only 1–2px
- collapsed items use tooltips
- collapse icon subtly morphs/rotates
- content area smoothly reflows
- no visible layout jump
- desktop preference may persist
- mobile uses an animated drawer

Suggested label transition:

```text
opacity 1 -> 0
translateX 0 -> -6px
```

Collapsing should feel slightly quicker than expanding.

---

# 7. Dashboard entrance

Suggested choreography:

```text
app shell settles
    ↓
Universal Search/top bar fades in
    ↓
Quick Capture rises
    ↓
What Matters cards stagger
    ↓
summary metrics animate
    ↓
Daily Briefing settles
```

The user must be able to interact immediately.

Do not make them wait for the sequence.

Quick Capture should visually feel like the main action.

On focus:
- accent ring appears
- surface gains slight elevation
- Save/analyze action becomes more prominent

No huge bloom/glow.

---

# 8. Your Space

Approved top-level cards:

- Tasks
- Events
- Shopping
- Expenses
- Study

Do not add another category without explicit approval.

`Study` is a UI view over the Education domain.

## Preview cards

Each card includes:
- icon
- title
- count
- 3–5 compact rows
- dates/status
- category accent
- View all action

Desktop hover:

```text
translateY 0 -> -6px
scale 1 -> 1.012
shadow/depth increases
accent shifts slightly
arrow moves
```

Do not make cards rotate or bounce dramatically.

## Click-to-expand

When clicked:

1. card compresses slightly;
2. background dims/blurs;
3. expanded panel grows from the card geometry where practical;
4. full list fades/staggers in;
5. X appears;
6. rest of app stays visible behind blur.

Desktop expanded modal:

```text
max-width: approximately 900–1100px
max-height: approximately 80–88vh
```

Mobile:
- near-full-screen sheet
- comfortable touch spacing
- no tiny desktop modal

Close via:
- X
- Escape
- safe backdrop click

Restore focus to the trigger card.

---

# 9. Universal Search bar

Search is available from:
- Sidebar Search
- app top bar
- Cmd/Ctrl+K

Idle placeholder examples may crossfade:

```text
Search Notes...
Ask My Notes...
Find an expense...
Find what you wrote...
```

Use subtle opacity/blur transitions.

Do not use a distracting endless typewriter animation.

Stop placeholder motion on focus.

On focus:
- border/accent sharpens
- elevation increases slightly
- shortcut hint fades
- input gets visually wider/prominent where layout allows

---

# 10. Search overlay

Opening:

```text
backdrop:
opacity 0 -> 1
blur 0 -> light blur

panel:
opacity 0 -> 1
scale .97 -> 1
translateY 18px -> 0
```

Desktop:

```text
┌────────────────────────────────────────────────────────────────┐
│ Search your memory...                                   [ X ] │
├───────────────────────────────┬────────────────────────────────┤
│ Search Notes                  │ Ask My Notes                   │
│                               │                                │
│ ranked source cards           │ strict grounded answer         │
│                               │                                │
│ result                 94 Rel │ source chips                   │
│ result                 86 Rel │                                │
│ result                 72 Rel │ insufficient-context state     │
└───────────────────────────────┴────────────────────────────────┘
```

Use a stable split such as 55/45 or 50/50.

Mobile:
- one panel
- shared search input
- animated tabs:
  - Search Notes
  - Ask My Notes

Do not squeeze desktop columns onto mobile.

---

# 11. Search Notes cards

Each result card may show:
- title
- excerpt
- type badge
- domain badges
- relevant date/time
- amount for Expense
- highlighted exact phrase/keyword match
- Relevance score bottom-right

Use `Relevance`, never `Confidence`.

Entrance:
- group fade/slide
- 35–60ms stagger

Hover:
- lift 3–4px
- border/contrast strengthens
- source arrow slides
- relevance pill becomes slightly more visible

Do not stagger so slowly that results feel delayed.

Click opens source Note with a fast route/modal transition.

---

# 12. Ask My Notes panel

Do not make this look like a chat transcript.

No chat bubbles.

Render:
- concise answer
- grounded/source state
- source chips/cards
- insufficient-context state
- provider-error state

Loading:

```text
answer skeleton
    ↓
answer fades in
    ↓
sources appear with short stagger
```

If the provider fails:
- left Search Notes stays usable
- right panel shows isolated error state
- never collapse the whole overlay

---

# 13. Route transitions

Keep them short.

Suggested:

```text
old:
opacity 1 -> .4

new:
opacity 0 -> 1
translateY 8px -> 0
```

Total:
- about 180–300ms

Never delay actual navigation waiting for animation.

---

# 14. Page / section reveals

Good targets:
- Dashboard headings
- Your Space grid
- Places page panels
- Settings groups

Suggested:

```text
opacity 0 -> 1
translateY 22px -> 0
scale .985 -> 1
```

Stagger cards:
- 40–80ms

Play once.

Do not animate every label.

---

# 15. Buttons

Hover:

```text
scale 1 -> 1.025
```

Press:

```text
scale -> .97
```

Primary:
- slightly stronger elevation/accent
- subtle icon movement

Destructive:
- clear and restrained
- no playful bounce

Loading:
- preserve width
- crossfade text/spinner
- no layout jump

---

# 16. Inputs / forms

On focus:
- border sharpens
- focus ring fades in
- background/surface becomes slightly clearer
- label accent changes

Validation:

```text
opacity 0 -> 1
translateY -4px -> 0
```

Avoid aggressive shake.

Secret/API-key fields must never animate secret values into visibility.

---

# 17. Modals / sheets / popovers

Shared opening language:

```text
backdrop fade
panel opacity
translateY 18–24px
scale .975 -> 1
```

Close slightly faster.

Popover:

```text
opacity
translateY 4–6px
scale .98
```

Support:
- Escape
- focus trap
- focus restore
- keyboard navigation
- reduced motion

---

# 18. Task / state micro-interactions

Task completion:

```text
checkbox check draws
text opacity reduces
strike-through draws
row gently settles
```

Do not instantly teleport the row away before feedback is visible.

If product logic reorders/removes it, do so after the micro-interaction.

Save states:

```text
Save -> Saving… -> Saved
```

Use crossfade, not width jump.

---

# 19. Expense / metric motion

Intentional headline metrics may count up once:

```text
0 -> monthly total
```

Do not animate every price in rows.

Expense category bars/cards may animate once to their final calculated value.

---

# 20. Places / reminders motion

- Place selection uses shared active highlight
- map container fades in after lazy load
- Location Mode toggle is tactile
- location acquisition may use one subtle pulse
- nearby Shopping toast slides from edge
- Shopping group expand/collapse uses layout animation

Do not create perpetual radar animation.

---

# 21. Loading

Prefer:
- content-shaped skeletons
- short shimmer
- skeleton fade-out
- real data fade-in

Avoid:
- full-page spinners
- long cinematic loader
- artificial delay

Universal Search should render left results as soon as available while the right RAG panel may continue loading independently.

---

# 22. Scrolling

Use Lenis only on long pages where it improves feel.

Do not use floaty smoothing inside:
- search result lists
- modals
- sheets
- dense app scroll containers

Never scroll-jack.

---

# 23. Hover capability

Only enable hover-specific polish on capable devices:

```css
@media (hover: hover) and (pointer: fine) {
  /* hover polish */
}
```

Touch users get stable controls.

---

# 24. Reduced motion

Mandatory.

When:

```text
prefers-reduced-motion: reduce
```

reduce/disable:
- stagger
- shared-layout zooms
- spring travel
- Lenis
- large transforms
- animated counters

Keep:
- focus cues
- essential state changes
- immediate content visibility

No functionality may depend on animation.

---

# 25. Performance

Animation-heavy must still be fast.

Prefer:
- transform
- opacity
- compositor-friendly animation

Avoid continuous animation of:
- width
- height
- top
- left
- huge blur
- large shadow
- filter

For sidebar width transitions:
- keep DOM simple
- keep duration short
- use transform/clip techniques when appropriate

Avoid:
- many requestAnimationFrame loops
- mounting heavy modal contents before needed
- loading map library globally
- marking the whole app `use client`

Use dynamic imports for heavy client-only features.

---

# 26. Next.js server/client boundaries

Default to Server Components where practical.

Use Client Components where interaction requires them:
- sidebar
- Universal Search
- Your Space modal
- forms
- animation state
- map
- notifications
- geolocation
- browser permission UI

Do not place `use client` at the root without necessity.

---

# 27. Data fetching

Use TanStack Query for authenticated Django API server-state where appropriate.

Use:
- query keys
- request cancellation
- cache invalidation
- stale-response prevention
- optimistic updates only where safe

Universal Search must cancel/ignore older responses when a newer query is current.

Do not store server payloads in Zustand.

---

# 28. Responsive behavior

Desktop:
- full collapsible sidebar
- split Search Overlay
- multi-column Your Space

Tablet:
- narrower sidebar
- two-column Space grid
- responsive split search

Mobile:
- drawer nav
- single-column content
- Space sheet
- Search Notes / Ask My Notes tabs
- no hover assumptions
- smaller motion distances

---

# 29. Accessibility

Keyboard support:
- sidebar
- Cmd/Ctrl+K
- search result navigation
- modal/sheet
- source links
- dialogs
- forms

Use visible focus states.

Use semantic buttons/links.

Do not make arbitrary `div`s clickable.

Search overlay:
- dialog semantics
- labelled search input
- focus trap
- Escape
- focus restore
- screen-reader labels for source/relevance metadata

---

# 30. Frontend testing

## Sidebar
Test:
- collapse/expand
- persisted harmless state
- keyboard
- mobile drawer
- active item

## Your Space
Test:
- cards
- preview rows
- modal open
- X close
- Escape
- backdrop
- focus return
- mobile sheet

## Universal Search
Test:
- keyboard shortcut
- input
- stale request cancellation
- left results
- ranking
- Relevance label
- right answer
- source chips
- provider failure
- insufficient context
- mobile tabs

## Motion
Test outcomes, not animation implementation internals.

Verify:
- reduced-motion path
- hidden content becomes visible
- no focus trap bug
- modal/sheet closes cleanly

## E2E
Use Playwright on desktop and mobile representative viewports.

Check browser console for:
- hydration errors
- uncaught exceptions
- obvious accessibility-critical failures

---

# 31. Initial authenticated page experience

Suggested:

```text
sidebar settles
    ↓
top search bar fades in
    ↓
Quick Capture rises
    ↓
priority cards stagger
    ↓
Your Space preview settles
```

Total perceived entrance should be around one second or less.

The user can interact immediately.

---

# 32. Quality bar

The interface should feel impressive because:
- components respond instantly
- state changes have physicality
- overlays feel dimensional
- layout transformations connect cause and effect
- loading is elegant
- hierarchy is strong
- animations share one language
- Universal Search feels like a centerpiece

Not because:
- the whole background moves
- everything glows
- every card rotates
- particles are everywhere
- interactions take too long

---

# 33. Implementation process

Before implementation:

1. inspect the current Vite/React frontend;
2. map routes/features;
3. identify state ownership;
4. identify reusable components;
5. produce a Vite -> Next.js migration map;
6. produce the final folder tree;
7. define design tokens;
8. define motion tokens;
9. define reusable AppShell;
10. define sidebar behavior;
11. define Your Space behavior;
12. define Universal Search behavior;
13. identify heavy dynamic imports;
14. define accessibility requirements;
15. define regression + E2E matrix.

Migrate incrementally.

Do not rewrite working business behavior only for visual polish.

---

# Final target

The final product should feel:

> **fast, fluid, tactile, visually rich, highly interactive, animation-forward, and memorable — a modern AI productivity product rather than a generic dashboard.**

Users should enjoy:
- collapsing the sidebar
- opening Universal Search
- expanding a Space card
- completing a Task
- opening Places
- navigating between views

because each interaction feels deliberate.

Animation may be prominent, but never at the cost of:
- speed
- legibility
- accessibility
- privacy
- correctness
- productivity
