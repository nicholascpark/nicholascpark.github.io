# Dodecahedron Entrance Tessellation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simple scale-in entrance with a 3D tessellated lattice that morphs and shatters radially, leaving only the center dodecahedron.

**Architecture:** Pure Three.js — copies, extended lines, and shatter fragments all rendered in the Three.js scene. `entranceGroup` is a child of `group` so copies inherit transforms. Fragments are added to `scene` directly so they don't inherit dodecahedron rotation. All entrance objects disposed after completion.

**Tech Stack:** Three.js (already loaded via CDN), vanilla JS

**Spec:** `docs/superpowers/specs/2026-03-17-dodecahedron-entrance-tessellation-design.md`

---

## Chunk 1: Remove old entrance, establish new skeleton

### Task 1: Remove existing entrance code and establish new entrance constants

**Files:**
- Modify: `site/js/scene.js`

- [ ] **Step 1: Remove old entrance system**

In `scene.js`, remove the following blocks (lines 206–226 and all entrance phase logic in `animate()` lines 243–324):

Remove these constants/functions/variables:
```javascript
// REMOVE: lines 206-226
const ENTRANCE_DURATION = 2.0;
const TRANSITION_DURATION = 1.5;
const CONTAINED_SCALE = 0.78;
var prefersReducedMotion = ...;
let entranceElapsed = ...;
function entranceEase(t) { ... }
function transitionEase(t) { ... }
```

In the `animate()` function, remove:
```javascript
// REMOVE: lines 243-256 (entrance progress computation)
entranceElapsed += dt;
var totalDuration = ...;
var inEntrance = ...;
var inTransition = ...;
var settled = ...;
var entranceT = ...;
var entranceProgress = ...;
var transitionT = ...;
var transitionProgress = ...;

// REMOVE: lines 262-267 (entrance rotation boost)
var entranceRotBoost = ...;
// Replace the rotation lines with simple versions (no boost)

// REMOVE: lines 299-313 (entrance scale logic)
var finalScale;
if (settled) { ... } else if (inTransition) { ... } else { ... }
// Replace with: group.scale.setScalar(breatheScale);

// REMOVE: lines 315-324 (entrance glow logic)
var glowIntensity = ...;
// Replace with normal opacity assignments
```

- [ ] **Step 2: Add new entrance constants and state**

Add this block after the content mask section (after line 197), before the resize handler:

```javascript
/* --- Entrance: tessellated lattice with shatter --- */
const ENTRANCE = {
  LATTICE_HOLD: 2.5,      // seconds: static lattice visible
  GROW_END: 5.0,           // seconds: growth + twist complete
  SHATTER_START: 5.0,      // seconds: shatter begins
  SHATTER_END: 7.5,        // seconds: all fragments gone
  CONTAINED_SCALE: 0.78,   // fits within viewport
  TWIST_AMOUNT: Math.PI / 3, // 60 degrees twist during growth
  GEO_RADIUS: 3.16,        // dodecahedron geometry radius
};

var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let entranceDone = prefersReducedMotion;
let entranceElapsed = 0;
let entranceGroup = null;  // child of group — copies + extended lines
let entranceFragments = []; // added to scene — shatter pieces
let entranceCopies = [];    // references to copy LineSegments
let entranceLines = null;   // extended line LineSegments

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}
```

- [ ] **Step 3: Update content mask delay**

Change line 193. When entrance is active, don't auto-build the mask — the cleanup code in Phase 3 calls `buildContentMask()` directly when the entrance finishes. This avoids double-fire.

```javascript
// Before
setTimeout(buildContentMask, 400);

// After
if (prefersReducedMotion || entranceDone) {
  setTimeout(buildContentMask, 400);
}
// Otherwise, buildContentMask() is called from entrance cleanup in Phase 3
```

- [ ] **Step 4: Simplify animate() to work without entrance (baseline)**

