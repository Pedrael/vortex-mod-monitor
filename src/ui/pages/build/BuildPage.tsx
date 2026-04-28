/**
 * BuildPage — Phase 5.3 (session-driven, 5.5+).
 *
 * The curator-side React UI. Drives the full build pipeline:
 *   1. Idle:     friendly welcome card, "Begin" launches the load.
 *   2. Loading:  read state, hash mods, load (or create) collection config.
 *   3. Form:     metadata + per-mod overrides + README / CHANGELOG editors.
 *   4. Building: run the manifest + package pipeline with progress.
 *   5. Done:     success card with "Open package" / "Open folder" actions.
 *
 * Crucially the page DOES NOT own the pipeline state. All in-flight
 * work (loadBuildContext, runBuildPipeline, AbortControllers, draft
 * restore) lives in `buildSession.ts` — a module-scope singleton
 * that survives sidebar tab switches. This page is a thin renderer:
 *   • subscribes to the session on mount,
 *   • dispatches user actions to it,
 *   • re-renders whenever the session emits.
 *
 * That decoupling is what lets the build keep running in the
 * background when the user navigates to another tab (the bug
 * symptom: hashing/building "restarted" on every tab return).
 */

import * as React from "react";

import {
  Button,
  Card,
  HashingCard,
  Pill,
  ProgressRing,
  StepDots,
  useToast,
} from "../../components";
import { ErrorBoundary, useErrorReporter, useErrorReporterFormatted } from "../../errors";
import type { EventHorizonRoute } from "../../routes";
import { useApi } from "../../state";
import {
  validateCuratorInput,
  type BuildContext,
  type BuildPipelineResult,
  type BuildProgress,
  type CuratorInput,
} from "./engine";
import type { ExternalModConfigEntry } from "../../../core/manifest/collectionConfig";
import type { VerificationLevel } from "../../../types/ehcoll";
import { getAppDataPath, saveDraft } from "../../../core/draftStorage";
import {
  type BuildDraftPayload,
  type BuildSession,
  type BuildSessionState,
} from "./buildSession";
import { getBuildSessionRegistry } from "./buildSessionRegistry";
import { BuildDashboard } from "./BuildDashboard";
import { ConcurrentOpBanner } from "../../runtime/ConcurrentOpBanner";
import { nativeNotify } from "../../runtime/nativeNotify";
import { getActiveGameId } from "../../../core/getModsListForProfile";

export interface BuildPageProps {
  onNavigate: (route: EventHorizonRoute) => void;
}

/**
 * Local alias for the form variant of the session state. Kept under
 * the old name so the inner panel components (FormPanel, banner) can
 * stay verbatim from the previous component-state implementation.
 */
type BuildFormState = Extract<BuildSessionState, { kind: "form" }>;

const DRAFT_AUTOSAVE_DEBOUNCE_MS = 600;

// ===========================================================================
// Page
// ===========================================================================

export function BuildPage(props: BuildPageProps): JSX.Element {
  const reportFormatted = useErrorReporterFormatted();
  // Top-level routing between dashboard and wizard. `undefined` ==
  // dashboard view (Track 1: parallel drafts). The dashboard creates
  // sessions in the registry on "+ New draft" / "Open" / "Update"
  // and hands the resulting draftId back here so the wizard can
  // subscribe to it.
  //
  // Kept in component state (not Redux/route segment) because the
  // dashboard ↔ wizard transition is purely a UI concern — the
  // sessions themselves persist across the transition because they
  // live in the module-scope registry.
  const [activeDraftId, setActiveDraftId] = React.useState<
    string | undefined
  >(undefined);

  return (
    <ErrorBoundary
      where="BuildPage"
      variant="page"
      onReport={reportFormatted}
    >
      {activeDraftId === undefined ? (
        <BuildDashboard
          onOpenDraft={(draftId): void => {
            setActiveDraftId(draftId);
          }}
        />
      ) : (
        <BuildWizard
          draftId={activeDraftId}
          onNavigate={props.onNavigate}
          onBackToDashboard={(): void => {
            setActiveDraftId(undefined);
          }}
        />
      )}
    </ErrorBoundary>
  );
}

interface BuildWizardProps extends BuildPageProps {
  draftId: string;
  onBackToDashboard: () => void;
}

