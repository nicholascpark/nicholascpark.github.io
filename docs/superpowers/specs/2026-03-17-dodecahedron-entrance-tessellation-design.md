# Design: Dodecahedron Entrance — 3D Tessellation with Shatter

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Entrance animation for the Three.js dodecahedron scene

## Problem

The dodecahedron appears with a simple scale-in glow on page load. This doesn't match the esoteric design language of the site. The current entrance code in `scene.js` (the `ENTRANCE_DURATION`, `TRANSITION_DURATION`, `CONTAINED_SCALE`, `entranceEase()`, `transitionEase()` system and all phase logic in `animate()`) will be **replaced entirely** by this new system.

## Solution

A three-phase entrance animation where the dodecahedron's edges extend into long lines, forming a tessellated lattice of packed dodecahedron copies that fills the viewport. As the center dodecahedron grows and twists, the lattice cells morph. Then everything except the center dodecahedron shatters radially outward, leaving the original in its normal breathing state.

## Concept Reference

2D prototype: `.superpowers/brainstorm/15383-1773727435/grid-packed-v2.html`

## Architecture

All changes in `site/js/scene.js`. No new files. The existing entrance code is removed and replaced. After the entrance completes, the animation loop returns to the existing behavior exactly.

### Implementation Strategy: Pure Three.js (no 2D overlay)

The entire entrance — copies, extended lines, fragments — is rendered in Three.js. This eliminates 2D/3D sync issues entirely.

- **Copies:** `InstancedMesh` using the same `EdgesGeometry` rendered as instanced `LineSegments`. Positioned in concentric rings around the center.
- **Extended lines:** Each edge extended to length ~100 units in 3D world space. The perspective camera naturally makes them appear to fill the viewport. Rendered as additional `LineSegments` in a separate group.
- **Fragments:** `ShapeGeometry` meshes positioned in a flat plane facing the camera. On shatter, each fragment gets velocity and angular velocity, animated per frame.
- **Cleanup:** All entrance objects (copies, lines, fragments) are added to an `entranceGroup`. On completion, `scene.remove(entranceGroup)` and dispose all geometries/materials.

### Phase 1: Tessellated Lattice (0–2.5s)

**What the user sees:** Lattice fades in over ~1s. Packed dodecahedron wireframe copies with edges extended as long lines fill the viewport. No gaps. The center dodecahedron is bold/luminous. Base rotation is frozen during this phase — the 3D dodecahedron is static to establish the geometric pattern.

**Technical approach:**

1. **Freeze rotation:** During Phase 1, `group.rotation` is held at its initial values. Mouse parallax and scroll rotation are suppressed.

2. **Fade in:** All entrance objects start at opacity 0, fade to target over ~1s.

3. **Dodecahedron copies via InstancedMesh:** Use the existing `EdgesGeometry` from the center dodecahedron. Create an `InstancedMesh` (or multiple instanced `LineSegments` — Three.js supports instanced line rendering via custom shaders, but for simplicity, cloned `LineSegments` with different position transforms is acceptable for ~55 copies).

4. **Packing geometry — concentric rings:**
   - Ring 1: 5 copies at `2 * R * cos(π/5)` from center (edge-sharing distance)
   - Ring 2: 5 copies at `2 * R` from center (vertex distance)
   - Ring 3: 10 copies at `R * (cos(π/5) * 2 + 1.1)` — fills first gap ring
   - Ring 4: 15 copies at ring 3 distance + `R * 1.2`
   - Ring 5: 20 copies at ring 4 distance + `R * 1.1`
   - Total: ~55 copies. Positions are evenly spaced around each ring.
   - **Note:** Rings 3–5 distances are approximate and should be tuned visually. The exact values depend on the projection and camera FOV. Dodecahedrons don't tile the plane, so some overlap is expected and acceptable — the extended lines fill any visual gaps.

