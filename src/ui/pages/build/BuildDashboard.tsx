/**
 * BuildDashboard — Track 1 (parallel drafts).
 *
 * Curator-side landing view for the Build tab. Shows two flavours
 * of collection in one unified, filterable list:
 *
 *   • Drafts        — in-progress build forms persisted on disk
 *                     (`core/draftStorage`) plus any live sessions
 *                     in the `BuildSessionRegistry`.
 *   • Published     — collections the curator has built before,
 *                     identified by the per-collection config files
 *                     under `<appData>/event-horizon/collections/.config/`.
 *
 * Why one list with a filter pill instead of two tabs:
 *   - The two views answer the same question ("what am I working
 *     on?") at different points in time. A draft is "soon-to-be a
 *     published collection"; a published collection is "edited via
 *     a fresh draft". Tabs would force users to mentally context-
 *     switch when they're really doing one workflow.
 *   - Single list lets us show update-tracing inline: "Editing
 *     v1.2 → ..." badge on a draft linked to its source published
 *     collection.
 *
 * Actions per item:
 *   - Draft           → Open (enters wizard for that draftId)
 *                     → Discard (removes session + on-disk file)
 *   - Published       → Update (creates fresh draft pre-linked to
 *                       this slug+packageId, opens wizard)
 *                     → New variant (creates fresh draft NOT linked
 *                       — same workflow as "+ New draft", but seeded
 *                       from this published one's metadata defaults)
 *
 * Game pinning: drafts are pinned to a gameId at creation. The
 * dashboard surfaces drafts for the active game first; non-active-
 * game drafts render with a hint pill so the curator knows they
 * have to switch profiles to edit.
 */

import * as React from "react";
import { util } from "vortex-api";
import * as path from "path";
import { randomUUID } from "crypto";

import {
  deleteDraft,
  getAppDataPath,
  getDraftsRoot,
  listDrafts,
  type DraftEnvelope,
} from "../../../core/draftStorage";
import {
  listPublishedCollections,
  type PublishedCollectionSummary,
} from "../../../core/manifest/collectionConfig";
import { getActiveGameId } from "../../../core/getModsListForProfile";
import { Button, Card, Pill, ProgressRing, useToast } from "../../components";
import { useApi } from "../../state";
import type { BuildDraftPayload } from "./buildSession";
import { getBuildSessionRegistry } from "./buildSessionRegistry";

// ───────────────────────────────────────────────────────────────────────
// Public surface
// ───────────────────────────────────────────────────────────────────────

export interface BuildDashboardProps {
  /**
   * Open the wizard for the given draftId. The page is responsible
   * for ensuring the draft's session exists in the registry before
   * mounting the wizard (the dashboard does that here so the wizard
   * can `registry.get(draftId)` synchronously).
   */
  onOpenDraft: (draftId: string) => void;
}

type FilterKey = "all" | "drafts" | "published";

interface DashboardState {
  loading: boolean;
  drafts: Array<DraftEnvelope<BuildDraftPayload>>;
  published: PublishedCollectionSummary[];
  errors: string[];
}

// ───────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────