function BuildWizard(props: BuildWizardProps): JSX.Element {
  const api = useApi();
  const reportError = useErrorReporter();
  const showToast = useToast();
  // Get-or-fail: the dashboard always creates the session before
  // routing here, so the `ensure` call below is effectively a get.
  // We seed the fallback `gameId` with whatever Vortex thinks is the
  // active game at recreate time — `ensure` ignores `gameId` for
  // existing sessions, which is what we always have at this point.
  // The fallback only fires after a hot reload nuked the registry
  // but `activeDraftId` state survived; in that case we want a
  // sensible game to pin the recreated session to (an empty string
  // would let `begin()` pick something arbitrary later, which races
  // with the user switching profiles between reload and click).
  const session: BuildSession = React.useMemo(() => {
    const registry = getBuildSessionRegistry();
    const existing = registry.get(props.draftId);
    if (existing !== undefined) return existing;
    const fallbackGameId = getActiveGameId(api.getState()) ?? "";
    return registry.ensure({
      draftId: props.draftId,
      gameId: fallbackGameId,
    });
    // We deliberately omit `api` from deps: the session is keyed by
    // draftId. Re-evaluating on every state tick would either
    // re-fetch the same instance (cheap, fine) or — if `api` changed
    // identity, which it shouldn't — risk a no-op `ensure`. Either
    // way the result is stable for this draftId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.draftId]);

  // Mirror the session's state into local React state. The session
  // is the source of truth; this useState only exists to trigger
  // re-renders when the session emits.
  const [state, setLocalState] = React.useState<BuildSessionState>(() =>
    session.getState(),
  );
  React.useEffect(() => {
    // On (re)mount, immediately sync — the session may have moved on
    // while we were on another tab.
    setLocalState(session.getState());
    return session.subscribe(setLocalState);
  }, [session]);

  // ── Side-effect dispatch on session transitions ──────────────────
  // Toasts and error modals must fire once per real transition, NOT
  // on remount when the user lands back on the page mid-state. We
  // track the previous kind in a ref and only react when it changes.
  // Refs persist for the component instance lifetime; reportedErrorId
  // makes "did I already open the modal for this exact failure?"
  // dedup explicit (the session bumps errorId per failure).
  const prevKindRef = React.useRef<BuildSessionState["kind"] | undefined>(
    undefined,
  );
  const reportedErrorIdRef = React.useRef<number | undefined>(undefined);
  React.useEffect(() => {
    const prev = prevKindRef.current;
    prevKindRef.current = state.kind;

    // First subscription tick: just record kind, never spam toasts
    // for whatever state we walked into.
    if (prev === undefined) return;
    if (prev === state.kind) return;

    if (state.kind === "done" && prev === "building") {
      showToast({
        intent: "success",
        title: `Built ${state.curator.name} v${state.curator.version}`,
        message: `${state.result.modCount} mods, ${formatBytes(state.result.outputBytes)}.`,
      });
      nativeNotify({
        title: "Event Horizon · build complete",
        body: `${state.curator.name} v${state.curator.version} — ${state.result.modCount} mods, ${formatBytes(state.result.outputBytes)}`,
        tag: `eh-build-${state.curator.name}-${state.curator.version}`,
      });
      return;
    }
    if (state.kind === "form" && prev === "building") {
      // Only path from building → form is a user-initiated cancel.
      showToast({
        intent: "info",
        title: "Build cancelled",
        message: "No .ehcoll was written.",
      });
      return;
    }
    if (state.kind === "error") {
      // Each distinct failure gets one report — even if the user
      // remounts the page, the modal won't reopen for the same
      // errorId. Cleared once they retry/reset.
      if (reportedErrorIdRef.current === state.record.errorId) return;
      reportedErrorIdRef.current = state.record.errorId;
      reportError(state.record.error, {
        title:
          state.record.phase === "load"
            ? "Couldn't prepare build context"
            : "Build failed",
        context: { step: state.record.phase },
      });
      return;
    }
    if (state.kind === "idle" || state.kind === "loading") {
      // Cleared so a future error after a retry reports cleanly.
      reportedErrorIdRef.current = undefined;
    }
  }, [state, showToast, reportError]);

  // ── Autosave (debounced) ─────────────────────────────────────────
  // Stays in the component because autosave only matters while the
  // user is editing — which means they're on this page. Persists to
  // disk via `core/draftStorage`; restoration happens inside the
  // session on the loading → form transition.
  //
  // Track 1: the autosave key is the session's `draftId` (a UUIDv4),
  // not `ctx.gameId`. That's what unlocks "many drafts per game" —
  // each draft gets its own file, no clobbering.
  //
  // We also persist linkage metadata (`linkedSlug`/`linkedPackageId`)
  // here because the dashboard's "Update from published" pre-stages
  // a partial draft on disk, but a subsequent autosave would
  // overwrite it without these fields if we didn't carry them
  // through. They're read off the saved disk envelope at the start
  // of the form session (see auto-begin effect below) and then
  // written back on every autosave.
  const linkedFieldsRef = React.useRef<{
    linkedSlug?: string;
    linkedPackageId?: string;
  }>({});

  // `title` lives in component state (not session form state)
  // because it's a dashboard-only label — never sent to the
  // manifest, never validated, just displayed on the DraftCard so
  // a curator with five drafts can tell them apart at a glance.
  // Initialised from any restored on-disk envelope below.
  const [draftTitle, setDraftTitle] = React.useState<string>("");

  React.useEffect(() => {
    if (state.kind !== "form") return undefined;
    const formState = state;
    const handle = setTimeout(() => {
      const payload: BuildDraftPayload = {
        draftId: session.draftId,
        gameId: session.gameId,
        title: draftTitle.length > 0 ? draftTitle : undefined,
        linkedSlug: linkedFieldsRef.current.linkedSlug,
        linkedPackageId: linkedFieldsRef.current.linkedPackageId,
        curator: formState.curator,
        overrides: formState.overrides,
        readme: formState.readme,
        changelog: formState.changelog,
        verificationLevel: formState.verificationLevel,
      };
      void saveDraft(getAppDataPath(), "build", session.draftId, payload);
    }, DRAFT_AUTOSAVE_DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
    };
  }, [
    session,
    state.kind,
    draftTitle,
    state.kind === "form" ? state.curator : undefined,
    state.kind === "form" ? state.overrides : undefined,
    state.kind === "form" ? state.readme : undefined,
    state.kind === "form" ? state.changelog : undefined,
    state.kind === "form" ? state.verificationLevel : undefined,
  ]);

  // ── Restore link-metadata from disk ──────────────────────────────
  // Pre-load `linkedSlug`/`linkedPackageId`/`title` from any on-disk
  // draft into the ref + title state so the autosave keeps them
  // stable across edits (the session's `form` state doesn't carry
  // them — they're dashboard-side affordances).
  //
  // Predictable-UX choice: we deliberately DO NOT call
  // `session.begin(api)` here. Even though the hashing pass would be
  // a "guessable next step" after Open / + New draft / Update, the
  // legacy auto-begin had two real downsides:
  //   • Surprise CPU. Tab-switching into the build page kicked off
  //     a heavy read pass without the user touching anything.
  //   • Race with the registry's defensive recreate path —
  //     `session.gameId === ""` when the registry was nuked by a
  //     hot reload, and `begin()` would silently re-bind to whatever
  //     game is active *right now*, not what the draft was created
  //     for.
  // Curators land on `IdlePanel`, read what's about to happen, and
  // press "Begin" explicitly. One extra click, zero surprise CPU.
  React.useEffect(() => {
    let alive = true;
    void (async (): Promise<void> => {
      try {
        const { loadDraft } = await import("../../../core/draftStorage");
        const env = await loadDraft<BuildDraftPayload>(
          getAppDataPath(),
          "build",
          session.draftId,
        );
        if (!alive) return;
        if (env !== undefined) {
          linkedFieldsRef.current = {
            linkedSlug: env.payload.linkedSlug,
            linkedPackageId: env.payload.linkedPackageId,
          };
          if (typeof env.payload.title === "string") {
            setDraftTitle(env.payload.title);
          }
        }
      } catch {
        /* swallow — best-effort */
      }
    })();
    return (): void => {
      alive = false;
    };
    // Run once per mounted draftId, not per state tick. Note we no
    // longer key on `state.kind === "idle"`: link metadata might be
    // missing from the ref if the user navigated away mid-form and
    // came back, in which case we still want to re-hydrate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ── Step indicator ───────────────────────────────────────────────
  // `queued` shares a step bucket with `building` because from the
  // user's mental model "I clicked Build, now I'm waiting" is one
  // phase. The QueuedPanel itself spells out the distinction.
  const stepIndex =
    state.kind === "idle"
      ? 0
      : state.kind === "loading"
      ? 1
      : state.kind === "form"
      ? 2
      : state.kind === "building" || state.kind === "queued"
      ? 3
      : 4;
  const stepLabels = ["Idle", "Loading", "Form", "Building", "Done"];

  // ── Render ────────────────────────────────────────────────────────
  // Tiny "← Drafts" affordance so the curator can always bail back
  // to the dashboard without resetting their session. Sessions live
  // in the registry; remounting the wizard for the same draftId
  // resumes exactly where they left off.
  const backToDashboard = (
    <div style={{ marginBottom: "var(--eh-sp-3)" }}>
      <Button intent="ghost" onClick={props.onBackToDashboard}>
        ← Drafts
      </Button>
    </div>
  );

  if (state.kind === "idle") {
    return (
      <div className="eh-page">
        {backToDashboard}
        <Header stepIndex={stepIndex} stepLabel="Idle" />
        <ConcurrentOpBanner self="build" />
        <IdlePanel
          onBegin={(): void => session.begin(api)}
          onCancel={props.onBackToDashboard}
        />
      </div>
    );
  }
  if (state.kind === "loading") {
    return (
      <div className="eh-page">
        {backToDashboard}
        <Header stepIndex={stepIndex} stepLabel={stepLabels[stepIndex]} />
        <LoadingPanel
          progress={state.phase}
          onCancel={(): void => session.cancelLoading()}
        />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="eh-page">
        {backToDashboard}
        <Header stepIndex={stepIndex} stepLabel="Error" />
        <ErrorPanel
          onRetry={(): void => {
            session.reset();
            session.begin(api);
          }}
        />
      </div>
    );
  }
  if (state.kind === "queued") {
    return (
      <div className="eh-page">
        {backToDashboard}
        <Header stepIndex={stepIndex} stepLabel="Queued" />
        <QueuedPanel
          curator={state.curator}
          queuePosition={state.queuePosition}
          onCancel={(): void => session.cancelBuilding()}
        />
      </div>
    );
  }
  if (state.kind === "building") {
    return (
      <div className="eh-page">
        {backToDashboard}
        <Header stepIndex={stepIndex} stepLabel={stepLabels[stepIndex]} />
        <BuildingPanel
          progress={state.progress}
          curator={state.curator}
          onCancel={(): void => session.cancelBuilding()}
        />
      </div>
    );
  }
  if (state.kind === "done") {
    return (
      <div className="eh-page">
        {backToDashboard}
        <Header stepIndex={stepIndex} stepLabel={stepLabels[stepIndex]} />
        <DonePanel
          result={state.result}
          onBuildAnother={(): void => {
            // Successful build — drop the session from the registry
            // and bounce back to the dashboard. Curators almost
            // always start a *different* collection next, not an
            // identical rebuild of the same one.
            session.reset();
            getBuildSessionRegistry().remove(session.draftId);
            props.onBackToDashboard();
          }}
          onGoHome={(): void => {
            session.reset();
            getBuildSessionRegistry().remove(session.draftId);
            props.onNavigate("home");
          }}
        />
      </div>
    );
  }

  const formState = state;
  const handleChange = (next: Partial<BuildFormState>): void => {
    session.patchForm(next);
  };

  const handleDiscardDraft = (): void => {
    void session.discardDraft();
    showToast({
      intent: "info",
      title: "Draft discarded",
      message: "Form reset to your saved collection defaults.",
    });
  };

  const handleDismissDraftBanner = (): void => {
    session.dismissDraftBanner();
  };

  const onBuild = (): void => {
    if (formState.ctx.mods.length === 0) {
      session.setValidationError(
        "Your active profile has no mods. Enable at least one mod in Vortex before building a collection.",
      );
      return;
    }
    const validationError = validateCuratorInput(formState.curator);
    if (validationError !== undefined) {
      session.setValidationError(validationError);
      return;
    }
    session.build(api, {
      ctx: formState.ctx,
      curator: formState.curator,
      overrides: formState.overrides,
      readme: formState.readme,
      changelog: formState.changelog,
      verificationLevel: formState.verificationLevel,
    });
  };

  // Game-mismatch banner: this draft was created for `session.gameId`,
  // but Vortex is currently active on a different game. Building
  // would still produce a manifest tied to `session.gameId` (the
  // form's `ctx.gameId` was pinned at load time), but any "begin
  // again" / "retry" path would re-read Vortex's active game and
  // silently switch — so warn the curator before that happens.
  const activeGameId = getActiveGameId(api.getState());
  const gameMismatch =
    typeof activeGameId === "string" &&
    activeGameId.length > 0 &&
    session.gameId.length > 0 &&
    activeGameId !== session.gameId;

  return (
    <div className="eh-page">
      {backToDashboard}
      <Header stepIndex={stepIndex} stepLabel={stepLabels[stepIndex]} />
      <ConcurrentOpBanner self="build" />
      {gameMismatch && (
        <GameMismatchBanner
          draftGameId={session.gameId}
          activeGameId={activeGameId as string}
        />
      )}
      <FormPanel
        state={formState}
        title={draftTitle}
        onTitleChange={setDraftTitle}
        onChange={handleChange}
        onBuild={onBuild}
        onDiscardDraft={handleDiscardDraft}
        onDismissDraftBanner={handleDismissDraftBanner}
      />
    </div>
  );
}

/**
 * Sticky orange notice at the top of the form when Vortex's active
 * game has drifted away from the game this draft was created for.
 * Doesn't disable Build (the form context is already pinned to the
 * draft's game and a build will still produce a coherent manifest)
 * — it just prevents the curator being surprised when their build
 * doesn't match what they currently see in Vortex's mod list.
 */
function GameMismatchBanner(props: {
  draftGameId: string;
  activeGameId: string;
}): JSX.Element {
  return (
    <div
      role="alert"
      style={{
        marginBottom: "var(--eh-sp-3)",
        padding: "var(--eh-sp-3) var(--eh-sp-4)",
        background: "rgba(255, 198, 99, 0.08)",
        border: "1px solid var(--eh-warning)",
        borderRadius: "var(--eh-radius-md)",
        color: "var(--eh-text-primary)",
        fontSize: "var(--eh-text-sm)",
        display: "flex",
        gap: "var(--eh-sp-2)",
        alignItems: "flex-start",
      }}
    >
      <span aria-hidden="true">⚠</span>
      <div>
        <strong>Active game switched.</strong>{" "}
        This draft was loaded for <code>{props.draftGameId}</code>, but
        Vortex is now active on <code>{props.activeGameId}</code>. The
        form data still reflects the original game and will build
        correctly. Switch Vortex back to{" "}
        <code>{props.draftGameId}</code> if you need to inspect
        live mod state, or open this draft from the dashboard after
        switching profiles.
      </div>
    </div>
  );
}

// ===========================================================================
// Queued
// ===========================================================================

/**
 * Card shown when this draft's build is parked behind another draft's
 * build. The registry's queue promotes us automatically; we just
 * render a friendly "you're #N in line" + a cancel that bails us out
 * without touching whoever currently owns the slot.
 */
function QueuedPanel(props: {
  curator: CuratorInput;
  queuePosition: number;
  onCancel: () => void;
}): JSX.Element {
  return (
    <Card title={`Queued: ${props.curator.name} v${props.curator.version}`}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--eh-sp-3)",
          padding: "var(--eh-sp-2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--eh-sp-3)",
          }}
        >
          <ProgressRing size={48} />
          <div>
            <div
              style={{
                color: "var(--eh-text-primary)",
                fontSize: "var(--eh-text-md)",
              }}
            >
              Waiting for the current build to finish.
            </div>
            <div
              style={{
                color: "var(--eh-text-secondary)",
                fontSize: "var(--eh-text-sm)",
                marginTop: "var(--eh-sp-1)",
              }}
            >
              Position {props.queuePosition} in queue. We'll start automatically
              when it's your turn — switching tabs is fine.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button intent="ghost" onClick={props.onCancel}>
            Cancel build
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ===========================================================================
// Idle
// ===========================================================================

/**
 * First-impression panel for the build flow. We deliberately don't
 * auto-start the (slow) hashing pass on tab open — it's surprising
 * for the user, costs CPU, and on cancel had no good "back" button.
 *
 * Instead this card explains what's about to happen and waits for an
 * explicit click. Once the work is in flight the session keeps it
 * running across tab switches.
 */
function IdlePanel(props: {
  onBegin: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <Card title="Build a collection">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--eh-sp-3)",
          padding: "var(--eh-sp-2)",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--eh-text-secondary)",
            fontSize: "var(--eh-text-md)",
            lineHeight: "var(--eh-leading-normal)",
          }}
        >
          Event Horizon will read your active profile, hash every mod
          archive (so the manifest pins exact files), and then open
          the curator form so you can polish the metadata, README,
          and CHANGELOG before packaging the .ehcoll.
        </p>
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
            Hashing is read-only and safe to cancel. Big profiles can
            take a few minutes the first time, near-instant on retries.
          </li>
          <li>
            Your draft autosaves while you edit. Switch to another tab
            or restart Vortex — your form will be there when you come back.
          </li>
          <li>
            The build keeps running if you navigate away while it's
            in flight; come back to this tab to see progress.
          </li>
        </ul>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--eh-sp-2)",
            marginTop: "var(--eh-sp-2)",
            flexWrap: "wrap",
          }}
        >
          <Button intent="ghost" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button intent="primary" size="lg" onClick={props.onBegin}>
            Begin
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ===========================================================================
// Header
// ===========================================================================

