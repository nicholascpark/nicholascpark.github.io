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

  // Wireframe edges — metallic silver
  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xc9a84c,
    transparent: true,
    opacity: 0.7,
  });
  const wireframe = new THREE.LineSegments(edgeGeo, edgeMat);
  group.add(wireframe);

  // Transparent faces — faint silver fill
  const faceMat = new THREE.MeshBasicMaterial({
    color: 0xc9a84c,
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
    color: 0xc9a84c,
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

  /* --- Animation loop --- */
  const baseRotationSpeed = 0.002;
  let time = 0;

  function animate() {
    requestAnimationFrame(animate);
    time += 0.01;

    // Smooth mouse lerp
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    // Base rotation + mouse parallax + scroll offset
    group.rotation.x = time * baseRotationSpeed * 0.7 + mouseY * 0.3 + scrollProgress * Math.PI * 0.5;
    group.rotation.y = time * baseRotationSpeed + mouseX * 0.3 + scrollProgress * Math.PI * 0.3;
    group.rotation.z = time * baseRotationSpeed * 0.3;

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
    var breatheScale = 1 + (breatheEased * 2 - 1) * 0.035;
    group.scale.setScalar(breatheScale);

    // Edge opacity pulse — metallic shimmer
    edgeMat.opacity = 0.6 + Math.sin(time * 0.3) * 0.15;

    // --- Time bridge: export state to CSS custom properties ---
    var docStyle = document.documentElement.style;
    docStyle.setProperty('--dodeca-breathe', breatheEased.toFixed(3));
    docStyle.setProperty('--dodeca-rx', ((group.rotation.x * 180 / Math.PI) % 360).toFixed(1));
    docStyle.setProperty('--dodeca-ry', ((group.rotation.y * 180 / Math.PI) % 360).toFixed(1));
    docStyle.setProperty('--dodeca-rz', ((group.rotation.z * 180 / Math.PI) % 360).toFixed(1));

    renderer.render(scene, camera);
  }

  animate();
})();
