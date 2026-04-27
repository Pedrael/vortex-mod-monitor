/**
 * Event Horizon card primitive.
 *
 * Two flavors:
 *   - Static card (default): just a styled container.
 *   - Interactive card (`onClick` provided): hoverable with a subtle
 *     gradient border-on-hover and tap feedback. Behaves as a button
 *     for keyboard a11y when interactive.
 *
 * Composition slots:
 *   - `icon`     : an optional ReactNode rendered in the icon block.
 *   - `title`    : card heading.
 *   - `children` : card body.
 *   - `footer`   : optional footer strip (small, uppercase by default).
 */

import * as React from "react";

export interface CardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  footer?: React.ReactNode;
  onClick?: () => void;
  /**
   * Disables the interactive treatment even if `onClick` is set.
   * Useful for cards that look identical regardless of hover.
   */
  inert?: boolean;
}

export function Card(props: CardProps): JSX.Element {
  const {
    icon,
    title,
    footer,
    onClick,
    inert,
    className,
    children,
    ...rest
  } = props;

  const isInteractive = onClick !== undefined && !inert;

  const classes = [
    "eh-card",
    isInteractive ? "eh-card--interactive" : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ): void => {
    if (!isInteractive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={classes}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      {...rest}
    >
      {icon !== undefined && (
        <div className="eh-card__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      {title !== undefined && (
        <h3 className="eh-card__title">{title}</h3>
      )}
      {children !== undefined && (
        <div className="eh-card__body">{children}</div>
      )}
      {footer !== undefined && (
        <div className="eh-card__footer">{footer}</div>
      )}
    </div>
  );
}
