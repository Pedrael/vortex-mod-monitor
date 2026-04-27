/**
 * Common page wrapper used by every Event Horizon page.
 *
 * Responsibilities:
 *   - Apply the entrance animation (fade-up via CSS class).
 *   - Render an optional page header (title + subtitle + actions).
 *   - Render the page body in a max-content-width column.
 *
 * Pages compose `Page` so they all feel consistent (consistent
 * padding, consistent entrance, consistent header layout) without any
 * page having to remember the exact spacing tokens.
 */

import * as React from "react";

export interface PageProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /**
   * Optional right-side content for the header (typically buttons).
   */
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function Page(props: PageProps): JSX.Element {
  const { title, subtitle, actions, className, children } = props;

  const classes = ["eh-page", className].filter(Boolean).join(" ");

  const hasHeader =
    title !== undefined || subtitle !== undefined || actions !== undefined;

  return (
    <div className={classes}>
      {hasHeader && (
        <header
          className="eh-page__header"
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "var(--eh-sp-4)",
            flexWrap: "wrap",
          }}
        >
          <div>
            {title !== undefined && (
              <h1 className="eh-page__title">{title}</h1>
            )}
            {subtitle !== undefined && (
              <p className="eh-page__subtitle">{subtitle}</p>
            )}
          </div>
          {actions !== undefined && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--eh-sp-2)",
              }}
            >
              {actions}
            </div>
          )}
        </header>
      )}
      {children}
    </div>
  );
}
