/**
 * CSS for the animated EventHorizonLogo SVG.
 *
 * The logo has four animated layers, all CSS-driven (no JS, no
 * requestAnimationFrame). Each layer rotates / pulses on its own
 * timeline so the composite never looks repetitive.
 *
 * Layers (back-to-front):
 *  1. `eh-logo__photon-ring`   — outermost faint ring, rotates CCW slow.
 *  2. `eh-logo__lens-arc`      — a bright Doppler-shifted arc that
 *                                sweeps around the disk every 8s,
 *                                fading in/out.
 *  3. `eh-logo__accretion-disk`— main visible disk, rotates CW.
 *  4. `eh-logo__core`          — pure-black singularity with a soft
 *                                breathing pulse (warp_pulse keyframe).
 *
 * Sizing: the entire logo lives inside a 200x200 SVG viewBox and is
 * sized via the `--eh-logo-size` custom property on the wrapper.
 */

export const LOGO_CSS = `
.eh-logo {
  display: inline-block;
  width: var(--eh-logo-size, 120px);
  height: var(--eh-logo-size, 120px);
  position: relative;
  flex-shrink: 0;
  isolation: isolate;
  animation: eh-warp-pulse var(--eh-dur-warp) ease-in-out infinite;
  transform-origin: center;
}

.eh-logo__svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.eh-logo__photon-ring {
  transform-origin: center;
  animation: eh-rotate-ccw var(--eh-dur-orbit) linear infinite;
}

.eh-logo__accretion-disk {
  transform-origin: center;
  animation: eh-rotate-cw var(--eh-dur-orbit-fast) linear infinite;
}

.eh-logo__lens-arc {
  transform-origin: center;
  animation: eh-doppler-sweep 8s var(--eh-easing) infinite;
}

.eh-logo__core {
  transform-origin: center;
  /* Slight independent breathing so the singularity feels alive
     even when the rotations are paused (reduced-motion). */
  animation: eh-pulse-opacity 4s ease-in-out infinite;
}

.eh-logo__halo {
  transform-origin: center;
  animation: eh-pulse-glow 4s ease-in-out infinite;
}

/* When the user prefers reduced motion, kill the rotation but
   keep the gentle breathing on the core + halo so the logo
   doesn't feel dead. */
@media (prefers-reduced-motion: reduce) {
  .eh-logo,
  .eh-logo__photon-ring,
  .eh-logo__accretion-disk,
  .eh-logo__lens-arc {
    animation: none !important;
  }
}
`;