function Header(props: { stepIndex: number; stepLabel: string }): JSX.Element {
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
          Capture your active profile as an Event Horizon .ehcoll package.
        </p>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "var(--eh-sp-2)",
        }}
      >
        <StepDots total={5} current={props.stepIndex} />
        <span
          style={{
            color: "var(--eh-text-muted)",
            fontSize: "var(--eh-text-xs)",
            textTransform: "uppercase",
            letterSpacing: "var(--eh-tracking-widest)",
          }}
        >
          Step {props.stepIndex + 1} / 5 · {props.stepLabel}
        </span>
      </div>
    </header>
  );
}

// ===========================================================================
// Loading
// ===========================================================================

function LoadingPanel(props: {
  progress?: BuildProgress;
  onCancel?: () => void;
}): JSX.Element {
  const phaseLabel = phaseToLabel(props.progress?.phase);
  const isHashing = props.progress?.phase === "hashing-mods";
  const total = props.progress?.total ?? 0;

  // Specialised card for the long, slow hashing pass: live counter,
  // current item, scanner shimmer, and a cancel button.
  if (isHashing && total > 0) {
    return (
      <HashingCard
        title="Hashing mod archives"
        subtitle="Computing SHA-256 of every mod archive — this is read-only and safe to cancel at any time."
        done={props.progress?.done ?? 0}
        total={total}
        currentItem={props.progress?.currentItem}
        onCancel={props.onCancel}
      />
    );
  }

  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--eh-sp-4)",
          padding: "var(--eh-sp-3)",
        }}
      >
        <ProgressRing size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, color: "var(--eh-text-primary)" }}>
            Preparing build context
          </h3>
          <p
            style={{
              margin: "var(--eh-sp-1) 0 0 0",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            {props.progress?.message ?? phaseLabel ?? "Reading active profile..."}
          </p>
        </div>
        {props.onCancel !== undefined && (
          <Button intent="ghost" size="sm" onClick={props.onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}

// ===========================================================================
// Form
// ===========================================================================

interface FormPanelProps {
  state: BuildFormState;
  /**
   * Optional dashboard-only label so curators with multiple drafts
   * in flight can tell them apart at a glance ("Skyrim — main", "Skyrim
   * — testing"). Independent from `curator.name` (which becomes the
   * package name and goes into the manifest); the title is purely a
   * draft-side affordance and never ships in the .ehcoll.
   */
  title: string;
  onTitleChange: (next: string) => void;
  onChange: (next: Partial<BuildFormState>) => void;
  onBuild: () => void;
  onDiscardDraft: () => void;
  onDismissDraftBanner: () => void;
}

function FormPanel(props: FormPanelProps): JSX.Element {
  const {
    state,
    title,
    onTitleChange,
    onChange,
    onBuild,
    onDiscardDraft,
    onDismissDraftBanner,
  } = props;
  const { ctx, curator, overrides, readme, changelog, validationError, restoredAt } = state;

  const updateCurator = (patch: Partial<CuratorInput>): void =>
    onChange({ curator: { ...curator, ...patch } });

  const updateOverride = (
    modId: string,
    patch: Partial<ExternalModConfigEntry>,
  ): void =>
    onChange({
      overrides: {
        ...overrides,
        [modId]: { ...overrides[modId], ...patch },
      },
    });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: "var(--eh-sp-4)",
      }}
    >
      {restoredAt !== undefined && (
        <DraftRestoredBanner
          savedAt={restoredAt}
          onDiscard={onDiscardDraft}
          onDismiss={onDismissDraftBanner}
        />
      )}
      {ctx.mods.length === 0 && (
        <div
          role="alert"
          style={{
            padding: "var(--eh-sp-3) var(--eh-sp-4)",
            background: "var(--eh-bg-elevated)",
            border: "1px solid var(--eh-danger)",
            borderRadius: "var(--eh-radius-md)",
            color: "var(--eh-text-primary)",
            fontSize: "var(--eh-text-sm)",
            display: "flex",
            gap: "var(--eh-sp-2)",
            alignItems: "flex-start",
          }}
        >
          <span aria-hidden="true">⚠</span>
          <div>
            <strong>Your active profile has no mods.</strong>{" "}
            A collection needs at least one mod. Enable some mods in
            Vortex first, then come back here.
          </div>
        </div>
      )}
      <Card title="Collection metadata">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--eh-sp-3)",
            marginBottom: "var(--eh-sp-3)",
            flexWrap: "wrap",
          }}
        >
          <Field
            label="Draft label (dashboard only)"
            hint="Optional. Helps you tell drafts apart on the dashboard. Not shipped in the .ehcoll."
          >
            <input
              type="text"
              className="eh-input"
              value={title}
              placeholder={`Untitled draft — e.g. "${ctx.gameId} main run"`}
              onChange={(e) => onTitleChange(e.target.value)}
              style={{ minWidth: 280 }}
            />
          </Field>
          <ImportPreviousButton
            onImported={(patch): void => {
              onChange({ curator: { ...curator, ...patch } });
            }}
          />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--eh-sp-3)",
          }}
        >
          <Field label="Name" hint="Curator-facing display name. Becomes the package name.">
            <input
              type="text"
              className="eh-input"
              value={curator.name}
              placeholder="My Awesome Skyrim Build"
              onChange={(e) => updateCurator({ name: e.target.value })}
            />
          </Field>
          <Field label="Version" hint="Semver: 1.0.0, 0.2.1-beta.1.">
            <input
              type="text"
              className="eh-input"
              value={curator.version}
              placeholder="1.0.0"
              onChange={(e) => updateCurator({ version: e.target.value })}
            />
          </Field>
          <Field label="Author">
            <input
              type="text"
              className="eh-input"
              value={curator.author}
              placeholder="Your Nexus username"
              onChange={(e) => updateCurator({ author: e.target.value })}
            />
          </Field>
        </div>
        <div style={{ marginTop: "var(--eh-sp-3)" }}>
          <Field label="Description (optional)">
            <textarea
              className="eh-input eh-input--textarea"
              rows={3}
              value={curator.description}
              placeholder="What this collection ships, who it's for..."
              onChange={(e) => updateCurator({ description: e.target.value })}
            />
          </Field>
        </div>
        <div
          style={{
            display: "flex",
            gap: "var(--eh-sp-2)",
            marginTop: "var(--eh-sp-3)",
            flexWrap: "wrap",
          }}
        >
          <Pill intent="info">{ctx.gameId}</Pill>
          <Pill intent="neutral">{ctx.mods.length} mods</Pill>
          <Pill intent="neutral">{ctx.externalMods.length} external</Pill>
          {ctx.configCreated ? (
            <Pill intent="warning">first build</Pill>
          ) : (
            <Pill intent="success" withDot>
              config loaded
            </Pill>
          )}
        </div>
      </Card>

      <Card title={`External mods (${ctx.externalMods.length})`}>
        {ctx.externalMods.length === 0 ? (
          <p style={{ margin: 0, color: "var(--eh-text-secondary)" }}>
            No external (non-Nexus) mods in this profile. Nothing to override.
          </p>
        ) : (
          <ExternalModsTable
            mods={ctx.externalMods}
            overrides={overrides}
            onChange={updateOverride}
          />
        )}
      </Card>

      <Card title="README (optional)">
        <textarea
          className="eh-input eh-input--textarea"
          rows={6}
          value={readme}
          placeholder="Markdown shipped inside the .ehcoll. Shown on the install screen."
          onChange={(e) => onChange({ readme: e.target.value })}
        />
      </Card>

      <Card title="CHANGELOG (optional)">
        <textarea
          className="eh-input eh-input--textarea"
          rows={6}
          value={changelog}
          placeholder="Markdown describing what's new in this version."
          onChange={(e) => onChange({ changelog: e.target.value })}
        />
      </Card>

      <IntegrityLevelCard
        level={state.verificationLevel}
        modCount={ctx.mods.length}
        onChange={(verificationLevel): void =>
          onChange({ verificationLevel })
        }
      />

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--eh-sp-2)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {validationError !== undefined && (
          <span
            style={{
              color: "var(--eh-danger)",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            {validationError}
          </span>
        )}
        <Button
          intent="primary"
          size="lg"
          onClick={onBuild}
          disabled={state.ctx.mods.length === 0}
          title={
            state.ctx.mods.length === 0
              ? "Enable at least one mod in your Vortex profile first"
              : undefined
          }
        >
          Build .ehcoll
        </Button>
      </div>
    </div>
  );
}

