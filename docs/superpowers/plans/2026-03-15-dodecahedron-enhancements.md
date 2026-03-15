# Dodecahedron Site Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 cohesive visual enhancements that connect the 3D dodecahedron background to the content layer through a shared timing system.

**Architecture:** Scene.js exports CSS custom properties (`--dodeca-breathe`, `--dodeca-rx/ry/rz`) that CSS and render.js consume. Effects are grouped into three temporal layers: load-once, scroll-triggered, and continuous. No dodecahedron geometry/materials/colors are modified.

**Tech Stack:** Three.js (existing), vanilla JS, CSS custom properties, CSS animations

**Spec:** `docs/superpowers/specs/2026-03-15-dodecahedron-enhancements-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `site/js/scene.js` | Modify (lines 228-256) | Time bridge exports, pentagon depth-scaling |
| `site/js/render.js` | Modify | Typewriter, mouse glow tracking, parallax, footer coordinates |
| `site/css/style.css` | Modify | Divider animation, border pulse, mouse glow, typewriter cursor, footer coords, parallax `will-change`, `prefers-reduced-motion` |

---

## Chunk 1: Foundation + Scene.js Changes

### Task 1: Time Bridge — Export CSS Custom Properties from scene.js

**Files:**
- Modify: `site/js/scene.js:248-255` (end of animation loop, before `renderer.render`)

- [ ] **Step 1: Add time bridge exports to the animation loop**

At the end of `animate()`, just before `renderer.render(scene, camera);` (line 255), add:

```javascript
    // --- Time bridge: export state to CSS custom properties ---
    var docStyle = document.documentElement.style;
    docStyle.setProperty('--dodeca-breathe', (Math.sin(time * 0.5) * 0.5 + 0.5).toFixed(3));
    docStyle.setProperty('--dodeca-rx', ((group.rotation.x * 180 / Math.PI) % 360).toFixed(1));
    docStyle.setProperty('--dodeca-ry', ((group.rotation.y * 180 / Math.PI) % 360).toFixed(1));
    docStyle.setProperty('--dodeca-rz', ((group.rotation.z * 180 / Math.PI) % 360).toFixed(1));
```

- [ ] **Step 2: Verify in browser devtools**

Open http://localhost:8765, inspect `<html>` element. Confirm `--dodeca-breathe` oscillates between 0.000 and 1.000. Confirm `--dodeca-rx/ry/rz` update continuously with degree values.

- [ ] **Step 3: Commit**

```bash
git add site/js/scene.js
git commit -m "feat: add time bridge — export dodecahedron state as CSS custom properties"
```

---

### Task 2: Pentagon Depth-Scaling

**Files:**
- Modify: `site/js/scene.js:228-245` (billboard pentagon loop)

- [ ] **Step 1: Add depth-based scaling to the billboard loop**

In the `animate()` function, modify the billboard loop. The current code at lines 230-244:

```javascript
    uniqueVertices.forEach((v, i) => {
      dummy.position.set(v.x, v.y, v.z);
      // Apply group's world rotation to get world position
      dummy.position.applyMatrix4(group.matrixWorld);
      dummy.quaternion.copy(camQuat);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();

      // But we need position in group-local space for the InstancedMesh
      // So: set local position, apply inverse group rotation to camera quat
      dummy.position.set(v.x, v.y, v.z);
      const invGroupQuat = group.quaternion.clone().invert();
      dummy.quaternion.copy(camQuat).premultiply(invGroupQuat);
      dummy.updateMatrix();
      pentMesh.setMatrixAt(i, dummy.matrix);
    });
```

Replace with:

```javascript
    uniqueVertices.forEach((v, i) => {
      dummy.position.set(v.x, v.y, v.z);
      // Apply group's world rotation to get world position
      dummy.position.applyMatrix4(group.matrixWorld);

      // Depth-based scaling: front vertices larger, rear smaller
      var depthZ = dummy.position.z;
      var depthScale = THREE.MathUtils.clamp(
        THREE.MathUtils.mapLinear(depthZ, -3, 3, 0.4, 1.8),
        0.4, 1.8
      );

      // We need position in group-local space for the InstancedMesh
      // Set local position, apply inverse group rotation to camera quat
      dummy.position.set(v.x, v.y, v.z);
      const invGroupQuat = group.quaternion.clone().invert();
      dummy.quaternion.copy(camQuat).premultiply(invGroupQuat);
      dummy.scale.setScalar(depthScale);
      dummy.updateMatrix();
      pentMesh.setMatrixAt(i, dummy.matrix);
    });