export function BuildDashboard(props: BuildDashboardProps): JSX.Element {
  const api = useApi();
  const showToast = useToast();
  const registry = React.useMemo(() => getBuildSessionRegistry(), []);

  const [state, setState] = React.useState<DashboardState>({
    loading: true,
    drafts: [],
    published: [],
    errors: [],
  });
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [refreshTick, setRefreshTick] = React.useState(0);

  const refresh = React.useCallback((): void => {
    setRefreshTick((t) => t + 1);
  }, []);

  // Re-render whenever the registry mutates (a session changes state,
  // is added, removed). Keeps "Building..." pills live without
  // forcing a manual refresh.
  const [, setRegistryTick] = React.useState(0);
  React.useEffect(() => {
    return registry.subscribe(() => {
      setRegistryTick((t) => t + 1);
    });
  }, [registry]);

  React.useEffect(() => {
    let alive = true;
    void (async (): Promise<void> => {
      setState((s) => ({ ...s, loading: true, errors: [] }));
      const errors: string[] = [];
      const appData = getAppDataPath();
      let drafts: Array<DraftEnvelope<BuildDraftPayload>> = [];
      try {
        drafts = await listDrafts<BuildDraftPayload>(appData, "build");
      } catch (err) {
        errors.push(
          `Couldn't list drafts: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const configDir = path.join(
        util.getVortexPath("appData"),
        "event-horizon",
        "collections",
        ".config",
      );
      const published = await listPublishedCollections(configDir, {
        onError: (filename, err) => {
          errors.push(
            `Couldn't read ${filename}: ${err instanceof Error ? err.message : String(err)}`,
          );
        },
      });

      if (!alive) return;
      setState({
        loading: false,
        drafts,
        published,
        errors,
      });
    })();
    return (): void => {
      alive = false;
    };
  }, [refreshTick]);

  const activeGameId = getActiveGameId(api.getState());

  // ── Actions ────────────────────────────────────────────────────────

  const handleNewDraft = (): void => {
    if (typeof activeGameId !== "string" || activeGameId.length === 0) {
      showToast({
        intent: "warning",
        title: "No active game",
        message:
          "Switch to a Creation Engine game in Vortex first, then create a new draft.",
      });
      return;
    }
    const draftId = randomUUID();
    registry.ensure({ draftId, gameId: activeGameId });
    props.onOpenDraft(draftId);
  };

  const handleOpenDraft = (env: DraftEnvelope<BuildDraftPayload>): void => {
    const draftId = env.payload.draftId ?? env.key;
    const gameId = env.payload.gameId ?? activeGameId ?? "";
    if (gameId.length === 0) {
      showToast({
        intent: "warning",
        title: "No active game",
        message:
          "This draft predates game-pinning and Vortex has no active game. Switch to your game first.",
      });
      return;
    }
    registry.ensure({ draftId, gameId });
    props.onOpenDraft(draftId);
  };

  const handleDiscardDraft = async (
    env: DraftEnvelope<BuildDraftPayload>,
  ): Promise<void> => {
    const draftId = env.payload.draftId ?? env.key;
    // Drop the live session if any — there's nothing to come back to
    // since the disk file is being deleted.
    registry.remove(draftId);
    await deleteDraft(getAppDataPath(), "build", draftId);
    showToast({
      intent: "info",
      title: "Draft deleted",
      message:
        env.payload.title ??
        env.payload.curator?.name ??
        "Untitled draft",
    });
    refresh();
  };

  const handleUpdatePublished = (
    summary: PublishedCollectionSummary,
  ): void => {
    if (typeof activeGameId !== "string" || activeGameId.length === 0) {
      showToast({
        intent: "warning",
        title: "No active game",
        message:
          "Switch to the game this collection targets in Vortex, then click Update.",
      });
      return;
    }
    const draftId = randomUUID();
    const session = registry.ensure({ draftId, gameId: activeGameId });
    // Pre-stage a draft envelope on disk so the wizard's begin() pass
    // restores `linkedSlug` / `linkedPackageId` and the autosave layer
    // keeps them. We can't push these into the session directly
    // because the session is in `idle` and has no `form` state yet.
    //
    // Caller-side autosave on the wizard's first form-state will
    // overwrite this with the full payload — but our linked fields
    // are only known here, so we seed them up front.
    void session; // we just need it created in the registry
    void (async (): Promise<void> => {
      const { saveDraft } = await import("../../../core/draftStorage");
      await saveDraft<BuildDraftPayload>(getAppDataPath(), "build", draftId, {
        draftId,
        gameId: activeGameId,
        title: summary.lastBuiltName ?? summary.slug,
        linkedSlug: summary.slug,
        linkedPackageId: summary.packageId,
        curator: {
          name: summary.lastBuiltName ?? "",
          version: bumpPatch(summary.lastBuiltVersion),
          author: "",
          description: "",
        },
        overrides: {},
        readme: "",
        changelog: "",
      });
      props.onOpenDraft(draftId);
    })();
  };

  // ── Filtering / merging ────────────────────────────────────────────

  const items = React.useMemo<DashboardItem[]>(() => {
    const out: DashboardItem[] = [];
    for (const env of state.drafts) {
      out.push({ kind: "draft", env });
    }
    for (const pub of state.published) {
      // Hide published collections that have an active draft pointing
      // at them — the draft IS the "in flight update" for that
      // published one, so listing both is noisy. Surface as a
      // subscript on the draft instead (handled in the row renderer).
      const linkedDraft = state.drafts.find(
        (d) => d.payload.linkedPackageId === pub.packageId,
      );
      if (linkedDraft !== undefined) continue;
      out.push({ kind: "published", summary: pub });
    }
    if (filter === "drafts") return out.filter((i) => i.kind === "draft");
    if (filter === "published") return out.filter((i) => i.kind === "published");
    return out;
  }, [state.drafts, state.published, filter]);

  // ── Render ─────────────────────────────────────────────────────────

  if (state.loading) {
    return (
      <div className="eh-page">
        <DashboardHeader
          activeGameId={activeGameId}
          counts={{ drafts: 0, published: 0 }}
          filter={filter}
          onFilter={setFilter}
          onNewDraft={handleNewDraft}
          onRefresh={refresh}
          newDraftDisabled={true}
          loading={true}
        />
        <div
          style={{
            padding: "var(--eh-sp-5)",
            background: "var(--eh-bg-raised)",
            borderRadius: "var(--eh-radius-lg)",
            display: "flex",
            gap: "var(--eh-sp-4)",
            alignItems: "center",
          }}
        >
          <ProgressRing size={48} />
          <span style={{ color: "var(--eh-text-secondary)" }}>
            Listing drafts and published collections...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="eh-page">
      <DashboardHeader
        activeGameId={activeGameId}
        counts={{
          drafts: state.drafts.length,
          published: state.published.length,
        }}
        filter={filter}
        onFilter={setFilter}
        onNewDraft={handleNewDraft}
        onRefresh={refresh}
        newDraftDisabled={
          typeof activeGameId !== "string" || activeGameId.length === 0
        }
      />

      {state.errors.length > 0 && (
        <div
          style={{
            marginBottom: "var(--eh-sp-4)",
            padding: "var(--eh-sp-3) var(--eh-sp-4)",
            background: "rgba(255, 91, 120, 0.08)",
            border: "1px solid var(--eh-danger)",
            borderRadius: "var(--eh-radius-md)",
            color: "var(--eh-danger)",
            fontSize: "var(--eh-text-sm)",
          }}
        >
          <strong>{state.errors.length} item{state.errors.length === 1 ? "" : "s"} failed to load.</strong>
          <ul
            style={{
              margin: "var(--eh-sp-2) 0 0 0",
              paddingLeft: "var(--eh-sp-5)",
              color: "var(--eh-text-secondary)",
            }}
          >
            {state.errors.slice(0, 5).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState onNewDraft={handleNewDraft} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "var(--eh-sp-4)",
          }}
        >
          {items.map((item) =>
            item.kind === "draft" ? (
              <DraftCard
                key={`draft:${item.env.key}`}
                env={item.env}
                activeGameId={activeGameId}
                registrySessionStateKind={
                  registry
                    .get(item.env.payload.draftId ?? item.env.key)
                    ?.getState().kind
                }
                onOpen={(): void => handleOpenDraft(item.env)}
                onDiscard={(): void => {
                  void handleDiscardDraft(item.env);
                }}
              />
            ) : (
              <PublishedCard
                key={`pub:${item.summary.slug}`}
                summary={item.summary}
                onUpdate={(): void => handleUpdatePublished(item.summary)}
              />
            ),
          )}
        </div>
      )}

      <DraftsRootHint />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────

function DashboardHeader(props: {
  activeGameId: string | undefined;
  counts: { drafts: number; published: number };
  filter: FilterKey;
  onFilter: (k: FilterKey) => void;
  onNewDraft: () => void;
  onRefresh: () => void;
  newDraftDisabled?: boolean;
  loading?: boolean;
}): JSX.Element {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: "var(--eh-sp-3)",
        marginBottom: "var(--eh-sp-5)",
        flexWrap: "wrap",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "var(--eh-text-2xl)",
            color: "var(--eh-text-primary)",
            letterSpacing: "var(--eh-tracking-tight)",
          }}
        >
          Build a collection
        </h2>
        <p
          style={{
            margin: "var(--eh-sp-2) 0 0 0",
            color: "var(--eh-text-secondary)",
            fontSize: "var(--eh-text-md)",
          }}
        >
          {props.loading
            ? "Loading..."
            : `${props.counts.drafts} draft${
                props.counts.drafts === 1 ? "" : "s"
              } · ${props.counts.published} published`}
          {props.activeGameId !== undefined && (
            <>
              {" · active game: "}
              <strong style={{ color: "var(--eh-text-primary)" }}>
                {props.activeGameId}
              </strong>
            </>
          )}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--eh-sp-2)",
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex", gap: "var(--eh-sp-2)", flexWrap: "wrap" }}>
          <Button intent="ghost" onClick={props.onRefresh}>
            Refresh
          </Button>
          <Button
            intent="primary"
            onClick={props.onNewDraft}
            disabled={props.newDraftDisabled}
            title={
              props.newDraftDisabled
                ? "Switch to a supported game in Vortex first."
                : undefined
            }
          >
            + New draft
          </Button>
        </div>
        <div style={{ display: "flex", gap: "var(--eh-sp-2)" }}>
          {(["all", "drafts", "published"] as FilterKey[]).map((k) => (
            <FilterPill
              key={k}
              active={props.filter === k}
              onClick={(): void => props.onFilter(k)}
            >
              {k === "all" ? "All" : k === "drafts" ? "Drafts" : "Published"}
            </FilterPill>
          ))}
        </div>
      </div>
    </header>
  );
}

