# FLUID, INTERACTIVE NEXT.JS PRODUCT EXPERIENCE — RECONCILED MOTION GUIDE

## Project
AI Context-Aware Note-Taking Web Application — My Notes

## Purpose

Make the application feel fluid, tactile, polished and responsive without turning
it into an animation demo.

The reference inspiration is useful for:
- smoothness
- easing
- scroll feel
- element choreography
- hover responsiveness
- modal/sheet transitions
- tactile controls

Do not copy heavy visual effects.

The rule is:

> **Elements can feel dynamic. Backgrounds should stay calm.**

---

# 1. Product feeling

Target:

- fast
- calm
- modern
- polished
- tactile
- responsive
- slightly springy
- productivity-first

Avoid:
- AI-looking neon effects
- animated gradient blobs
- particles
- cursor trails
- WebGL decoration
- liquid reveals
- giant moving backgrounds
- constant parallax
- endless glow
- long cinematic loaders

The user should notice that the app feels smooth, not that it contains many animations.

---

# 2. Final product structure

Motion must support the final architecture:

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

Do not build interactions around the retired top-level `Your Space`.

`Expenses` is a Transactions filter/tab, not the permanent finance destination.

---

# 3. Motion tokens

Recommended:

```css
--motion-instant: 120ms;
--motion-fast: 180ms;
--motion-normal: 300ms;
--motion-panel: 420ms;
--motion-reveal: 650ms;

--ease-out: cubic-bezier(.22,1,.36,1);
--ease-soft: cubic-bezier(.16,1,.3,1);
```

Spring-like interactions may use approximately:

```text
stiffness: 320–450
damping: 26–36
mass: 0.7–1
```

Keep overshoot restrained.

---

# 4. Movement scale

Use small distances.

```text
micro interaction:     2–4px
card/button movement:  4–8px
menu/modal entrance:  12–24px
scroll reveal:         20–36px
```

Scale:

```text
button hover: 1.015–1.025
card hover:   1.005–1.01
entrance:     .985–1
press:        .97–.99
```

Avoid dramatic scale/rotation.

---

# 5. Scrolling

Use Lenis only where it improves long-page feel.

Good candidates:
- Dashboard overview
- Settings page
- long informational pages

Do not apply floaty smoothing inside:
- Search results
- dialogs
- sheets
- dense list containers
- map interaction areas

Never scroll-jack.

Touch and keyboard scrolling remain natural.

Under reduced motion, use native scrolling.

---

# 6. App shell

The shell should feel stable while content changes.

Good:
- sidebar settles smoothly
- active indicator glides
- labels fade/slide on collapse
- page content fades/rises slightly
- no abrupt layout jump

Avoid:
- moving the entire shell on every route
- large page zooms
- long route choreography

---

# 7. Sidebar

Expanded:

```text
Dashboard  ▾
  Overview
  Tasks
  Events
  Shopping
  Transactions
  Study

Search
Places
Settings
```

Collapsed:
- anchored icons
- tooltip
- Dashboard icon opens accessible child popover/flyout

Interaction:
- width transition short
- labels opacity + small `translateX`
- chevron rotates
- child rows fade/slide
- active state moves smoothly

Example:

```text
label:
opacity 1 -> 0
translateX 0 -> -6px
```

Do not compress text into unreadable width.

---

# 8. Dashboard entrance

Suggested:

```text
shell visible immediately
  ↓
top search fades in
  ↓
Quick Capture rises
  ↓
Categorized Summary cards settle
  ↓
finance snapshot / What Matters enters
```

User can interact before the sequence ends.

Total perceived entrance around one second or less.

---

# 9. Categorized Summary cards

Categories:

```text
Tasks
Events
Shopping
Transactions
Study
```

Hover on desktop:

```text
translateY 0 -> -4px
scale 1 -> 1.008
border/shadow slightly stronger
arrow moves 2–3px
```

Click:
- subtle press
- open page/modal/sheet
- backdrop appears smoothly
- content enters with short stagger

No card rotation.

No bouncing.

---

# 10. Transaction interactions

Transaction rows should stay calm.

Good:
- row hover background
- amount text stable
- edit/delete action fades in
- new confirmed Transaction slides/fades into list
- balance headline crossfades/counts once when intentionally changed

Do not:
- animate every amount constantly
- flash money
- use casino-like green/red effects
- shake rows

Income/Expense meaning must not depend on color alone.

---

# 11. Quick Capture

On focus:
- accent ring appears
- surface elevates slightly
- action button becomes clearer

On save:
- button `Saving…`
- then compact `Saved`
- note appears with short fade/slide

AI analysis result:
- review panel appears below
- suggestion cards stagger lightly
- no giant AI glow

Raw Note should remain visually stable.

---

# 12. Buttons

Hover:

```text
scale 1 -> 1.02
```

Press:

```text
scale -> .98
```

Arrow:
- right arrow +3px
- up-right arrow +2px/-2px

Loading:
- preserve button width
- crossfade text/spinner
- no layout jump