```

Key changes:
- Capture `depthZ` from world-space position BEFORE the local-space overwrite
- Remove the first `dummy.updateMatrix()` call (was unnecessary — the second one is the one that matters)
- Apply `depthScale` instead of `setScalar(1)`

- [ ] **Step 2: Verify in browser**

Open http://localhost:8765. Confirm pentagons on the front face of the dodecahedron appear larger than those on the rear. As the dodecahedron rotates, pentagons should smoothly grow and shrink. The wireframe edges and colors should be completely unchanged.

- [ ] **Step 3: Commit**

```bash
git add site/js/scene.js
git commit -m "feat: add depth-based pentagon vertex scaling"
```

---

## Chunk 2: CSS Enhancements (style.css)

> **Note:** All line numbers in this chunk reference the **original unmodified** `style.css`. When executing sequentially, locate targets by their CSS selector/comment text rather than line number, since earlier tasks shift line positions.

### Task 3: Animated Section Divider Lines

**Files:**
- Modify: `site/css/style.css:183-206` (section-divider rules)

- [ ] **Step 1: Add draw-line keyframe and update divider styles**

After the existing `.section-divider svg` rule (line 206), add the keyframe. Then modify the existing divider pseudo-element and SVG rules:

Replace the entire section-divider block (lines 183-206) with:

```css
/* --- Sacred divider between sections --- */

.section-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: calc(var(--spacing-unit) * 2.5) 0;
  gap: 1.2rem;
  opacity: 0.3;
}

.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-gold-dim), transparent);
  transform: scaleX(0);
  transition: transform 0.6s ease-out;
}

.section-divider.revealed::before,
.section-divider.revealed::after {
  transform: scaleX(1);
}

.section-divider svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.4s ease-out 0.6s;
}

.section-divider.revealed svg {
  opacity: 1;
}
```

- [ ] **Step 2: Verify in browser**

Scroll down on the site. Divider lines should draw in from center when they enter the viewport. The SVG symbol should fade in after the lines complete.

- [ ] **Step 3: Commit**

```bash
git add site/css/style.css
git commit -m "feat: add draw-in animation for section divider lines"
```

---

### Task 4: Living Left-Border Pulse on Interest Items

**Files:**
- Modify: `site/css/style.css:243-248` (interests-list li rules)

- [ ] **Step 1: Update interest item border to read --dodeca-breathe**

Replace the existing `.interests-list li` rule (lines 243-248):

```css
.interests-list li {
  padding: calc(var(--spacing-unit) * 0.6) calc(var(--spacing-unit) * 0.8);
  border-left: 2px solid rgba(160, 133, 64, calc(0.15 + var(--dodeca-breathe, 0) * 0.15));
  border-radius: 0 8px 8px 0;
  transition: border-color 0.4s ease, background 0.4s ease, box-shadow 0.4s ease;
}
```

The hover rule (line 250-254) stays as-is — `border-left-color: var(--color-gold)` overrides the pulse on hover.

- [ ] **Step 2: Verify in browser**

The left border on interest items should subtly pulse in sync with the dodecahedron's breathing. On hover, it should snap to solid gold.

- [ ] **Step 3: Commit**

```bash
git add site/css/style.css
git commit -m "feat: sync interest border pulse with dodecahedron breathing"
```

---

### Task 5: Mouse Proximity Glow (CSS portion)

**Files:**
- Modify: `site/css/style.css:69-77` (after #root rule)

- [ ] **Step 1: Add mouse glow pseudo-element**

After the `#root` rule (line 77), add:

```css
/* --- Mouse proximity glow --- */

#root::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: radial-gradient(
    300px at var(--mouse-x, -300px) var(--mouse-y, -300px),
    rgba(160, 133, 64, 0.06),
    transparent
  );
  border-radius: inherit;
}

@media (hover: none) {
  #root::before {
    display: none;
  }
}
```

The default value of `-300px` hides the glow until JS sets the mouse position.

- [ ] **Step 2: Verify in browser**

Move cursor over content area — a very subtle gold glow should follow the mouse. On mobile viewport (resize to narrow), the glow should not appear.

- [ ] **Step 3: Commit**

```bash
git add site/css/style.css
git commit -m "feat: add mouse proximity glow pseudo-element"
```

---

### Task 6: Typewriter Cursor + Parallax + Footer + Reduced Motion (CSS)

**Files:**
- Modify: `site/css/style.css` (multiple locations)

- [ ] **Step 1: Add typewriter cursor styles**

After the `.site-header .tagline` rule (line 137), add:

```css
/* --- Typewriter cursor --- */

@keyframes blink {
  from, to { opacity: 1; }
  50% { opacity: 0; }
}

.tagline.typing::after {
  content: '|';
  animation: blink 0.7s step-end infinite;
  margin-left: 1px;
  color: var(--color-gold);
}
```

- [ ] **Step 2: Add will-change for parallax on section titles**