// ===========================================================================
// Integrity verification level
// ===========================================================================

interface IntegrityLevelCardProps {
  level: VerificationLevel;
  modCount: number;
  onChange: (level: VerificationLevel) => void;
}

/**
 * Curator-facing integrity-verification picker. Every option produces
 * a valid `.ehcoll`; the trade-off is build-time cost vs. how much of
 * Vortex's "lost / corrupted file" failure mode the user-side install
 * can detect.
 *
 * - `"fast"` (default): walks each mod's staging folder, records
 *   `{path, size}` per file. Catches Vortex dropping files entirely
 *   plus any zero-byte / truncated writes. Cheap — no read of file
 *   contents.
 *
 * - `"thorough"`: same plus SHA-256 per file. Catches silent
 *   corruption (wrong content with right size). Reads every byte of
 *   every file in every mod's staging folder; cost scales with mod
 *   size, not count.
 *
 * - `"none"`: skip the check. Useful when build time matters more
 *   than catching post-install integrity bugs (or for re-builds of
 *   the same data where the curator already trusts their machine).
 */
function IntegrityLevelCard(props: IntegrityLevelCardProps): JSX.Element {
  const { level, modCount, onChange } = props;
  return (
    <Card title="Integrity verification">
      <p
        style={{
          margin: 0,
          marginBottom: "var(--eh-sp-3)",
          color: "var(--eh-text-secondary)",
          fontSize: "var(--eh-text-sm)",
        }}
      >
        Captures a per-mod fingerprint of the curator's staging folder
        so users can detect when Vortex drops or corrupts files during
        install.
      </p>
      <div
        role="radiogroup"
        aria-label="Integrity verification level"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--eh-sp-2)",
        }}
      >
        <IntegrityOption
          checked={level === "fast"}
          onChange={(): void => onChange("fast")}
          title="Fast (recommended)"
          subtitle={
            `Records file paths + sizes for all ${modCount} mods. ` +
            "Catches missing or truncated files. Build cost: minimal."
          }
        />
        <IntegrityOption
          checked={level === "thorough"}
          onChange={(): void => onChange("thorough")}
          title="Thorough"
          subtitle={
            "Adds SHA-256 per file. Catches silent corruption. " +
            "Build cost: reads every byte of every mod (slower for large collections)."
          }
        />
        <IntegrityOption
          checked={level === "none"}
          onChange={(): void => onChange("none")}
          title="Skip"
          subtitle={
            "No staging folder inspection. Builds fastest but users " +
            "can't detect post-install file loss / corruption."
          }
        />
      </div>
    </Card>
  );
}

