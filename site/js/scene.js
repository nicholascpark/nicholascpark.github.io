/**
 * Three.js dodecahedron scene — silver wireframe with pentagon vertices
 * Fixed full-viewport canvas behind all content.
 * Mouse parallax + scroll-driven rotation.
 * Content-aware opacity: dodecahedron fades where it overlaps text.
 */

(function () {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 6;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  canvas.id = 'scene-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
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
    opacity: 0.7,
  });
  const wireframe = new THREE.LineSegments(edgeGeo, edgeMat);
  group.add(wireframe);

  // Transparent faces — faint fill
  const faceMat = new THREE.MeshBasicMaterial({
    color: initColor,
    transparent: true,
    opacity: 0.0075,
    side: THREE.DoubleSide,
  });
  const faceMesh = new THREE.Mesh(geo, faceMat);
  group.add(faceMesh);

  // --- Pentagon vertices ---
  // Extract unique vertex positions
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

  // Create a pentagon shape — 56% of original size (0.08 * 0.56 ≈ 0.045)
  const pentRadius = 0.015;
  const pentShape = new THREE.Shape();
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2; // start from top
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

  // Place a pentagon at each vertex, using InstancedMesh for performance
  const pentMesh = new THREE.InstancedMesh(pentGeo, pentMat, uniqueVertices.length);
  const dummy = new THREE.Object3D();

  uniqueVertices.forEach((v, i) => {
    dummy.position.set(v.x, v.y, v.z);
    dummy.updateMatrix();
    pentMesh.setMatrixAt(i, dummy.matrix);
  });

  // Pentagon meshes always face camera — updated in animation loop
  group.add(pentMesh);


  /* --- Mouse tracking for parallax --- */
  let mouseX = 0;
  let mouseY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;

  document.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  /* --- Scroll tracking --- */
  let scrollProgress = 0;
  window.addEventListener('scroll', () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  });

  /* --- Content-aware opacity mask --- */
  // Build a mask once in document-space (full page height).
  // On scroll, just shift mask-position — no regeneration, no flicker.
  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d');
  let prevMaskUrl = null;

  const MASK_SELECTORS = '.site-header, .section-prose, .section-title, .interests-list li, .projects-list li, .venture-tag, .links-row, .site-footer p';

  function buildContentMask() {
    const root = document.getElementById('root');
    if (!root) return;

    const vw = window.innerWidth;
    const docH = document.documentElement.scrollHeight;
    const scrollY = window.scrollY;
    const scale = 0.3;

    maskCanvas.width = Math.round(vw * scale);
    maskCanvas.height = Math.round(docH * scale);
    const ctx = maskCtx;

    // Full opacity everywhere — dodecahedron visible
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    // Erase mode with blur for soft edges
    ctx.globalCompositeOperation = 'destination-out';
    ctx.filter = 'blur(' + Math.round(22 * scale) + 'px)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';

    const els = root.querySelectorAll(MASK_SELECTORS);
    const pad = 20;

    els.forEach(function (el) {
      // getBoundingClientRect is viewport-relative; add scrollY for document-space
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

    // Sync data URL — no async flicker
    var dataUrl = maskCanvas.toDataURL('image/png');

    canvas.style.maskImage = 'url(' + dataUrl + ')';
    canvas.style.webkitMaskImage = canvas.style.maskImage;
    canvas.style.maskSize = vw + 'px ' + docH + 'px';
    canvas.style.webkitMaskSize = canvas.style.maskSize;
    canvas.style.maskRepeat = 'no-repeat';
    canvas.style.webkitMaskRepeat = 'no-repeat';

    // Set initial scroll position
    updateMaskScroll();
  }

  function updateMaskScroll() {
    var y = -window.scrollY;
    canvas.style.maskPosition = '0px ' + y + 'px';
    canvas.style.webkitMaskPosition = canvas.style.maskPosition;
  }

  // Scroll only shifts the mask — no rebuild, no flicker
  window.addEventListener('scroll', updateMaskScroll, { passive: true });
  // Rebuild mask on resize (layout changes)
  window.addEventListener('resize', function () {
    requestAnimationFrame(buildContentMask);
  });
  // Initial build after DOM settles
  setTimeout(buildContentMask, 400);
  // Expose for theme toggle to trigger rebuild
  window.rebuildContentMask = function () {
    setTimeout(buildContentMask, 50);
  };

  /* --- Resize --- */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* --- Entrance animation --- */
  // Phase 1 (0–2s):  Scale 0 → contained size, bold/luminous wireframe
  // Phase 2 (2–3.5s): Scale contained → original (overflows viewport), glow fades
  // Phase 3:         Original breathing as before
  const ENTRANCE_DURATION = 2.0;   // phase 1: materialize
  const TRANSITION_DURATION = 1.5; // phase 2: expand to full size
  const CONTAINED_SCALE = 0.78;    // fits within viewport during entrance
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let entranceElapsed = prefersReducedMotion ? (ENTRANCE_DURATION + TRANSITION_DURATION) : 0;

  // Smooth ease-out for materialization
  function entranceEase(t) {
    if (t >= 1) return 1;
    return 1 - Math.pow(1 - t, 3);
  }

  // Smooth ease for transition back to full size
  function transitionEase(t) {
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);  // smoothstep
  }

  /* --- Animation loop --- */
  const baseRotationSpeed = 0.002;
  let time = 0;
  let lastTimestamp = 0;

  function animate(timestamp) {
    requestAnimationFrame(animate);

    // Delta time for entrance (real seconds, not animation time)
    if (!lastTimestamp) lastTimestamp = timestamp;
    var dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    time += 0.01;

    // --- Entrance progress ---
    entranceElapsed += dt;
    var totalDuration = ENTRANCE_DURATION + TRANSITION_DURATION;
    var inEntrance = entranceElapsed < ENTRANCE_DURATION;
    var inTransition = entranceElapsed >= ENTRANCE_DURATION && entranceElapsed < totalDuration;
    var settled = entranceElapsed >= totalDuration;

    // Phase 1 progress: 0→1 during materialization
    var entranceT = Math.min(entranceElapsed / ENTRANCE_DURATION, 1);
    var entranceProgress = entranceEase(entranceT);

    // Phase 2 progress: 0→1 during expansion to full size
    var transitionT = inTransition ? (entranceElapsed - ENTRANCE_DURATION) / TRANSITION_DURATION : (settled ? 1 : 0);
    var transitionProgress = transitionEase(transitionT);

    // Smooth mouse lerp
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    // Base rotation + mouse parallax + scroll offset
    // During entrance: faster rotation for esoteric unveiling effect
    var entranceRotBoost = settled ? 1 : 1 + Math.max(1 - entranceT, 0) * 3;
    group.rotation.x = time * baseRotationSpeed * 0.7 * entranceRotBoost + mouseY * 0.3 + scrollProgress * Math.PI * 0.5;
    group.rotation.y = time * baseRotationSpeed * entranceRotBoost + mouseX * 0.3 + scrollProgress * Math.PI * 0.3;
    group.rotation.z = time * baseRotationSpeed * 0.3 * entranceRotBoost;

    // Billboard pentagons — make each instance face the camera
    const camQuat = camera.quaternion;
    uniqueVertices.forEach((v, i) => {
      dummy.position.set(v.x, v.y, v.z);
      // Apply group's world rotation to get world position
      dummy.position.applyMatrix4(group.matrixWorld);

      // Depth-based scaling: front vertices larger, rear smaller
      var depthZ = dummy.position.z;
      var depthScale = THREE.MathUtils.clamp(
        THREE.MathUtils.mapLinear(depthZ, -3.5, 3.5, 0.6, 1.3),
        0.6, 1.3
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
    pentMesh.instanceMatrix.needsUpdate = true;

    // Human breathing via breathe.js — 10s cycle, inhale 50% faster than exhale
    var breatheEased = breathe(time / 0.6); // convert animation-time to real seconds
    // Original breathing: 0.900 + breatheEased * 0.115
    var breatheScale = 0.900 + breatheEased * 0.115;

    // Scale logic:
    //   Phase 1: 0 → CONTAINED_SCALE (fits viewport, materializing)
    //   Phase 2: CONTAINED_SCALE → original breatheScale (expands back to full size)
    //   Phase 3: original breatheScale (normal breathing, overflows viewport)
    var finalScale;
    if (settled) {
      finalScale = breatheScale;
    } else if (inTransition) {
      // Lerp from contained to original
      finalScale = CONTAINED_SCALE + (breatheScale - CONTAINED_SCALE) * transitionProgress;
    } else {
      // Materializing from 0 to contained
      finalScale = CONTAINED_SCALE * entranceProgress;
    }
    group.scale.setScalar(finalScale);

    // --- Entrance mystic effects ---
    // Glow intensity: full during entrance, fades through transition, gone after
    var glowIntensity = settled ? 0 : (inTransition ? (1 - transitionProgress) : 1);

    // Edge opacity: bold (1.0) → normal shimmer (0.6 ± 0.15)
    var baseEdgeOpacity = 0.6 + Math.sin(time * 0.3) * 0.15;
    edgeMat.opacity = baseEdgeOpacity + glowIntensity * (1.0 - baseEdgeOpacity);

    // Face opacity: luminous glow (0.08) → near-invisible (0.0075)
    faceMat.opacity = 0.0075 + glowIntensity * 0.075;

    // Theme-reactive color: platinum on light, gold on dark
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var targetHex = isDark ? 0xc9a84c : 0x4a4640;
    if (edgeMat.color.getHex() !== targetHex) {
      edgeMat.color.setHex(targetHex);
      faceMat.color.setHex(targetHex);
      pentMat.color.setHex(targetHex);
    }

    // --- Time bridge: export state to CSS custom properties ---
    var docStyle = document.documentElement.style;
    docStyle.setProperty('--dodeca-breathe', breatheEased.toFixed(3));
    docStyle.setProperty('--dodeca-rx', ((group.rotation.x * 180 / Math.PI) % 360).toFixed(1));
    docStyle.setProperty('--dodeca-ry', ((group.rotation.y * 180 / Math.PI) % 360).toFixed(1));
    docStyle.setProperty('--dodeca-rz', ((group.rotation.z * 180 / Math.PI) % 360).toFixed(1));

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
})();
