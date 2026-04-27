/**
 * About page — short pitch + status pills + supported games.
 *
 * Doubles as a smoke test for the design tokens (primary text,
 * secondary text, pills, gradient wordmark).
 */

import * as React from "react";

import { EventHorizonLogo, Page, Pill } from "../components";
import { EXTENSION_VERSION } from "../version";

export function AboutPage(): JSX.Element {
  return (
    <Page>
      <div
        style={{
          display: "flex",
          gap: "var(--eh-sp-6)",
          alignItems: "flex-start",
          flexWrap: "wrap",
          padding: "var(--eh-sp-5)",
          background: "var(--eh-bg-glass)",
          border: "1px solid var(--eh-border-subtle)",
          borderRadius: "var(--eh-radius-lg)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <EventHorizonLogo size={96} />
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <h2 style={{ marginBottom: "var(--eh-sp-2)" }}>
            <span className="eh-text-gradient">Event Horizon</span>
          </h2>
          <p style={{ marginBottom: "var(--eh-sp-4)" }}>
            A drop-in collection installer for Vortex that captures every
            piece of curator state — FOMOD selections, mod rules, plugin
            load order, INI tweaks, file overrides — and reproduces it
            faithfully on the player&apos;s machine. Standalone format,
            no interference with vanilla Vortex collections.
          </p>
          <div
            style={{
              display: "flex",
              gap: "var(--eh-sp-2)",
              flexWrap: "wrap",
              marginBottom: "var(--eh-sp-4)",
            }}
          >
            <Pill intent="info" withDot>
              v{EXTENSION_VERSION}
            </Pill>
            <Pill intent="success" withDot>
              Open source
            </Pill>
            <Pill intent="warning">Pre-release</Pill>
          </div>
          <h4 style={{ marginBottom: "var(--eh-sp-2)" }}>Supported games</h4>
          <p style={{ color: "var(--eh-text-muted)" }}>
            Skyrim Special Edition / Anniversary Edition, Fallout 3,
            Fallout: New Vegas, Fallout 4, Starfield.
          </p>
          <h4
            style={{
              marginTop: "var(--eh-sp-4)",
              marginBottom: "var(--eh-sp-2)",
            }}
          >
            Authors
          </h4>
          <p style={{ color: "var(--eh-text-muted)" }}>
            <strong style={{ color: "var(--eh-text-secondary)" }}>
              DuduPhudu
            </strong>{" "}
            and{" "}
            <strong style={{ color: "var(--eh-text-secondary)" }}>
              Bluuuk
            </strong>
            .
          </p>
        </div>
      </div>

      <div
        className="eh-stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--eh-sp-4)",
          marginTop: "var(--eh-sp-6)",
        }}
      >
        <Stat label="Captures" value="FOMOD + rules + LO" />
        <Stat label="Identity" value="Nexus IDs + sha256" />
        <Stat label="Isolation" value="Fresh-profile by default" />
        <Stat label="Conflicts" value="Explicit user pickers" />
      </div>
    </Page>
  );
}

interface StatProps {
  label: string;
  value: string;
}

function Stat(props: StatProps): JSX.Element {
  const { label, value } = props;
  return (
    <div
      style={{
        padding: "var(--eh-sp-4)",
        background: "var(--eh-bg-raised)",
        border: "1px solid var(--eh-border-subtle)",
        borderRadius: "var(--eh-radius-md)",
      }}
    >
      <div
        style={{
          fontSize: "var(--eh-text-xs)",
          color: "var(--eh-text-muted)",
          letterSpacing: "var(--eh-tracking-widest)",
          textTransform: "uppercase",
          marginBottom: "var(--eh-sp-2)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "var(--eh-text-md)",
          color: "var(--eh-text-primary)",
          fontWeight: 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}