function IntegrityOption(props: {
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle: string;
}): JSX.Element {
  const { checked, onChange, title, subtitle } = props;
  return (
    <label
      style={{
        display: "flex",
        gap: "var(--eh-sp-3)",
        padding: "var(--eh-sp-3)",
        border: `1px solid ${
          checked ? "var(--eh-accent)" : "var(--eh-border)"
        }`,
        borderRadius: "var(--eh-radius-md)",
        background: checked ? "var(--eh-bg-elevated)" : "transparent",
        cursor: "pointer",
        alignItems: "flex-start",
      }}
    >
      <input
        type="radio"
        name="eh-integrity-level"
        checked={checked}
        onChange={onChange}
        style={{ marginTop: 3 }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 600 }}>{title}</span>
        <span
          style={{
            fontSize: "var(--eh-text-sm)",
            color: "var(--eh-text-secondary)",
          }}
        >
          {subtitle}
        </span>
      </div>
    </label>
  );
}

// ===========================================================================
// Import previous .ehcoll
// ===========================================================================

interface ImportPreviousButtonProps {
  onImported: (patch: Partial<CuratorInput>) => void;
}

/** Small ghost button on the metadata card. Lets the curator pick a
 * previously-built `.ehcoll` and prefill name/version/author/description
 * from its manifest. We do not import mod selections or external-mod
 * overrides — those depend on the *current* profile's mods, and a stale
 * import would produce silently-mismatched config. */
