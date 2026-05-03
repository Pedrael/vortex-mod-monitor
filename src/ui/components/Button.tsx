/**
 * Event Horizon button primitive.
 *
 * Three intents:
 *   - "primary"  : solid disk-orange → pink on hover (see theme).
 *   - "ghost"    : transparent w/ border, used for secondary actions.
 *   - "danger"   : red outline, used for destructive confirmations.
 *
 * Two sizes:
 *   - "md" (default)
 *   - "sm" / "lg"
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
    style: _omitInlineStyle,
    ...rest
  } = props;

  const classes = [
    "eh-button",
    `eh-button--${intent}`,
    size !== "md" ? `eh-button--${size}` : undefined,
    fullWidth ? "eh-button--full-width" : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type ?? "button"} className={classes} {...rest}>
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
