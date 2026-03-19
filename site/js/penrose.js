/**
 * Penrose P3 tiling generator — Robinson triangle subdivision.
 * Produces triangle shard data for the dodecahedron entrance animation.
 */

// eslint-disable-next-line no-unused-vars
function generatePenroseTiling(config) {
  var radius = config.radius || 6;
  var iterations = config.iterations || 4;
  var innerRadius = config.innerRadius || 2.5;  // tiles within this are "inner" (dodecahedron zone)
  var maxRadius = config.maxRadius || 8;

  var PHI = (1 + Math.sqrt(5)) / 2;

  // Start: 10 triangles forming a decagonal sun
  // Rotated -90° so top vertex aligns with dodecahedron's orientation
  var triangles = [];
  for (var i = 0; i < 10; i++) {
    var a1 = (2 * Math.PI * i) / 10 - Math.PI / 2;
    var a2 = (2 * Math.PI * (i + 1)) / 10 - Math.PI / 2;
    var B = [radius * Math.cos(a1), radius * Math.sin(a1)];
    var C = [radius * Math.cos(a2), radius * Math.sin(a2)];
    if (i % 2 === 0) {
      triangles.push({ type: 0, A: [0, 0], B: B, C: C });
    } else {
      triangles.push({ type: 0, A: [0, 0], B: C, C: B });
    }
  }

  // Subdivide using Robinson triangle rules
  for (var iter = 0; iter < iterations; iter++) {
    var next = [];
    for (var t = 0; t < triangles.length; t++) {
      var tri = triangles[t];
      var A = tri.A, B = tri.B, C = tri.C;

      if (tri.type === 0) {
        // Thin (golden gnomon) → 1 thin + 1 thick
        var P = [A[0] + (B[0] - A[0]) / PHI, A[1] + (B[1] - A[1]) / PHI];
        next.push({ type: 0, A: C, B: P, C: B });
        next.push({ type: 1, A: P, B: C, C: A });
      } else {
        // Thick (golden triangle) → 2 thick + 1 thin
        var Q = [B[0] + (A[0] - B[0]) / PHI, B[1] + (A[1] - B[1]) / PHI];
        var R = [B[0] + (C[0] - B[0]) / PHI, B[1] + (C[1] - B[1]) / PHI];
        next.push({ type: 1, A: R, B: C, C: A });
        next.push({ type: 1, A: Q, B: R, C: B });
        next.push({ type: 0, A: R, B: Q, C: A });
      }
    }
    triangles = next;
  }

  // Filter and compute metadata
  var result = [];
  for (var t = 0; t < triangles.length; t++) {
    var tri = triangles[t];
    var cx = (tri.A[0] + tri.B[0] + tri.C[0]) / 3;
    var cy = (tri.A[1] + tri.B[1] + tri.C[1]) / 3;
    var dist = Math.sqrt(cx * cx + cy * cy);

    if (dist < maxRadius) {
      result.push({
        vertices: [tri.A, tri.B, tri.C],
        center: [cx, cy],
        dist: dist,
        type: tri.type,
        inner: dist < innerRadius,  // true = part of the dodecahedron zone
      });
    }
  }

  return result;
}
