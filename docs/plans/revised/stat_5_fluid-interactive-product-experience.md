# FLUID, INTERACTIVE PRODUCT EXPERIENCE

## Purpose

Make the existing application feel fast, calm, tactile, and polished without changing its architecture.

Rule:

> Elements can feel dynamic. Backgrounds should stay calm.

## 1. Product feeling

Target:
- fast;
- calm;
- modern;
- responsive;
- restrained spring/tactile feedback;
- productivity-first.

Avoid:
- animated gradient blobs;
- particles;
- cursor trails;
- decorative WebGL;
- giant moving backgrounds;
- constant parallax/glow;
- long cinematic loaders.

## 2. Navigation

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

Logout
```

No permanent `Your Space`.
Expenses remain inside Transactions.

## 3. Motion scale

Recommended durations:

```text
instant  120ms
fast     180ms
normal   300ms
panel    420ms
reveal   650ms max
```

Recommended movement:

```text
micro             2-4px
card/button       4-8px
menu/modal        12-24px
scroll reveal     20-36px
```

Keep scale changes subtle and overshoot restrained.

## 4. Shell/sidebar

Keep shell stable.

Good:
- short sidebar width transition;
- labels fade/slide slightly;
- chevron rotates;
- active indicator moves smoothly;
- collapsed icons have tooltips;
- mobile uses a clear drawer/menu.

Avoid large page zooms or moving the whole shell on every route.

## 5. Dashboard/categories

Quick Capture and category cards may enter with short fades/rises.

Categories:

```text
Tasks
Events
Shopping
Transactions
Study
```

Desktop hover may use a very small lift/scale/border emphasis.
No card rotation/bounce.

## 6. Transactions

Good:
- calm row hover;
- edit/delete actions appear clearly;
- new confirmed row fades/slides in;
- balance change may crossfade once.

Do not animate amounts continuously or rely on red/green alone for meaning.

## 7. Quick Capture and AI review

On focus:
- clear focus ring;
- slight surface emphasis.

On save:
- `Saving...` then compact success feedback;
- no layout jump.

AI review panels may appear with a light stagger.
Raw Note text remains visually stable.

## 8. Buttons/forms

Buttons:
- small hover scale;
- small press scale;
- preserve width while loading.

Forms:
- visible focus;
- small validation fade/slide;
- no aggressive shake;
- secret/BYOK text never animates into visibility.

## 9. Dialogs/sheets/popovers

Use short opacity + small translate/scale transitions.

Require:
- Escape where appropriate;
- focus trap;
- focus restore;
- safe backdrop behavior;
- mobile-friendly sizing;
- reduced-motion fallback.

## 10. Search

Search overlay opens quickly.

Results and generated answers load independently:
- first useful result must not be delayed for animation;
- generated-answer failure must not hide retrieval results;
- compact stagger only.

## 11. Tasks/Shopping/Places

Task completion should show immediate state feedback before reorder/removal.

Shopping Place groups may expand/collapse with layout animation.

Location UI may use one subtle acquisition pulse, never perpetual radar/scanning effects.

## 12. Onboarding/loading

Onboarding:
- short spotlight/card transitions;
- skip immediately available;
- no brittle animated arrows.

Loading:
- content-shaped skeletons when useful;
- short transitions;
- no artificial delay/full-page spinner unless truly necessary.

## 13. Hover/mobile/reduced motion

Use hover polish only on hover-capable pointers.

Mobile gets less motion and smaller travel distances.

Under `prefers-reduced-motion: reduce`, remove/reduce:
- smooth-scroll effects;
- stagger;
- spring travel;
- large transforms;
- animated counters.

Keep focus and essential status feedback.

## 14. Performance

Prefer transform/opacity.
Avoid continuous expensive layout/filter/blur animation.
Lazy-load genuinely heavy client-only features such as maps where supported by the current frontend stack.

## 15. Quality target

The product should feel smooth when the user navigates, captures a Note, confirms a Transaction, searches, completes a Task, expands Shopping, edits Settings, or enables Location Mode, while motion remains secondary to usefulness.
