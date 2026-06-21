# Premium Shadow System

A unified shadow model and an executable spec for an AI agent to audit and fix every shadow in a repo. The goal is shadows that read as one coherent light source across the whole product, from a tab to a full modal, never as scattered cheap defaults.

---

## 1. Why cheap shadows look cheap

Cheap shadows share a fixed set of tells. Premium shadows are defined by avoiding all of them.

| Cheap signature | Why it reads cheap | Premium fix |
|---|---|---|
| Single `box-shadow` layer | Real light has a soft penumbra. One layer has a hard, flat falloff. | Stack 2 to 4 layers (contact + penumbra) |
| `rgba(0,0,0,…)` / `#000` | Pure black is muddy and sits on top of color like dirt | Tinted cool dark color, never black |
| Non-zero X offset, random direction | Implies multiple light sources. Reads chaotic. | One overhead light: `x = 0`, shadow drops straight down |
| `blur ≈ offset` | Hard edge, looks like a drop-shadow filter | `blur ≈ 2× offset`, soft falloff |
| High alpha (`> 0.2`) on a big blur | Grey smear, kills contrast | Low alpha per layer, summed weight stays light |
| Shadow with no border | Edge of the surface dissolves into the page | Pair with a hairline border at low alpha |
| Different shadows on the same component type | No system, no light model | Everything maps to one token scale |

The unifying idea: **every shadow in the product is cast by the same virtual light**. Small and large elements differ only in how high they float, not in light direction, color, or character.

---

## 2. The unifying formula

A shadow is fully determined by one input: elevation height `h` (the conceptual resting height of the element above the surface, in px). Everything else is derived. This is what makes a tab and a modal feel like the same system.

**Invariants the agent enforces on every shadow:**

1. `offset-x = 0` always. Single overhead light.
2. `offset-y ≈ h` for the main cast layer.
3. `blur ≈ 2 × offset-y` per layer. Blur always dominates offset.
4. `spread = -(offset-y × 0.25)` on the largest layer, `0` on the contact layer. Negative spread pulls wide shadows back in so they do not bleed.
5. Layer count `n = clamp(round(log2(h)), 2, 4)`. Higher float, more penumbra layers.
6. Each layer's offset and blur is roughly **2× the previous** (geometric cascade). This exponential falloff is how real light behaves.
7. Per-layer alpha sits between `0.04` and `0.12`, decreasing as the layer grows. Total summed alpha stays at or below ~`0.30`.
8. Color is a fixed cool-dark tint token. Never `#000`.

If you only remember one line: **one light, straight down, layered, tinted, blur double the offset, alpha low.**

### The two-part anatomy of every shadow

- **Contact layer** (tight, small blur, slightly higher alpha): the ambient occlusion where the object nearly touches the surface. Grounds the element.
- **Cast layer(s)** (larger offset and blur, lower alpha): the penumbra thrown by the overhead light. Sells the float.

A shadow with only a cast layer floats untethered. A shadow with only a contact layer looks stuck. Premium needs both.

---

## 3. The token scale (light mode)

Define the tint once, derive everything from it. Drop this in your root stylesheet or token file.

```css
:root {
  /* One cool, deep tint. Never pure black. */
  --shadow-color: 220 43% 11%;

  /* xs — resting elements barely off the surface:
     tabs, chips, segmented controls, badges, inline cards */
  --shadow-xs:
    0 1px 2px -1px hsl(var(--shadow-color) / 0.10),
    0 1px 1px -0.5px hsl(var(--shadow-color) / 0.06);

  /* sm — buttons, inputs, small cards, simple tooltips */
  --shadow-sm:
    0 1px 2px -1px hsl(var(--shadow-color) / 0.10),
    0 2px 4px -1px hsl(var(--shadow-color) / 0.07),
    0 4px 6px -2px hsl(var(--shadow-color) / 0.04);

  /* md — cards, dropdowns, selects, date pickers */
  --shadow-md:
    0 1px 2px -1px hsl(var(--shadow-color) / 0.09),
    0 2px 6px -1px hsl(var(--shadow-color) / 0.07),
    0 8px 16px -4px hsl(var(--shadow-color) / 0.06);

  /* lg — popovers, menus, floating toolbars, notification toasts */
  --shadow-lg:
    0 1px 2px -1px hsl(var(--shadow-color) / 0.08),
    0 4px 8px -2px hsl(var(--shadow-color) / 0.06),
    0 12px 24px -6px hsl(var(--shadow-color) / 0.10);

  /* xl — modals, command palettes, large floating cards */
  --shadow-xl:
    0 1px 2px -1px hsl(var(--shadow-color) / 0.08),
    0 8px 16px -4px hsl(var(--shadow-color) / 0.08),
    0 24px 48px -12px hsl(var(--shadow-color) / 0.12);

  /* 2xl — dialogs over a scrim, hero / marketing float cards */
  --shadow-2xl:
    0 2px 4px -1px hsl(var(--shadow-color) / 0.06),
    0 12px 24px -6px hsl(var(--shadow-color) / 0.10),
    0 40px 72px -16px hsl(var(--shadow-color) / 0.16);
}
```