function FilterPill(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      onClick={props.onClick}
      style={{
        padding: "var(--eh-sp-1) var(--eh-sp-3)",
        background: props.active
          ? "var(--eh-accent-soft, var(--eh-bg-raised))"
          : "var(--eh-bg-base)",
        border: `1px solid ${
          props.active ? "var(--eh-accent, var(--eh-text-primary))" : "var(--eh-border-default)"
        }`,
        borderRadius: "var(--eh-radius-pill, 999px)",
        color: props.active
          ? "var(--eh-text-primary)"
          : "var(--eh-text-secondary)",
        fontSize: "var(--eh-text-sm)",
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      {props.children}
    </button>
  );
}

function EmptyState(props: { onNewDraft: () => void }): JSX.Element {
  return (
    <div
      style={{
        padding: "var(--eh-sp-7) var(--eh-sp-5)",
        background: "var(--eh-bg-glass)",
        border: "1px dashed var(--eh-border-default)",
        borderRadius: "var(--eh-radius-lg)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "var(--eh-sp-4)",
        alignItems: "center",
      }}
    >
      <h3 style={{ margin: 0, color: "var(--eh-text-primary)" }}>
        No drafts or published collections yet
      </h3>
      <p
        style={{
          margin: 0,
          color: "var(--eh-text-secondary)",
          maxWidth: 480,
          lineHeight: "var(--eh-leading-relaxed)",
          fontSize: "var(--eh-text-sm)",
        }}
      >
        Start a new draft to capture your active profile as an Event
        Horizon collection. Drafts autosave while you edit, and you
        can keep several in flight at once — one per collection
        you're working on.
      </p>
      <Button intent="primary" size="lg" onClick={props.onNewDraft}>
        + New draft
      </Button>
    </div>
  );
}

type DashboardItem =
  | { kind: "draft"; env: DraftEnvelope<BuildDraftPayload> }
  | { kind: "published"; summary: PublishedCollectionSummary };

function DraftCard(props: {
  env: DraftEnvelope<BuildDraftPayload>;
  activeGameId: string | undefined;
  registrySessionStateKind: string | undefined;
  onOpen: () => void;
  onDiscard: () => void;
}): JSX.Element {
  const { env, activeGameId, registrySessionStateKind } = props;
  const payload = env.payload;
  const title =
    payload.title ??
    payload.curator?.name ??
    "Untitled draft";
  const gameId = payload.gameId ?? env.key;
  const draftMatchesGame = activeGameId === gameId;
  const liveStatus = registrySessionStateKind ?? "idle";
  return (
    <Card
      title={title}
      footer={
        <span style={{ color: "var(--eh-text-muted)" }}>
          autosaved {relativeTime(env.savedAt)}
        </span>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--eh-sp-2)",
          color: "var(--eh-text-secondary)",
          fontSize: "var(--eh-text-sm)",
        }}
      >
        <div style={{ display: "flex", gap: "var(--eh-sp-2)", flexWrap: "wrap" }}>
          <Pill intent="info">draft</Pill>
          <Pill intent="neutral">{gameId}</Pill>
          {!draftMatchesGame && (
            <Pill intent="warning">switch to {gameId}</Pill>
          )}
          {liveStatus === "loading" && <Pill intent="info">loading</Pill>}
          {liveStatus === "queued" && <Pill intent="info">queued</Pill>}
          {liveStatus === "building" && (
            <Pill intent="info" withDot>
              building
            </Pill>
          )}
        </div>
        {payload.linkedSlug !== undefined && (
          <div style={{ color: "var(--eh-text-muted)" }}>
            <strong>Updates:</strong> {payload.linkedSlug}
            {payload.curator?.version !== undefined && (
              <> → v{payload.curator.version}</>
            )}
          </div>
        )}
        {payload.curator?.version !== undefined &&
          payload.linkedSlug === undefined && (
            <div>
              <strong>Version:</strong> v{payload.curator.version || "—"}
            </div>
          )}
        <div style={{ display: "flex", gap: "var(--eh-sp-2)", marginTop: "var(--eh-sp-2)" }}>
          <Button
            intent="primary"
            onClick={props.onOpen}
            disabled={!draftMatchesGame}
            title={
              draftMatchesGame
                ? undefined
                : `Switch Vortex to ${gameId} to open this draft.`
            }
          >
            Open
          </Button>
          <Button intent="ghost" onClick={props.onDiscard}>
            Discard
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PublishedCard(props: {
  summary: PublishedCollectionSummary;
  onUpdate: () => void;
}): JSX.Element {
  const { summary } = props;
  const title = summary.lastBuiltName ?? summary.slug;
  return (
    <Card
      title={title}
      footer={
        <span style={{ color: "var(--eh-text-muted)" }}>
          {summary.lastBuiltAt !== undefined
            ? `last built ${relativeTime(summary.lastBuiltAt)}`
            : "never built"}
        </span>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--eh-sp-2)",
          color: "var(--eh-text-secondary)",
          fontSize: "var(--eh-text-sm)",
        }}
      >
        <div style={{ display: "flex", gap: "var(--eh-sp-2)", flexWrap: "wrap" }}>
          <Pill intent="success">published</Pill>
          {summary.lastBuiltVersion !== undefined && (
            <Pill intent="info">v{summary.lastBuiltVersion}</Pill>
          )}
        </div>
        <div style={{ color: "var(--eh-text-muted)" }}>
          <strong>Slug:</strong> {summary.slug}
        </div>
        <div style={{ display: "flex", gap: "var(--eh-sp-2)", marginTop: "var(--eh-sp-2)" }}>
          <Button intent="primary" onClick={props.onUpdate}>
            Update
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DraftsRootHint(): JSX.Element {
  const [shown, setShown] = React.useState(false);
  return (
    <div
      style={{
        marginTop: "var(--eh-sp-5)",
        fontSize: "var(--eh-text-xs)",
        color: "var(--eh-text-muted)",
      }}
    >
      <button
        onClick={(): void => setShown((s) => !s)}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--eh-text-muted)",
          cursor: "pointer",
          padding: 0,
          fontFamily: "inherit",
          fontSize: "inherit",
        }}
      >
        {shown ? "Hide" : "Show"} draft folder location
      </button>
      {shown && (
        <div style={{ marginTop: "var(--eh-sp-1)", fontFamily: "var(--eh-font-mono)" }}>
          {getDraftsRoot(getAppDataPath())}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

/**
 * Best-effort patch-bump for "Update from published" pre-fill. Treats
 * "1.2.3" → "1.2.4". Curators can edit the version anyway, so we
 * just nudge them in the right direction on open.
 */
function bumpPatch(version: string | undefined): string {
  if (typeof version !== "string" || version.length === 0) return "1.0.0";
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (m === null) return version;
  const major = m[1];
  const minor = m[2];
  const patch = Number.parseInt(m[3], 10);
  if (!Number.isFinite(patch)) return version;
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Compact relative time for autosave / build timestamps. Avoids
 * pulling in Intl.RelativeTimeFormat (Vortex-host quirks) in favour
 * of a deterministic tiny formatter — accuracy beyond "a few hours
 * ago" doesn't matter for this UI.
 */
function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const ms = Date.now() - t;
  const sec = Math.round(ms / 1000);
  if (sec < 30) return "just now";
  if (sec < 90) return "a minute ago";
  const min = Math.round(sec / 60);
  if (min < 45) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  // Beyond a month, fall back to a date string — no point pretending
  // we know "3 months ago" precisely.
  return new Date(t).toLocaleDateString();
}