5. **Extended edge lines:** For each dodecahedron (center + copies), take each edge segment (vertex A → vertex B) and extend both ends by ~50 units along the edge direction. Render as `LineSegments` with thin, semi-transparent material. This produces ~55 × 30 = 1650 extended line segments, all in 3D.

6. **Center glow:** Set `edgeMat.opacity = 1.0` (overriding the constructor's 0.7), `faceMat.opacity = 0.05`. Copy materials use their own `LineBasicMaterial` at lower opacity (~0.3 edges).

7. **Content mask delay:** Delay `buildContentMask()` call until entrance completes (change the existing `setTimeout(buildContentMask, 400)` to fire after `SHATTER_END` seconds instead).

### Phase 2: Growth + Twist (2.5–5s)

**What the user sees:** The center dodecahedron grows and twists (~60°). All copies grow and twist with it. The extended lines shift — lattice cells morph continuously.

**Technical approach:**

1. **Scale interpolation (smoothstep):** `group.scale` lerps from `CONTAINED_SCALE (0.78)` → the current `breatheScale` value (which oscillates around 0.900–1.015). The lerp target is evaluated fresh each frame so breathing begins seamlessly.

2. **Twist:** Apply additional rotation up to `π/3` (60°) to `group.rotation.y` during growth, using smoothstep easing. This rotation is additive — after Phase 2, it becomes absorbed into the continuous base rotation.

3. **Copy and line transforms — `entranceGroup` as child of `group`:** The `entranceGroup` is a **child of `group`**. This means copies and lines automatically inherit the center dodecahedron's rotation, scale, and position transforms. Each copy only needs its local packing offset position. On cleanup, `group.remove(entranceGroup)` removes all entrance objects while leaving the center dodecahedron intact. Fragments are moved to `scene` (not `group`) at shatter time so they don't inherit ongoing rotation.

4. **Copy repositioning:** Each frame during Phase 2, recompute copy positions based on the current radius (which is growing). Scale proportionally: `copyDistance = baseDistance * (currentScale / CONTAINED_SCALE)`, where `CONTAINED_SCALE = 0.78` and `currentScale` is the current `group.scale` value. The effective contained radius is `geoRadius * CONTAINED_SCALE = 3.16 * 0.78 = 2.465`.

5. **Glow fadeout:** `edgeMat.opacity` transitions from 1.0 → normal shimmer (0.6). `faceMat.opacity` transitions from 0.05 → 0.0075. Copy opacity fades proportionally.

6. **Rotation unfreezes:** Base rotation, mouse parallax, and scroll rotation gradually resume during Phase 2 (blend from 0 → 1 influence over the growth duration).

### Phase 3: Radial Shatter (5–7.5s)

**What the user sees:** Everything except the center dodecahedron explodes radially outward. Polygon fragments fly away from center. Inner fragments go first, rippling outward. Copy wireframes fade simultaneously.

**Technical approach:**

1. **Fragment generation — pre-computed Voronoi shatter (at shatter trigger, one-time):**

   Do NOT compute fragments from actual line intersections (O(n²), fragile). Instead, use a pre-computed random Voronoi approach:

   a. Generate ~150–200 random seed points across the viewport, excluding the center dodecahedron's screen-space bounds.

   b. Compute a Voronoi diagram from these seed points (use a simple Fortune's algorithm implementation or a library — or approximate with nearest-neighbor grid cells).

   c. Each Voronoi cell becomes a fragment polygon. The cell's centroid is its position. Its shape is the cell boundary vertices (relative to centroid).

   d. If Voronoi is too complex, use a simpler approach: divide the viewport into a grid (~15×10 cells), jitter each cell center randomly, and build irregular quadrilateral/triangular fragments from the jittered grid. This is visually convincing and trivially implementable.

   e. Cap at 200 fragments. If fewer than 20 are generated (tiny viewport), proceed with what's available.

   f. Convert each fragment's screen-space centroid to world-space via `Vector3.unproject(camera)` and place the fragment on a plane at z=0 in world space.

2. **Fragment meshes:** Each fragment becomes a `Mesh` with `ShapeGeometry` (flat polygon) added directly to `scene` (not `entranceGroup` or `group`, so fragments don't inherit dodecahedron rotation). Fragments face the camera (billboard orientation).

3. **Fragment animation (per frame):**
   - Velocity: radially outward from center in world space, accelerating (`v *= 1 + dt * 0.3`)
   - Angular velocity: random spin around random axis
   - Opacity: fade from 1 → 0 over ~2s
   - Delay: distance-based (closer fragments shatter first)

4. **Copy wireframe fadeout:** All copy `LineSegments` fade opacity to 0 over ~1.5s simultaneously with shatter.

5. **Extended lines fadeout:** All extended line `LineSegments` fade opacity to 0 over ~1s.

6. **Cleanup:** Once all fragments have opacity 0 and copies are invisible:
   - Remove all fragment meshes from `scene` and dispose their geometries/materials
   - `group.remove(entranceGroup)` — removes copies and extended lines
   - Dispose all entrance geometries and materials
   - Set `entranceDone = true`
   - The original `group` (center dodecahedron) continues with the normal animation loop

### Post-Entrance (7.5s+)

The existing animation loop runs exactly as before. No entrance code executes. The original breathing, rotation, parallax, content mask, and theme reactivity are fully restored:
- `breatheScale = 0.900 + breatheEased * 0.115`
- `edgeMat.opacity = 0.6 + Math.sin(time * 0.3) * 0.15`
- `faceMat.opacity = 0.0075`

## Existing Code Removal

The following existing entrance code in `scene.js` must be **removed entirely** and replaced by the new system:

- Constants: `ENTRANCE_DURATION`, `TRANSITION_DURATION`, `CONTAINED_SCALE`, `prefersReducedMotion` entrance check
- Functions: `entranceEase()`, `transitionEase()`
- Variables: `entranceElapsed`, `entranceComplete` (old), `inEntrance`, `inTransition`, `settled`
- All phase logic inside `animate()` that references these (the scale, opacity, and rotation boost blocks)

## Retina / DPR Handling

Not applicable — everything renders through Three.js which already handles `devicePixelRatio` via `renderer.setPixelRatio()`.

## Theme Awareness

Entrance materials (copies, lines, fragments) must use the same theme-reactive color as the center dodecahedron. Read `data-theme` and set colors accordingly (platinum `0x4a4640` for light, gold `0xc9a84c` for dark). Update per frame during entrance in case the user toggles theme.

## Pentagon Vertex Markers

The existing `InstancedMesh` pentagon markers on the center dodecahedron remain visible during the entrance. Copy dodecahedrons do NOT need pentagon markers — they are secondary/peripheral elements.

## Reduced Motion

If `prefers-reduced-motion: reduce` is set, skip the entrance entirely — set `entranceDone = true` immediately, no entrance objects created. The dodecahedron appears at its normal breathing scale from frame 1.

## Files Changed

| Action | Path | Reason |
|--------|------|--------|
| **Modify** | `site/js/scene.js` | Remove old entrance, add new tessellation entrance system |

## Files NOT Changed

- `index.html`, `site/css/style.css`, `site/js/render.js`, `site/js/breathe.js`
- `nicholas.yaml`, `outputs/`, `identity/`, `generate.py`

## Performance Considerations

- ~55 cloned `LineSegments` + ~1650 extended line segments during entrance. Manageable for modern GPUs.
- Fragment generation (Voronoi/jittered grid computation) runs once at shatter trigger. Cap at ~200 fragments to avoid frame spike.
- All entrance objects are disposed after completion — zero ongoing cost.
- Content mask build is delayed until entrance completes.

## Out of Scope

- Mobile-specific tuning (fewer copies on small screens — can be added later)
- Configurable timing (hardcoded constants are fine for a personal site)