The `animate()` function should now have clean rotation, scale, and opacity with no entrance logic — just the normal post-entrance behavior. This is the baseline we build on top of.

Rotation (replace the entranceRotBoost lines):
```javascript
group.rotation.x = time * baseRotationSpeed * 0.7 + mouseY * 0.3 + scrollProgress * Math.PI * 0.5;
group.rotation.y = time * baseRotationSpeed + mouseX * 0.3 + scrollProgress * Math.PI * 0.3;
group.rotation.z = time * baseRotationSpeed * 0.3;
```

Scale (replace the phase logic):
```javascript
group.scale.setScalar(breatheScale);
```

Opacity (replace the glow logic):
```javascript
edgeMat.opacity = 0.6 + Math.sin(time * 0.3) * 0.15;
faceMat.opacity = 0.0075;
```

- [ ] **Step 5: Verify site loads and dodecahedron works normally**

Run: `python3 -m http.server 8000`
Open `http://localhost:8000`. Verify:
- Dodecahedron appears at full breathing size immediately (no entrance)
- Breathing, rotation, parallax, theme toggle all work
- No console errors

- [ ] **Step 6: Commit**

```bash
git add site/js/scene.js
git commit -m "refactor: remove old entrance, add new tessellation entrance skeleton"
```

---

## Chunk 2: Build entrance group — copies and extended lines

### Task 2: Create dodecahedron copies in concentric rings

**Files:**
- Modify: `site/js/scene.js`

- [ ] **Step 1: Add copy generation function**

Add after the entrance constants block:

```javascript
function createEntranceCopies() {
  entranceGroup = new THREE.Group();
  group.add(entranceGroup);

  var R = ENTRANCE.GEO_RADIUS;
  var copyMat = new THREE.LineBasicMaterial({
    color: initColor,
    transparent: true,
    opacity: 0,  // starts invisible, fades in
  });

  // Ring positions: [count, distance] — matches spec (~55 copies total)
  var d1 = 2 * R * Math.cos(Math.PI / 5);  // edge-sharing distance
  var rings = [
    [5,  d1],                  // Ring 1: edge-sharing
    [5,  2 * R],               // Ring 2: vertex distance
    [10, d1 + R * 1.1],        // Ring 3: fills first gap
    [15, d1 + R * 1.1 + R * 1.2], // Ring 4
    [20, d1 + R * 1.1 + R * 1.2 + R * 1.1], // Ring 5
  ];

  rings.forEach(function (ring) {
    var count = ring[0];
    var dist = ring[1];
    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2;
      var copy = new THREE.LineSegments(edgeGeo, copyMat.clone());
      copy.position.set(
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        0
      );
      copy.userData.baseDistance = dist;
      copy.userData.angle = angle;
      entranceGroup.add(copy);
      entranceCopies.push(copy);
    }
  });

  return copyMat;
}
```

- [ ] **Step 2: Add initialization call**

Add before the animation loop starts (before `requestAnimationFrame(animate)`):

```javascript
var entranceCopyMat = null;
if (!entranceDone) {
  entranceCopyMat = createEntranceCopies();
  // Start at contained scale
  group.scale.setScalar(ENTRANCE.CONTAINED_SCALE);
}
```

- [ ] **Step 3: Verify copies appear**

Temporarily set `copyMat` opacity to 0.3 in the constructor, run the server, verify ~65 wireframe copies surround the center dodecahedron. Then revert opacity to 0.

- [ ] **Step 4: Commit**

```bash
git add site/js/scene.js
git commit -m "feat: create dodecahedron copies in concentric rings"
```

### Task 3: Create extended edge lines

**Files:**
- Modify: `site/js/scene.js`

- [ ] **Step 1: Add extended lines function**

Add after `createEntranceCopies()`:

```javascript
function createExtendedLines() {
  // Get edge pairs from the EdgesGeometry
  var edgePositions = edgeGeo.attributes.position;
  var edgeCount = edgePositions.count / 2; // 2 vertices per edge segment

  // For each copy + center, extend each edge to ~50 units both directions
  var allVertices = [];
  var EXT_LENGTH = 50;

  // Process one dodecahedron's edges at an offset position
  function addExtendedEdges(offsetX, offsetY, offsetZ) {
    for (var i = 0; i < edgeCount; i++) {
      var ax = edgePositions.getX(i * 2) + offsetX;
      var ay = edgePositions.getY(i * 2) + offsetY;
      var az = edgePositions.getZ(i * 2) + offsetZ;
      var bx = edgePositions.getX(i * 2 + 1) + offsetX;
      var by = edgePositions.getY(i * 2 + 1) + offsetY;
      var bz = edgePositions.getZ(i * 2 + 1) + offsetZ;

      var dx = bx - ax, dy = by - ay, dz = bz - az;
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 0.001) continue;
      var nx = dx / len, ny = dy / len, nz = dz / len;

      // Extended line: A - EXT to B + EXT
      allVertices.push(
        ax - nx * EXT_LENGTH, ay - ny * EXT_LENGTH, az - nz * EXT_LENGTH,
        bx + nx * EXT_LENGTH, by + ny * EXT_LENGTH, bz + nz * EXT_LENGTH
      );
    }
  }

  // Center dodecahedron
  addExtendedEdges(0, 0, 0);

  // All copies
  entranceCopies.forEach(function (copy) {
    addExtendedEdges(copy.position.x, copy.position.y, copy.position.z);
  });

  var lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));

  var lineMat = new THREE.LineBasicMaterial({
    color: initColor,
    transparent: true,
    opacity: 0, // starts invisible
  });

  entranceLines = new THREE.LineSegments(lineGeo, lineMat);
  entranceGroup.add(entranceLines);

  return lineMat;
}
```

- [ ] **Step 2: Call from initialization**

Update the init block:

```javascript
var entranceCopyMat = null;
var entranceLineMat = null;
if (!entranceDone) {
  entranceCopyMat = createEntranceCopies();
  entranceLineMat = createExtendedLines();
  group.scale.setScalar(ENTRANCE.CONTAINED_SCALE);
}
```

- [ ] **Step 3: Verify lines appear**

Temporarily set `lineMat` opacity to 0.15, serve, verify long lines extending from all dodecahedrons fill the viewport. Then revert opacity to 0.

- [ ] **Step 4: Commit**

```bash
git add site/js/scene.js
git commit -m "feat: create extended edge lines from all dodecahedron copies"
```

---

## Chunk 3: Phase 1 and Phase 2 animation

### Task 4: Implement Phase 1 — lattice fade-in with frozen rotation

**Files:**
- Modify: `site/js/scene.js`

- [ ] **Step 1: Add entrance update logic to animate()**

In the `animate()` function, add entrance logic right after the `time += 0.01;` line. This block controls scale, rotation, and opacity based on entrance phase.

