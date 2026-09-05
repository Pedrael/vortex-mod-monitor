/**
 * Curator Tools — the profile-wide actions Vortex does badly or never built.
 *
 * Read-first by construction: the page opens showing what it FOUND, and every
 * action is a separate deliberate click. Vortex's own bulk update is a single
 * button that starts dozens of concurrent installs and loses files while doing
 * it, and the shape of that UI is part of why — there is no moment where the
 * curator sees what is about to happen.
 *
 * The lists are the product. The buttons are what you do after reading them.
 */

import * as React from "react";
import { actions as vortexActions, selectors } from "@nexusmods/vortex-api";

import {
  findDuplicates,
  findEndorsable,
  findFrozen,
  findUpdatable,
  summarizeProfile,
  type CuratorMod,
} from "../../../core/curator/profileActions";
import {
  freezeAttribute,
  readCuratorMods,
  readEnabledModIds,
} from "../../../core/curator/readProfile";
import { Button, Card, Page, Pill } from "../../components";
import { useApi } from "../../state";
import { ErrorBoundary } from "../../errors";

/** The Nexus-integration calls this page uses, all optional on the API. */
type NexusExt = {
  nexusCheckModsVersion?: (
    gameId: string,
    mods: Record<string, unknown>,
    forceFull: boolean | "silent",
  ) => void;
  nexusEndorseDirect?: (
    gameId: string,
    nexusId: number,
    version: string,
    status: string,
  ) => PromiseLike<unknown>;
};

const num = (n: number): string => n.toLocaleString();

function Tile(props: {
  label: string;
  value: number;
  intent?: "warning" | "danger";
}): JSX.Element {
  return (
    <div
      style={{
        padding: "var(--eh-sp-3)",
        background: "var(--eh-bg-raised)",
        border: "1px solid var(--eh-border-default)",
        borderRadius: "var(--eh-radius-md)",
        minWidth: 120,
      }}
    >
      <div
        style={{
          fontSize: "var(--eh-text-xs)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--eh-text-muted)",
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          fontSize: "var(--eh-text-xl)",
          color:
            props.value === 0
              ? "var(--eh-text-secondary)"
              : props.intent === "danger"
                ? "var(--eh-danger)"
                : props.intent === "warning"
                  ? "var(--eh-warning)"
                  : "var(--eh-text-primary)",
        }}
      >
        {num(props.value)}
      </div>
    </div>
  );
}

function Section(props: {
  title: string;
  note: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Card title={props.title}>
      <p
        style={{
          margin: "0 0 var(--eh-sp-2)",
          color: "var(--eh-text-secondary)",
          fontSize: "var(--eh-text-sm)",
        }}
      >
        {props.note}
      </p>
      {props.children}
    </Card>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--eh-sp-3)",
  padding: "var(--eh-sp-2)",
  borderTop: "1px solid var(--eh-border-subtle)",
};

