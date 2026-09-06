/**
 * CSS for the two animated brand marks — the EventHorizonLogo SVG and the
 * EventHorizonMark raster.
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

/* ── The raster mark (EventHorizonMark) ──────────────────────────────
   Two nested elements because one element cannot run two transform
   animations: the wrapper breathes, the image inside it turns. Splitting
   them also lets the two timelines stay coprime, so the composite never
   visibly repeats — the same reason the SVG layers each have their own. */
.eh-mark {
  display: inline-block;
  width: var(--eh-mark-size, 120px);
  height: var(--eh-mark-size, 120px);
  flex-shrink: 0;
  isolation: isolate;
  transform-origin: center;
  animation: eh-mark-breathe var(--eh-dur-breathe) ease-in-out infinite;
  /* The glow is animated on this element, so it must not also be set inline
     on the image — an inline filter would win and freeze the pulse. */
}

.eh-mark__img {
  display: block;
  width: 100%;
  height: 100%;
  /* The source is square with a transparent surround, so nothing is cropped
     and the aspect ratio cannot drift. */
  object-fit: contain;
  transform-origin: center;
  animation: eh-rotate-cw var(--eh-dur-drift) linear infinite;
  -webkit-user-select: none;
  user-select: none;
}

/* When the user prefers reduced motion, kill the rotation but
   keep the gentle breathing on the core + halo so the logo
   doesn't feel dead. */
@media (prefers-reduced-motion: reduce) {
  .eh-logo,
  .eh-logo__photon-ring,
  .eh-logo__accretion-disk,
  .eh-logo__lens-arc,
  .eh-mark,
  .eh-mark__img {
    animation: none !important;
  }

  /* The breath carried the glow, so hand it back statically rather than
     letting reduced motion quietly delete the shadow as well. */
  .eh-mark {
    filter: drop-shadow(0 0 18px rgba(240, 56, 107, 0.28));
  }
}
`;