function ImportPreviousButton(props: ImportPreviousButtonProps): JSX.Element {
  const reportError = useErrorReporter();
  const showToast = useToast();
  const [busy, setBusy] = React.useState(false);

  const handleClick = React.useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { pickEhcollFile } = await import("../../../utils/utils");
      const file = await pickEhcollFile();
      if (file === undefined) return;

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { readEhcoll } = await import(
        "../../../core/manifest/readEhcoll"
      );
      const result = await readEhcoll(file);
      const pkg = result.manifest.package;

      const patch: Partial<CuratorInput> = {
        name: pkg.name,
        version: pkg.version,
        author: pkg.author,
        description: pkg.description ?? "",
      };
      props.onImported(patch);
      showToast({
        intent: "success",
        title: "Imported metadata",
        message: `Pre-filled from "${pkg.name}" v${pkg.version}.`,
      });
    } catch (err) {
      reportError(err, {
        title: "Couldn't import .ehcoll metadata",
        context: { step: "build-import-existing" },
      });
    } finally {
      setBusy(false);
    }
  }, [props, reportError, showToast]);

  return (
    <Button
      intent="ghost"
      size="sm"
      disabled={busy}
      onClick={(): void => {
        void handleClick();
      }}
      title="Pick a previously-built .ehcoll and copy its name/version/author/description into this form."
    >
      {busy ? "Importing..." : "Import from previous .ehcoll"}
    </Button>
  );
}

// ===========================================================================
// External mods table
// ===========================================================================

interface ExternalModsTableProps {
  mods: BuildContext["externalMods"];
  overrides: Record<string, ExternalModConfigEntry>;
  onChange: (modId: string, patch: Partial<ExternalModConfigEntry>) => void;
}

function ExternalModsTable(props: ExternalModsTableProps): JSX.Element {
  const { mods, overrides, onChange } = props;
  return (
    <div
      style={{
        border: "1px solid var(--eh-border-subtle)",
        borderRadius: "var(--eh-radius-sm)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) auto minmax(0, 3fr)",
          gap: "var(--eh-sp-3)",
          padding: "var(--eh-sp-2) var(--eh-sp-3)",
          background: "var(--eh-bg-base)",
          color: "var(--eh-text-muted)",
          fontSize: "var(--eh-text-xs)",
          textTransform: "uppercase",
          letterSpacing: "var(--eh-tracking-widest)",
        }}
      >
        <span>Mod</span>
        <span>Bundle</span>
        <span>Instructions</span>
      </div>
      {mods.map((mod) => {
        const override = overrides[mod.id] ?? {};
        const hasArchive =
          typeof mod.archiveSha256 === "string" && mod.archiveSha256.length > 0;
        return (
          <div
            key={mod.id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) auto minmax(0, 3fr)",
              gap: "var(--eh-sp-3)",
              padding: "var(--eh-sp-3)",
              borderTop: "1px solid var(--eh-border-subtle)",
              alignItems: "start",
            }}
          >
            <div>
              <div
                style={{
                  color: "var(--eh-text-primary)",
                  fontWeight: 600,
                  wordBreak: "break-word",
                }}
              >
                {mod.name}
              </div>
              <div
                style={{
                  color: "var(--eh-text-muted)",
                  fontSize: "var(--eh-text-xs)",
                  fontFamily: "var(--eh-font-mono)",
                  marginTop: 2,
                  wordBreak: "break-all",
                }}
              >
                {mod.id}
              </div>
              {!hasArchive && (
                <div style={{ marginTop: 4 }}>
                  <Pill intent="warning">no archive</Pill>
                </div>
              )}
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--eh-sp-2)",
                cursor: hasArchive ? "pointer" : "not-allowed",
                opacity: hasArchive ? 1 : 0.5,
                color: "var(--eh-text-secondary)",
                fontSize: "var(--eh-text-sm)",
              }}
            >
              <input
                type="checkbox"
                disabled={!hasArchive}
                checked={override.bundled === true}
                onChange={(e) =>
                  onChange(mod.id, { bundled: e.target.checked })
                }
              />
              {override.bundled === true ? "Bundled" : "Manual"}
            </label>
            <textarea
              className="eh-input eh-input--textarea"
              rows={2}
              placeholder="Optional instructions shown when the user installs."
              value={override.instructions ?? ""}
              onChange={(e) =>
                onChange(mod.id, { instructions: e.target.value })
              }
            />
          </div>
        );
      })}
    </div>
  );
}

// ===========================================================================
// Building
// ===========================================================================

function BuildingPanel(props: {
  progress: BuildProgress;
  curator: CuratorInput;
  onCancel?: () => void;
}): JSX.Element {
  // The packaging phase runs through the ZIP writer which doesn't
  // support cancellation cleanly, so we only show the Cancel button
  // in early phases. Beyond `packaging` we hide it to avoid implying
  // we can rip a half-written file out from under the user.
  const cancellable =
    props.progress.phase !== "packaging" &&
    props.progress.phase !== "resolving-bundled-archives";

  return (
    <Card>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--eh-sp-4)",
          padding: "var(--eh-sp-5)",
        }}
      >
        <ProgressRing size={84} />
        <h3
          style={{
            margin: 0,
            color: "var(--eh-text-primary)",
            textAlign: "center",
          }}
        >
          Building {props.curator.name} v{props.curator.version}
        </h3>
        <p
          style={{
            margin: 0,
            color: "var(--eh-text-secondary)",
            fontSize: "var(--eh-text-sm)",
            textAlign: "center",
          }}
        >
          {props.progress.message ?? phaseToLabel(props.progress.phase)}
        </p>
        {props.onCancel !== undefined && cancellable && (
          <Button intent="ghost" size="sm" onClick={props.onCancel}>
            Cancel
          </Button>
        )}
        {props.onCancel !== undefined && !cancellable && (
          <p
            style={{
              margin: 0,
              color: "var(--eh-text-muted)",
              fontSize: "var(--eh-text-xs)",
            }}
          >
            Finishing up — please don't close Vortex.
          </p>
        )}
      </div>
    </Card>
  );
}

