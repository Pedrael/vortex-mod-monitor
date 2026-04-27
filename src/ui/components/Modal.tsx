/**
 * Modal primitive for Event Horizon.
 *
 * Behaviour:
 *   - Renders an absolutely-positioned backdrop + a centered card.
 *   - Backdrop fades in (`eh-fade-in`); card scales in (`eh-fade-scale`).
 *   - Esc closes by default. Backdrop click closes by default.
 *   - Both can be disabled via `closeOnEsc` / `closeOnBackdropClick`.
 *   - First focusable element inside the modal is auto-focused on
 *     mount, so keyboard users land on something useful.
 *
 * The modal lives INSIDE `.eh-app` (we don't portal out to body) so
 * Vortex's chrome stays visible — a deliberate choice that prevents
 * the modal from feeling like a system-modal hijacking the whole
 * window.
 *
 * Stacking: backdrop uses `--eh-z-modal`, so any toast/overlay above
 * `--eh-z-toast` (2000) still wins. That matters for dismissal toasts
 * coming out of a modal action — we want them to render over the
 * dimming backdrop, not beneath it.
 */

import * as React from "react";

export type ModalSize = "sm" | "md" | "lg" | "xl";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /**
   * Optional text rendered under the title (in muted color).
   */
  subtitle?: React.ReactNode;
  /**
   * Footer (typically buttons). Aligns to the right by default.
   */
  footer?: React.ReactNode;
  size?: ModalSize;
  closeOnEsc?: boolean;
  closeOnBackdropClick?: boolean;
  /**
   * If true, the close-X button is hidden. Use this for blocking
   * confirmation dialogs where every button is in the footer.
   */
  hideCloseButton?: boolean;
  ariaLabel?: string;
  children?: React.ReactNode;
}

const SIZE_TO_WIDTH: Record<ModalSize, string> = {
  sm: "420px",
  md: "560px",
  lg: "760px",
  xl: "960px",
};

export function Modal(props: ModalProps): JSX.Element | null {
  const {
    open,
    onClose,
    title,
    subtitle,
    footer,
    size = "md",
    closeOnEsc = true,
    closeOnBackdropClick = true,
    hideCloseButton,
    ariaLabel,
    children,
  } = props;

  const cardRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (!closeOnEsc) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return (): void => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, closeOnEsc, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const card = cardRef.current;
    if (card === null) return;
    // Autofocus first focusable element inside the modal so keyboard
    // users land somewhere useful. Falls back to the card itself.
    const focusable = card.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? card).focus();
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = (
    event: React.MouseEvent<HTMLDivElement>,
  ): void => {
    if (!closeOnBackdropClick) return;
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="eh-modal-backdrop"
      onMouseDown={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1000,
        background: "var(--eh-bg-overlay)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--eh-sp-5)",
        animation: "eh-fade-in var(--eh-dur-base) var(--eh-easing) both",
      }}
    >
      <div
        ref={cardRef}
        className="eh-modal"
        tabIndex={-1}
        style={{
          width: "100%",
          maxWidth: SIZE_TO_WIDTH[size],
          maxHeight: "calc(100% - 32px)",
          background: "var(--eh-bg-raised)",
          border: "1px solid var(--eh-border-default)",
          borderRadius: "var(--eh-radius-lg)",
          boxShadow: "var(--eh-shadow-modal)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation:
            "eh-fade-scale var(--eh-dur-base) var(--eh-easing) both",
        }}
      >
        {(title !== undefined || !hideCloseButton) && (
          <header
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "var(--eh-sp-4)",
              padding:
                "var(--eh-sp-5) var(--eh-sp-5) var(--eh-sp-3) var(--eh-sp-5)",
              borderBottom: "1px solid var(--eh-border-subtle)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {title !== undefined && (
                <h3
                  style={{
                    margin: 0,
                    fontSize: "var(--eh-text-lg)",
                    color: "var(--eh-text-primary)",
                  }}
                >
                  {title}
                </h3>
              )}
              {subtitle !== undefined && (
                <p
                  style={{
                    margin: "var(--eh-sp-1) 0 0 0",
                    color: "var(--eh-text-secondary)",
                    fontSize: "var(--eh-text-sm)",
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: 0,
                  color: "var(--eh-text-muted)",
                  fontSize: "var(--eh-text-xl)",
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: "var(--eh-sp-1) var(--eh-sp-2)",
                  borderRadius: "var(--eh-radius-sm)",
                  transition:
                    "color var(--eh-dur-fast) var(--eh-easing), background var(--eh-dur-fast) var(--eh-easing)",
                }}
                onMouseEnter={(e): void => {
                  e.currentTarget.style.color = "var(--eh-text-primary)";
                  e.currentTarget.style.background = "var(--eh-border-subtle)";
                }}
                onMouseLeave={(e): void => {
                  e.currentTarget.style.color = "var(--eh-text-muted)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                ×
              </button>
            )}
          </header>
        )}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--eh-sp-5)",
          }}
        >
          {children}
        </div>
        {footer !== undefined && (
          <footer
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "var(--eh-sp-2)",
              padding: "var(--eh-sp-4) var(--eh-sp-5)",
              borderTop: "1px solid var(--eh-border-subtle)",
              background: "var(--eh-bg-base)",
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
