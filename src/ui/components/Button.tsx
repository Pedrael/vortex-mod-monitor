/**
 * Event Horizon button primitive.
 *
 * Three intents:
 *   - "primary"  : the accretion-disk-gradient button (one-per-page).
 *   - "ghost"    : transparent w/ border, used for secondary actions.
 *   - "danger"   : red outline, used for destructive confirmations.
 *
 * Two sizes:
 *   - "md" (default)
 *   - "sm" / "lg"
 *
 * The shimmer effect on `primary:hover` is fully CSS-driven (see
 * `theme/components.ts`).
 */

import * as React from "react";

export type ButtonIntent = "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: ButtonIntent;
  size?: ButtonSize;
  /**
   * Optional leading icon (ReactNode — already-rendered SVG, glyph,
   * or Vortex `<Icon />`).
   */
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button(props: ButtonProps): JSX.Element {
  const {
    intent = "ghost",
    size = "md",
    leadingIcon,
    trailingIcon,
    fullWidth,
    className,
    children,
    type,
    ...rest
  } = props;

  const classes = [
    "eh-button",
    `eh-button--${intent}`,
    size !== "md" ? `eh-button--${size}` : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const style: React.CSSProperties | undefined = fullWidth
    ? { width: "100%" }
    : undefined;

  return (
    <button
      type={type ?? "button"}
      className={classes}
      style={{ ...(style ?? {}), ...(rest.style ?? {}) }}
      {...rest}
    >
      {leadingIcon !== undefined && (
        <span className="eh-button__icon" aria-hidden="true">
          {leadingIcon}
        </span>
      )}
      <span>{children}</span>
      {trailingIcon !== undefined && (
        <span className="eh-button__icon" aria-hidden="true">
          {trailingIcon}
        </span>
      )}
    </button>
  );
}