// ===========================================================================
// Done
// ===========================================================================

function DonePanel(props: {
  result: BuildPipelineResult;
  onBuildAnother: () => void;
  onGoHome: () => void;
}): JSX.Element {
  const { result } = props;
  const showToast = useToast();

  const handleCopyPath = React.useCallback((): void => {
    void writeToClipboard(result.outputPath).then((ok) => {
      showToast({
        intent: ok ? "success" : "warning",
        title: ok ? "Path copied" : "Couldn't copy path",
        message: ok ? result.outputPath : "Clipboard isn't available right now.",
        ttl: 3500,
      });
    });
  }, [result.outputPath, showToast]);

  return (
    <Card title="Build complete">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--eh-sp-4)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--eh-sp-3)",
          }}
        >
          <Stat label="Output size" value={formatBytes(result.outputBytes)} />
          <Stat label="Mods" value={String(result.modCount)} />
          <Stat label="Bundled archives" value={String(result.bundledCount)} />
          <Stat label="Warnings" value={String(result.warnings.length)} />
        </div>
        <BuildRulesScopeSummary result={result} />
        <div
          style={{
            padding: "var(--eh-sp-3)",
            background: "var(--eh-bg-base)",
            border: "1px solid var(--eh-border-subtle)",
            borderRadius: "var(--eh-radius-sm)",
            fontFamily: "var(--eh-font-mono)",
            color: "var(--eh-text-secondary)",
            fontSize: "var(--eh-text-xs)",
            wordBreak: "break-all",
          }}
        >
          {result.outputPath}
        </div>
        <DistributionHint />
        {result.warnings.length > 0 && (
          <details
            style={{
              padding: "var(--eh-sp-3)",
              background: "rgba(255, 198, 99, 0.06)",
              border: "1px solid var(--eh-warning)",
              borderRadius: "var(--eh-radius-sm)",
              color: "var(--eh-warning)",
            }}
          >
            <summary style={{ cursor: "pointer" }}>
              {result.warnings.length} warning{result.warnings.length === 1 ? "" : "s"}
            </summary>
            <ul
              style={{
                margin: "var(--eh-sp-2) 0 0 0",
                paddingLeft: "var(--eh-sp-5)",
                color: "var(--eh-text-secondary)",
                fontSize: "var(--eh-text-sm)",
              }}
            >
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        )}
        <div
          style={{
            display: "flex",
            gap: "var(--eh-sp-2)",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <Button intent="ghost" onClick={handleCopyPath}>
            Copy path
          </Button>
          <Button
            intent="ghost"
            onClick={(): void => {
              void openShellPath(result.outputPath);
            }}
          >
            Open file
          </Button>
          <Button
            intent="ghost"
            onClick={(): void => {
              const dir = result.outputPath.replace(/[\\/][^\\/]+$/, "");
              void openShellPath(dir);
            }}
          >
            Open folder
          </Button>
          <Button intent="ghost" onClick={props.onBuildAnother}>
            Build another
          </Button>
          <Button intent="primary" onClick={props.onGoHome}>
            Done
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ===========================================================================
// Error
// ===========================================================================

function ErrorPanel(props: { onRetry: () => void }): JSX.Element {
  return (
    <Card>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--eh-sp-3)",
          padding: "var(--eh-sp-3)",
        }}
      >
        <h3 style={{ margin: 0, color: "var(--eh-danger)" }}>
          Something went wrong
        </h3>
        <p
          style={{
            margin: 0,
            color: "var(--eh-text-secondary)",
            fontSize: "var(--eh-text-sm)",
          }}
        >
          A detailed error report should already be open. Once you're done
          reading it you can retry — Event Horizon will reload your active
          profile.
        </p>
        <div>
          <Button intent="primary" onClick={props.onRetry}>
            Retry
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function Field(props: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--eh-sp-1)",
      }}
    >
      <span
        style={{
          color: "var(--eh-text-secondary)",
          fontSize: "var(--eh-text-xs)",
          textTransform: "uppercase",
          letterSpacing: "var(--eh-tracking-widest)",
        }}
      >
        {props.label}
      </span>
      {props.children}
      {props.hint !== undefined && (
        <span
          style={{
            color: "var(--eh-text-muted)",
            fontSize: "var(--eh-text-xs)",
          }}
        >
          {props.hint}
        </span>
      )}
    </label>
  );
}

function Stat(props: { label: string; value: string }): JSX.Element {
  return (
    <div
      style={{
        padding: "var(--eh-sp-3)",
        background: "var(--eh-bg-base)",
        border: "1px solid var(--eh-border-subtle)",
        borderRadius: "var(--eh-radius-sm)",
      }}
    >
      <div
        style={{
          color: "var(--eh-text-muted)",
          fontSize: "var(--eh-text-xs)",
          textTransform: "uppercase",
          letterSpacing: "var(--eh-tracking-widest)",
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          marginTop: "var(--eh-sp-1)",
          color: "var(--eh-text-primary)",
          fontWeight: 600,
        }}
      >
        {props.value}
      </div>
    </div>
  );
}

/**
 * Curator-side mirror of the install Done card's "Rules & ordering"
 * section. Reads the rule/loadOrder/userlist counts from the build
 * pipeline result so the curator gets immediate feedback that the
 * curator's mod rules + LOOT plugin rules + load order baselines
 * landed in the package — without this, the only way to know was
 * to install the .ehcoll on a fresh Vortex.
 *
 * Hidden when the curator authored none of these. A collection
 * with zero rules / zero load order / zero plugins (e.g. a tiny
 * texture pack) shouldn't get a noisy empty section.
 */
