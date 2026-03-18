/**
 * Three.js dodecahedron scene — silver wireframe with pentagon vertices
 * Fixed full-viewport canvas behind all content.
 * Mouse parallax + scroll-driven rotation.
 * Content-aware opacity: dodecahedron fades where it overlaps text.
 *
 * Entrance: tessellated lattice of dodecahedron copies fills viewport,
 * grows + twists to morph cells, then shatters radially outward.
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
  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d');
  let prevMaskUrl = null;

  const MASK_SELECTORS = '.site-header, .section-prose, .section-title, .interests-list li, .projects-list li, .links-row, .site-footer p';

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
    var y = -window.scrollY;
    canvas.style.maskPosition = '0px ' + y + 'px';
    canvas.style.webkitMaskPosition = canvas.style.maskPosition;
  }

  window.addEventListener('scroll', updateMaskScroll, { passive: true });
  window.addEventListener('resize', function () {
    requestAnimationFrame(buildContentMask);
  });
  window.rebuildContentMask = function () {
    setTimeout(buildContentMask, 50);
  };


  /* --- Entrance: tessellated lattice with radial shatter --- */

  const ENTRANCE = {
    LATTICE_HOLD: 2.5,
    GROW_END: 5.0,
    SHATTER_START: 5.0,
    SHATTER_END: 7.5,
    CONTAINED_SCALE: 0.78,
    TWIST_AMOUNT: Math.PI / 3,
    GEO_RADIUS: 3.16,
  };

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let entranceDone = prefersReducedMotion;
  let entranceElapsed = 0;
  let entranceGroup = null;
  let entranceFragments = [];
  let entranceCopies = [];
  let entranceLines = null;
  let entranceCopyMat = null;
  let entranceLineMat = null;

  function smoothstep(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  // --- Create dodecahedron copies in concentric rings ---
  function createEntranceCopies() {
    entranceGroup = new THREE.Group();
    group.add(entranceGroup);

    var R = ENTRANCE.GEO_RADIUS;
    entranceCopyMat = new THREE.LineBasicMaterial({
      color: initColor,
      transparent: true,
      opacity: 0,
    });

    var d1 = 2 * R * Math.cos(Math.PI / 5);
    var rings = [
      [5,  d1],
      [5,  2 * R],
      [10, d1 + R * 1.1],
      [15, d1 + R * 1.1 + R * 1.2],
      [20, d1 + R * 1.1 + R * 1.2 + R * 1.1],
    ];

    rings.forEach(function (ring) {
      var count = ring[0];
      var dist = ring[1];
      for (var i = 0; i < count; i++) {
        var angle = (i / count) * Math.PI * 2;
        var copy = new THREE.LineSegments(edgeGeo, entranceCopyMat.clone());
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
  }

  // --- Create extended edge lines ---
  function createExtendedLines() {
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

    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));

    entranceLineMat = new THREE.LineBasicMaterial({
      color: initColor,
      transparent: true,
      opacity: 0,
    });

    entranceLines = new THREE.LineSegments(lineGeo, entranceLineMat);
    entranceGroup.add(entranceLines);
  }

  // --- Rebuild extended lines when copies reposition ---
  function rebuildExtendedLines() {
    if (!entranceLines) return;
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

    var posAttr = entranceLines.geometry.attributes.position;
    if (posAttr.count * 3 === allVertices.length) {
      for (var i = 0; i < allVertices.length; i++) {
        posAttr.array[i] = allVertices[i];
      }
      posAttr.needsUpdate = true;
    } else {
      entranceLines.geometry.dispose();
      var newGeo = new THREE.BufferGeometry();
      newGeo.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
      entranceLines.geometry = newGeo;
    }
  }

  // --- Generate shatter fragments ---
  function generateShatterFragments() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var fragColor = isDark ? 0xc9a84c : 0x4a4640;

    var cols = 15;
    var rows = Math.round(cols * (window.innerHeight / window.innerWidth));
    var cellW = window.innerWidth / cols;
    var cellH = window.innerHeight / rows;

    var centerScreen = new THREE.Vector3(0, 0, 0).project(camera);
    var centerSX = (centerScreen.x + 1) / 2 * window.innerWidth;
    var centerSY = (1 - centerScreen.y) / 2 * window.innerHeight;
    var screenRadius = ENTRANCE.GEO_RADIUS * ENTRANCE.CONTAINED_SCALE * 80;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var sx = (col + 0.3 + Math.random() * 0.4) * cellW;
        var sy = (row + 0.3 + Math.random() * 0.4) * cellH;

        var dxS = sx - centerSX;
        var dyS = sy - centerSY;
        var distFromCenter = Math.sqrt(dxS * dxS + dyS * dyS);
        if (distFromCenter < screenRadius) continue;

        var sides = 3 + Math.floor(Math.random() * 3);
        var fragSize = Math.min(cellW, cellH) * (0.3 + Math.random() * 0.3);
        var baseAngle = Math.random() * Math.PI * 2;
        var shape = new THREE.Shape();
        for (var i = 0; i < sides; i++) {
          var a = baseAngle + (i / sides) * Math.PI * 2;
          var r = fragSize * 0.01; // world-space scale
          var px = Math.cos(a) * r;
          var py = Math.sin(a) * r;
          if (i === 0) shape.moveTo(px, py);
          else shape.lineTo(px, py);
        }

        var fragGeo = new THREE.ShapeGeometry(shape);
        var fragMat = new THREE.MeshBasicMaterial({
          color: fragColor,
          transparent: true,
          opacity: 1.0,
          side: THREE.DoubleSide,
        });
        var mesh = new THREE.Mesh(fragGeo, fragMat);

        // Convert screen pos to world pos
        var ndcX = (sx / window.innerWidth) * 2 - 1;
        var ndcY = -(sy / window.innerHeight) * 2 + 1;
        var worldPos = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
        var dir = worldPos.sub(camera.position).normalize();
        var t = -camera.position.z / dir.z;
        var pos = camera.position.clone().add(dir.multiplyScalar(t));

        mesh.position.copy(pos);
        mesh.lookAt(camera.position);

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

  // --- Entrance cleanup ---
  function cleanupEntrance() {
    entranceFragments.forEach(function (f) {
      scene.remove(f.mesh);
      f.mesh.geometry.dispose();
      f.mesh.material.dispose();
    });
    entranceFragments = [];

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
    entranceCopyMat = null;
    entranceLineMat = null;
    entranceDone = true;

    buildContentMask();
  }

  // --- Initialize entrance ---
  if (!entranceDone) {
    createEntranceCopies();
    createExtendedLines();
    group.scale.setScalar(ENTRANCE.CONTAINED_SCALE);
  } else {
    // No entrance — build content mask immediately
    setTimeout(buildContentMask, 400);
  }


  /* --- Resize --- */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });


  /* --- Animation loop --- */
  const baseRotationSpeed = 0.002;
  let time = 0;
  let lastTimestamp = 0;

  function animate(timestamp) {
    requestAnimationFrame(animate);

    if (!lastTimestamp) lastTimestamp = timestamp;
    var dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // cap dt to avoid jumps
    lastTimestamp = timestamp;

    time += 0.01;

    // Smooth mouse lerp
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    // Human breathing
    var breatheEased = breathe(time / 0.6);
    var breatheScale = 0.900 + breatheEased * 0.115;

    // --- Entrance system ---
    if (!entranceDone) {
      entranceElapsed += dt;
      var fadeIn = Math.min(entranceElapsed / 1.0, 1);

      // Theme sync for entrance materials
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      var targetHex = isDark ? 0xc9a84c : 0x4a4640;
      entranceCopies.forEach(function (c) {
        if (c.material.color.getHex() !== targetHex) c.material.color.setHex(targetHex);
      });
      if (entranceLines && entranceLineMat.color.getHex() !== targetHex) {
        entranceLineMat.color.setHex(targetHex);
      }

      if (entranceElapsed < ENTRANCE.LATTICE_HOLD) {
        // === Phase 1: Static lattice, frozen rotation ===
        group.scale.setScalar(ENTRANCE.CONTAINED_SCALE);
        group.rotation.x = 0;
        group.rotation.y = 0;
        group.rotation.z = 0;

        // Glow
        edgeMat.opacity = fadeIn * 1.0;
        faceMat.opacity = fadeIn * 0.05;

        // Fade in copies and lines
        entranceCopies.forEach(function (c) {
          c.material.opacity = fadeIn * 0.3;
        });
        if (entranceLineMat) entranceLineMat.opacity = fadeIn * 0.12;

      } else if (entranceElapsed < ENTRANCE.GROW_END) {
        // === Phase 2: Growth + twist ===
        var growT = smoothstep((entranceElapsed - ENTRANCE.LATTICE_HOLD) / (ENTRANCE.GROW_END - ENTRANCE.LATTICE_HOLD));

        // Scale: contained → breathing
        var currentScale = ENTRANCE.CONTAINED_SCALE + (breatheScale - ENTRANCE.CONTAINED_SCALE) * growT;
        group.scale.setScalar(currentScale);

        // Twist + gradual rotation unfreeze
        var twist = ENTRANCE.TWIST_AMOUNT * growT;
        var rotInfluence = growT;
        group.rotation.x = (time * baseRotationSpeed * 0.7 + mouseY * 0.3 + scrollProgress * Math.PI * 0.5) * rotInfluence;
        group.rotation.y = twist + (time * baseRotationSpeed + mouseX * 0.3 + scrollProgress * Math.PI * 0.3) * rotInfluence;
        group.rotation.z = (time * baseRotationSpeed * 0.3) * rotInfluence;

        // Reposition copies
        var scaleRatio = currentScale / ENTRANCE.CONTAINED_SCALE;
        entranceCopies.forEach(function (c) {
          var newDist = c.userData.baseDistance * scaleRatio;
          c.position.set(
            Math.cos(c.userData.angle) * newDist,
            Math.sin(c.userData.angle) * newDist,
            0
          );
        });

        // Rebuild lines with new positions (throttle: every 3rd frame)
        if (Math.floor(entranceElapsed * 60) % 3 === 0) {
          rebuildExtendedLines();
        }

        // Glow fadeout
        var glowFade = 1 - growT;
        edgeMat.opacity = (0.6 + Math.sin(time * 0.3) * 0.15) + glowFade * 0.4;
        faceMat.opacity = 0.0075 + glowFade * 0.045;

        // Copy + line opacity
        entranceCopies.forEach(function (c) {
          c.material.opacity = 0.3 * (1 - growT * 0.3);
        });
        if (entranceLineMat) entranceLineMat.opacity = 0.12 * (1 - growT * 0.3);

      } else {
        // === Phase 3: Shatter ===
        if (entranceFragments.length === 0) {
          generateShatterFragments();
        }

        var st = entranceElapsed - ENTRANCE.SHATTER_START;

        // Normal rotation + scale
        group.rotation.x = time * baseRotationSpeed * 0.7 + mouseY * 0.3 + scrollProgress * Math.PI * 0.5;
        group.rotation.y = ENTRANCE.TWIST_AMOUNT + time * baseRotationSpeed + mouseX * 0.3 + scrollProgress * Math.PI * 0.3;
        group.rotation.z = time * baseRotationSpeed * 0.3;
        group.scale.setScalar(breatheScale);
        edgeMat.opacity = 0.6 + Math.sin(time * 0.3) * 0.15;
        faceMat.opacity = 0.0075;

        // Fade copies and lines
        var copyFade = Math.max(0, 1 - st * 0.67);
        var lineFade = Math.max(0, 1 - st);
        entranceCopies.forEach(function (c) { c.material.opacity = 0.3 * copyFade; });
        if (entranceLineMat) entranceLineMat.opacity = 0.12 * lineFade;

        // Theme sync for fragments
        var isDarkFrag = document.documentElement.getAttribute('data-theme') === 'dark';
        var fragTargetHex = isDarkFrag ? 0xc9a84c : 0x4a4640;

        // Animate fragments
        var allGone = true;
        entranceFragments.forEach(function (f) {
          if (f.mesh.material.color.getHex() !== fragTargetHex) {
            f.mesh.material.color.setHex(fragTargetHex);
          }

          var ft = Math.max(0, st - f.delay);
          if (ft <= 0) { allGone = false; return; }
          if (!f.triggered) f.triggered = true;

          var accel = 1 + ft * 0.3;
          f.mesh.position.x += f.vx * dt * accel * 3;
          f.mesh.position.y += f.vy * dt * accel * 3;
          f.mesh.position.z += f.vz * dt * accel * 3;

          f.mesh.rotateOnAxis(f.rotAxis, f.vr);

          f.opacity = Math.max(0, 1.0 - ft * 0.5);
          f.mesh.material.opacity = f.opacity;

          if (f.opacity > 0) allGone = false;
        });

        // Cleanup when done
        if (allGone && st > 2.0) {
          cleanupEntrance();
        }
      }

    } else {
      // === Post-entrance: normal behavior ===
      group.rotation.x = time * baseRotationSpeed * 0.7 + mouseY * 0.3 + scrollProgress * Math.PI * 0.5;
      group.rotation.y = ENTRANCE.TWIST_AMOUNT + time * baseRotationSpeed + mouseX * 0.3 + scrollProgress * Math.PI * 0.3;
      group.rotation.z = time * baseRotationSpeed * 0.3;

      group.scale.setScalar(breatheScale);

      edgeMat.opacity = 0.6 + Math.sin(time * 0.3) * 0.15;
      faceMat.opacity = 0.0075;
    }

    // Billboard pentagons — make each instance face the camera
    const camQuat = camera.quaternion;
    uniqueVertices.forEach((v, i) => {
      dummy.position.set(v.x, v.y, v.z);
      dummy.position.applyMatrix4(group.matrixWorld);

      var depthZ = dummy.position.z;
      var depthScale = THREE.MathUtils.clamp(
        THREE.MathUtils.mapLinear(depthZ, -3.5, 3.5, 0.6, 1.3),
        0.6, 1.3
      );

      dummy.position.set(v.x, v.y, v.z);
      const invGroupQuat = group.quaternion.clone().invert();
      dummy.quaternion.copy(camQuat).premultiply(invGroupQuat);
      dummy.scale.setScalar(depthScale);
      dummy.updateMatrix();
      pentMesh.setMatrixAt(i, dummy.matrix);
    });
    pentMesh.instanceMatrix.needsUpdate = true;

    // Theme-reactive color
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var targetHex = isDark ? 0xc9a84c : 0x4a4640;
    if (edgeMat.color.getHex() !== targetHex) {
      edgeMat.color.setHex(targetHex);
      faceMat.color.setHex(targetHex);
      pentMat.color.setHex(targetHex);
    }

    // Time bridge: export state to CSS custom properties
    var docStyle = document.documentElement.style;
    docStyle.setProperty('--dodeca-breathe', breatheEased.toFixed(3));
    docStyle.setProperty('--dodeca-rx', ((group.rotation.x * 180 / Math.PI) % 360).toFixed(1));
    docStyle.setProperty('--dodeca-ry', ((group.rotation.y * 180 / Math.PI) % 360).toFixed(1));
    docStyle.setProperty('--dodeca-rz', ((group.rotation.z * 180 / Math.PI) % 360).toFixed(1));

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
})();