In the existing `.section-title` rule (line 214), add one property:

```css
.section-title {
  font-family: var(--font-serif);
  font-weight: 500;
  font-size: 1.4rem;
  margin-bottom: calc(var(--spacing-unit) * 1.2);
  color: var(--color-gold);
  letter-spacing: 0.02em;
  will-change: transform;
}
```

- [ ] **Step 3: Add footer coordinate styles**

After the existing `.site-footer a:hover` rule (line 346), add:

```css
.footer-coords {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.7rem;
  color: var(--color-text-dim);
  letter-spacing: 0.08em;
  margin-top: 0.4rem;
  opacity: 0.6;
}
```

- [ ] **Step 4: Add prefers-reduced-motion overrides**

Before the `/* --- Loading state --- */` comment (line 448), add:

```css
/* --- Reduced motion --- */

@media (prefers-reduced-motion: reduce) {
  .tagline.typing::after {
    display: none;
  }

  .section-title {
    will-change: auto;
  }

  .interests-list li {
    border-left-color: var(--color-border);
  }

  .section-divider::before,
  .section-divider::after {
    transform: scaleX(1);
    transition: none;
  }

  .section-divider svg {
    opacity: 1;
    transition: none;
  }

  .reveal {
    transition-duration: 0.01s;
  }

  .reveal-stagger > * {
    transition-duration: 0.01s;
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add site/css/style.css
git commit -m "feat: add typewriter cursor, parallax will-change, footer coords, reduced-motion"
```

---

## Chunk 3: JavaScript Enhancements (render.js)

### Task 7: Typewriter Effect

**Files:**
- Modify: `site/js/render.js:86-94` (renderHeader tagline section)
- Modify: `site/js/render.js` (add typewrite utility function)

- [ ] **Step 1: Add typewrite utility function**

After the `elText` function (line 256), add:

```javascript
/* --- Typewriter effect --- */

function typewrite(el, text, speed) {
  speed = speed || 40;

  // Accessibility: screen readers get the full text immediately
  el.setAttribute('aria-label', text);
  el.textContent = '';
  el.classList.add('typing');

  // Respect reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = text;
    el.classList.remove('typing');
    return;
  }

  var i = 0;
  var interval = setInterval(function () {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) {
      clearInterval(interval);
      setTimeout(function () { el.classList.remove('typing'); }, 1000);
    }
  }, speed);
}
```

- [ ] **Step 2: Modify renderHeader to use typewriter**

In `renderHeader` (lines 91-94), change:

FROM:
```javascript
  // Tagline
  const tagline = el('p', 'tagline');
  tagline.textContent = 'Software Engineer \u00b7 AI Agents \u00b7 Applied Cognition';
  header.appendChild(tagline);
```

TO:
```javascript
  // Tagline — typed in after header reveals
  const TAGLINE_TEXT = 'Software Engineer \u00b7 AI Agents \u00b7 Applied Cognition';
  const tagline = el('p', 'tagline');
  tagline.setAttribute('aria-label', TAGLINE_TEXT);
  header.appendChild(tagline);

  // Start typewriter after header reveal transition completes
  header.addEventListener('transitionend', function onReveal(e) {
    if (e.target !== header) return;
    header.removeEventListener('transitionend', onReveal);
    typewrite(tagline, TAGLINE_TEXT);
  });
```

- [ ] **Step 3: Verify in browser**

Reload the page. The tagline should be empty when the header first reveals, then type in character-by-character with a blinking cursor. The cursor should disappear ~1s after typing finishes.

- [ ] **Step 4: Commit**

```bash
git add site/js/render.js
git commit -m "feat: add typewriter effect on tagline reveal"
```

---

### Task 8: Mouse Glow Tracking (JS portion)

**Files:**
- Modify: `site/js/render.js:28-31` (after initScrollReveals call)

- [ ] **Step 1: Add mouse tracking after scroll reveals init**

After the `initScrollReveals();` line (line 30), add:

```javascript
    // Mouse proximity glow tracking
    initMouseGlow(root);
```

Then after the `initScrollReveals` function (line 276), add:

```javascript
/* --- Mouse proximity glow --- */

function initMouseGlow(root) {
  if (window.matchMedia('(hover: none)').matches) return;

  root.addEventListener('mousemove', function (e) {
    // Coordinates must be relative to #root, not viewport,
    // since the ::before pseudo-element is positioned relative to #root
    var rect = root.getBoundingClientRect();
    root.style.setProperty('--mouse-x', (e.clientX - rect.left) + 'px');
    root.style.setProperty('--mouse-y', (e.clientY - rect.top) + 'px');
  });
}
```

- [ ] **Step 2: Verify in browser**

