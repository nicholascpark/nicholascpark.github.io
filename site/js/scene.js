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

  const geo = new THREE.DodecahedronGeometry(2.8, 0);

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

  // Outer glow shell — slightly larger, very faint
  const glowGeo = new THREE.DodecahedronGeometry(3.0, 0);
  const glowEdgeGeo = new THREE.EdgesGeometry(glowGeo);
  const glowMat = new THREE.LineBasicMaterial({
    color: 0xc9a84c,
    transparent: true,
    opacity: 0.15,
  });
  const glowWireframe = new THREE.LineSegments(glowEdgeGeo, glowMat);
  group.add(glowWireframe);

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
  // Dynamically update canvas CSS mask so the dodecahedron fades
  // behind content regions as the user scrolls
  function updateContentMask() {
    const root = document.getElementById('root');
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Content column bounds as percentages of viewport width
    const leftEdge = ((rootRect.left - 40) / vw) * 100;
    const rightEdge = ((rootRect.right + 40) / vw) * 100;

    // Vertical: fade where content is visible in viewport
    const contentTop = Math.max(0, rootRect.top);
    const contentBottom = Math.min(vh, rootRect.bottom);
    const topPct = (contentTop / vh) * 100;
    const bottomPct = (contentBottom / vh) * 100;

    // Build a CSS mask: full opacity everywhere except a soft
    // rectangle over the content area which is semi-transparent
    canvas.style.maskImage = `
      linear-gradient(to right,
        rgba(0,0,0,1) 0%,
        rgba(0,0,0,1) ${leftEdge}%,
        rgba(0,0,0,0.55) ${leftEdge + 3}%,
        rgba(0,0,0,0.55) ${rightEdge - 3}%,
        rgba(0,0,0,1) ${rightEdge}%,
        rgba(0,0,0,1) 100%
      )`;
    canvas.style.webkitMaskImage = canvas.style.maskImage;
  }

  window.addEventListener('scroll', updateContentMask);
  window.addEventListener('resize', updateContentMask);
  // Initial call after a short delay so DOM is ready
  setTimeout(updateContentMask, 200);

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
    pentMesh.instanceMatrix.needsUpdate = true;

    // Subtle breathing scale
    const breathe = 1 + Math.sin(time * 0.5) * 0.015;
    group.scale.setScalar(breathe);

    // Edge opacity pulse — metallic shimmer
    edgeMat.opacity = 0.6 + Math.sin(time * 0.3) * 0.15;

    renderer.render(scene, camera);
  }

  animate();
})();