Notice the contact layer (`0 1px 2px -1px`) is nearly identical across every level. The light source never changes. Only the cast layers grow. That shared contact layer is what visually ties a chip to a modal.

### Two finishing touches that separate premium from good

**Hairline border companion.** Every surface at `md` and above pairs the shadow with a 1px border so the edge stays crisp instead of dissolving:

```css
border: 1px solid hsl(var(--shadow-color) / 0.06);
/* or, to avoid affecting layout box: */
box-shadow: …, 0 0 0 1px hsl(var(--shadow-color) / 0.05);
```

**Top inset highlight (light mode).** A 1px lit top edge simulates light catching the upper rim. Subtle, very expensive-looking on cards and buttons:

```css
box-shadow:
  inset 0 1px 0 hsl(0 0% 100% / 0.06),
  var(--shadow-md);
```

---

## 4. Dark mode

This is where most products fail. **Shadows are nearly invisible on dark surfaces** because a dark shadow on a dark background has almost no contrast. Dumping the light-mode tokens into dark mode produces flat, muddy, undefined surfaces.

The premium dark-mode model flips the strategy: **define elevation with borders and a top highlight, not with cast shadows.** Keep a faint shadow for grounding, but let a brighter top edge and a hairline border do the lifting.

```css
:root[data-theme="dark"] {
  /* Deeper, near-black tint, and shadows lean on opacity, not spread */
  --shadow-color: 220 60% 2%;

  --shadow-md:
    /* lit top edge does most of the elevation work */
    inset 0 1px 0 hsl(0 0% 100% / 0.06),
    /* hairline border for edge definition */
    0 0 0 1px hsl(0 0% 100% / 0.04),
    /* faint grounding shadow */
    0 4px 12px -2px hsl(var(--shadow-color) / 0.50),
    0 8px 24px -4px hsl(var(--shadow-color) / 0.40);

  --shadow-lg:
    inset 0 1px 0 hsl(0 0% 100% / 0.07),
    0 0 0 1px hsl(0 0% 100% / 0.05),
    0 8px 20px -4px hsl(var(--shadow-color) / 0.55),
    0 16px 40px -8px hsl(var(--shadow-color) / 0.45);

  --shadow-xl:
    inset 0 1px 0 hsl(0 0% 100% / 0.08),
    0 0 0 1px hsl(0 0% 100% / 0.06),
    0 16px 32px -8px hsl(var(--shadow-color) / 0.60),
    0 32px 64px -16px hsl(var(--shadow-color) / 0.50);
}
```

Rule of thumb: in light mode elevation reads top-down (shadow below). In dark mode elevation reads as a glowing rim (highlight above, border around). Same elevation language, inverted lighting.

---

## 5. State and motion rules

Shadows encode interaction state. The agent should wire these, not leave shadows static.

- **Hover on a liftable surface:** raise one elevation level and `transform: translateY(-1px)`. Transition both over ~150ms ease-out.
- **Pressed / active:** drop one elevation level. The element sinks toward the surface.
- **Focus:** use a separate focus ring token, not a shadow. Do not overload `box-shadow` to carry both elevation and focus unless you compose them (`var(--shadow-md), var(--ring)`).
- **Disabled:** drop to `xs` or remove. Disabled things do not float.
- **Dragging:** jump to `xl` or `2xl`. The element is in the user's hand, maximally lifted.

```css
.card {
  box-shadow: var(--shadow-sm);
  transition: box-shadow 150ms ease-out, transform 150ms ease-out;
}
.card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.card:active { box-shadow: var(--shadow-xs); transform: translateY(0); }
```

---

## 6. Colored and branded surfaces

For a brand-colored card (a colored CTA, a colored stat card), a neutral slate shadow can look disconnected. Two valid options:

1. **Keep the slate token.** Safe, neutral, always works. Default to this.
2. **Tint the shadow toward the surface hue** for a richer, more designed feel. Use the surface's hue, very low lightness, low alpha:

```css
/* a violet button casting a violet-tinted shadow */
--shadow-brand:
  0 1px 2px -1px hsl(258 60% 20% / 0.20),
  0 4px 8px -2px hsl(258 60% 30% / 0.18),
  0 12px 24px -6px hsl(258 70% 40% / 0.16);
```

Tinted brand shadows are higher risk. Use them on hero / primary actions only, never product-wide, or the UI starts to feel like a casino.

---

## 7. AI agent: repo audit and fix spec

Hand this section to the agent (Claude Code or similar) as its operating instructions.

### Step 0 — Establish the token source of truth
1. Locate or create the token definition file (`tokens.css`, `globals.css`, Tailwind config, theme file).
2. Insert the token scale from sections 3 and 4. If the project uses Tailwind, map these to `theme.extend.boxShadow` keys `xs sm md lg xl 2xl`.
3. From this point, **no raw shadow values are allowed anywhere except this file.** Every other shadow becomes a token reference.

### Step 1 — Find every shadow
Search the repo for all of: `box-shadow`, `boxShadow`, `shadow-`, `elevation`, `drop-shadow`, `filter: drop-shadow`, `.shadow(` (SCSS mixins), and platform equivalents (`shadowColor`, `shadowOffset`, `shadowRadius`, `elevation:` for RN). Build an inventory: file, line, current value, the component it styles.

### Step 2 — Classify each shadow by element type, assign a token
Map the host element to an elevation token:

| Element type | Token |
|---|---|
| Tab, chip, segmented control, badge, inline tag | `xs` |
| Button, input, text field, small card, tooltip | `sm` |
| Card, dropdown, select menu, date picker, accordion panel | `md` |
| Popover, context menu, floating toolbar, toast | `lg` |
| Modal, dialog content, command palette, large card | `xl` |
| Full-screen dialog over scrim, hero float card | `2xl` |

If an element does not fit cleanly, pick the token whose `h` is closest to the existing `offset-y`, then round to the nearest scale step.

### Step 3 — Apply the fix rules per shadow
For each found shadow, in order:
1. Replace the raw value with the mapped token reference.
2. If the shadow used `rgba(0,0,0,…)` or `#000`, that is now handled by the token tint. Confirm removed.
3. If `offset-x ≠ 0`, it is gone (token uses 0). Flag any case where the X offset looked intentional for human review.
4. For tokens `md` and above, add the hairline border companion if the element has none.
5. In light mode, add the top inset highlight on raised interactive surfaces (cards, buttons, menus).
6. Wire hover / active / disabled state shadows per section 5 if the element is interactive and lacks them.

### Step 4 — De-duplicate and unify
1. If two instances of the same component type carry different shadows, collapse both to the single mapped token.
2. If an element sits inside a parent already at the same elevation (a card inside a card with identical shadow), remove the child shadow or drop it one level. Nested identical shadows read as noise.
3. Remove any shadow stacked redundantly with a `drop-shadow` filter doing the same job.

### Step 5 — Dark mode pass
1. Confirm a dark theme exists. If shadows are defined once and reused across themes, split them: light tokens and dark tokens per section 4.
2. In dark mode, verify each elevated surface has the top highlight + border, not just a cast shadow. A dark surface with only a dark cast shadow is a bug.

### Step 6 — Report
Output a summary: count of shadows fixed, the token each maps to, every case flagged for human review (intentional directional shadows, colored brand shadows, unusual elevations), and a before/after of the token file.

### Detection heuristics for "this shadow is cheap, rewrite it"
The agent should treat any of these as a definite rewrite, not a maybe:
- Exactly one shadow layer
- Any pure black or `rgba(0,0,0,…)` shadow color
- `blur ≤ offset-y` (too hard)
- Any single-layer alpha above `0.25` (muddy)
- `offset-x ≠ 0` with no clear directional intent
- A `box-shadow` with no accompanying border on a surface at `md`+
- Two instances of one component type with differing shadows

---

## 8. The 30-second sanity check

Before shipping, eyeball any screen against these. If all pass, the shadows are premium.

1. Do all shadows fall in the **same direction** (straight down)?
2. Is the shadow color **tinted, not black**?
3. Does every elevated surface have a **soft penumbra**, not a hard edge?
4. Do **bigger elements float higher** than smaller ones, consistently?
5. Is there a **crisp border or lit edge** so surfaces do not dissolve into the page?
6. In **dark mode**, can you still see the elevation?
7. Do interactive elements **respond** on hover and press?

One light. Straight down. Layered. Tinted. Bordered. That is the whole system.
