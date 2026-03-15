# Dodecahedron Site Enhancements — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Scope:** 7 cohesive enhancements to the personal site, unified by a shared timing system

## Overview

Add depth, dynamism, and connection between the 3D dodecahedron background and the content layer. All effects share a unified rhythm anchored to the dodecahedron's existing breathing cycle. The dodecahedron's geometry, materials, colors, and thickness are never modified.

## Architecture: Unified Timing Bridge

Scene.js exports CSS custom properties at the end of its existing animation loop:

- `--dodeca-breathe`: 0→1→0 sine wave synced to the dodecahedron's breathing (`sin(time * 0.5) * 0.5 + 0.5`)
- `--dodeca-rx`, `--dodeca-ry`, `--dodeca-rz`: live rotation angles in degrees (converted from radians via `* 180 / Math.PI`, modulo 360)

These are set on `document.documentElement.style`. CSS and render.js read them. Zero coupling beyond custom properties.

### Three Temporal Layers

- **Layer 1 — Load (once):** Header reveal → typewriter tagline (triggered by header `transitionend`) → remaining section reveals
- **Layer 2 — Scroll (on demand):** Divider lines draw in → SVG fades → sections stagger in; content parallax
- **Layer 3 — Continuous (always):** Pentagon depth-scaling, border pulse, mouse glow, footer coordinates

## Effects

### 1. Depth-Scaled Pentagon Vertices

**File:** `site/js/scene.js` (animation loop, billboard section)

In the existing billboard loop, the world-space position is already computed at `dummy.position.applyMatrix4(group.matrixWorld)`. Capture `dummy.position.z` at that point (before the local-space overwrite on the next line) and use it to scale:

- Front-facing vertices (higher Z in camera space): scale up to ~1.8x
- Rear vertices: scale down to ~0.4x
- Mapping: `THREE.MathUtils.mapLinear(depthZ, -3, 3, 0.4, 1.8)`, clamped
- The range (-3, 3) covers the dodecahedron's radius (2.8) plus slight breathing overshoot

After the local-space position is restored and quaternion is set, apply `dummy.scale.setScalar(clampedScale)` before `dummy.updateMatrix()`. No geometry or material changes.

### 2. Mouse Proximity Glow on Content

**Files:** `site/js/render.js`, `site/css/style.css`

A `#root::before` pseudo-element with `radial-gradient(300px at var(--mouse-x) var(--mouse-y), rgba(160,133,64,0.06), transparent)` follows the cursor. Render.js tracks mousemove on `#root` and sets `--mouse-x`/`--mouse-y` custom properties.

- `#root::before` requires `position: absolute; inset: 0; pointer-events: none; z-index: 0;`
- `#root` already has `position: relative` (confirmed)
- Radius: ~300px
- Color: `rgba(160,133,64,0.06)` — barely visible, atmospheric
- Disabled on touch devices via `@media (hover: none) { #root::before { display: none; } }`

### 3. Subtle Content Parallax

**File:** `site/js/render.js`

On scroll, `.section-title` elements get a `translateY` offset based on viewport position:

```
offset = (rect.top / window.innerHeight - 0.5) * 8
```

- Maximum shift: ~8px
- Applied via passive scroll listener with rAF throttle
- `.section-title` should receive `will-change: transform` in CSS to promote to compositing layer
- Disabled when `prefers-reduced-motion: reduce`

### 4. Animated Section Divider Lines

**File:** `site/css/style.css`

When `.section-divider` receives the `.revealed` class (from existing IntersectionObserver):

- `::before` and `::after` pseudo-elements animate via `scaleX` transform from 0 to 1 over 0.6s ease-out (using `scaleX` instead of `max-width` to work reliably with the existing `flex: 1` layout)
- SVG symbol fades in 0.4s ease-out with **0.6s delay** (sequenced after lines finish)

Initial state: `::before`/`::after` have `transform: scaleX(0)`, SVG has `opacity: 0`. The `.revealed` class triggers both animations.

### 5. Living Left-Border on Interest Items

**File:** `site/css/style.css`

The existing `border-left` on `.interests-list li` reads `--dodeca-breathe`:

```css
border-left-color: rgba(160, 133, 64, calc(0.15 + var(--dodeca-breathe, 0) * 0.15));
```

- Resting: opacity 0.15 → peak: opacity 0.30
- On hover: jumps to full `var(--color-gold)` (overrides the pulse)
- Falls back gracefully to 0 if the custom property isn't set
- Disabled when `prefers-reduced-motion: reduce` (static 0.15)

### 6. Typewriter Reveal on Tagline

**File:** `site/js/render.js` (renderHeader function), `site/css/style.css`

The tagline element is created with `textContent = ''` (not pre-filled). The full string is stored in a variable. The typewriter is triggered by listening for `transitionend` on the header element (which fires when the `.reveal` → `.revealed` transition completes):

- Speed: ~40ms per character
- Text: "Software Engineer · AI Agents · Applied Cognition" (~42 chars = ~1.7s)
- Blinking cursor via CSS `::after` on a `.typing` class: `content: '|'; animation: blink 0.7s step-end infinite`
- Cursor disappears 1s after typing completes (`.typing` class removed)
- Fires once — the `transitionend` listener removes itself after first fire
- Accessibility: `aria-label` set to full text on the tagline element so screen readers get the complete text immediately
- When `prefers-reduced-motion: reduce`: skip typewriter, set full text immediately

### 7. Geometric Footer Detail

**Files:** `site/js/scene.js` (exports rotation), `site/js/render.js` (renderFooter)

Below the © line, display live dodecahedron rotation as coordinates:

```
© 2026 Nicholas C. Park
○ x: 47.2°  y: 128.6°  z: 11.4°
```

- Monospaced, muted color (`--color-text-dim`), small font (~0.7rem)
- Scene.js sets `--dodeca-rx/ry/rz` as CSS custom properties each frame (radians → degrees conversion: `(angle * 180 / Math.PI) % 360`)
- Render.js creates a `requestAnimationFrame` loop to read the CSS custom properties and update the text node. This is a second rAF loop alongside scene.js's — acceptable cost for a single text update per frame.
- Letter-spacing: 0.08em for the instrument readout feel

## Files Modified

- `site/js/scene.js` — time bridge exports (~4 lines at end of animation loop), depth-scale logic in billboard loop (~5 lines)
- `site/js/render.js` — typewriter function, mouse tracking, parallax scroll handler, footer update loop
- `site/css/style.css` — divider animation keyframes, border pulse, mouse glow pseudo-element, typing cursor, footer coordinate styling, `will-change` for parallax, `prefers-reduced-motion` overrides

## Constraints

- Dodecahedron geometry, materials, colors, and edge thickness are never changed
- All enhancements are additive to existing code
- Content-aware mask system remains unchanged
- Mobile: mouse glow disabled via `@media (hover: none)`, parallax reduced, typewriter still fires
- `prefers-reduced-motion: reduce`: disables typewriter animation, parallax, and border pulse