```javascript
    // --- Entrance system ---
    if (!entranceDone) {
      entranceElapsed += dt;
      var fadeIn = Math.min(entranceElapsed / 1.0, 1); // 1s fade in

      if (entranceElapsed < ENTRANCE.LATTICE_HOLD) {
        // Phase 1: static lattice, frozen rotation
        group.scale.setScalar(ENTRANCE.CONTAINED_SCALE);

        // Freeze rotation — suppress mouse/scroll influence
        group.rotation.x = 0;
        group.rotation.y = 0;
        group.rotation.z = 0;

        // Glow: bold edges, luminous faces
        edgeMat.opacity = fadeIn * 1.0;
        faceMat.opacity = fadeIn * 0.05;

        // Fade in copies and lines
        if (entranceCopyMat) {
          entranceCopies.forEach(function (c) {
            c.material.opacity = fadeIn * 0.3;
          });
        }
        if (entranceLineMat) entranceLineMat.opacity = fadeIn * 0.12;

      } else {
        // Phases 2-3 handled in subsequent tasks
      }

      // Theme color sync for entrance materials
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      var targetHex = isDark ? 0xc9a84c : 0x4a4640;
      entranceCopies.forEach(function (c) {
        if (c.material.color.getHex() !== targetHex) c.material.color.setHex(targetHex);
      });
      if (entranceLines && entranceLines.material.color.getHex() !== targetHex) {
        entranceLines.material.color.setHex(targetHex);
      }

    } else {
      // Normal post-entrance behavior (twist offset persists)
      group.rotation.x = time * baseRotationSpeed * 0.7 + mouseY * 0.3 + scrollProgress * Math.PI * 0.5;
      group.rotation.y = ENTRANCE.TWIST_AMOUNT + time * baseRotationSpeed + mouseX * 0.3 + scrollProgress * Math.PI * 0.3;
      group.rotation.z = time * baseRotationSpeed * 0.3;

      group.scale.setScalar(breatheScale);

      edgeMat.opacity = 0.6 + Math.sin(time * 0.3) * 0.15;
      faceMat.opacity = 0.0075;
    }
```

Note: Move the existing rotation, scale, and opacity lines into the `else` block — they only run post-entrance.

- [ ] **Step 2: Verify Phase 1**

Serve and refresh. Should see:
- Dodecahedron at contained size (fits viewport)
- Copies and extended lines fade in over ~1s
- Everything is static (no rotation)
- Bold/luminous center
- After 2.5s, nothing changes yet (Phase 2 not implemented)

- [ ] **Step 3: Commit**

```bash
git add site/js/scene.js
git commit -m "feat: implement Phase 1 — lattice fade-in with frozen rotation"
```

### Task 5: Implement Phase 2 — growth, twist, and transition to normal

**Files:**
- Modify: `site/js/scene.js`

- [ ] **Step 1: Add Phase 2 logic**

Replace the `// Phases 2-3 handled in subsequent tasks` comment with:

```javascript
      } else if (entranceElapsed < ENTRANCE.GROW_END) {
        // Phase 2: grow + twist + unfreeze rotation
        var growT = smoothstep((entranceElapsed - ENTRANCE.LATTICE_HOLD) / (ENTRANCE.GROW_END - ENTRANCE.LATTICE_HOLD));

        // Scale: contained → breathing scale
        var targetScale = breatheScale;
        var currentScale = ENTRANCE.CONTAINED_SCALE + (targetScale - ENTRANCE.CONTAINED_SCALE) * growT;
        group.scale.setScalar(currentScale);

        // Twist: 0 → TWIST_AMOUNT on Y axis
        var twist = ENTRANCE.TWIST_AMOUNT * growT;

        // Unfreeze rotation gradually
        var rotInfluence = growT;
        group.rotation.x = (time * baseRotationSpeed * 0.7 + mouseY * 0.3 + scrollProgress * Math.PI * 0.5) * rotInfluence;
        group.rotation.y = twist + (time * baseRotationSpeed + mouseX * 0.3 + scrollProgress * Math.PI * 0.3) * rotInfluence;
        group.rotation.z = (time * baseRotationSpeed * 0.3) * rotInfluence;

        // Reposition copies as radius grows
        var scaleRatio = currentScale / ENTRANCE.CONTAINED_SCALE;
        entranceCopies.forEach(function (c) {
          var newDist = c.userData.baseDistance * scaleRatio;
          c.position.set(
            Math.cos(c.userData.angle) * newDist,
            Math.sin(c.userData.angle) * newDist,
            0
          );
        });

        // Rebuild extended lines geometry with new positions
        if (entranceLines) {
          rebuildExtendedLines(entranceLines);
        }

        // Glow fadeout
        var glowFade = 1 - growT;
        edgeMat.opacity = (0.6 + Math.sin(time * 0.3) * 0.15) + glowFade * 0.4;
        faceMat.opacity = 0.0075 + glowFade * 0.045;

        // Copy opacity fade
        entranceCopies.forEach(function (c) {
          c.material.opacity = 0.3 * (1 - growT * 0.3);
        });
        if (entranceLineMat) entranceLineMat.opacity = 0.12 * (1 - growT * 0.3);

      } else {
        // Phase 3: shatter (next task)
      }
```

