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
  findUpdateShadowed,
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
  ENDORSE_PACE_MS,
  describeEndorseDuration,
  endorseIsLong,
} from "../../../core/curator/endorsePace";
import {
  archivesFreedByRemoval,
  cleanupSubset,
  describeEvidence,
  findSupersededMods,
  provenSupersedes,
  unprovenSupersedes,
  formatSize,
  orphanArchives,
  planCleanup,
  tickedArchives,
  type CleanupPlan,
  type DownloadEntry,
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
import {
  Button,
  Card,
  DataTable,
  Page,
  Pill,
  describeTarget,
  type Column,
  type TargetSet,
} from "../../components";
import { useApi } from "../../state";
import { ErrorBoundary } from "../../errors";
import { ehLog } from "../../../core/logging/ehLog";

/**
 * How Vortex's Nexus integration is ACTUALLY reached.
 *
 * Not as methods on the api. `INexusAPIExtension` exists in the typings but is
 * referenced by nothing, and calling `api.nexusCheckModsVersion` found
 * `undefined` — which this page reported, correctly, as "not available".
 *
 * Vortex drives its own buttons through events, and this is copied from what
 * its mod-update toolbar and endorse control actually do:
 *
 *   api.emitAndAwait("check-mods-version", gameId, mods, force)
 *   api.events.emit("endorse-mod", gameId, vortexModId, status)
 *   api.events.emit("mod-update", gameId, nexusModId, newestFileId, source)
 *
 * Note the endorse id: Vortex passes `mod.id` — its OWN mod id — while the
 * update passes `attributes.modId`, the NEXUS one. Two ids, adjacent calls,
 * and the wrong one endorses nothing.
 */
type EmitAndAwait = {
  emitAndAwait?: (event: string, ...args: unknown[]) => PromiseLike<unknown>;
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

/**
 * ─── COLUMN DEFINITIONS LIVE AT MODULE LEVEL, DELIBERATELY ─────────────
 * `DataTable` projects every row through its columns inside a `useMemo` keyed
 * on the column array's identity. An array literal written inside the
 * component is a new array on every render, so that memo would never hit and
 * a 1,900-mod profile would be re-projected on every keystroke in a filter
 * box. Defined once here, they are stable for the life of the module.
 *
 * The types are read off the finders rather than imported by name, so a
 * change to what a finder returns is a compile error here rather than a
 * column quietly rendering `undefined`.
 */
type UpdateRow = ReturnType<typeof findUpdatable>[number];
type FrozenRow = ReturnType<typeof findFrozen>[number];
type ShadowRow = ReturnType<typeof findUpdateShadowed>[number];
type RetireRow = ReturnType<typeof findSupersededMods>[number];
type DuplicateRow = ReturnType<typeof findDuplicates>[number];
type RemovalRow = CleanupPlan["removeMods"][number];
type ArchiveRow = CleanupPlan["deleteArchives"][number];

/** Vortex's empty modType is the default one. Say so rather than showing "". */
const kindOf = (mod: CuratorMod): string =>
  mod.modType === "" ? "default" : mod.modType;
const stateOf = (mod: CuratorMod): string =>
  mod.enabled ? "enabled" : "disabled";

const UPDATE_COLUMNS: Column<UpdateRow>[] = [
  { key: "name", header: "Mod", value: (c) => c.mod.name },
  { key: "from", header: "Installed", value: (c) => c.fromVersion, width: 130 },
  { key: "to", header: "Available", value: (c) => c.toVersion, width: 130 },
  {
    key: "state",
    header: "State",
    match: "exact",
    width: 110,
    value: (c) => stateOf(c.mod),
  },
];

const FROZEN_COLUMNS: Column<FrozenRow>[] = [
  { key: "name", header: "Mod", value: (f) => f.mod.name },
  { key: "at", header: "Frozen at", value: (f) => f.frozenAtVersion, width: 130 },
  {
    key: "status",
    header: "Status",
    match: "exact",
    width: 180,
    value: (f) =>
      f.driftedTo !== undefined
        ? "drifted"
        : f.updateWithheld
          ? "holding an update"
          : "holding",
    render: (f) =>
      f.driftedTo !== undefined ? (
        <Pill intent="danger">now {f.driftedTo}</Pill>
      ) : (
        <Pill intent={f.updateWithheld ? "warning" : "neutral"}>
          {f.updateWithheld ? "holding an update" : "holding"}
        </Pill>
      ),
  },
];

const SHADOW_COLUMNS: Column<ShadowRow>[] = [
  { key: "name", header: "Older install", value: (r) => r.mod.name },
  { key: "version", header: "Version", value: (r) => r.mod.version, width: 130 },
  {
    key: "newer",
    header: "Newer copy already installed",
    value: (r) => r.newerInstall.name,
  },
];

const MOD_COLUMNS: Column<CuratorMod>[] = [
  { key: "name", header: "Mod", value: (m) => m.name },
  { key: "version", header: "Version", value: (m) => m.version, width: 130 },
  { key: "kind", header: "Kind", match: "exact", width: 120, value: kindOf },
  { key: "state", header: "State", match: "exact", width: 110, value: stateOf },
];

const shownVersion = (v: string | undefined): string => v ?? "unknown";

const RETIRE_COLUMNS: Column<RetireRow>[] = [
  { key: "name", header: "Older install", value: (c) => c.mod.name },
  {
    key: "version",
    header: "Version",
    width: 190,
    // The transition, not just the installed side. "1.0" alone says nothing
    // about what would replace it, which is the fact being decided here.
    value: (c) =>
      `${shownVersion(c.mod.version)} → ${shownVersion(c.supersededBy.version)}`,
  },
  {
    key: "newer",
    header: "Replaced by",
    value: (c) => c.supersededBy.name,
  },
  {
    key: "evidence",
    header: "Why",
    match: "exact",
    width: 200,
    // On the row, because this card deletes things. A curator should not have
    // to remember which rule put a line here.
    value: (c) => describeEvidence(c.evidence),
    render: (c) => (
      <Pill intent={c.evidence === "same-page-only" ? "warning" : "neutral"}>
        {describeEvidence(c.evidence)}
      </Pill>
    ),
  },
  {
    key: "state",
    header: "State",
    match: "exact",
    width: 110,
    value: (c) => stateOf(c.mod),
  },
];

const DUPLICATE_COLUMNS: Column<DuplicateRow>[] = [
  {
    key: "names",
    header: "Installs sharing a Nexus page",
    value: (g) => g.mods.map((m) => m.name).join("  ·  "),
  },
  {
    key: "kind",
    header: "Verdict",
    match: "exact",
    width: 220,
    value: (g) =>
      g.kind === "same-file" ? "same file twice" : "same page, different files",
    render: (g) => (
      <Pill intent={g.kind === "same-file" ? "danger" : "warning"}>
        {g.kind === "same-file"
          ? "same file twice"
          : "same page, different files"}
      </Pill>
    ),
  },
];

const REMOVAL_COLUMNS: Column<RemovalRow>[] = [
  { key: "name", header: "Install to remove", value: (r) => r.mod.name },
  { key: "newer", header: "Superseded by", value: (r) => r.supersededBy.name },
];

const ARCHIVE_COLUMNS: Column<ArchiveRow>[] = [
  { key: "file", header: "Archive to delete", value: (a) => a.entry.fileName },
  {
    key: "bytes",
    header: "Size",
    numeric: true,
    align: "right",
    width: 120,
    value: (a) => a.entry.bytes,
    render: (a) => formatSize(a.entry.bytes),
  },
];

/** Stable row identities, for the same memo reason as the columns above. */
const updateId = (c: UpdateRow): string => c.mod.id;
const frozenId = (f: FrozenRow): string => f.mod.id;
const shadowId = (r: ShadowRow): string => r.mod.id;
const curatorModId = (m: CuratorMod): string => m.id;
const retireId = (c: RetireRow): string => c.mod.id;
const duplicateId = (g: DuplicateRow): string => String(g.nexusModId);
const removalId = (r: RemovalRow): string => r.mod.id;
const archiveId = (a: ArchiveRow): string => a.entry.id;

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
  /**
   * Older installs of a mod that already has a newer copy installed.
   *
   * They are deliberately NOT offered an update — updating both would install
   * the new file twice and leave four copies where there were two, which is
   * the exact mess this page exists to clean up. Shown so the omission is
   * something the curator reads rather than something they notice missing.
   */
  const shadowed = React.useMemo(() => findUpdateShadowed(mods), [mods]);
  const endorsable = React.useMemo(() => findEndorsable(mods), [mods]);

  const ext = api as unknown as EmitAndAwait;
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
  const [typeValue, setTypeValue] = React.useState("");
  /**
   * ─── ONE TICK SET PER TABLE ────────────────────────────────────────
   * Each table answers a different question, so a tick in one must not mean
   * anything in another. Held here rather than inside `DataTable` so the
   * buttons above each table can act on them.
   */
  const [updateSel, setUpdateSel] = React.useState<ReadonlySet<string>>(new Set());
  const [frozenSel, setFrozenSel] = React.useState<ReadonlySet<string>>(new Set());
  const [dupSel, setDupSel] = React.useState<ReadonlySet<string>>(new Set());
  const [archiveSel, setArchiveSel] = React.useState<ReadonlySet<string>>(new Set());

  /**
   * What each table's button acts on: ticks if any, else the filtered rows.
   *
   * `undefined` until the table has reported once, and the fallback below is
   * "everything" — so the label is right on the very first render instead of
   * flashing zero before the effect lands.
   */
  const [updateAim, setUpdateAim] = React.useState<TargetSet | undefined>();
  const [frozenAim, setFrozenAim] = React.useState<TargetSet | undefined>();
  const [dupAim, setDupAim] = React.useState<TargetSet | undefined>();
  const [archiveAim, setArchiveAim] = React.useState<TargetSet | undefined>();

  /**
   * Every finished download, read straight from Vortex's state.
   *
   * There used to be a "Scan for old versions" button in front of this, and
   * it protected nothing: `readDownloads` reads Redux, touches no disk and
   * deletes nothing. All the button did was hide both lists behind a step
   * whose purpose nobody could see — which is most of why this section was
   * unreadable. The gate that matters is Apply, and that one is still here.
   *
   * Keyed on `tick` like `mods`, so both cleanup questions and the profile
   * always describe the same moment.
   */
  const downloads = React.useMemo<readonly DownloadEntry[]>(
    () => (gameId === undefined ? [] : readDownloads(api.getState(), gameId)),
    [api, gameId, tick],
  );
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
  /**
   * Backed by evidence versus merely sharing a mod page.
   *
   * Kept apart because they are different claims. "Same page" produced plain
   * false positives on the real profile — a bodypaint's CBBE variant offered
   * for deletion because a Male variant had a higher file id — so those are
   * shown separately, below, and never mixed in with the ones Nexus or the
   * file's own name actually vouches for.
   */
  const provenRetire = React.useMemo(
    () => provenSupersedes(retireCandidates),
    [retireCandidates],
  );
  const unprovenRetire = React.useMemo(
    () => unprovenSupersedes(retireCandidates),
    [retireCandidates],
  );

  /**
   * Two plans from one scan, because they are two different acts.
   *
   * `orphanPlan` assumes NO removals, so its orphans are archives that are
   * already free — deletable on their own. `retirePlan` assumes the ticked
   * removals, and the archives it frees are only free AFTER those happen.
   * Deriving both from the same `downloads` is what stops the two cards
   * describing different disks.
   */
  const orphanPlan = React.useMemo(
    () => planCleanup({ mods, downloads }),
    [mods, downloads],
  );
  const retirePlan = React.useMemo(
    () => planCleanup({ mods, downloads, removeModIds: retire }),
    [mods, downloads, retire],
  );
  const orphans = React.useMemo(() => orphanArchives(orphanPlan), [orphanPlan]);

  /** The duplicate groups the button will really add: ticks, else filtered. */
  const dupGroups = React.useMemo(() => {
    const ids = new Set(dupAim?.ids ?? duplicates.map((g) => String(g.nexusModId)));
    return duplicates.filter((g) => ids.has(String(g.nexusModId)));
  }, [duplicates, dupAim]);

  /** The archives the delete button will really remove, and their weight. */
  const archiveRemovals = React.useMemo(
    () =>
      archiveAim === undefined
        ? orphans
        : tickedArchives(orphans, new Set(archiveAim.ids)),
    [orphans, archiveAim],
  );
  const archiveBytes = React.useMemo(
    () => archiveRemovals.reduce((n, a) => n + a.entry.bytes, 0),
    [archiveRemovals],
  );
  /** What retiring the ticked installs frees, once they are gone. */
  const freedByRetiring = React.useMemo(
    () =>
      archivesFreedByRemoval(retirePlan).reduce((n, a) => n + a.entry.bytes, 0),
    [retirePlan],
  );

  /** The rows each button will really act on. */
  const updateRows = React.useMemo(() => {
    const ids = new Set(updateAim?.ids ?? updatable.map((c) => c.mod.id));
    return updatable.filter((c) => ids.has(c.mod.id));
  }, [updatable, updateAim]);
  const frozenRows = React.useMemo(() => {
    const ids = new Set(frozenAim?.ids ?? frozen.map((f) => f.mod.id));
    return frozen.filter((f) => ids.has(f.mod.id));
  }, [frozen, frozenAim]);

  const setFrozen = (mod: CuratorMod, version: string | undefined): void => {
    const { key, value } = freezeAttribute(version);
    api.store?.dispatch(
      vortexActions.setModAttribute(gameId!, mod.id, key, value) as never,
    );
    setTick((t) => t + 1);
  };

  const refreshUpdates = async (): Promise<void> => {
    if (gameId === undefined) return;
    const byId = api.getState().persistent.mods[gameId] ?? {};
    if (ext.emitAndAwait === undefined) {
      setNote("This Vortex build does not expose emitAndAwait.");
      return;
    }
    setBusy("refresh");
    setNote("Asking Nexus about every mod — this takes a moment.");
    try {
      // Read-only: this asks Vortex to refresh what Nexus says. Nothing is
      // installed and nothing on disk changes. Same call Vortex's own
      // "check for updates" toolbar button makes.
      ehLog("info", "curator.recheck.start", {
        gameId,
        mods: Object.keys(byId).length,
      });
      await ext.emitAndAwait("check-mods-version", gameId, byId, true);
      ehLog("info", "curator.recheck.ok", { gameId });
      setNote("Nexus re-checked. The counts below are current.");
    } catch (err) {
      ehLog("error", "curator.recheck.fail", { err });
      setNote(
        `Vortex could not check for updates: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    setBusy(undefined);
    setTick((t) => t + 1);
  };

  const endorseAll = async (): Promise<void> => {
    const game = gameId;
    if (game === undefined) return;
    setBusy("endorse");
    let done = 0;
    // Paced, not parallel. `endorse-mod` is fire-and-forget — Vortex gives no
    // promise to await — so the only way to avoid firing 1,500 requests at
    // Nexus in one tick is to space them. A ban is not a faster result.
    for (const mod of endorsable) {
      if (mod.nexusModId === undefined) continue;
      // Vortex's OWN mod id here, not the Nexus one: that is what its endorse
      // control passes, and the other id endorses nothing.
      api.events.emit("endorse-mod", game, mod.id, "Endorsed");
      done += 1;
      setProgress(
        `Endorsing ${done} of ${endorsable.length} — ${mod.name} ` +
          `(${describeEndorseDuration(endorsable.length - done)} left)`,
      );
      await new Promise((r) => setTimeout(r, ENDORSE_PACE_MS));
    }
    setBusy(undefined);
    setProgress(undefined);
    setTick((t) => t + 1);
    ehLog("info", "curator.endorse.done", { asked: done });
    setNote(
      `Asked Vortex to endorse ${done} mod(s). Vortex reports each result in ` +
        `its own notifications; press Reload to see the counts settle.`,
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
  const updateAll = async (candidates: UpdateRow[]): Promise<void> => {
    // Narrowed here rather than relied on from the guard below: this function
    // is defined above it, so the compiler cannot see that check — the same
    // shape as the closure bugs that crashed two releases of the build page.
    const game = gameId;
    if (game === undefined) return;
    setBusy("update");
    setLines([]);
    const installedIds = new Map<string, string>();
    const controller = new AbortController();
    // This flow logged nothing at all, so an update that did literally
    // nothing looked exactly like one that was working — and the only way to
    // tell them apart was to read Vortex's log and find it empty too.
    ehLog("info", "curator.bulk-update.start", {
      candidates: candidates.length,
      gameId: game,
    });
    const startedAt = Date.now();
    const report = await runBulkUpdate({
      candidates,
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
          start: () => {
            /**
             * ─── THE LAST ARGUMENT IS A DISCRIMINATOR, NOT A LABEL ──────
             * Vortex's `onModUpdate` opens with:
             *
             *     if (source !== "nexus") {
             *       // not a mod from nexus mods
             *       return;
             *     }
             *
             * It was passed "event-horizon-curator-tools", read as an
             * attribution tag because Vortex's own caller passes
             * `mod.attributes.source` there. The handler returned
             * immediately — no download, no error, and not one line in
             * Vortex's log or ours — and the page sat on "Updating 1 of 4"
             * until the fifteen-minute timeout. Vortex's own bulk update
             * hardcodes "nexus" at this exact call; so does this.
             */
            const source = "nexus";
            // Differs from the active game for a compatible download — a
            // Skyrim LE file installed under SSE — and Vortex reads it here
            // for exactly that case.
            const downloadGame = candidate.mod.downloadGame ?? game;
            ehLog("info", "curator.update.start", {
              mod: candidate.mod.name,
              nexusModId: candidate.mod.nexusModId,
              fromFileId: candidate.fromFileId,
              toFileId: candidate.toFileId,
              downloadGame,
            });
            api.events.emit(
              "mod-update",
              downloadGame,
              candidate.mod.nexusModId!,
              candidate.toFileId,
              source,
            );
          },
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
    ehLog("info", "curator.bulk-update.done", {
      ms: Date.now() - startedAt,
      cancelled: report.cancelled,
      outcomes: report.outcomes.reduce<Record<string, number>>((acc, o) => {
        acc[o.kind] = (acc[o.kind] ?? 0) + 1;
        return acc;
      }, {}),
    });
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



  /**
   * Apply the plan that is on screen — never a freshly computed one.
   *
   * The caller passes the very object the table rendered from, so what runs
   * is what was read. Re-planning here would act on something the curator
   * never saw, which is the whole point of the dry run.
   */
  const applyCleanup = async (plan: CleanupPlan): Promise<void> => {
    const game = gameId;
    if (game === undefined) return;
    setBusy("cleanup");
    const outcome = await runCleanup({
      plan,
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
    setRetire(new Set());
    setArchiveSel(new Set());
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
        <Button intent="ghost" onClick={(): void => void refreshUpdates()}>
          Re-check Nexus for updates
        </Button>
        <Button intent="ghost" onClick={(): void => setTick((t) => t + 1)}>
          Reload
        </Button>
        <Button
          intent="primary"
          disabled={busy !== undefined || updateRows.length === 0}
          onClick={(): void => void updateAll(updateRows)}
        >
          {busy === "update"
            ? "Updating..."
            : `Update ${describeTarget(
                updateAim ?? { ids: updatable.map((c) => c.mod.id), from: "all" },
                "mod",
              )}, one at a time`}
        </Button>
        <Button
          intent="ghost"
          disabled={busy !== undefined || endorsable.length === 0}
          onClick={(): void => void endorseAll()}
        >
          {busy === "endorse"
            ? "Endorsing..."
            : `Endorse ${num(endorsable.length)} mod(s)` +
              (endorseIsLong(endorsable.length)
                ? ` — ${describeEndorseDuration(endorsable.length)}`
                : "")}
        </Button>
      </div>

      {endorseIsLong(endorsable.length) && busy === undefined && (
        <p
          style={{
            margin: 0,
            padding: "var(--eh-sp-2)",
            borderLeft: "3px solid var(--eh-warning)",
            color: "var(--eh-text-secondary)",
            fontSize: "var(--eh-text-sm)",
          }}
        >
          Endorsing {num(endorsable.length)} mods takes{" "}
          {describeEndorseDuration(endorsable.length)} and cannot be stopped
          once it starts. Vortex gives no way to confirm an endorsement
          finished, so they are spaced {ENDORSE_PACE_MS}ms apart — sending
          them all at once is a rate-limit, not a faster result. Leave the page
          open while it runs.
        </p>
      )}

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
        <DataTable
          rows={updatable}
          idOf={updateId}
          columns={UPDATE_COLUMNS}
          noun="update"
          limit={200}
          selection={{ selected: updateSel, onChange: setUpdateSel }}
          onTarget={setUpdateAim}
          empty={
            <p style={{ color: "var(--eh-text-secondary)", margin: 0 }}>
              Nothing to update, as far as Vortex currently knows. Re-check
              Nexus if that looks wrong.
            </p>
          }
          actions={(c): JSX.Element => (
            <Button
              size="sm"
              intent="ghost"
              onClick={(): void => setFrozen(c.mod, c.mod.version ?? "")}
            >
              Freeze here
            </Button>
          )}
        />

        {shadowed.length > 0 && (
          <div style={{ marginTop: "var(--eh-sp-3)" }}>
            <p
              style={{
                margin: "0 0 var(--eh-sp-1)",
                color: "var(--eh-text-secondary)",
                fontSize: "var(--eh-text-sm)",
              }}
            >
              {shadowed.length} older install(s) also have a newer file on
              Nexus and are deliberately NOT listed above — you already have a
              newer copy of each installed, so updating both would install the
              new file twice. Retire them under Disk cleanup instead.
            </p>
            <DataTable
              rows={shadowed}
              idOf={shadowId}
              columns={SHADOW_COLUMNS}
              noun="older install"
              limit={100}
              maxHeight={240}
            />
          </div>
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
        {frozen.length > 0 && (
          <div style={{ marginBottom: "var(--eh-sp-2)" }}>
            <Button
              size="sm"
              intent="ghost"
              disabled={busy !== undefined || frozenRows.length === 0}
              onClick={(): void => {
                for (const f of frozenRows) setFrozen(f.mod, undefined);
                setFrozenSel(new Set());
              }}
            >
              Unfreeze {describeTarget(
                frozenAim ?? { ids: frozen.map((f) => f.mod.id), from: "all" },
                "mod",
              )}
            </Button>
          </div>
        )}
        <DataTable
          rows={frozen}
          idOf={frozenId}
          columns={FROZEN_COLUMNS}
          noun="frozen mod"
          limit={200}
          maxHeight={320}
          selection={{ selected: frozenSel, onChange: setFrozenSel }}
          onTarget={setFrozenAim}
          empty={
            <p style={{ color: "var(--eh-text-secondary)", margin: 0 }}>
              Nothing frozen. Freeze a mod when its current version is the one
              your setup depends on.
            </p>
          }
          actions={(f): JSX.Element => (
            <Button
              size="sm"
              intent="ghost"
              onClick={(): void => setFrozen(f.mod, undefined)}
            >
              Unfreeze
            </Button>
          )}
        />
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

        <div style={{ marginTop: "var(--eh-sp-2)" }}>
          <DataTable
            rows={mods}
            idOf={curatorModId}
            columns={MOD_COLUMNS}
            noun="mod"
            limit={200}
            maxHeight={420}
            selection={{ selected, onChange: setSelected }}
          />
        </div>
      </Section>

      <Section
        title="Disk cleanup — 1. Orphaned archives"
        note={
          "Downloaded files that no installed mod points at, where a newer " +
          "version of the same mod IS installed. Deleting these changes " +
          "nothing about your setup — it is only disk. This is where almost " +
          "all the space is."
        }
      >
        {orphans.length === 0 ? (
          <p style={{ color: "var(--eh-text-secondary)", margin: 0 }}>
            No orphaned archives. Every download is either in use by an
            installed mod, or is something with no installed version at all.
          </p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: "var(--eh-sp-2)",
                flexWrap: "wrap",
                marginBottom: "var(--eh-sp-2)",
              }}
            >
              <Button
                intent="danger"
                disabled={busy !== undefined || archiveRemovals.length === 0}
                onClick={(): void =>
                  void applyCleanup(
                    cleanupSubset({
                      plan: orphanPlan,
                      removeMods: [],
                      deleteArchives: archiveRemovals,
                    }),
                  )
                }
              >
                {busy === "cleanup"
                  ? "Deleting..."
                  : `Delete ${describeTarget(
                      archiveAim ?? { ids: orphans.map((a) => a.entry.id), from: "all" },
                      "archive",
                    )} — frees ${formatSize(archiveBytes)}`}
              </Button>
              <span
                style={{
                  alignSelf: "center",
                  color: "var(--eh-text-secondary)",
                  fontSize: "var(--eh-text-sm)",
                }}
              >
                Deletes the files permanently. Nothing is uninstalled.
              </span>
            </div>
            <DataTable
              rows={orphans}
              idOf={archiveId}
              columns={ARCHIVE_COLUMNS}
              noun="archive"
              limit={200}
              maxHeight={320}
              selection={{ selected: archiveSel, onChange: setArchiveSel }}
              onTarget={setArchiveAim}
            />
          </>
        )}

        {orphanPlan.keptReferenced > 0 && (
          <p
            style={{
              margin: "var(--eh-sp-2) 0 0",
              color: "var(--eh-text-muted)",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            {num(orphanPlan.keptReferenced)} archive(s) are not listed because
            an installed mod still points at them. Event Horizon hashes those
            when you build, so they are never candidates here.
          </p>
        )}

        {orphanPlan.unclearOrphans.length > 0 && (
          <p
            style={{
              margin: "var(--eh-sp-2) 0 0",
              padding: "var(--eh-sp-2)",
              borderLeft: "3px solid var(--eh-info)",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            {num(orphanPlan.unclearOrphans.length)} more download(s) worth{" "}
            {formatSize(orphanPlan.unclearBytes)} have NO version of that mod
            installed. Those are not listed above and never selected: a file
            you downloaded on purpose and have not installed yet looks exactly
            like a leftover from here.
          </p>
        )}
      </Section>

      <Section
        title="Disk cleanup — 2. Old mod installs"
        note={
          "This one changes your setup, so nothing is pre-ticked. An install " +
          "is only listed here when Nexus's own update chain says it was " +
          "replaced, or when the same FILE is installed at a lower version — " +
          "sharing a mod page proves nothing on its own. Removing an install " +
          "frees its archive too."
        }
      >
        {retireCandidates.length === 0 ? (
          <p style={{ color: "var(--eh-text-secondary)", margin: 0 }}>
            No install has been replaced by another one you have installed.
          </p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: "var(--eh-sp-2)",
                flexWrap: "wrap",
                marginBottom: "var(--eh-sp-2)",
              }}
            >
              <Button
                intent="danger"
                disabled={busy !== undefined || retirePlan.removeMods.length === 0}
                onClick={(): void =>
                  void applyCleanup(
                    cleanupSubset({
                      plan: retirePlan,
                      removeMods: retirePlan.removeMods,
                      deleteArchives: archivesFreedByRemoval(retirePlan),
                    }),
                  )
                }
              >
                {busy === "cleanup"
                  ? "Removing..."
                  : retirePlan.removeMods.length === 0
                    ? "Tick the installs you want removed"
                    : `Remove ${num(retirePlan.removeMods.length)} ticked ` +
                      `install(s) — frees ${formatSize(freedByRetiring)}`}
              </Button>
              {retire.size > 0 && (
                <Button
                  intent="ghost"
                  disabled={busy !== undefined}
                  onClick={(): void => setRetire(new Set())}
                >
                  Clear ticks
                </Button>
              )}
            </div>
            {provenRetire.length === 0 ? (
              <p style={{ color: "var(--eh-text-secondary)", margin: 0 }}>
                Nothing here is backed by evidence. Everything found only
                shares a mod page, and is listed below.
              </p>
            ) : (
              <DataTable
                rows={provenRetire}
                idOf={retireId}
                columns={RETIRE_COLUMNS}
                noun="older install"
                limit={200}
                maxHeight={320}
                selection={{ selected: retire, onChange: setRetire }}
              />
            )}

            {unprovenRetire.length > 0 && (
              <div style={{ marginTop: "var(--eh-sp-3)" }}>
                <p
                  style={{
                    margin: "0 0 var(--eh-sp-1)",
                    padding: "var(--eh-sp-2)",
                    borderLeft: "3px solid var(--eh-warning)",
                    color: "var(--eh-text-secondary)",
                    fontSize: "var(--eh-text-sm)",
                  }}
                >
                  {num(unprovenRetire.length)} more install(s) share a Nexus
                  page with a newer file and NOTHING ELSE. That is not an old
                  version — one page ships a main file, optional files,
                  variants and patches, so this is where
                  &ldquo;Bodypaints - CBBE&rdquo; sits next to
                  &ldquo;Bodypaints - Male&rdquo;. Listed so nothing is hidden;
                  tick one only if you know it yourself.
                </p>
                <DataTable
                  rows={unprovenRetire}
                  idOf={retireId}
                  columns={RETIRE_COLUMNS}
                  noun="unproven install"
                  limit={200}
                  maxHeight={280}
                  selection={{ selected: retire, onChange: setRetire }}
                />
              </div>
            )}
          </>
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
        {duplicates.length > 0 && (
          <div style={{ marginBottom: "var(--eh-sp-2)" }}>
            <Button
              size="sm"
              intent="ghost"
              disabled={dupGroups.length === 0}
              onClick={(): void => {
                // Into the main selection, where Disable / Reinstall / Set
                // kind already live. Deliberately NOT "delete the older one":
                // two files from one page can be a main plus an optional, and
                // this page does not guess which of those it is looking at.
                const next = new Set(selected);
                for (const group of dupGroups) {
                  for (const m of group.mods) next.add(m.id);
                }
                setSelected(next);
                setDupSel(new Set());
              }}
            >
              Add {describeTarget(
                dupAim ?? { ids: duplicates.map((g) => String(g.nexusModId)), from: "all" },
                "group",
              )} to the selection above
            </Button>
          </div>
        )}
        <DataTable
          rows={duplicates}
          idOf={duplicateId}
          columns={DUPLICATE_COLUMNS}
          noun="group"
          limit={200}
          maxHeight={320}
          selection={{ selected: dupSel, onChange: setDupSel }}
          onTarget={setDupAim}
          empty={
            <p style={{ color: "var(--eh-text-secondary)", margin: 0 }}>
              No mod is installed twice.
            </p>
          }
        />
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