Move cursor across the content area. A very subtle gold radial glow should follow the cursor position.

- [ ] **Step 3: Commit**

```bash
git add site/js/render.js
git commit -m "feat: add mouse proximity glow tracking"
```

---

### Task 9: Content Parallax

**Files:**
- Modify: `site/js/render.js` (after initMouseGlow call, and new function)

- [ ] **Step 1: Add parallax init after mouse glow**

After the `initMouseGlow(root);` line, add:

```javascript
    // Subtle content parallax
    initParallax();
```

Then after the `initMouseGlow` function, add:

```javascript
/* --- Subtle content parallax --- */

function initParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var titles = document.querySelectorAll('.section-title');
  var ticking = false;

  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var vh = window.innerHeight;
      titles.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        var offset = (rect.top / vh - 0.5) * 8;
        el.style.transform = 'translateY(' + offset.toFixed(1) + 'px)';
      });
      ticking = false;
    });
  }, { passive: true });
}
```

- [ ] **Step 2: Verify in browser**

Scroll through the page. Section titles ("About", "Interests", "Selected Work") should move slightly slower than their surrounding content — a very subtle 8px max offset. Should feel like gentle layered depth, not jarring.

- [ ] **Step 3: Commit**

```bash
git add site/js/render.js
git commit -m "feat: add subtle content parallax on section titles"
```

---

### Task 10: Geometric Footer Coordinates

**Files:**
- Modify: `site/js/render.js:228-234` (renderFooter function)

- [ ] **Step 1: Update renderFooter to include coordinate display**

Replace the existing `renderFooter` function (lines 228-234):

```javascript
function renderFooter(profile) {
  const footer = el('footer', 'site-footer reveal');
  const p = document.createElement('p');
  p.innerHTML = `&copy; ${new Date().getFullYear()} ${profile.name}`;
  footer.appendChild(p);

  // Live dodecahedron rotation coordinates
  const coords = el('p', 'footer-coords');
  coords.textContent = '\u25CB x: 0.0\u00B0  y: 0.0\u00B0  z: 0.0\u00B0';
  footer.appendChild(coords);

  // Update coordinates from scene.js CSS custom properties
  // Read from .style directly (not getComputedStyle) to avoid forced recalc
  function updateCoords() {
    var s = document.documentElement.style;
    var rx = s.getPropertyValue('--dodeca-rx') || '0.0';
    var ry = s.getPropertyValue('--dodeca-ry') || '0.0';
    var rz = s.getPropertyValue('--dodeca-rz') || '0.0';
    coords.textContent = '\u25CB x: ' + rx.trim() + '\u00B0  y: ' + ry.trim() + '\u00B0  z: ' + rz.trim() + '\u00B0';
    requestAnimationFrame(updateCoords);
  }
  requestAnimationFrame(updateCoords);

  return footer;
}
```

- [ ] **Step 2: Verify in browser**

Scroll to the footer. Below the © line, you should see live-updating rotation coordinates in a monospaced, muted style. The values should change continuously as the dodecahedron rotates.

- [ ] **Step 3: Commit**

```bash
git add site/js/render.js
git commit -m "feat: add live dodecahedron rotation coordinates to footer"
```

---

## Chunk 4: Final Verification

### Task 11: End-to-End Verification

- [ ] **Step 1: Full page walkthrough**

Open http://localhost:8765 in a fresh browser tab. Verify the complete experience:

1. Page loads → header reveals → tagline types in with blinking cursor
2. Cursor disappears after typing completes
3. Scroll down → divider lines draw in from center, SVG fades in after
4. Sections and grid items stagger-reveal on scroll
5. Section titles have subtle parallax offset while scrolling
6. Interest item left-borders pulse in sync with dodecahedron breathing
7. Mouse cursor creates a soft gold glow over content area
8. Pentagon vertices on the dodecahedron scale with depth (front = larger)
9. Footer shows live rotation coordinates
10. Dodecahedron edges, colors, and thickness are identical to before

- [ ] **Step 2: Check mobile viewport**

Resize browser to 375px width. Verify:
- Mouse glow does not appear
- Typewriter still fires
- Layout remains intact
- Parallax still works (reduced naturally by narrower viewport)

- [ ] **Step 3: Check reduced motion**

In browser devtools, enable "prefers-reduced-motion: reduce". Verify:
- Tagline shows full text immediately (no typewriter)
- No blinking cursor
- Borders are static (no pulse)
- Dividers appear immediately (no draw-in animation)
- Section titles have no parallax offset

- [ ] **Step 4: Final commit (if any uncommitted fixes remain)**

```bash
git add site/js/scene.js site/js/render.js site/css/style.css
git commit -m "feat: complete dodecahedron site enhancements — unified timing system"
```
