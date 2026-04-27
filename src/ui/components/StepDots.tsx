/**
 * Wizard step indicator — N dots where the current one expands into
 * a pill with the disk gradient, completed steps go green.
 *
 * Used in the Phase 5.1 install wizard to show: pick → preview →
 * conflicts → orphans → install → done.
 *
 * Design note: the active dot animates width from 8px → 24px, so the
 * indicator scans like a comet. Completed dots stay round but adopt
 * the success color; pending dots are muted.
 */

import * as React from "react";

export interface StepDotsProps {
  /**
   * Total number of steps (>=1).
   */
  total: number;
  /**
   * Current step index, 0-based. Anything < current is "done", == is
   * "active", > is pending.
   */
  current: number;
  className?: string;
  /**
   * Optional aria-label override; default produced from current/total.
   */
  ariaLabel?: string;
}

export function StepDots(props: StepDotsProps): JSX.Element {
  const { total, current, className, ariaLabel } = props;
  const safeTotal = Math.max(1, Math.floor(total));
  const safeCurrent = Math.max(0, Math.min(safeTotal - 1, Math.floor(current)));

  const classes = ["eh-steps", className].filter(Boolean).join(" ");

  const dots = Array.from({ length: safeTotal }, (_, idx) => {
    const dotClass =
      idx < safeCurrent
        ? "eh-steps__dot eh-steps__dot--done"
        : idx === safeCurrent
          ? "eh-steps__dot eh-steps__dot--active"
          : "eh-steps__dot";
    return <span key={idx} className={dotClass} />;
  });

  return (
    <div
      className={classes}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={safeTotal}
      aria-valuenow={safeCurrent + 1}
      aria-label={ariaLabel ?? `Step ${safeCurrent + 1} of ${safeTotal}`}
    >
      {dots}
    </div>
  );
}
