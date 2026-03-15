/**
 * Human Breathing Algorithm
 *
 * A piecewise easing function that models natural human breathing rhythm.
 * Returns a 0→1→0 value over a configurable cycle, with four distinct phases:
 *
 *   Inhale  → Hold → Exhale → Rest → (repeat)
 *
 * Unlike a sine wave (symmetric rise/fall), this curve captures the
 * asymmetry of real breathing: inhale is faster than exhale, with
 * distinct pauses at full expansion and at rest.
 *
 * Each phase uses smoothstep easing (t² × (3 - 2t)) for organic,
 * jerk-free transitions — no abrupt velocity changes between phases.
 *
 * Usage:
 *   var b = breathe(elapsedTime);           // default 10s cycle
 *   var b = breathe(elapsedTime, { cycleDuration: 8 });
 *   var b = breathe(elapsedTime, { inhaleRatio: 1.8 });
 *
 * @param {number} time — elapsed time in seconds (or any linear counter)
 * @param {object} [opts] — configuration
 * @param {number} [opts.cycleDuration=10] — full cycle length in same units as time
 * @param {number} [opts.inhaleRatio=1.5] — how much faster inhale is vs exhale (1.5 = 50% faster)
 * @param {number} [opts.holdFraction=0.08] — fraction of cycle spent holding at full
 * @param {number} [opts.restFraction=0.30] — fraction of cycle spent resting at empty
 * @returns {number} 0–1 breathing value (0 = fully contracted, 1 = fully expanded)
 */
function breathe(time, opts) {
  opts = opts || {};
  var cycleDuration = opts.cycleDuration || 10;
  var inhaleRatio   = opts.inhaleRatio   || 1.5;
  var holdFraction  = opts.holdFraction  || 0.08;
  var restFraction  = opts.restFraction  || 0.30;

  // Derive inhale/exhale fractions from the ratio
  // inhaleRatio = exhaleTime / inhaleTime
  // inhaleFrac + exhaleFrac = 1 - holdFraction - restFraction
  // exhaleFrac = inhaleFrac * inhaleRatio
  var movingFraction = 1 - holdFraction - restFraction;
  var inhaleFraction = movingFraction / (1 + inhaleRatio);
  var exhaleFraction = movingFraction - inhaleFraction;

  // Phase boundaries
  var inhaleEnd = inhaleFraction;
  var holdEnd   = inhaleEnd + holdFraction;
  var exhaleEnd = holdEnd + exhaleFraction;
  // restEnd = 1.0

  // Current phase position (0–1 within cycle)
  var phase = ((time % cycleDuration) / cycleDuration);
  // Handle negative time gracefully
  if (phase < 0) phase += 1;

  if (phase < inhaleEnd) {
    // Inhale — smoothstep rise
    var t = phase / inhaleEnd;
    return smoothstep(t);

  } else if (phase < holdEnd) {
    // Hold at full expansion
    return 1;

  } else if (phase < exhaleEnd) {
    // Exhale — smoothstep fall (slower than inhale)
    var t = (phase - holdEnd) / (exhaleEnd - holdEnd);
    return 1 - smoothstep(t);

  } else {
    // Rest at empty
    return 0;
  }
}

/**
 * Attempt to make available as ES module; fall back to global.
 * In a <script> tag context, `breathe` is simply a global function.
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = breathe;
}

/* --- Internal --- */

/**
 * Smoothstep: classic Hermite interpolation.
 * Maps 0→0, 1→1 with zero first-derivative at both endpoints.
 * Produces organic, jerk-free motion.
 *
 *   f(t) = t² × (3 - 2t)
 *
 *   f(0)  = 0,  f'(0) = 0   — starts from rest
 *   f(1)  = 1,  f'(1) = 0   — arrives at rest
 *   f(0.5) = 0.5             — symmetric midpoint
 */
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}
