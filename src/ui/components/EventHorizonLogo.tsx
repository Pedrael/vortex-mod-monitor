/**
 * The signature animated logo of Event Horizon.
 *
 * Composed of five SVG layers, each on its own CSS animation timeline:
 *   1. Halo          — outer breathing glow.
 *   2. Photon ring   — faint outer ring, rotates CCW slowly.
 *   3. Accretion     — main visible disk gradient + embers, rotates CW.
 *   4. Lens arc      — bright Doppler crescent, sweeps every 8s.
 *   5. Core          — singularity (black radial-gradient circle).
 *
 * Animation lives entirely in CSS (see `theme/logo.ts`). This file is
 * pure markup + per-instance SVG `<defs>` ids so multiple logos on the
 * same page never collide.
 *
 * Sizing: pass a `size` prop (number => pixels) or rely on the default
 * 120px. For perfect rendering at any DPI, the viewBox is fixed at
 * 200x200 and only the wrapper element resizes.
 *
 * Accessibility: the wrapper carries `role="img"` and an `aria-label`
 * so screen readers announce "Event Horizon" rather than reading every
 * inner SVG node.
 */

import * as React from "react";

export interface EventHorizonLogoProps {
  /**
   * Pixel size for both width and height. Default: 120.
   */
  size?: number;
  /**
   * Optional aria-label override. Defaults to "Event Horizon logo".
   */
  ariaLabel?: string;
  /**
   * Pass-through className for layout positioning.
   */
  className?: string;
}

/**
 * Monotonically increasing instance counter for defs-id uniqueness.
 * Module-scoped — survives re-renders, fine for our single-bundle
 * extension. Not exported.
 */
let logoInstanceCounter = 0;

export function EventHorizonLogo(props: EventHorizonLogoProps): JSX.Element {
  const { size = 120, ariaLabel = "Event Horizon logo", className } = props;

  // Lazily allocate a stable instance id on first render. Using
  // useState with a lazy initialiser guarantees one id per component
  // instance, regardless of re-renders.
  const [instanceId] = React.useState(() => {
    logoInstanceCounter += 1;
    return logoInstanceCounter;
  });

  const idHaloGrad = `eh-logo-halo-${instanceId}`;
  const idDiskGrad = `eh-logo-disk-${instanceId}`;
  const idCoreGrad = `eh-logo-core-${instanceId}`;
  const idEmberGrad = `eh-logo-ember-${instanceId}`;
  const idGlowFilter = `eh-logo-glow-${instanceId}`;
  const idBlurFilter = `eh-logo-blur-${instanceId}`;

  const wrapperClassName = ["eh-logo", className].filter(Boolean).join(" ");

  return (
    <span
      className={wrapperClassName}
      style={{ ["--eh-logo-size" as string]: `${size}px` }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg
        className="eh-logo__svg"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={idHaloGrad} cx="50%" cy="50%" r="50%">
            <stop offset="35%" stopColor="rgba(240,56,107,0)" />
            <stop offset="62%" stopColor="rgba(240,56,107,0.18)" />
            <stop offset="82%" stopColor="rgba(95,44,165,0.12)" />
            <stop offset="100%" stopColor="rgba(95,44,165,0)" />
          </radialGradient>

          <linearGradient
            id={idDiskGrad}
            x1="0%"
            y1="50%"
            x2="100%"
            y2="50%"
          >
            <stop offset="0%" stopColor="#ffb15c" />
            <stop offset="22%" stopColor="#ff6b3d" />
            <stop offset="48%" stopColor="#f0386b" />
            <stop offset="72%" stopColor="#a93289" />
            <stop offset="100%" stopColor="#5f2ca5" />
          </linearGradient>

          <linearGradient
            id={idEmberGrad}
            x1="0%"
            y1="50%"
            x2="100%"
            y2="50%"
          >
            <stop offset="0%" stopColor="#fff4d6" />
            <stop offset="50%" stopColor="#ffd9b8" />
            <stop offset="100%" stopColor="#ff9d6c" />
          </linearGradient>

          <radialGradient id={idCoreGrad} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" />
            <stop offset="78%" stopColor="#050309" />
            <stop offset="93%" stopColor="rgba(95,44,165,0.55)" />
            <stop offset="100%" stopColor="rgba(95,44,165,0)" />
          </radialGradient>

          <filter id={idGlowFilter} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id={idBlurFilter} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Layer 1 — outer breathing halo */}
        <circle
          className="eh-logo__halo"
          cx="100"
          cy="100"
          r="96"
          fill={`url(#${idHaloGrad})`}
          filter={`url(#${idBlurFilter})`}
        />

        {/* Layer 2 — photon ring (CCW, slow) */}
        <g className="eh-logo__photon-ring">
          <circle
            cx="100"
            cy="100"
            r="86"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="0.6"
          />
          <circle
            cx="100"
            cy="100"
            r="86"
            fill="none"
            stroke="#76e4f7"
            strokeWidth="1.4"
            strokeDasharray="42 500"
            strokeLinecap="round"
            filter={`url(#${idGlowFilter})`}
            opacity="0.9"
          />
        </g>

        {/* Layer 3 — accretion disk (CW, faster) */}
        <g className="eh-logo__accretion-disk">
          <circle
            cx="100"
            cy="100"
            r="74"
            fill="none"
            stroke={`url(#${idDiskGrad})`}
            strokeWidth="6"
            opacity="0.88"
          />
          <circle
            cx="100"
            cy="100"
            r="62"
            fill="none"
            stroke={`url(#${idDiskGrad})`}
            strokeWidth="3.6"
            opacity="0.96"
          />
          {/* Embers — bright tiny dashes riding along the outer disk */}
          <circle
            cx="100"
            cy="100"
            r="74"
            fill="none"
            stroke={`url(#${idEmberGrad})`}
            strokeWidth="1.6"
            strokeDasharray="2 58"
            strokeDashoffset="0"
            strokeLinecap="round"
            filter={`url(#${idGlowFilter})`}
          />
          <circle
            cx="100"
            cy="100"
            r="62"
            fill="none"
            stroke="#ffe3a8"
            strokeWidth="1.2"
            strokeDasharray="1.5 84"
            strokeDashoffset="20"
            strokeLinecap="round"
            filter={`url(#${idGlowFilter})`}
            opacity="0.85"
          />
        </g>

        {/* Layer 4 — lens arc (Doppler-bright crescent that sweeps) */}
        <g className="eh-logo__lens-arc">
          <path
            d="M 100 21 A 79 79 0 0 1 179 100"
            fill="none"
            stroke="#fff4d6"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter={`url(#${idGlowFilter})`}
            opacity="0.9"
          />
        </g>

        {/* Layer 5 — singularity core */}
        <circle
          className="eh-logo__core"
          cx="100"
          cy="100"
          r="50"
          fill={`url(#${idCoreGrad})`}
        />
      </svg>
    </span>
  );
}
