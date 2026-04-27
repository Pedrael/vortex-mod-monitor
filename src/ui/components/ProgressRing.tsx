/**
 * Circular progress ring with the accretion-disk gradient as the bar.
 *
 * Two modes:
 *   - Determinate (pass `value` 0–1)  : displays percentage label.
 *   - Indeterminate (`value` omitted) : spins forever.
 *
 * Uses a single SVG with a stable gradient id (`eh-ring-gradient`).
 * If multiple rings appear on the same page that's fine — gradients
 * with identical `<defs>` ids resolve to the same definition; we only
 * need one.
 */

import * as React from "react";

export interface ProgressRingProps {
  /**
   * Progress from 0 to 1. Omit for indeterminate mode.
   */
  value?: number;
  size?: number;
  /**
   * Optional center label override. Defaults to the percentage when
   * determinate, and an animated dot when indeterminate.
   */
  label?: React.ReactNode;
  className?: string;
}

export function ProgressRing(props: ProgressRingProps): JSX.Element {
  const { value, size = 64, label, className } = props;

  const stroke = 4;
  const radius = 50 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const indeterminate = value === undefined;

  const clampedValue = clamp(value ?? 0, 0, 1);
  const dashOffset = circumference * (1 - clampedValue);

  const classes = ["eh-ring", className].filter(Boolean).join(" ");

  const renderLabel = (): React.ReactNode => {
    if (label !== undefined) return label;
    if (indeterminate) return null;
    return (
      <span className="eh-ring__label">{Math.round(clampedValue * 100)}%</span>
    );
  };

  return (
    <span
      className={classes}
      style={{ ["--eh-ring-size" as string]: `${size}px` }}
    >
      <svg
        className="eh-ring__svg"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="eh-ring-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#ffb15c" />
            <stop offset="50%" stopColor="#f0386b" />
            <stop offset="100%" stopColor="#5f2ca5" />
          </linearGradient>
        </defs>
        <circle
          className="eh-ring__track"
          cx="50"
          cy="50"
          r={radius}
        />
        <g className={indeterminate ? "eh-ring__indeterminate" : undefined}>
          <circle
            className="eh-ring__bar"
            cx="50"
            cy="50"
            r={radius}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={
              indeterminate
                ? circumference * 0.7
                : dashOffset
            }
          />
        </g>
      </svg>
      {renderLabel()}
    </span>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
