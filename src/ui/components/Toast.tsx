/**
 * Toast notification primitives. The host renders a stack of toasts
 * in the bottom-right corner of `.eh-app`; the context provider
 * exposes `useToast()` which returns `showToast({...})`.
 *
 * Toasts are non-blocking. They're ideal for:
 *   - "Receipt saved"
 *   - "Hashing 12 archives..."
 *   - "Profile switched to <name>"
 *
 * For anything that requires acknowledgement, use the ErrorReportModal
 * or a confirmation Modal instead.
 */

import * as React from "react";

export type ToastIntent = "success" | "info" | "warning" | "danger";

export interface ToastInput {
  intent?: ToastIntent;
  title?: React.ReactNode;
  message: React.ReactNode;
  /**
   * Auto-dismiss delay in ms. `0` means sticky (manual dismiss only).
   * Default: 4000ms.
   */
  ttl?: number;
  /**
   * Optional action button (single). Clicking it dismisses the toast.
   */
  action?: { label: string; onClick: () => void };
}

interface ToastInstance extends ToastInput {
  id: number;
  /** Stable hash used to dedupe identical toasts back-to-back. */
  key: string;
}

/** Max simultaneous toasts shown in the stack. Beyond this we drop the
 * oldest. We don't want a buggy loop covering the whole UI. */
const MAX_STACK = 5;

interface ToastContextValue {
  show: (input: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): (input: ToastInput) => number {
  const ctx = React.useContext(ToastContext);
  if (ctx === null) {
    return (): number => {
      // eslint-disable-next-line no-console
      console.warn("[Event Horizon] useToast() called outside ToastProvider");
      return -1;
    };
  }
  return ctx.show;
}

export function useToastDismiss(): (id: number) => void {
  const ctx = React.useContext(ToastContext);
  if (ctx === null) {
    return (): void => undefined;
  }
  return ctx.dismiss;
}

export interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider(props: ToastProviderProps): JSX.Element {
  const [toasts, setToasts] = React.useState<ToastInstance[]>([]);
  const counterRef = React.useRef(0);
  const timeoutsRef = React.useRef<Map<number, number>>(new Map());

  const dismiss = React.useCallback((id: number): void => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timeoutsRef.current.get(id);
    if (t !== undefined) {
      window.clearTimeout(t);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const show = React.useCallback(
    (input: ToastInput): number => {
      const ttl = input.ttl ?? 4000;
      const key = toastDedupKey(input);

      // Capture the dedupe id without setState side-effects fighting
      // each other. We resolve to a single id here then synchronously
      // schedule the auto-dismiss timer below.
      let resolvedId = -1;

      setToasts((prev) => {
        // Dedupe: an identical toast already on screen → just bump
        // its TTL by reissuing the timer below. Don't push a clone.
        const existing = prev.find((t) => t.key === key);
        if (existing !== undefined) {
          resolvedId = existing.id;
          return prev;
        }

        counterRef.current += 1;
        resolvedId = counterRef.current;
        const next = [...prev, { ...input, id: resolvedId, key }];

        // Cap the stack. Oldest excess toasts (still pinned) get
        // discarded; the rest survive.
        if (next.length > MAX_STACK) {
          const overflow = next.length - MAX_STACK;
          for (let i = 0; i < overflow; i++) {
            const dropped = next[i];
            const handle = timeoutsRef.current.get(dropped.id);
            if (handle !== undefined) {
              window.clearTimeout(handle);
              timeoutsRef.current.delete(dropped.id);
            }
          }
          return next.slice(overflow);
        }
        return next;
      });

      // Reschedule the timer for both new + deduped toasts so the
      // user sees the latest occurrence linger a full TTL.
      if (resolvedId >= 0 && ttl > 0) {
        const prevTimer = timeoutsRef.current.get(resolvedId);
        if (prevTimer !== undefined) {
          window.clearTimeout(prevTimer);
        }
        const handle = window.setTimeout(() => dismiss(resolvedId), ttl);
        timeoutsRef.current.set(resolvedId, handle);
      }
      return resolvedId;
    },
    [dismiss],
  );

  React.useEffect(() => {
    return (): void => {
      for (const t of timeoutsRef.current.values()) {
        window.clearTimeout(t);
      }
      timeoutsRef.current.clear();
    };
  }, []);

  const value = React.useMemo<ToastContextValue>(
    () => ({ show, dismiss }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ===========================================================================
// Dedup
// ===========================================================================

/** Best-effort hash over the user-visible content of a toast. Two
 * toasts with the same intent + title + message dedupe, regardless of
 * action button. ReactNode -> string is intentionally shallow: we
 * stringify primitives and fall back to `[node]` so distinct elements
 * still hash distinctly via the surrounding intent/title slots. */
function toastDedupKey(input: ToastInput): string {
  return [
    input.intent ?? "info",
    nodeToText(input.title),
    nodeToText(input.message),
  ].join("\u0001");
}

function nodeToText(node: React.ReactNode): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  return "[node]";
}

// ===========================================================================
// Host
// ===========================================================================

function ToastHost(props: {
  toasts: ToastInstance[];
  onDismiss: (id: number) => void;
}): JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        right: "var(--eh-sp-5)",
        bottom: "var(--eh-sp-5)",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        gap: "var(--eh-sp-2)",
        pointerEvents: "none",
        maxWidth: "380px",
      }}
      aria-live="polite"
      role="region"
    >
      {props.toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onDismiss={(): void => props.onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}

function ToastCard(props: {
  toast: ToastInstance;
  onDismiss: () => void;
}): JSX.Element {
  const { toast, onDismiss } = props;
  const intent = toast.intent ?? "info";

  const accentColor =
    intent === "success"
      ? "var(--eh-success)"
      : intent === "warning"
        ? "var(--eh-warning)"
        : intent === "danger"
          ? "var(--eh-danger)"
          : "var(--eh-info)";

  return (
    <div
      role="status"
      style={{
        pointerEvents: "auto",
        background: "var(--eh-bg-elevated)",
        border: "1px solid var(--eh-border-default)",
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: "var(--eh-radius-md)",
        boxShadow: "var(--eh-shadow-card)",
        padding: "var(--eh-sp-3) var(--eh-sp-4)",
        display: "flex",
        gap: "var(--eh-sp-3)",
        alignItems: "flex-start",
        animation:
          "eh-slide-in-right var(--eh-dur-base) var(--eh-easing) both",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title !== undefined && (
          <div
            style={{
              fontWeight: 600,
              color: "var(--eh-text-primary)",
              fontSize: "var(--eh-text-sm)",
              marginBottom: "var(--eh-sp-1)",
            }}
          >
            {toast.title}
          </div>
        )}
        <div
          style={{
            color: "var(--eh-text-secondary)",
            fontSize: "var(--eh-text-sm)",
            lineHeight: "var(--eh-leading-snug)",
            wordBreak: "break-word",
          }}
        >
          {toast.message}
        </div>
        {toast.action !== undefined && (
          <button
            type="button"
            className="eh-button eh-button--ghost eh-button--sm"
            style={{ marginTop: "var(--eh-sp-2)" }}
            onClick={(): void => {
              toast.action?.onClick();
              onDismiss();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        style={{
          appearance: "none",
          background: "transparent",
          border: 0,
          color: "var(--eh-text-muted)",
          cursor: "pointer",
          fontSize: "var(--eh-text-md)",
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