Destructive actions:
- clear
- restrained
- no playful bounce

---

# 13. Forms

Focus:
- border sharpens
- focus ring fades in
- background becomes slightly clearer

Validation:

```text
opacity 0 -> 1
translateY -4px -> 0
```

Avoid aggressive shake.

Secret/BYOK fields must never animate secret text into visibility.

---

# 14. Modals and sheets

Open:

```text
backdrop opacity 0 -> 1
panel opacity 0 -> 1
translateY 18px -> 0
scale .98 -> 1
```

Close slightly faster.

Requirements:
- Escape
- focus trap
- focus restore
- safe backdrop click
- reduced motion
- mobile near-full-screen sheet where appropriate

---

# 15. Universal Search

Opening:

```text
backdrop fades
panel rises 12–18px
panel scale .98 -> 1
```

Results:
- group fade/slide
- 35–60ms stagger
- do not delay the first useful result

Left Search results must render independently from Ask My Notes.

Right answer:
- skeleton
- answer fades in
- sources appear shortly after

If Groq fails, do not animate/collapse the left panel away.

---

# 16. Search result hover

Desktop:

```text
translateY 0 -> -3px
border contrast slightly stronger
arrow -> +2px
Relevance badge slightly clearer
```

Do not make ranked results bounce.

Transaction search results follow the same language.

---

# 17. Route transitions

Short only.

Example:

```text
old content opacity 1 -> .5
new content opacity 0 -> 1
new content translateY 8px -> 0
```

Target total:
- 180–280ms

Navigation must not wait for animation completion.

---

# 18. Text reveals

Use only for:
- major Dashboard heading
- onboarding welcome
- important empty-state statement
- section title in long page

Do not animate every paragraph.

Simple line/word reveal is enough.

---

# 19. Tasks and state changes

Task completion:
- checkbox draws
- text opacity reduces
- strike-through draws
- row settles

If item disappears/reorders:
- show completion feedback first
- then layout transition

Do not instantly teleport it.

---

# 20. Shopping groups

When grouping by Place:
- group expand/collapse uses layout animation
- completed item exits gracefully
- nearby group may receive a subtle one-time emphasis

No radar animation.

No endless location pulse.

---

# 21. Places / location

Good:
- map fades in after lazy load
- selected Place gets shared highlight
- Add/Edit dialog transitions normally
- Location Mode toggle tactile
- one subtle acquisition pulse

Avoid:
- animated map background
- perpetual GPS waves
- decorative scanning effects

---

# 22. Onboarding

Use:
- spotlight fade
- tour card slide
- target pulse once
- progress transition

Do not:
- blink endlessly
- block the user for a long sequence
- use brittle animated arrows across the screen

Skip is immediate.

---

# 23. Loading

Prefer:
- content-shaped skeletons
- short shimmer if needed
- skeleton fade-out
- real content fade-in

Avoid:
- full-page spinners
- long loading logo sequences
- artificial delays

Search left/right panels load independently.

---

# 24. Dropdowns / popovers

Open:

```text
opacity 0 -> 1
translateY 4–6px -> 0
scale .98 -> 1
```

Duration:
- 150–220ms

Keep menus responsive.

---

# 25. Hover capability

Only use hover polish when supported:

```css
@media (hover: hover) and (pointer: fine) {
  /* hover */
}
```

Touch receives stable controls.

---

# 26. Reduced motion

Mandatory.

Under:

```text
prefers-reduced-motion: reduce
```

disable/reduce:
- Lenis
- stagger
- spring travel
- shared-layout zoom
- animated counters
- large transforms

Keep:
- focus states
- visibility changes
- essential status feedback

No content may remain hidden because an animation did not run.

---

# 27. Performance

Prefer:

```text
transform
opacity
```

Avoid continuous animation of:
- width
- height
- top
- left
- large blur
- huge shadow
- filter

Sidebar width may animate, but keep DOM simple and duration short.

Avoid many rAF loops.

Use dynamic imports for heavy client-only features.

---

# 28. Next.js boundaries

Default to Server Components when they genuinely help.

Use Client Components for:
- Supabase session-aware authenticated data
- TanStack Query
- sidebar
- Search overlay
- forms
- modals
- onboarding
- map
- geolocation
- notifications
- animation state

Do not mark root application `use client`.

---

# 29. Mobile

Mobile should be slightly less animated.

Keep:
- menu/drawer
- modal/sheet
- button feedback
- section entrance
- task completion
- search transitions

Reduce:
- large stagger
- hover assumptions
- large movement
- complex shared-layout effects

---

# 30. Quality target

The app should feel:

> smooth enough that the user notices the quality, but calm enough that the
> motion disappears into normal use.

The interface should feel good when the user:
- collapses the sidebar
- switches Dashboard categories
- captures a Note
- confirms a Transaction
- opens Search
- completes a Task
- expands Shopping
- edits Settings
- enables Location Mode

The background should rarely be the thing moving.