function BuildRulesScopeSummary(props: {
  result: BuildPipelineResult;
}): JSX.Element | null {
  const { result } = props;
  const total =
    result.ruleCount +
    result.loadOrderCount +
    result.pluginOrderCount +
    result.userlistPluginCount +
    result.userlistGroupCount +
    result.stagingFileCount;
  if (total === 0) return null;

  const integrityLabel =
    result.verificationLevel === "thorough"
      ? "thorough (sha256)"
      : result.verificationLevel === "fast"
        ? "fast (size only)"
        : "skipped";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--eh-sp-2)",
      }}
    >
      <div
        style={{
          color: "var(--eh-text-muted)",
          fontSize: "var(--eh-text-xs)",
          textTransform: "uppercase",
          letterSpacing: "var(--eh-tracking-widest)",
        }}
      >
        Captured into the package
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--eh-sp-2)",
        }}
      >
        {result.ruleCount > 0 && (
          <Stat label="Mod rules" value={String(result.ruleCount)} />
        )}
        {result.loadOrderCount > 0 && (
          <Stat
            label="Load order entries"
            value={String(result.loadOrderCount)}
          />
        )}
        {result.pluginOrderCount > 0 && (
          <Stat label="Plugins" value={String(result.pluginOrderCount)} />
        )}
        {result.userlistPluginCount > 0 && (
          <Stat
            label="LOOT plugin rules"
            value={String(result.userlistPluginCount)}
          />
        )}
        {result.userlistGroupCount > 0 && (
          <Stat
            label="LOOT groups"
            value={String(result.userlistGroupCount)}
          />
        )}
        {result.stagingFileCount > 0 && (
          <Stat
            label={`Integrity (${integrityLabel})`}
            value={`${result.stagingFileCount.toLocaleString()} files`}
          />
        )}
      </div>
    </div>
  );
}

async function openShellPath(p: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require("electron") as {
      shell?: { openPath?: (p: string) => Promise<string> };
    };
    if (electron.shell?.openPath) {
      await electron.shell.openPath(p);
    }
  } catch {
    // Best-effort; swallow if Electron isn't available.
  }
}

/**
 * Best-effort clipboard write. Tries the navigator API first (works
 * inside Electron's renderer when the page is HTTPS-equivalent), then
 * falls back to electron.clipboard. Returns false if both fail.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard !== undefined &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to electron clipboard */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require("electron") as {
      clipboard?: { writeText?: (s: string) => void };
    };
    if (electron.clipboard?.writeText) {
      electron.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* swallow */
  }
  return false;
}

/**
 * Tiny hint card that bridges "build finished" → "now what?". Until
 * we ship a one-click publish flow (see docs/RESEARCH_PUBLISHING.md),
 * curators distribute their `.ehcoll` by uploading it as a regular
 * Nexus mod attachment. Saying it explicitly here saves "where do I
 * upload this?" support requests.
 */
function DistributionHint(): JSX.Element {
  return (
    <div
      style={{
        padding: "var(--eh-sp-3) var(--eh-sp-4)",
        background:
          "color-mix(in srgb, var(--eh-accent) 8%, transparent)",
        border:
          "1px solid color-mix(in srgb, var(--eh-accent) 30%, transparent)",
        borderRadius: "var(--eh-radius-sm)",
        fontSize: "var(--eh-text-sm)",
        lineHeight: "var(--eh-leading-relaxed)",
        color: "var(--eh-text-secondary)",
      }}
    >
      <strong style={{ color: "var(--eh-text-primary)" }}>Next: share it.</strong>{" "}
      Upload this <code>.ehcoll</code> as a regular Nexus mod
      attachment under your collection&apos;s mod page — testers install it via
      Event Horizon&apos;s install tab. A one-click publish flow is
      tracked in <code>docs/RESEARCH_PUBLISHING.md</code>.
    </div>
  );
}

function phaseToLabel(phase: BuildProgress["phase"] | undefined): string | undefined {
  switch (phase) {
    case "hashing-mods":
      return "Hashing mod archives...";
    case "inspecting-mods":
      return "Inspecting mod folders for integrity capture...";
    case "capturing-deployment":
      return "Capturing deployment manifests...";
    case "capturing-load-order":
      return "Capturing load order...";
    case "capturing-userlist":
      return "Capturing LOOT userlist...";
    case "reading-plugins-txt":
      return "Reading plugins.txt...";
    case "writing-config":
      return "Saving collection config...";
    case "building-manifest":
      return "Building manifest...";
    case "resolving-bundled-archives":
      return "Resolving bundled archives...";
    case "packaging":
      return "Packaging .ehcoll...";
    default:
      return undefined;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ===========================================================================
// Draft-restored banner
// ===========================================================================

/**
 * Surfaces "we just rehydrated your in-flight build form" to the curator
 * the very first time they open the page after a reboot/remount/crash.
 *
 * Two affordances:
 *   • "Discard draft" — nukes the on-disk draft file and resets every
 *     editable field to the config defaults. Confirms via toast.
 *   • Close (×)        — hides the banner only. The restored values
 *     stay, and autosave keeps writing as the curator edits.
 *
 * The relative time is recomputed every 30s while mounted so a long
 * editing session shows accurate "Restored 12 minutes ago" → "13" etc.
 */
function DraftRestoredBanner(props: {
  savedAt: string;
  onDiscard: () => void;
  onDismiss: () => void;
}): JSX.Element {
  const [, forceTick] = React.useState(0);
  React.useEffect(() => {
    const handle = setInterval(() => {
      forceTick((t) => t + 1);
    }, 30_000);
    return () => clearInterval(handle);
  }, []);

  const relative = formatRelativeTime(props.savedAt);
  const absolute = (() => {
    try {
      return new Date(props.savedAt).toLocaleString();
    } catch {
      return props.savedAt;
    }
  })();

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--eh-sp-3)",
        padding: "var(--eh-sp-3) var(--eh-sp-4)",
        border: "1px solid var(--eh-cyan)",
        background: "rgba(118, 228, 247, 0.08)",
        borderRadius: "var(--eh-radius-md)",
        color: "var(--eh-text-primary)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: "var(--eh-cyan)",
          boxShadow: "0 0 8px var(--eh-cyan)",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>Draft restored</div>
        <div
          style={{
            color: "var(--eh-text-secondary)",
            fontSize: "var(--eh-text-sm)",
          }}
          title={absolute}
        >
          Picked up where you left off — autosaved {relative}.
        </div>
      </div>
      <Button intent="ghost" size="sm" onClick={props.onDiscard}>
        Discard draft
      </Button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={props.onDismiss}
        style={{
          background: "transparent",
          border: 0,
          color: "var(--eh-text-muted)",
          cursor: "pointer",
          fontSize: "var(--eh-text-lg)",
          padding: "0 var(--eh-sp-1)",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Relative-time formatter tuned for "just now → minutes ago →
 * hours ago → days ago". Falls back to the raw ISO string on parse
 * failure so we never show "NaN ago" garbage in the banner.
 */
function formatRelativeTime(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return `at ${iso}`;
  const deltaMs = Date.now() - parsed;
  if (deltaMs < 30_000) return "just now";
  if (deltaMs < 60_000) return `${Math.round(deltaMs / 1000)}s ago`;
  if (deltaMs < 60 * 60_000) {
    const m = Math.round(deltaMs / 60_000);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (deltaMs < 24 * 60 * 60_000) {
    const h = Math.round(deltaMs / (60 * 60_000));
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.round(deltaMs / (24 * 60 * 60_000));
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
