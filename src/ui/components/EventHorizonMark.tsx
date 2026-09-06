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
 * ─── IT DRIFTS, IT DOES NOT SPIN ───────────────────────────────────────
 * Two ambient loops, both in CSS (see `theme/logo.ts`), neither in JS:
 *
 *   the wrapper BREATHES — a 2.8% scale swell over 9s with the glow rising
 *     to meet it, so the two read as one breath rather than two effects;
 *   the image DRIFTS — one clockwise revolution per minute.
 *
 * A minute per revolution is the whole trick. The artwork has a bright
 * crescent and a four-point flare, and any landmark turning at the SVG
 * logo's 12s orbit reads as a loading spinner — the eye locks onto the flare
 * and starts timing it. At sixty seconds it is alive over a glance and never
 * busy. The SVG can afford to turn fast precisely because it is radially
 * even and offers the eye nothing to time.
 *
 * Two nested elements because one element cannot run two `transform`
 * animations, and their periods are deliberately coprime so the composite
 * never visibly repeats.
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
    <span
      className={["eh-mark", className].filter(Boolean).join(" ")}
      style={{ ["--eh-mark-size" as string]: `${size}px` }}
    >
      <img
        className="eh-mark__img"
        src={EVENT_HORIZON_MARK_PNG}
        alt={ariaLabel}
        width={size}
        height={size}
        draggable={false}
      />
    </span>
  );
}