function CuratorBody(): JSX.Element {
  const api = useApi();
  const [tick, setTick] = React.useState(0);
  const [busy, setBusy] = React.useState<string | undefined>(undefined);
  const [note, setNote] = React.useState<string | undefined>(undefined);

  const gameId = React.useMemo(() => {
    const state = api.getState();
    try {
      const fromSelector = selectors.activeGameId(state);
      if (typeof fromSelector === "string" && fromSelector !== "") {
        return fromSelector;
      }
    } catch {
      // Selector unavailable or a partial state. Fall through rather than
      // rendering "no active game" over a machine that plainly has one.
    }
    // The active profile knows its own game, and a page that shows nothing is
    // indistinguishable from a page that found nothing — the worse of the two,
    // because only one of them makes the curator go looking.
    const settings = (
      state as unknown as {
        settings?: { profiles?: { activeProfileId?: string } };
        persistent?: { profiles?: Record<string, { gameId?: string }> };
      }
    );
    const activeProfileId = settings?.settings?.profiles?.activeProfileId;
    if (activeProfileId === undefined) return undefined;
    return settings?.persistent?.profiles?.[activeProfileId]?.gameId;
  }, [api, tick]);

  const mods = React.useMemo<CuratorMod[]>(() => {
    if (gameId === undefined) return [];
    const state = api.getState();
    return readCuratorMods(state, gameId, readEnabledModIds(state, gameId));
    // `tick` is the refresh handle: every action bumps it so the view re-reads
    // Vortex rather than trusting a copy it mutated itself.
  }, [api, gameId, tick]);

  const summary = React.useMemo(() => summarizeProfile(mods), [mods]);
  const updatable = React.useMemo(() => findUpdatable(mods), [mods]);
  const frozen = React.useMemo(() => findFrozen(mods), [mods]);
  const duplicates = React.useMemo(() => findDuplicates(mods), [mods]);
  const endorsable = React.useMemo(() => findEndorsable(mods), [mods]);

  const ext = api as unknown as NexusExt;

  const setFrozen = (mod: CuratorMod, version: string | undefined): void => {
    const { key, value } = freezeAttribute(version);
    api.store?.dispatch(
      vortexActions.setModAttribute(gameId!, mod.id, key, value) as never,
    );
    setTick((t) => t + 1);
  };

  const refreshUpdates = (): void => {
    if (gameId === undefined || ext.nexusCheckModsVersion === undefined) {
      setNote(
        "Vortex's Nexus integration is not available, so update information " +
          "cannot be refreshed from here.",
      );
      return;
    }
    const byId = api.getState().persistent.mods[gameId] ?? {};
    // Read-only on our side: this asks Vortex to refresh what Nexus says.
    // Nothing is installed and nothing is changed on disk.
    ext.nexusCheckModsVersion(gameId, byId as Record<string, unknown>, true);
    setNote(
      "Asked Vortex to re-check every mod against Nexus. The counts update as " +
        "answers arrive — press Reload in a moment.",
    );
  };

  const endorseAll = async (): Promise<void> => {
    if (gameId === undefined || ext.nexusEndorseDirect === undefined) {
      setNote("Vortex's Nexus integration is not available.");
      return;
    }
    setBusy("endorse");
    let done = 0;
    let failed = 0;
    // One at a time. Endorsing is a network call per mod and Nexus rate-limits;
    // firing 900 at once earns a ban, not a faster result.
    for (const mod of endorsable) {
      if (mod.nexusModId === undefined) continue;
      try {
        await ext.nexusEndorseDirect(
          gameId,
          mod.nexusModId,
          mod.version ?? "1.0.0",
          "Endorsed",
        );
        done += 1;
      } catch {
        failed += 1;
      }
    }
    setBusy(undefined);
    setTick((t) => t + 1);
    setNote(
      `Endorsed ${done} mod(s)` + (failed > 0 ? `, ${failed} failed.` : "."),
    );
  };

  if (gameId === undefined) {
    return (
      <Card title="No active game">
        <p style={{ color: "var(--eh-text-secondary)" }}>
          Vortex is not managing a game right now, so there is no profile to act
          on.
        </p>
      </Card>
    );
  }

  return (
    <div className="eh-stack eh-stack--md">
      <div style={{ display: "flex", gap: "var(--eh-sp-3)", flexWrap: "wrap" }}>
        <Tile label="Mods" value={summary.total} />
        <Tile label="Enabled" value={summary.enabled} />
        <Tile label="Updatable" value={summary.updatable} intent="warning" />
        <Tile label="Frozen" value={summary.frozen} />
        <Tile
          label="Freeze broken"
          value={summary.frozenDrifted}
          intent="danger"
        />
        <Tile label="Unendorsed" value={summary.endorsable} />
        <Tile label="Duplicate groups" value={summary.duplicateGroups} />
      </div>

      <div style={{ display: "flex", gap: "var(--eh-sp-2)", flexWrap: "wrap" }}>
        <Button intent="ghost" onClick={refreshUpdates}>
          Re-check Nexus for updates
        </Button>
        <Button intent="ghost" onClick={(): void => setTick((t) => t + 1)}>
          Reload
        </Button>
        <Button
          intent="ghost"
          disabled={busy !== undefined || endorsable.length === 0}
          onClick={(): void => void endorseAll()}
        >
          {busy === "endorse"
            ? "Endorsing..."
            : `Endorse ${endorsable.length} mod(s)`}
        </Button>
      </div>

      {note !== undefined && (
        <p
          style={{
            margin: 0,
            padding: "var(--eh-sp-2)",
            borderLeft: "3px solid var(--eh-info)",
            color: "var(--eh-text-secondary)",
          }}
        >
          {note}
        </p>
      )}

      <Section
        title={`Updates available (${updatable.length})`}
        note={
          "Frozen mods are not listed here. Installing these is a separate " +
          "step and runs one mod at a time — Vortex's own bulk update runs " +
          "them concurrently, which is why it loses files."
        }
      >
        {updatable.length === 0 ? (
          <p style={{ color: "var(--eh-text-secondary)", margin: 0 }}>
            Nothing to update, as far as Vortex currently knows. Re-check Nexus
            if that looks wrong.
          </p>
        ) : (
          updatable.slice(0, 40).map((c) => (
            <div key={c.mod.id} style={rowStyle}>
              <span style={{ color: "var(--eh-text-primary)", minWidth: 0 }}>
                {c.mod.name}
              </span>
              <span
                style={{
                  color: "var(--eh-text-secondary)",
                  fontFamily: "var(--eh-font-mono)",
                  fontSize: "var(--eh-text-xs)",
                  whiteSpace: "nowrap",
                }}
              >
                {c.fromVersion} → {c.toVersion}
              </span>
              <Button
                size="sm"
                intent="ghost"
                onClick={(): void => setFrozen(c.mod, c.mod.version ?? "")}
              >
                Freeze here
              </Button>
            </div>
          ))
        )}
      </Section>

      <Section
        title={`Frozen (${frozen.length})`}
        note={
          "A freeze keeps a mod out of this page's bulk update. It cannot stop " +
          "Vortex's own update button — Vortex has no such concept — so if the " +
          "version moves anyway, it is reported here rather than hidden."
        }
      >
        {frozen.length === 0 ? (
          <p style={{ color: "var(--eh-text-secondary)", margin: 0 }}>
            Nothing frozen. Freeze a mod when its current version is the one
            your setup depends on.
          </p>
        ) : (
          frozen.map((f) => (
            <div key={f.mod.id} style={rowStyle}>
              <span style={{ color: "var(--eh-text-primary)", minWidth: 0 }}>
                {f.mod.name}
              </span>
              {f.driftedTo !== undefined ? (
                <Pill intent="danger">
                  frozen at {f.frozenAtVersion}, now {f.driftedTo}
                </Pill>
              ) : (
                <Pill intent={f.updateWithheld ? "warning" : "neutral"}>
                  {f.updateWithheld
                    ? `holding at ${f.frozenAtVersion}`
                    : `at ${f.frozenAtVersion}`}
                </Pill>
              )}
              <Button
                size="sm"
                intent="ghost"
                onClick={(): void => setFrozen(f.mod, undefined)}
              >
                Unfreeze
              </Button>
            </div>
          ))
        )}
      </Section>

      <Section
        title={`Installed more than once (${duplicates.length})`}
        note={
          "Mods sharing a Nexus page. The same FILE twice is always redundant; " +
          "two different files from one page might be a main plus an optional, " +
          "so those are shown as something to look at rather than a verdict."
        }
      >
        {duplicates.length === 0 ? (
          <p style={{ color: "var(--eh-text-secondary)", margin: 0 }}>
            No mod is installed twice.
          </p>
        ) : (
          duplicates.map((group) => (
            <div key={group.nexusModId} style={rowStyle}>
              <span style={{ color: "var(--eh-text-primary)", minWidth: 0 }}>
                {group.mods.map((m) => m.name).join("  ·  ")}
              </span>
              <Pill intent={group.kind === "same-file" ? "danger" : "warning"}>
                {group.kind === "same-file"
                  ? "same file twice"
                  : "same page, different files"}
              </Pill>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}

/** Exported for the render harness; the route renders {@link CuratorPage}. */
export function CuratorPanel(): JSX.Element {
  return <CuratorBody />;
}

export function CuratorPage(): JSX.Element {
  return (
    <Page
      title="Curator Tools"
      subtitle="Profile-wide actions, done one mod at a time."
    >
      <ErrorBoundary where="Curator Tools">
        <CuratorBody />
      </ErrorBoundary>
    </Page>
  );
}
