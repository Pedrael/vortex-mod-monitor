/**
 * About page — pitch, version, authors, credits, license, and the
 * external links a curious user is most likely to want.
 *
 * Pure presentational component; no async work, no state. The links
 * use Electron's shell.openExternal so they open in the system browser
 * instead of trying to navigate the Electron renderer (which would
 * blank the Vortex window).
 */

import * as React from "react";

import { EventHorizonLogo, Page, Pill, Card } from "../components";
import { EXTENSION_VERSION } from "../version";

const REPO_URL = "https://github.com/BubuZefirka/vortex-event-horizon";
const ISSUE_URL = `${REPO_URL}/issues/new`;
const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
const VORTEX_URL = "https://www.nexusmods.com/about/vortex/";
const NEXUS_URL = "https://www.nexusmods.com/";

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
              MIT licensed
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--eh-sp-4)",
          marginTop: "var(--eh-sp-6)",
        }}
      >
        <Card title="Links">
          <LinkRow
            href={REPO_URL}
            label="Source code"
            sub="GitHub repository · contributions welcome"
          />
          <LinkRow
            href={ISSUE_URL}
            label="Report a bug"
            sub="Open an issue with the Copy report payload from any error"
          />
          <LinkRow
            href={LICENSE_URL}
            label="MIT License"
            sub="© 2026 BubuZefirka — see LICENSE for full text"
          />
        </Card>

        <Card title="Built on">
          <LinkRow
            href={VORTEX_URL}
            label="Vortex"
            sub="The Nexus Mods mod manager Event Horizon plugs into"
          />
          <LinkRow
            href={NEXUS_URL}
            label="Nexus Mods"
            sub="Where mods live; Event Horizon resolves Nexus IDs to files"
          />
          <p
            style={{
              margin: "var(--eh-sp-3) 0 0 0",
              color: "var(--eh-text-muted)",
              fontSize: "var(--eh-text-xs)",
              lineHeight: "var(--eh-leading-relaxed)",
            }}
          >
            Not affiliated with or endorsed by Nexus Mods. &quot;Vortex&quot;
            is a trademark of its respective owners.
          </p>
        </Card>

        <Card title="Credits">
          <ul
            style={{
              margin: 0,
              paddingLeft: "var(--eh-sp-5)",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-sm)",
              lineHeight: "var(--eh-leading-relaxed)",
            }}
          >
            <li>
              <strong style={{ color: "var(--eh-text-primary)" }}>
                vortex-api
              </strong>{" "}
              — extension framework + types from the Vortex team.
            </li>
            <li>
              <strong style={{ color: "var(--eh-text-primary)" }}>
                node-7z
              </strong>{" "}
              — streaming 7-Zip wrapper used to package and unpack
              <code> .ehcoll</code> archives.
            </li>
            <li>
              <strong style={{ color: "var(--eh-text-primary)" }}>React</strong>{" "}
              — UI runtime; thanks to the Vortex bundle for shipping it.
            </li>
            <li>
              Everyone testing pre-releases and filing issues. You make
              this less broken.
            </li>
          </ul>
        </Card>
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

interface LinkRowProps {
  href: string;
  label: string;
  sub: string;
}

function LinkRow(props: LinkRowProps): JSX.Element {
  const handleClick = (e: React.MouseEvent): void => {
    e.preventDefault();
    void openExternal(props.href);
  };
  return (
    <div style={{ marginBottom: "var(--eh-sp-3)" }}>
      <a
        href={props.href}
        onClick={handleClick}
        style={{
          color: "var(--eh-accent)",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "var(--eh-text-sm)",
        }}
      >
        {props.label} ↗
      </a>
      <div
        style={{
          color: "var(--eh-text-muted)",
          fontSize: "var(--eh-text-xs)",
          marginTop: "var(--eh-sp-1)",
        }}
      >
        {props.sub}
      </div>
    </div>
  );
}

async function openExternal(url: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require("electron") as {
      shell?: { openExternal?: (u: string) => Promise<void> };
    };
    if (electron.shell?.openExternal) {
      await electron.shell.openExternal(url);
    }
  } catch {
    /* Best-effort; if Electron is unavailable just give up silently.
     * The user can still copy the URL from the visible link text. */
  }
}
