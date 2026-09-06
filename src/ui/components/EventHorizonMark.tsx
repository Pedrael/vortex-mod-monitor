/**
 * ──────────────────────────────────────────────────────────────────────
 * The real brand mark, for the places big enough to deserve it.
 *
 * Deliberately NOT a replacement for `EventHorizonLogo`. The two are for
 * different jobs and both are correct where they are used:
 *
 *   `EventHorizonLogo` — five animated SVG layers. Vector, so it stays sharp
 *     at 28px in the nav bar; it rotates, and the rotation is the concept.
 *     Its geometry is concentric BECAUSE it spins: perfect circles are what
 *     let it turn without wobbling.
 *
 *   `EventHorizonMark` (this) — the actual artwork. Filaments, turbulence,
 *     a star flare, a wisp trailing off the lower right. None of that
 *     survives being 28 pixels wide; all of it is the point at 96 and above.
 *
 * So this is used at the three hero moments — About, Home, and the install
 * step — and the animated logo keeps every small and inline placement.
 *
 * ─── NO ROTATION ───────────────────────────────────────────────────────
 * Spinning it would be physically apt and visually wrong. The artwork has a
 * bright asymmetric crescent and a four-point flare, so a rotation reads as a
 * loading spinner rather than as an accretion disk — the eye locks onto the
 * flare and starts timing it. The animated SVG can rotate precisely because
 * it is radially even and has no such landmark.
 * ──────────────────────────────────────────────────────────────────────
 */

import * as React from "react";

import { EVENT_HORIZON_MARK_PNG } from "./eventHorizonMarkData";

export interface EventHorizonMarkProps {
  /** Pixel size for both width and height. Default: 120. */
  size?: number;
  /** Optional aria-label override. Defaults to "Event Horizon logo". */
  ariaLabel?: string;
  /** Pass-through className for layout positioning. */
  className?: string;
}

export function EventHorizonMark(props: EventHorizonMarkProps): JSX.Element {
  const { size = 120, ariaLabel = "Event Horizon logo", className } = props;

  return (
    <img
      src={EVENT_HORIZON_MARK_PNG}
      alt={ariaLabel}
      width={size}
      height={size}
      className={className}
      style={{
        display: "block",
        width: size,
        height: size,
        // The source is 320px square with a transparent surround, so nothing
        // is cropped and the aspect ratio cannot drift.
        objectFit: "contain",
        // The artwork's own glow stops at its alpha edge. A soft shadow in the
        // brand's magenta lets it sit ON the panel rather than in front of it,
        // which is what the animated logo gets for free from its halo layer.
        filter: "drop-shadow(0 0 18px rgba(240, 56, 107, 0.28))",
        // Purely decorative next to a heading that already names the product.
        userSelect: "none",
      }}
      draggable={false}
    />
  );
}
