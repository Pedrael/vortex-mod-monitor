/**
 * Event Horizon pill / tag primitive.
 *
 * Used for status indicators, version tags, mod sources, etc.
 * Carries an optional dot when `withDot` is set; the dot inherits the
 * intent color and gets a small glow.
 */

import * as React from "react";

export type PillIntent = "neutral" | "success" | "warning" | "danger" | "info";

export interface PillProps {
  intent?: PillIntent;
  withDot?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Pill(props: PillProps): JSX.Element {
  const { intent = "neutral", withDot, className, children } = props;

  const classes = [
    "eh-pill",
    intent !== "neutral" ? `eh-pill--${intent}` : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      {withDot && <span className="eh-pill__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
