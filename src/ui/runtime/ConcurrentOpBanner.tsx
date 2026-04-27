/**
 * Inline banner shown at the top of a wizard when the OTHER pipeline
 * is currently running. Keeps the user informed without forbidding
 * the operation outright — they may know exactly what they're doing.
 */

import * as React from "react";

import { useEHRuntime } from "./useEHRuntime";

export type Pipeline = "build" | "install";

export interface ConcurrentOpBannerProps {
  /** Which pipeline this page is showing. We hide if it matches. */
  self: Pipeline;
}

export function ConcurrentOpBanner(
  props: ConcurrentOpBannerProps,
): JSX.Element | null {
  const { buildBusy, installBusy } = useEHRuntime();

  const otherBusy =
    (props.self === "build" && installBusy) ||
    (props.self === "install" && buildBusy);

  if (!otherBusy) return null;

  const otherLabel = props.self === "build" ? "install" : "build";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        margin: "0 0 var(--eh-sp-4) 0",
        padding: "var(--eh-sp-3) var(--eh-sp-4)",
        background: "color-mix(in srgb, var(--eh-warning) 12%, transparent)",
        border: "1px solid color-mix(in srgb, var(--eh-warning) 35%, transparent)",
        borderRadius: "var(--eh-radius-md)",
        color: "var(--eh-text-primary)",
        fontSize: "var(--eh-text-sm)",
        lineHeight: "var(--eh-leading-relaxed)",
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--eh-sp-3)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontSize: "var(--eh-text-md)",
          lineHeight: 1,
          marginTop: 2,
        }}
      >
        ⚠
      </span>
      <div>
        <strong style={{ display: "block", marginBottom: 2 }}>
          A {otherLabel} is in progress on the other tab.
        </strong>
        <span style={{ color: "var(--eh-text-secondary)" }}>
          Both pipelines read Vortex state at the same time. You can
          continue, but a snapshot taken now may not match the disk
          once the {otherLabel} finishes.
        </span>
      </div>
    </div>
  );
}