- [ ] **Step 2: Add rebuildExtendedLines helper**

Add after `createExtendedLines()`:

```javascript
function rebuildExtendedLines(linesMesh) {
  var edgePositions = edgeGeo.attributes.position;
  var edgeCount = edgePositions.count / 2;
  var allVertices = [];
  var EXT_LENGTH = 50;

  function addExtendedEdges(offsetX, offsetY, offsetZ) {
    for (var i = 0; i < edgeCount; i++) {
      var ax = edgePositions.getX(i * 2) + offsetX;
      var ay = edgePositions.getY(i * 2) + offsetY;
      var az = edgePositions.getZ(i * 2) + offsetZ;
      var bx = edgePositions.getX(i * 2 + 1) + offsetX;
      var by = edgePositions.getY(i * 2 + 1) + offsetY;
      var bz = edgePositions.getZ(i * 2 + 1) + offsetZ;

      var dx = bx - ax, dy = by - ay, dz = bz - az;
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 0.001) continue;
      var nx = dx / len, ny = dy / len, nz = dz / len;

      allVertices.push(
        ax - nx * EXT_LENGTH, ay - ny * EXT_LENGTH, az - nz * EXT_LENGTH,
        bx + nx * EXT_LENGTH, by + ny * EXT_LENGTH, bz + nz * EXT_LENGTH
      );
    }
  }

  addExtendedEdges(0, 0, 0);
  entranceCopies.forEach(function (c) {
    addExtendedEdges(c.position.x, c.position.y, c.position.z);
  });

  var posAttr = linesMesh.geometry.attributes.position;
  if (posAttr.count * 3 === allVertices.length) {
    // Same size — update in place
    for (var i = 0; i < allVertices.length; i++) {
      posAttr.array[i] = allVertices[i];
    }
    posAttr.needsUpdate = true;
  } else {
    // Different count — rebuild geometry
    linesMesh.geometry.dispose();
    var newGeo = new THREE.BufferGeometry();
    newGeo.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
    linesMesh.geometry = newGeo;
  }
}
```

- [ ] **Step 3: Verify Phase 2**

Serve and refresh. Should see:
- Phase 1: lattice appears, static
- Phase 2 (2.5-5s): dodecahedron grows and twists 60°, copies expand outward, lines shift, cells morph, rotation gradually unfreezes, glow fades
- After 5s: nothing changes (Phase 3 not implemented)

- [ ] **Step 4: Commit**

```bash
git add site/js/scene.js
git commit -m "feat: implement Phase 2 — growth, twist, and lattice morphing"
```

---

## Chunk 4: Phase 3 — shatter and cleanup

### Task 6: Implement fragment generation and shatter animation

**Files:**
- Modify: `site/js/scene.js`

- [ ] **Step 1: Add fragment generation function**

Add after `rebuildExtendedLines()`:

```javascript
function generateShatterFragments() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var fragColor = isDark ? 0xc9a84c : 0x4a4640;
  var fragMat = new THREE.MeshBasicMaterial({
    color: fragColor,
    transparent: true,
    opacity: 1.0,
    side: THREE.DoubleSide,
  });

  // Jittered grid approach: divide viewport into cells, create fragment per cell
  var cols = 15;
  var rows = Math.round(cols * (window.innerHeight / window.innerWidth));
  var cellW = window.innerWidth / cols;
  var cellH = window.innerHeight / rows;

  // Center dodecahedron screen bounds (approximate)
  var centerScreen = new THREE.Vector3(0, 0, 0).project(camera);
  var centerSX = (centerScreen.x + 1) / 2 * window.innerWidth;
  var centerSY = (1 - centerScreen.y) / 2 * window.innerHeight;
  var screenRadius = ENTRANCE.GEO_RADIUS * ENTRANCE.CONTAINED_SCALE * 80; // approximate px

  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      // Jittered cell center
      var sx = (col + 0.3 + Math.random() * 0.4) * cellW;
      var sy = (row + 0.3 + Math.random() * 0.4) * cellH;

      // Skip center region
      var dxS = sx - centerSX;
      var dyS = sy - centerSY;
      var distFromCenter = Math.sqrt(dxS * dxS + dyS * dyS);
      if (distFromCenter < screenRadius) continue;

      // Build irregular polygon (3-5 vertices)
      var sides = 3 + Math.floor(Math.random() * 3);
      var fragSize = Math.min(cellW, cellH) * (0.3 + Math.random() * 0.3);
      var baseAngle = Math.random() * Math.PI * 2;
      var shape = new THREE.Shape();
      for (var i = 0; i < sides; i++) {
        var a = baseAngle + (i / sides) * Math.PI * 2;
        var r = fragSize * (0.5 + Math.random() * 0.5);
        var px = Math.cos(a) * r;
        var py = Math.sin(a) * r;
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      }

      var fragGeo = new THREE.ShapeGeometry(shape);
      var mesh = new THREE.Mesh(fragGeo, fragMat.clone());

      // Convert screen pos to world pos on a plane at z=0
      var ndcX = (sx / window.innerWidth) * 2 - 1;
      var ndcY = -(sy / window.innerHeight) * 2 + 1;
      var worldPos = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
      // Place on a plane between camera and dodecahedron
      var dir = worldPos.sub(camera.position).normalize();
      var planeZ = 0;
      var t = (planeZ - camera.position.z) / dir.z;
      var pos = camera.position.clone().add(dir.multiplyScalar(t));

      mesh.position.copy(pos);
      mesh.lookAt(camera.position); // face camera

      // Radial velocity — outward from center
      var angle = Math.atan2(pos.y, pos.x);
      var speed = 0.5 + Math.random() * 1.5;

      scene.add(mesh);
      entranceFragments.push({
        mesh: mesh,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: (Math.random() - 0.5) * 0.3,
        vr: (Math.random() - 0.5) * 0.08,
        rotAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        opacity: 1.0,
        delay: (distFromCenter / Math.max(window.innerWidth, window.innerHeight)) * 0.8,
        triggered: false,
      });

      if (entranceFragments.length >= 200) return;
    }
  }
}
```

- [ ] **Step 2: Add Phase 3 logic and cleanup**

Replace `// Phase 3: shatter (next task)` in the animate function:

```javascript
      } else if (!entranceDone) {
        // Phase 3: shatter
        if (entranceFragments.length === 0) {
          generateShatterFragments();
        }

        var st = entranceElapsed - ENTRANCE.SHATTER_START;

        // Normal rotation/scale now
        group.rotation.x = time * baseRotationSpeed * 0.7 + mouseY * 0.3 + scrollProgress * Math.PI * 0.5;
        group.rotation.y = ENTRANCE.TWIST_AMOUNT + time * baseRotationSpeed + mouseX * 0.3 + scrollProgress * Math.PI * 0.3;
        group.rotation.z = time * baseRotationSpeed * 0.3;
        group.scale.setScalar(breatheScale);
        edgeMat.opacity = 0.6 + Math.sin(time * 0.3) * 0.15;
        faceMat.opacity = 0.0075;

        // Fade copies and lines
        var copyFade = Math.max(0, 1 - st * 0.67); // gone by ~1.5s
        var lineFade = Math.max(0, 1 - st);         // gone by ~1s
        entranceCopies.forEach(function (c) { c.material.opacity = 0.3 * copyFade; });
        if (entranceLineMat) entranceLineMat.opacity = 0.12 * lineFade;

        // Theme sync for fragments
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        var fragTargetHex = isDark ? 0xc9a84c : 0x4a4640;

        // Animate fragments
        var allGone = true;
        entranceFragments.forEach(function (f) {
          // Theme color sync
          if (f.mesh.material.color.getHex() !== fragTargetHex) {
            f.mesh.material.color.setHex(fragTargetHex);
          }

          var ft = Math.max(0, st - f.delay);
          if (ft <= 0) { allGone = false; return; }
          if (!f.triggered) { f.triggered = true; }

          // Radial acceleration
          var accel = 1 + ft * 0.3;
          f.mesh.position.x += f.vx * dt * accel * 3;
          f.mesh.position.y += f.vy * dt * accel * 3;
          f.mesh.position.z += f.vz * dt * accel * 3;

          // Spin
          f.mesh.rotateOnAxis(f.rotAxis, f.vr);

          // Fade: 1.0 → 0 over ~2s
          f.opacity = Math.max(0, 1.0 - ft * 0.5);
          f.mesh.material.opacity = f.opacity;

          if (f.opacity > 0) allGone = false;
        });

        // Cleanup when everything is gone
        if (allGone && st > 2.0) {
          // Remove fragments from scene
          entranceFragments.forEach(function (f) {
            scene.remove(f.mesh);
            f.mesh.geometry.dispose();
            f.mesh.material.dispose();
          });
          entranceFragments = [];

          // Remove entrance group from dodecahedron group
          if (entranceGroup) {
            entranceGroup.traverse(function (obj) {
              if (obj.geometry) obj.geometry.dispose();
              if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(function (m) { m.dispose(); });
                else obj.material.dispose();
              }
            });
            group.remove(entranceGroup);
            entranceGroup = null;
          }
          entranceCopies = [];
          entranceLines = null;
          entranceDone = true;

          // Build content mask now
          buildContentMask();
        }
      }
```

- [ ] **Step 3: Verify full entrance**

Serve and refresh. Should see:
- Phase 1 (0–2.5s): lattice fades in, static, bold center
- Phase 2 (2.5–5s): grows, twists, cells morph, rotation unfreezes, glow fades
- Phase 3 (5–7.5s): fragments explode radially outward, copies fade, lines fade
- Post-entrance: normal dodecahedron breathing, rotation, parallax — identical to before

- [ ] **Step 4: Verify cleanup — no memory leaks**

Open browser DevTools → Memory tab. Take a heap snapshot before and after entrance completes. The entrance objects should be garbage collected (no `entranceGroup`, no fragment meshes remaining).

- [ ] **Step 5: Verify theme toggle during entrance**

Toggle dark/light mode during each phase. Copies, lines, and fragments should all react to theme color changes.

- [ ] **Step 6: Commit**

```bash
git add site/js/scene.js
git commit -m "feat: implement Phase 3 — radial shatter with cleanup

Three-phase dodecahedron entrance: tessellated lattice fills viewport,
grows and twists to morph cells, then shatters radially outward.
All entrance objects disposed after completion."
```

### Task 7: Final polish and edge cases

**Files:**
- Modify: `site/js/scene.js`

- [ ] **Step 1: Test reduced motion**

In browser DevTools, emulate `prefers-reduced-motion: reduce`. Refresh. Dodecahedron should appear at normal size immediately with no entrance animation.

- [ ] **Step 2: Test resize during entrance**

Resize browser window during each phase. Verify no crashes. The lattice may look slightly off after resize — this is acceptable per spec (out of scope).

- [ ] **Step 3: Verify content mask builds after entrance**

After the entrance completes, the dodecahedron should fade where it overlaps text. Check that `buildContentMask()` fires correctly after `SHATTER_END`.

- [ ] **Step 4: Verify no console errors**

Open DevTools console. Refresh page. Let entrance play fully. Check for any errors or warnings.

- [ ] **Step 5: Commit if any fixes were made**

```bash
git add site/js/scene.js
git commit -m "fix: entrance edge case fixes"
```
