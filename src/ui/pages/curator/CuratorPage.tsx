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

import * as fsp from "fs/promises";

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
import {
  installFromExistingDownload,
  uninstallMod,
} from "../../../core/installer/modInstall";
import { getModArchivePath } from "../../../core/archiveHashing";
import { describeBulkUpdate, runBulkUpdate } from "../../../core/curator/bulkUpdate";
import {
  describeEnableChanges,
  describeTypeChanges,
  planEnableChanges,
  planTypeChanges,
} from "../../../core/curator/bulkToggles";
import {
  captureForReinstall,
  reinstallArgs,
  restorationFor,
} from "../../../core/curator/reinstallMod";
import { runSequentially } from "../../../core/curator/runSequentially";
import {
  describeCleanupPlan,
  findSupersededMods,
  formatSize,
  planCleanup,
  type CleanupPlan,
} from "../../../core/curator/cleanupPlan";
import {
  describeCleanupOutcome,
  readDownloads,
  runCleanup,
} from "../../../core/curator/runCleanup";
import { FROZEN_ATTRIBUTE } from "../../../core/curator/readProfile";
import {
  installedIdentityReader,
  updateOneAndWait,
} from "../../../core/curator/updateOneMod";
import { verifyUpdatedMod } from "../../../core/curator/verifyAfterUpdate";
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
  nexusModUpdate?: (
    gameId: string,
    modId: number,
    fileId: number,
    source: string,
  ) => void;
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
  /**
   * Vortex gives an updated mod a NEW id; verification must use that one.
   *
   * Built fresh per run rather than kept in a ref. A ref outlives every run,
   * and Vortex derives a mod id from its archive name — so a later install can
   * be handed an id an earlier run already mapped, and verification would then
   * check a mod that no longer exists.
   */
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const chosen = React.useMemo(
    () => mods.filter((m) => selected.has(m.id)),
    [mods, selected],
  );
  const toggle = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [typeValue, setTypeValue] = React.useState("");
  /**
   * The dry run. Deletion is only reachable once a plan is on screen — the
   * report IS the confirmation, and there is no path to Apply without it.
   */
  const [cleanup, setCleanup] = React.useState<CleanupPlan | undefined>(undefined);
  /**
   * Old installs the curator has TICKED for removal.
   *
   * Never pre-filled. A lower Nexus file id does not prove an older version —
   * a page ships a main file and its optional patches under one mod id — and
   * the planner used to act on that guess.
   */
  const [retire, setRetire] = React.useState<ReadonlySet<string>>(new Set());
  const retireCandidates = React.useMemo(
    () => findSupersededMods(mods),
    [mods],
  );

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

  const [progress, setProgress] = React.useState<string | undefined>(undefined);
  const [lines, setLines] = React.useState<string[]>([]);

  /**
   * Update every candidate, one at a time, verifying each before the next.
   *
   * The awaiting is the feature. `updateOneAndWait` resolves only when Vortex
   * reports finishing THIS mod — matched on its Nexus ids, not on "some
   * install finished" — and `runBulkUpdate` cannot begin the next until it
   * has. Vortex's own bulk update starts them together, which is why it loses
   * files.
   */
  const updateAll = async (): Promise<void> => {
    // Narrowed here rather than relied on from the guard below: this function
    // is defined above it, so the compiler cannot see that check — the same
    // shape as the closure bugs that crashed two releases of the build page.
    const game = gameId;
    if (game === undefined || ext.nexusModUpdate === undefined) {
      setNote("Vortex's Nexus integration is not available.");
      return;
    }
    const startUpdate = ext.nexusModUpdate;
    setBusy("update");
    setLines([]);
    const installedIds = new Map<string, string>();
    const controller = new AbortController();
    const report = await runBulkUpdate({
      candidates: updatable,
      signal: controller.signal,
      onProgress: (n, total, m) =>
        setProgress(`Updating ${n + 1} of ${total} — ${m.name}`),
      update: async (candidate) => {
        const newModId = await updateOneAndWait({
          events: api.events as never,
          gameId: game,
          nexusModId: candidate.mod.nexusModId!,
          toFileId: candidate.toFileId,
          readInstalled: installedIdentityReader(api.getState(), game),
          start: () =>
            startUpdate(
              game,
              candidate.mod.nexusModId!,
              candidate.toFileId,
              "event-horizon-curator-tools",
            ),
        });
        installedIds.set(candidate.mod.id, newModId);
      },
      verify: async (m) =>
        verifyUpdatedMod({
          state: api.getState(),
          gameId: game,
          vortexModId: installedIds.get(m.id) ?? m.id,
        }),
    });
    setBusy(undefined);
    setProgress(undefined);
    setLines(describeBulkUpdate(report));
    setTick((t) => t + 1);
  };

  /**
   * Reinstall the mods that lost files, one at a time.
   *
   * The repair for what the update check finds. Everything the uninstall
   * would destroy — FOMOD answers, modType, enabled state, the freeze — is
   * read BEFORE it happens and put back after, or the mod returns as a
   * default install of the same archive: silently different from what the
   * curator had.
   */
  const reinstall = async (targets: readonly CuratorMod[]): Promise<void> => {
    const game = gameId;
    if (game === undefined || targets.length === 0) return;
    setBusy("reinstall");
    setLines([]);
    const installedIds = new Map<string, string>();
    const state0 = api.getState();
    const enabledNow = readEnabledModIds(state0, game);

    const report = await runSequentially<CuratorMod>({
      items: targets,
      onProgress: (n, total, m) =>
        setProgress(`Reinstalling ${n + 1} of ${total} — ${m.name}`),
      act: async (m) => {
        const preserved = captureForReinstall(
          api.getState(),
          game,
          m.id,
          enabledNow,
          FROZEN_ATTRIBUTE,
        );
        await uninstallMod(api, { gameId: game, modId: m.id });
        const { vortexModId } = await installFromExistingDownload(api, {
          gameId: game,
          ...reinstallArgs(preserved),
        } as never);
        installedIds.set(m.id, vortexModId);

        const fresh = readCuratorMods(
          api.getState(),
          game,
          new Set(),
        ).find((x) => x.id === vortexModId);
        const restore = restorationFor(preserved, {
          modType: fresh?.modType ?? "",
        });
        if (restore.setModType !== undefined) {
          api.store?.dispatch(
            vortexActions.setModType(game, vortexModId, restore.setModType) as never,
          );
        }
        if (restore.setFrozenAtVersion !== undefined) {
          api.store?.dispatch(
            vortexActions.setModAttribute(
              game,
              vortexModId,
              FROZEN_ATTRIBUTE,
              restore.setFrozenAtVersion,
            ) as never,
          );
        }
        const profileId = (
          api.getState() as unknown as {
            settings?: { profiles?: { activeProfileId?: string } };
          }
        )?.settings?.profiles?.activeProfileId;
        if (profileId !== undefined) {
          api.store?.dispatch(
            vortexActions.setModEnabled(
              profileId,
              vortexModId,
              restore.enable,
            ) as never,
          );
        }
      },
      verify: async (m) =>
        verifyUpdatedMod({
          state: api.getState(),
          gameId: game,
          vortexModId: installedIds.get(m.id) ?? m.id,
        }),
    });

    setBusy(undefined);
    setProgress(undefined);
    setLines(
      describeBulkUpdate({
        cancelled: report.cancelled,
        outcomes: report.outcomes.map((o) =>
          o.kind === "done"
            ? { kind: "updated" as const, mod: o.item }
            : o.kind === "files-dropped"
              ? { kind: "files-dropped" as const, mod: o.item, missing: o.missing }
              : o.kind === "failed"
                ? { kind: "failed" as const, mod: o.item, why: o.why }
                : { kind: "unverified" as const, mod: o.item, why: o.why },
        ),
      }),
    );
    setTick((t) => t + 1);
  };

  const setEnabledFor = (targets: readonly CuratorMod[], to: boolean): void => {
    const profileId = (
      api.getState() as unknown as {
        settings?: { profiles?: { activeProfileId?: string } };
      }
    )?.settings?.profiles?.activeProfileId;
    const changes = planEnableChanges(targets, to);
    setNote(describeEnableChanges(changes));
    if (profileId === undefined) return;
    for (const change of changes) {
      api.store?.dispatch(
        vortexActions.setModEnabled(profileId, change.mod.id, change.to) as never,
      );
    }
    setTick((t) => t + 1);
  };

  const setTypeFor = (targets: readonly CuratorMod[], to: string): void => {
    const game = gameId;
    if (game === undefined) return;
    const changes = planTypeChanges(targets, to);
    setNote(describeTypeChanges(changes));
    for (const change of changes) {
      api.store?.dispatch(
        vortexActions.setModType(game, change.mod.id, change.to) as never,
      );
    }
    setTick((t) => t + 1);
  };

  const scanForCleanup = (): void => {
    const game = gameId;
    if (game === undefined) return;
    const state0 = api.getState();
    setCleanup(
      planCleanup({
        mods: readCuratorMods(state0, game, readEnabledModIds(state0, game)),
        downloads: readDownloads(state0, game),
        removeModIds: retire,
      }),
    );
    setLines([]);
  };

  /**
   * Apply the plan that is on screen — never a freshly computed one.
   *
   * Re-planning at apply time would act on something the curator never read,
   * which is the whole point of the dry run.
   */
  const applyCleanup = async (): Promise<void> => {
    const game = gameId;
    if (game === undefined || cleanup === undefined) return;
    setBusy("cleanup");
    const outcome = await runCleanup({
      plan: cleanup,
      onProgress: (n, total, what) => setProgress(`${what} (${n + 1}/${total})`),
      removeMod: async (vortexModId) => {
        await uninstallMod(api, { gameId: game, modId: vortexModId });
      },
      deleteArchive: async (dlEntry) => {
        const full = getModArchivePath(api.getState(), dlEntry.id, game);
        if (full === undefined) {
          throw new Error("its path on disk could not be resolved");
        }
        await fsp.rm(full, { force: true });
        // Outside the throwing path on purpose. The file IS gone by here, so a
        // failed dispatch must not be reported as a failed deletion — that
        // would understate what was freed and describe a success as an error.
        // The worst case is a download entry Vortex still lists, which shows
        // up as "missing" rather than as lost disk.
        try {
          api.store?.dispatch(vortexActions.removeDownload(dlEntry.id) as never);
        } catch {
          /* the bytes are freed either way */
        }
      },
    });
    setBusy(undefined);
    setProgress(undefined);
    setLines(describeCleanupOutcome(outcome));
    setCleanup(undefined);
    setTick((t) => t + 1);
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
          intent="primary"
          disabled={busy !== undefined || updatable.length === 0}
          onClick={(): void => void updateAll()}
        >
          {busy === "update"
            ? "Updating..."
            : `Update ${updatable.length} mod(s), one at a time`}
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

      {progress !== undefined && (
        <p style={{ margin: 0, color: "var(--eh-text-primary)" }}>{progress}</p>
      )}

      {lines.length > 0 && (
        <Card title="Update report">
          {lines.map((l) => (
            <p
              key={l}
              style={{
                margin: "0 0 var(--eh-sp-2)",
                color: l.includes("LOST")
                  ? "var(--eh-danger)"
                  : "var(--eh-text-secondary)",
              }}
            >
              {l}
            </p>
          ))}
        </Card>
      )}

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
        title={`Selected (${chosen.length} of ${mods.length})`}
        note={
          "Tick mods below, then act on all of them at once. Enabling and " +
          "setting a kind are state writes — Vortex re-deploys once at the " +
          "end. Reinstalling moves files, so it runs one mod at a time and " +
          "checks each against its archive before starting the next."
        }
      >
        <div
          style={{ display: "flex", gap: "var(--eh-sp-2)", flexWrap: "wrap" }}
        >
          <Button
            size="sm"
            intent="ghost"
            disabled={busy !== undefined || chosen.length === 0}
            onClick={(): void => setEnabledFor(chosen, true)}
          >
            Enable
          </Button>
          <Button
            size="sm"
            intent="ghost"
            disabled={busy !== undefined || chosen.length === 0}
            onClick={(): void => setEnabledFor(chosen, false)}
          >
            Disable
          </Button>
          <Button
            size="sm"
            intent="ghost"
            disabled={busy !== undefined || chosen.length === 0}
            onClick={(): void => void reinstall(chosen)}
          >
            {busy === "reinstall"
              ? "Reinstalling..."
              : `Reinstall ${chosen.length}`}
          </Button>
          <input
            aria-label="Mod kind"
            placeholder="mod kind, e.g. dinput"
            value={typeValue}
            onChange={(e): void => setTypeValue(e.target.value)}
            style={{
              background: "var(--eh-bg-deep)",
              border: "1px solid var(--eh-border-default)",
              borderRadius: "var(--eh-radius-sm)",
              color: "var(--eh-text-primary)",
              padding: "var(--eh-sp-1) var(--eh-sp-2)",
              fontFamily: "var(--eh-font-mono)",
              fontSize: "var(--eh-text-xs)",
            }}
          />
          <Button
            size="sm"
            intent="ghost"
            disabled={busy !== undefined || chosen.length === 0}
            onClick={(): void => setTypeFor(chosen, typeValue)}
          >
            Set kind
          </Button>
          <Button
            size="sm"
            intent="ghost"
            disabled={selected.size === 0}
            onClick={(): void => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>

        <div style={{ maxHeight: 320, overflowY: "auto", marginTop: "var(--eh-sp-2)" }}>
          {mods.map((m) => (
            <label
              key={m.id}
              style={{ ...rowStyle, cursor: "pointer", justifyContent: "flex-start" }}
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={(): void => toggle(m.id)}
              />
              <span style={{ color: "var(--eh-text-primary)", minWidth: 0 }}>
                {m.name}
              </span>
              {m.modType !== "" && <Pill intent="neutral">{m.modType}</Pill>}
              {!m.enabled && <Pill intent="warning">disabled</Pill>}
            </label>
          ))}
        </div>
      </Section>

      <Section
        title="Disk cleanup"
        note={
          "Vortex never deletes anything, so every version you have ever " +
          "downloaded is still here. Scan produces a plan; nothing is touched " +
          "until you read it and press Apply."
        }
      >
        {retireCandidates.length > 0 && (
          <div style={{ marginBottom: "var(--eh-sp-2)" }}>
            <p
              style={{
                margin: "0 0 var(--eh-sp-1)",
                color: "var(--eh-text-secondary)",
                fontSize: "var(--eh-text-sm)",
              }}
            >
              {retireCandidates.length} install(s) share a Nexus page with a
              newer file. That is not proof one is an old VERSION — a page also
              ships optional patches under the same mod id — so tick only the
              ones you know are stale.
            </p>
            {retireCandidates.map((c) => (
              <label
                key={c.mod.id}
                style={{ ...rowStyle, cursor: "pointer", justifyContent: "flex-start" }}
              >
                <input
                  type="checkbox"
                  checked={retire.has(c.mod.id)}
                  onChange={(): void =>
                    setRetire((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.mod.id)) next.delete(c.mod.id);
                      else next.add(c.mod.id);
                      return next;
                    })
                  }
                />
                <span style={{ color: "var(--eh-text-primary)", minWidth: 0 }}>
                  {c.mod.name}
                </span>
                <span
                  style={{
                    color: "var(--eh-text-muted)",
                    fontSize: "var(--eh-text-xs)",
                  }}
                >
                  newer file installed as {c.supersededBy.name}
                </span>
                {!c.mod.enabled && <Pill intent="neutral">disabled</Pill>}
              </label>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--eh-sp-2)", flexWrap: "wrap" }}>
          <Button intent="ghost" disabled={busy !== undefined} onClick={scanForCleanup}>
            Scan for old versions
          </Button>
          {cleanup !== undefined && (
            <Button
              intent="danger"
              disabled={
                busy !== undefined ||
                (cleanup.removeMods.length === 0 &&
                  cleanup.deleteArchives.length === 0)
              }
              onClick={(): void => void applyCleanup()}
            >
              {busy === "cleanup"
                ? "Cleaning..."
                : `Apply — delete ${formatSize(cleanup.bytesFreed)} permanently`}
            </Button>
          )}
        </div>

        {cleanup !== undefined && (
          <div style={{ marginTop: "var(--eh-sp-2)" }}>
            {describeCleanupPlan(cleanup).map((line) => (
              <p
                key={line}
                style={{
                  margin: "0 0 var(--eh-sp-2)",
                  color: "var(--eh-text-secondary)",
                }}
              >
                {line}
              </p>
            ))}

            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {cleanup.removeMods.map((r) => (
                <div key={r.mod.id} style={rowStyle}>
                  <span style={{ color: "var(--eh-text-primary)", minWidth: 0 }}>
                    {r.mod.name}
                  </span>
                  <span
                    style={{
                      color: "var(--eh-text-muted)",
                      fontSize: "var(--eh-text-xs)",
                    }}
                  >
                    superseded by {r.supersededBy.name}
                  </span>
                  <Pill intent="warning">install removed</Pill>
                </div>
              ))}
              {cleanup.deleteArchives.map((a) => (
                <div key={a.entry.id} style={rowStyle}>
                  <span
                    style={{
                      color: "var(--eh-text-primary)",
                      minWidth: 0,
                      fontFamily: "var(--eh-font-mono)",
                      fontSize: "var(--eh-text-xs)",
                    }}
                  >
                    {a.entry.fileName}
                  </span>
                  <span style={{ color: "var(--eh-text-muted)" }}>
                    {formatSize(a.entry.bytes)}
                  </span>
                  <Pill intent="danger">deleted</Pill>
                </div>
              ))}
            </div>
          </div>
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
