/**
 * Three.js dodecahedron scene — silver wireframe with pentagon vertices
 * Fixed full-viewport canvas behind all content.
 * Mouse parallax + scroll-driven rotation.
 * Content-aware opacity: dodecahedron fades where it overlaps text.
 * Entrance: Penrose tessellation shatters outward as dodecahedron materializes.
 */

(function () {
  function readSiteCapabilities() {
    if (window.getSiteCapabilities) return window.getSiteCapabilities();

    var width = window.innerWidth || document.documentElement.clientWidth || 0;
    var touch = window.matchMedia('(hover: none)').matches ||
      window.matchMedia('(pointer: coarse)').matches ||
      (navigator.maxTouchPoints || 0) > 0;
    var compact = width <= 820;
    var handset = width <= 640;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return {
      width: width,
      touch: touch,
      compact: compact,
      handset: handset,
      reducedMotion: reducedMotion,
      mobileLite: touch || compact,
    };
  }

  function getScenePixelRatio(capabilities) {
    var cap = capabilities.mobileLite ? 1.25 : 2;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  var capabilities = readSiteCapabilities();
  var mobileLite = capabilities.mobileLite;
  var prefersReducedMotion = capabilities.reducedMotion;
  var useContentMask = !prefersReducedMotion;
  var baseRotationSpeed = mobileLite ? 0.00135 : 0.002;
  const DEFAULT_CONTAINED_SCALE = 0.78;
  var sceneScaleProfile = getSceneScaleProfile(capabilities);

  function getSceneScaleProfile(currentCapabilities) {
    if (!currentCapabilities.mobileLite) {
      return {
        contained: DEFAULT_CONTAINED_SCALE,
        settleBase: 0.9,
        breatheAmplitude: 0.115,
      };
    }

    var root = document.getElementById('root');
    var viewportWidth = Math.max(window.innerWidth || 1, 1);
    var rootWidth = root
      ? root.getBoundingClientRect().width
      : Math.min(viewportWidth - 32, 680);
    var widthRatio = THREE.MathUtils.clamp(rootWidth / viewportWidth, 0.72, 0.94);

    var contained = currentCapabilities.handset
      ? THREE.MathUtils.clamp(widthRatio * 0.7, 0.58, 0.66)
      : THREE.MathUtils.clamp(widthRatio * 0.86, 0.66, 0.75);

    var settleBase = currentCapabilities.handset
      ? THREE.MathUtils.clamp(contained + 0.04, 0.62, 0.7)
      : THREE.MathUtils.clamp(contained + 0.05, 0.72, 0.82);

    var breatheAmplitude = currentCapabilities.handset ? 0.04 : 0.065;
    var breatheRangeBoost = currentCapabilities.handset ? 0.018 : 0.014;

    return {
      contained: contained,
      // Keep the same maximum radius on mobile, but let the form contract more
      // between breaths so the breathing reads more clearly on small screens.
      settleBase: settleBase - breatheRangeBoost,
      breatheAmplitude: breatheAmplitude + breatheRangeBoost,
    };
  }

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 6;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !mobileLite });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(getScenePixelRatio(capabilities));
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  canvas.id = 'scene-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
  canvas.dataset.mode = mobileLite ? 'lite' : 'full';
  document.body.prepend(canvas);

  /* --- Dodecahedron group --- */
  const group = new THREE.Group();
  scene.add(group);

  const geo = new THREE.DodecahedronGeometry(3.16, 0);

  // Wireframe edges — platinum (light) or gold (dark), set per frame
  var initColor = document.documentElement.getAttribute('data-theme') === 'dark' ? 0xc9a84c : 0x4a4640;
  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: initColor,
    transparent: true,
    opacity: 0.55,
  });
  const wireframe = new THREE.LineSegments(edgeGeo, edgeMat);
  group.add(wireframe);

  // Transparent faces — faint fill
  const faceMat = new THREE.MeshBasicMaterial({
    color: initColor,
    transparent: true,
    opacity: 0.0001,
    side: THREE.DoubleSide,
  });
  const faceMesh = new THREE.Mesh(geo, faceMat);
  group.add(faceMesh);

  // --- Pentagon vertices ---
  const positions = geo.attributes.position;
  const uniqueVertices = [];
  const seen = new Set();

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueVertices.push({ x, y, z });
    }
  }

  const pentRadius = 0.015;
  const pentShape = new THREE.Shape();
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(angle) * pentRadius;
    const py = Math.sin(angle) * pentRadius;
    if (i === 0) pentShape.moveTo(px, py);
    else pentShape.lineTo(px, py);
  }
  pentShape.closePath();

  const pentGeo = new THREE.ShapeGeometry(pentShape);
  const pentMat = new THREE.MeshBasicMaterial({
    color: initColor,
    side: THREE.DoubleSide,
  });

  const pentMesh = new THREE.InstancedMesh(pentGeo, pentMat, uniqueVertices.length);
  const dummy = new THREE.Object3D();

  uniqueVertices.forEach((v, i) => {
    dummy.position.set(v.x, v.y, v.z);
    dummy.updateMatrix();
    pentMesh.setMatrixAt(i, dummy.matrix);
  });

  group.add(pentMesh);


  /* --- Penrose tessellation entrance --- */
  var tessGroup = new THREE.Group();
  scene.add(tessGroup);
  var shards = [];

  if (!prefersReducedMotion && !mobileLite && typeof generatePenroseTiling === 'function') {
    // No exclusion zone — tiles cover everything including the center.
    // Inner tiles (within dodecahedron projection) fade out as 3D form emerges.
    var tiling = generatePenroseTiling({
      radius: 7,
      iterations: 5,
      innerRadius: 2.5,  // ≈ dodecahedron radius * contained scale
      maxRadius: 9,
    });

    var shardColor = new THREE.Color(initColor);

    for (var ti = 0; ti < tiling.length; ti++) {
      var tile = tiling[ti];
      var verts = tile.vertices;

      // Create wireframe triangle
      var lineGeo = new THREE.BufferGeometry();
      var lineVerts = new Float32Array([
        verts[0][0], verts[0][1], 0,
        verts[1][0], verts[1][1], 0,
        verts[1][0], verts[1][1], 0,
        verts[2][0], verts[2][1], 0,
        verts[2][0], verts[2][1], 0,
        verts[0][0], verts[0][1], 0,
      ]);
      lineGeo.setAttribute('position', new THREE.BufferAttribute(lineVerts, 3));

      var lineMat = new THREE.LineBasicMaterial({
        color: shardColor,
        transparent: true,
        opacity: 0.8,
      });
      var lineMesh = new THREE.LineSegments(lineGeo, lineMat);

      // Faint fill for the shard
      var fillShape = new THREE.Shape();
      fillShape.moveTo(verts[0][0], verts[0][1]);
      fillShape.lineTo(verts[1][0], verts[1][1]);
      fillShape.lineTo(verts[2][0], verts[2][1]);
      fillShape.closePath();
      var fillGeo = new THREE.ShapeGeometry(fillShape);
      var fillMat = new THREE.MeshBasicMaterial({
        color: shardColor,
        transparent: true,
        opacity: 0.04,
        side: THREE.DoubleSide,
      });
      var fillMesh = new THREE.Mesh(fillGeo, fillMat);

      var shardGroup = new THREE.Group();
      shardGroup.add(lineMesh);
      shardGroup.add(fillMesh);
      tessGroup.add(shardGroup);

      // Shatter physics data
      var cx = tile.center[0];
      var cy = tile.center[1];
      var dist = tile.dist;
      var angle = Math.atan2(cy, cx);

      // Velocity: gentle outward drift — elegant, not explosive
      var speed = 1.2 + dist * 0.15;
      var vx = Math.cos(angle) * speed;
      var vy = Math.sin(angle) * speed;

      // Minimal rotation — glass panes separating, not debris
      var angVel = (Math.random() - 0.5) * 0.8;

      // Stagger: outer tiles peel away first, dissolving inward toward center
      var maxDist = 9;
      var shatterDelay = (1 - (dist / maxDist)) * 0.8;

      shards.push({
        group: shardGroup,
        lineMat: lineMat,
        fillMat: fillMat,
        cx: cx,
        cy: cy,
        dist: dist,
        inner: tile.inner,  // true = fades out as 3D form emerges
        vx: vx,
        vy: vy,
        vz: (Math.random() - 0.5) * 1.5,
        angVel: angVel,
        shatterDelay: shatterDelay,
        shattered: false,
      });
    }
  }


  /* --- Mouse tracking for parallax --- */
  let mouseX = 0;
  let mouseY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;

  if (!capabilities.touch) {
    document.addEventListener('mousemove', (e) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });
  }

  /* --- Scroll tracking --- */
  let scrollProgress = 0;
  window.addEventListener('scroll', () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  }, { passive: true });

  /* --- Content-aware opacity mask --- */
  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d');

  const MASK_SELECTORS = '.site-header, .section-prose, .section-title, .interests-list li, .projects-list li, .links-row, .site-footer p';

  function clearContentMask() {
    canvas.style.maskImage = 'none';
    canvas.style.webkitMaskImage = 'none';
    canvas.style.maskSize = '';
    canvas.style.webkitMaskSize = '';
    canvas.style.maskRepeat = '';
    canvas.style.webkitMaskRepeat = '';
    canvas.style.maskPosition = '';
    canvas.style.webkitMaskPosition = '';
  }

  function buildContentMask() {
    if (!useContentMask) {
      clearContentMask();
      return;
    }

    const root = document.getElementById('root');
    if (!root) return;

    const vw = window.innerWidth;
    const docH = document.documentElement.scrollHeight;
    const scrollY = window.scrollY;
    const scale = 0.3;

    maskCanvas.width = Math.round(vw * scale);
    maskCanvas.height = Math.round(docH * scale);
    const ctx = maskCtx;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.filter = 'blur(' + Math.round(22 * scale) + 'px)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';

    const els = root.querySelectorAll(MASK_SELECTORS);
    const pad = 20;

    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      ctx.fillRect(
        (r.left - pad) * scale,
        (r.top + scrollY - pad) * scale,
        (r.width + pad * 2) * scale,
        (r.height + pad * 2) * scale
      );
    });

    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';

    var dataUrl = maskCanvas.toDataURL('image/png');

    canvas.style.maskImage = 'url(' + dataUrl + ')';
    canvas.style.webkitMaskImage = canvas.style.maskImage;
    canvas.style.maskSize = vw + 'px ' + docH + 'px';
    canvas.style.webkitMaskSize = canvas.style.maskSize;
    canvas.style.maskRepeat = 'no-repeat';
    canvas.style.webkitMaskRepeat = 'no-repeat';

    updateMaskScroll();
  }

  function updateMaskScroll() {
    if (!useContentMask) return;
    var y = -window.scrollY;
    canvas.style.maskPosition = '0px ' + y + 'px';
    canvas.style.webkitMaskPosition = canvas.style.maskPosition;
  }

  window.addEventListener('scroll', updateMaskScroll, { passive: true });
  window.addEventListener('resize', function () {
    if (useContentMask) requestAnimationFrame(buildContentMask);
  });
  if (useContentMask) {
    setTimeout(buildContentMask, 100);
  } else {
    clearContentMask();
  }
  window.rebuildContentMask = function () {
    if (!useContentMask) {
      clearContentMask();
      return;
    }

    setTimeout(buildContentMask, 50);
  };

  function refreshSceneCapabilities(nextCapabilities) {
    capabilities = nextCapabilities || readSiteCapabilities();
    mobileLite = capabilities.mobileLite;
    prefersReducedMotion = capabilities.reducedMotion;
    useContentMask = !prefersReducedMotion;
    baseRotationSpeed = mobileLite ? 0.00135 : 0.002;
    sceneScaleProfile = getSceneScaleProfile(capabilities);
    renderer.setPixelRatio(getScenePixelRatio(capabilities));
    canvas.dataset.mode = mobileLite ? 'lite' : 'full';

    if (mobileLite || capabilities.touch) {
      targetMouseX = 0;
      targetMouseY = 0;
    }

    if (useContentMask) requestAnimationFrame(buildContentMask);
    else clearContentMask();
  }

  /* --- Resize --- */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    refreshSceneCapabilities();
  });

  window.addEventListener('site:capabilitieschange', function (event) {
    refreshSceneCapabilities(event.detail);
  });

  /* --- Entrance animation --- */
  // Phase 1 (0–1.5s):  Sacred geometry — dodecahedron + tessellation frozen as one pattern
  // Phase 2 (1.5–3.5s): Tessellation shatters, dodecahedron awakens (rotation + growth)
  // Phase 3:           Original breathing, tessellation gone
  const HOLD_DURATION = 1.5;        // phase 1: frozen sacred pattern
  const SHATTER_DURATION = 2.0;     // phase 2: shatter + awaken
  let entranceElapsed = prefersReducedMotion ? (HOLD_DURATION + SHATTER_DURATION) : 0;
  var tessellationCleanedUp = prefersReducedMotion;

  // Dodecahedron starts at scale 0 — it grows from the center of the tiling,
  // reaching contained size by end of hold, then expands to full size during shatter.
  group.scale.setScalar(0);
  if (!prefersReducedMotion) {
    group.visible = true;  // visible from start, but at scale 0
  }

  function entranceEase(t) {
    if (t >= 1) return 1;
    return 1 - Math.pow(1 - t, 3);
  }

  function transitionEase(t) {
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  }

  /* --- Animation loop --- */
  let time = 0;
  let lastTimestamp = 0;
  let lastRenderedTimestamp = 0;
  let processedFrameCount = 0;
  let animationFrameId = 0;

  function queueNextFrame() {
    if (!animationFrameId && !document.hidden) {
      animationFrameId = requestAnimationFrame(animate);
    }
  }

  function stopAnimationLoop() {
    if (!animationFrameId) return;
    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }

  function startAnimationLoop() {
    lastTimestamp = 0;
    lastRenderedTimestamp = 0;
    processedFrameCount = 0;
    queueNextFrame();
  }

  function animate(timestamp) {
    animationFrameId = 0;
    queueNextFrame();

    if (mobileLite && lastRenderedTimestamp && timestamp - lastRenderedTimestamp < (1000 / 30)) {
      return;
    }

    lastRenderedTimestamp = timestamp;

    if (!lastTimestamp) lastTimestamp = timestamp;
    var dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05); // cap dt
    lastTimestamp = timestamp;

    time += dt * 0.6;
    processedFrameCount += 1;

    // --- Entrance progress ---
    entranceElapsed += dt;
    var totalDuration = HOLD_DURATION + SHATTER_DURATION;
    var inHold = entranceElapsed < HOLD_DURATION;
    var inShatter = entranceElapsed >= HOLD_DURATION && entranceElapsed < totalDuration;
    var settled = entranceElapsed >= totalDuration;

    // Shatter progress: 0→1 during phase 2
    var shatterT = inShatter ? (entranceElapsed - HOLD_DURATION) / SHATTER_DURATION : (settled ? 1 : 0);
    var shatterProgress = transitionEase(shatterT);

    // Smooth mouse lerp
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    // Rotation: FROZEN during hold, awakens during shatter, normal after
    if (inHold) {
      // Sacred geometry — perfectly still
      group.rotation.x = 0;
      group.rotation.y = 0;
      group.rotation.z = 0;
    } else {
      // Awaken: rotation ramps up from 0 to normal
      var awakenT = Math.min(shatterProgress, 1);
      var rotScale = awakenT; // 0→1 during shatter
      var mouseInfluence = capabilities.touch ? 0 : (mobileLite ? 0.16 : 0.3);
      var scrollInfluenceX = mobileLite ? Math.PI * 0.28 : Math.PI * 0.5;
      var scrollInfluenceY = mobileLite ? Math.PI * 0.18 : Math.PI * 0.3;
      group.rotation.x = (time * baseRotationSpeed * 0.7 + mouseY * mouseInfluence + scrollProgress * scrollInfluenceX) * rotScale;
      group.rotation.y = (time * baseRotationSpeed + mouseX * mouseInfluence + scrollProgress * scrollInfluenceY) * rotScale;
      group.rotation.z = (time * baseRotationSpeed * (mobileLite ? 0.18 : 0.3)) * rotScale;
    }

    // Billboard pentagons
    if (!mobileLite || processedFrameCount % 2 === 0) {
      const camQuat = camera.quaternion;
      const invGroupQuat = group.quaternion.clone().invert();

      uniqueVertices.forEach((v, i) => {
        dummy.position.set(v.x, v.y, v.z);
        dummy.position.applyMatrix4(group.matrixWorld);

        var depthZ = dummy.position.z;
        var depthScale = mobileLite ? 0.92 : THREE.MathUtils.clamp(
          THREE.MathUtils.mapLinear(depthZ, -3.5, 3.5, 0.6, 1.3),
          0.6, 1.3
        );

        dummy.position.set(v.x, v.y, v.z);
        dummy.quaternion.copy(camQuat).premultiply(invGroupQuat);
        dummy.scale.setScalar(depthScale);
        dummy.updateMatrix();
        pentMesh.setMatrixAt(i, dummy.matrix);
      });
      pentMesh.instanceMatrix.needsUpdate = true;
    }

    // Human breathing
    var breatheEased = breathe(time / 0.6);
    var breatheScale = sceneScaleProfile.settleBase + breatheEased * sceneScaleProfile.breatheAmplitude;

    // Scale logic:
    //   Hold: 0 → contained scale (grows from center of tiling)
    //   Shatter: contained scale → original breatheScale (awakening)
    //   Settled: original breatheScale (normal)
    var holdT = Math.min(entranceElapsed / HOLD_DURATION, 1);
    var holdProgress = entranceEase(holdT);
    var finalScale;
    if (settled) {
      finalScale = breatheScale;
    } else if (inShatter) {
      finalScale = sceneScaleProfile.contained + (breatheScale - sceneScaleProfile.contained) * shatterProgress;
    } else {
      finalScale = sceneScaleProfile.contained * holdProgress;
    }
    group.scale.setScalar(finalScale);

    // --- Entrance mystic effects on dodecahedron ---
    // Hold: bold, luminous (matches tessellation intensity)
    // Shatter: glow fades as it becomes the normal subtle wireframe
    var glowIntensity = settled ? 0 : (inShatter ? (1 - shatterProgress) : 1);

    var baseEdgeOpacity = (mobileLite ? 0.4 : 0.5) + Math.sin(time * 0.3) * (mobileLite ? 0.06 : 0.11);
    edgeMat.opacity = baseEdgeOpacity + glowIntensity * (1.0 - baseEdgeOpacity);
    faceMat.opacity = (mobileLite ? 0.003 : 0.0075) + glowIntensity * (mobileLite ? 0.03 : 0.075);

    // --- Tessellation shatter animation ---
    if (shards.length > 0 && !tessellationCleanedUp) {
      if (inHold) {
        // Phase 1: tiling fills the screen. Dodecahedron grows from center,
        // gradually displacing inner tiles as it expands through them.
        var tessGlow = 0.7 + Math.sin(time * 1.5) * 0.15;
        // Current dodecahedron radius in world space
        var currentRadius = 3.16 * sceneScaleProfile.contained * holdProgress;
        for (var si = 0; si < shards.length; si++) {
          var s = shards[si];
          if (s.inner && s.dist < currentRadius) {
            // This tile is now inside the growing dodecahedron — fade it out
            var overlapT = Math.min((currentRadius - s.dist) / 0.8, 1);
            s.lineMat.opacity = tessGlow * (1 - overlapT);
            s.fillMat.opacity = 0.035 * (1 - overlapT);
          } else {
            s.lineMat.opacity = tessGlow;
            s.fillMat.opacity = 0.035;
          }
        }
        tessGroup.visible = true;
      } else if (inShatter) {
        // Phase 2: the 3D dodecahedron is at contained size.
        // Inner tiles finish fading. Outer tiles shatter outward.
        // Dodecahedron expands to full size.

        var emergeT = Math.min(shatterProgress * 2, 1);

        var shatterElapsed = entranceElapsed - HOLD_DURATION;

        for (var si = 0; si < shards.length; si++) {
          var s = shards[si];

          if (s.inner) {
            // Inner tiles: fade out as 3D form replaces them
            var innerFade = 1 - emergeT;
            s.lineMat.opacity = 0.7 * innerFade;
            s.fillMat.opacity = 0.035 * innerFade;
            if (innerFade <= 0) s.group.visible = false;
            continue;
          }

          // Outer tiles: shatter outward
          var localT = shatterElapsed - s.shatterDelay;

          if (localT <= 0) {
            s.lineMat.opacity = 0.7 * (1 - shatterProgress * 0.3);
            continue;
          }

          if (!s.shattered) {
            s.shattered = true;
          }

          // Graceful outward drift — accelerates gently
          var accel = 1 + localT * 0.5;
          s.group.position.x += s.vx * dt * accel;
          s.group.position.y += s.vy * dt * accel;
          s.group.position.z += s.vz * 0.3 * dt;

          // Subtle rotation — glass pane separating, not tumbling debris
          s.group.rotation.z += s.angVel * dt;

          // Long, soft fade — dissolves into nothing
          var fadeT = Math.min(localT / (SHATTER_DURATION * 0.85), 1);
          var fadeEase = fadeT * fadeT;  // ease-in: starts slow, finishes quick
          s.lineMat.opacity = 0.7 * (1 - fadeEase);
          s.fillMat.opacity = 0.035 * (1 - fadeEase);

          if (fadeT >= 1) {
            s.group.visible = false;
          }
        }
      } else if (settled && !tessellationCleanedUp) {
        // Cleanup: remove tessellation from scene
        scene.remove(tessGroup);
        tessGroup.traverse(function (obj) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        shards.length = 0;
        tessellationCleanedUp = true;
      }
    }

    // Theme-reactive color
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var targetHex = isDark ? 0xc9a84c : 0x4a4640;
    if (edgeMat.color.getHex() !== targetHex) {
      edgeMat.color.setHex(targetHex);
      faceMat.color.setHex(targetHex);
      pentMat.color.setHex(targetHex);
      // Update tessellation colors too
      for (var si = 0; si < shards.length; si++) {
        shards[si].lineMat.color.setHex(targetHex);
        shards[si].fillMat.color.setHex(targetHex);
      }
    }

    // --- Time bridge: export state to CSS custom properties ---
    var docStyle = document.documentElement.style;
    docStyle.setProperty('--dodeca-breathe', breatheEased.toFixed(3));
    docStyle.setProperty('--dodeca-rx', ((group.rotation.x * 180 / Math.PI) % 360).toFixed(1));
    docStyle.setProperty('--dodeca-ry', ((group.rotation.y * 180 / Math.PI) % 360).toFixed(1));
    docStyle.setProperty('--dodeca-rz', ((group.rotation.z * 180 / Math.PI) % 360).toFixed(1));

    renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopAnimationLoop();
      return;
    }

    refreshSceneCapabilities();
    startAnimationLoop();
  });

  startAnimationLoop();
})();
