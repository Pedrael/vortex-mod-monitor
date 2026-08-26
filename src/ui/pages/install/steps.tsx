/**
 * Step components for the install wizard. Each step is a pure
 * presentational React component — it receives state slice + a
 * dispatch and renders accordingly. All async work is owned by the
 * InstallPage orchestrator.
 *
 * Steps in document order:
 *
 *   1. PickStep            — large drop / pick CTA
 *   2. LoadingStep         — phase-aware skeleton with progress ring
 *   3. StaleReceiptStep    — three-button resolution prompt
 *   4. PreviewStep         — plan summary + verdict + Install button
 *   5. DecisionsStep       — per-conflict + per-orphan picker grid
 *   6. ConfirmStep         — final review before driver runs
 *   7. InstallingStep      — live phase + per-step progress
 *   8. DoneStep            — success / aborted / failed report
 *
 * Each step renders itself inside an `eh-page` wrapper so the
 * entrance animation plays on every step transition.
 */

import * as React from "react";
import { util } from "@nexusmods/vortex-api";

import {
  Button,
  Card,
  EventHorizonLogo,
  HashingCard,
  Pill,
  ProgressRing,
  StepDots,
} from "../../components";
import { useApi, useApiOptional } from "../../state";
import { useToast } from "../../components";
import { useKeyboardShortcut } from "../../hooks/useKeyboardShortcut";
import { formatBytes } from "../../../utils/diskSpace";
import { openExternalUrl } from "../build/revealPath";
import { describeDownload } from "./downloadGuidance";
import {
  describeElapsed,
  describeQuiet,
  estimateRemainingMs,
  formatDuration,
  trackPhase,
} from "./installProgress";
import type { PhaseTiming } from "./installProgress";
import {
  countNexusDownloads,
  describeNexusAccount,
  readNexusAccount,
} from "../../../core/installer/checkNexusAccount";
import type { NexusAccount } from "../../../core/installer/checkNexusAccount";
import {
  ConflictChoice,
  DriverProgress,
  InstallResult,
  OrphanChoice,
} from "../../../types/installDriver";
import {
  InstallPlan,
  ModResolution,
  OrphanedModDecision,
} from "../../../types/installPlan";
import { deleteReceipt } from "../../../core/installLedger";
import { pickModArchiveFile } from "../../../utils/utils";
import { useErrorReporter } from "../../errors";
import { getVortexUserDataPath } from "../../../core/paths";
import {
  LoadingPhase,
  PreviewBundle,
  WizardAction,
  WizardState,
  buildUserConfirmedDecisions,
  canProceedFromDecisions,
  countUndecidedConflicts,
  defaultConflictChoice,
  defaultOrphanChoice,
  fillDefaultConflictChoices,
  fillDefaultOrphanChoices,
  selectConflictResolutions,
} from "./state";

// ===========================================================================
// Common building blocks
// ===========================================================================

/**
 * The wizard step indicator we show at the top of every step (except
 * the very first pick screen). 7 dots = 6 transitions; the active one
 * expands into a pill with the current step's label.
 */
const STEP_LABELS: Array<{ kind: WizardState["kind"]; label: string }> = [
  { kind: "pick", label: "Pick" },
  { kind: "loading", label: "Loading" },
  { kind: "preview", label: "Preview" },
  { kind: "decisions", label: "Decisions" },
  { kind: "confirm", label: "Confirm" },
  { kind: "installing", label: "Install" },
  { kind: "done", label: "Done" },
];

function Stepper(props: { current: WizardState["kind"] }): JSX.Element {
  const visibleStates: Array<WizardState["kind"]> = [
    "pick",
    "loading",
    "preview",
    "decisions",
    "confirm",
    "installing",
    "done",
  ];
  const idx = visibleStates.indexOf(props.current);
  // map stale-receipt and error to the closest visible step
  const safeIdx =
    idx >= 0
      ? idx
      : props.current === "stale-receipt"
        ? 1
        : 0;
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--eh-sp-2)",
        alignItems: "center",
        marginBottom: "var(--eh-sp-5)",
      }}
    >
      <StepDots total={visibleStates.length} current={safeIdx} />
      <span
        className="eh-label"
      >
        Step {safeIdx + 1} / {visibleStates.length}
        {STEP_LABELS[safeIdx]?.label
          ? ` · ${STEP_LABELS[safeIdx]?.label}`
          : ""}
      </span>
    </div>
  );
}

function StepFrame(props: {
  current: WizardState["kind"];
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  showStepper?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="eh-page" key={props.current}>
      {props.showStepper !== false && <Stepper current={props.current} />}
      <header
        style={{
          marginBottom: "var(--eh-sp-5)",
          animation:
            "eh-fade-up var(--eh-dur-slow) var(--eh-easing) both",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "var(--eh-text-primary)",
            fontSize: "var(--eh-text-2xl)",
            letterSpacing: "var(--eh-tracking-tight)",
          }}
        >
          {props.title}
        </h2>
        {props.subtitle !== undefined && (
          <p
            style={{
              margin: "var(--eh-sp-2) 0 0 0",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-md)",
              lineHeight: "var(--eh-leading-relaxed)",
              maxWidth: "640px",
            }}
          >
            {props.subtitle}
          </p>
        )}
      </header>
      {props.children}
    </div>
  );
}

// ===========================================================================
// 1. PickStep
// ===========================================================================

export interface PickStepProps {
  onPick: (zipPath: string) => void;
}

export function PickStep(props: PickStepProps): JSX.Element {
  const reportError = useErrorReporter();
  const showToast = useToast();
  const [isDragging, setDragging] = React.useState(false);
  // Track nested dragenter/dragleave: child elements fire leave when
  // we cross internal boundaries, which would clear the highlight
  // even though the cursor is still over the drop zone.
  const dragDepthRef = React.useRef(0);

  const handlePick = React.useCallback(async (): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { pickEhcollFile } = await import("../../../utils/utils");
      const file = await pickEhcollFile();
      if (file !== undefined) {
        props.onPick(file);
      }
    } catch (err) {
      reportError(err, {
        title: "Couldn't open file picker",
        context: { step: "pick" },
      });
    }
  }, [props, reportError]);

  const handleDragEnter = React.useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (dragDepthRef.current === 1) setDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragging(false);
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setDragging(false);

      const files = e.dataTransfer.files;
      if (files.length === 0) return;
      if (files.length > 1) {
        showToast({
          intent: "warning",
          message: "Drop only one .ehcoll file at a time.",
        });
        return;
      }
      // Electron exposes the absolute path on File. In a normal
      // browser this is empty for security; we tell the user to
      // browse instead.
      const dropped = files[0] as File & { path?: string };
      const filePath = dropped.path ?? "";
      if (filePath.length === 0) {
        showToast({
          intent: "warning",
          message:
            "Couldn't read the dropped file path. Use the Browse button instead.",
        });
        return;
      }
      if (!filePath.toLowerCase().endsWith(".ehcoll")) {
        showToast({
          intent: "warning",
          message: "That's not a .ehcoll file. Drop an Event Horizon collection.",
        });
        return;
      }
      props.onPick(filePath);
    },
    [props, showToast],
  );

  return (
    <StepFrame
      current="pick"
      showStepper={false}
      title="Install a collection"
      subtitle="Pick a .ehcoll archive and Event Horizon walks you through every mod, conflict, and decision before touching your profile."
    >
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--eh-sp-5)",
          padding: "var(--eh-sp-7) var(--eh-sp-5)",
          background: isDragging
            ? "var(--eh-accent-soft, var(--eh-bg-elevated))"
            : "var(--eh-bg-glass)",
          border: isDragging
            ? "2px dashed var(--eh-accent)"
            : "1px dashed var(--eh-border-default)",
          borderRadius: "var(--eh-radius-lg)",
          textAlign: "center",
          transition: "background var(--eh-dur-fast) var(--eh-easing), border-color var(--eh-dur-fast) var(--eh-easing)",
          animation:
            "eh-fade-up var(--eh-dur-deliberate) var(--eh-easing) both",
        }}
      >
        <EventHorizonLogo size={120} />
        <div>
          <h3
            style={{
              margin: 0,
              color: "var(--eh-text-primary)",
              fontSize: "var(--eh-text-xl)",
            }}
          >
            Drop a .ehcoll file or click to browse
          </h3>
          <p
            style={{
              margin: "var(--eh-sp-2) 0 0 0",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-sm)",
              maxWidth: "440px",
            }}
          >
            Event Horizon never modifies your current profile until you click Install on the final review screen.
          </p>
        </div>
        <Button
          intent="primary"
          size="lg"
          onClick={(): void => {
            void handlePick();
          }}
        >
          Choose .ehcoll file...
        </Button>
      </div>
    </StepFrame>
  );
}

// ===========================================================================
// 2. LoadingStep
// ===========================================================================

const LOADING_PHASE_LABELS: Record<LoadingPhase, string> = {
  "reading-package": "Reading the .ehcoll archive",
  "reading-receipt": "Looking up previous installs",
  "checking-game": "Checking the active game profile",
  "hashing-mods": "Hashing your installed mods",
  "hashing-staging": "Verifying installed mod contents",
  "resolving-plan": "Resolving the install plan",
};

export function LoadingStep(props: {
  phase: LoadingPhase;
  hashCount?: number;
  hashDone?: number;
  hashCurrent?: string;
  onCancel?: () => void;
}): JSX.Element {
  const phaseIdx =
    Object.keys(LOADING_PHASE_LABELS).indexOf(props.phase);
  const totalPhases = Object.keys(LOADING_PHASE_LABELS).length;
  const ratio = totalPhases > 0 ? (phaseIdx + 1) / totalPhases : 0;

  // Specialised UI for the hashing pass: live counter + scanner +
  // cancel button. Hashing is read-only so cancellation is always
  // safe — see `core/archiveHashing.ts`.
  const isHashing =
    props.phase === "hashing-mods" || props.phase === "hashing-staging";
  const total = props.hashCount ?? 0;

  return (
    <StepFrame
      current="loading"
      title="Working on it..."
      subtitle="Event Horizon needs to inspect the archive, your installed mods, and any previous install of this collection before it can show you a plan."
    >
      {isHashing && total > 0 ? (
        <HashingCard
          title="Hashing your installed mods"
          subtitle="Computing SHA-256 of every archive — this is read-only and safe to cancel."
          done={props.hashDone ?? 0}
          total={total}
          currentItem={props.hashCurrent}
          onCancel={props.onCancel}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--eh-sp-5)",
            padding: "var(--eh-sp-6)",
            background: "var(--eh-bg-raised)",
            border: "1px solid var(--eh-border-default)",
            borderRadius: "var(--eh-radius-lg)",
          }}
        >
          <ProgressRing value={ratio} size={88} />
          <div className="eh-fill">
            <strong
              style={{
                color: "var(--eh-text-primary)",
                fontSize: "var(--eh-text-lg)",
              }}
            >
              {LOADING_PHASE_LABELS[props.phase]}
            </strong>
            <p
              style={{
                margin: "var(--eh-sp-1) 0 0 0",
                color: "var(--eh-text-secondary)",
                fontSize: "var(--eh-text-sm)",
              }}
            >
              Hold tight — this can take a moment for large mod lists.
            </p>
          </div>
          {props.onCancel !== undefined && (
            <Button intent="ghost" size="sm" onClick={props.onCancel}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </StepFrame>
  );
}

// ===========================================================================
// 3. StaleReceiptStep
// ===========================================================================

export interface StaleReceiptStepProps {
  state: Extract<WizardState, { kind: "stale-receipt" }>;
  onResolved: (
    resolution: "delete" | "keep" | "cancel",
  ) => void;
}

export function StaleReceiptStep(
  props: StaleReceiptStepProps,
): JSX.Element {
  const { state, onResolved } = props;
  const api = useApi();
  const reportError = useErrorReporter();
  const [busy, setBusy] = React.useState(false);

  // Esc → "Go back" (least destructive). We deliberately do NOT bind
  // Enter here: there are three roughly-equivalent choices and silent
  // confirmation of any one of them could wipe the receipt by accident.
  useKeyboardShortcut("Escape", () => {
    if (!busy) onResolved("cancel");
  });

  const handleDelete = async (): Promise<void> => {
    setBusy(true);
    try {
      const appData = getVortexUserDataPath();
      await deleteReceipt(appData, state.receipt.packageId);
      onResolved("delete");
    } catch (err) {
      reportError(err, {
        title: "Couldn't delete the stale receipt",
        context: {
          step: "stale-receipt",
          packageId: state.receipt.packageId,
        },
      });
      onResolved("cancel");
    } finally {
      setBusy(false);
    }
  };

  void api;

  return (
    <StepFrame
      current="stale-receipt"
      title="This collection was installed here before"
      subtitle="Event Horizon kept a record of the last install, but the Vortex profile it pointed to is gone. Pick how to handle it before continuing."
    >
      <Card
        title={`${state.receipt.packageName} v${state.receipt.packageVersion}`}
        footer={`Receipt last updated ${formatTime(state.receipt.installedAt)}`}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--eh-sp-3)",
            color: "var(--eh-text-secondary)",
            fontSize: "var(--eh-text-sm)",
          }}
        >
          <div>
            <strong>Was installed into:</strong>{" "}
            {state.receipt.vortexProfileName}{" "}
            <span className="eh-muted">
              (deleted — id {state.receipt.vortexProfileId})
            </span>
          </div>
          <div>
            <strong>Mods recorded in receipt:</strong>{" "}
            {state.receipt.mods.length}
          </div>

          <details
            style={{
              padding: "var(--eh-sp-2) var(--eh-sp-3)",
              background: "var(--eh-bg-elevated)",
              border: "1px solid var(--eh-border-default)",
              borderRadius: "var(--eh-radius-sm)",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                color: "var(--eh-text-primary)",
                fontWeight: 600,
              }}
            >
              What is a stale receipt?
            </summary>
            <p
              style={{
                margin: "var(--eh-sp-2) 0 0 0",
                lineHeight: "var(--eh-leading-relaxed)",
              }}
            >
              When a collection is installed, Event Horizon writes a small
              JSON file remembering which mods went where, so a re-install
              can skip them. If the Vortex profile is later deleted (or
              you moved your config), that receipt is left dangling and
              points nowhere.
            </p>
          </details>

          <div
            style={{
              padding: "var(--eh-sp-3)",
              background: "var(--eh-bg-elevated)",
              border: "1px solid var(--eh-border-default)",
              borderRadius: "var(--eh-radius-sm)",
              color: "var(--eh-text-primary)",
              fontSize: "var(--eh-text-sm)",
              lineHeight: "var(--eh-leading-relaxed)",
            }}
          >
            <strong>Recommended:</strong>{" "}
            <em>Start fresh</em> — Event Horizon deletes the dead receipt
            and treats this like a brand-new install (a new profile, full
            install plan, full safety guarantees).
          </div>
        </div>
        <div
          style={{
            marginTop: "var(--eh-sp-4)",
            display: "flex",
            gap: "var(--eh-sp-2)",
            flexWrap: "wrap",
          }}
        >
          <Button
            intent="primary"
            disabled={busy}
            onClick={(): void => {
              void handleDelete();
            }}
            title="Delete the dead receipt and install into a new profile (recommended)"
          >
            Start fresh
          </Button>
          <Button
            intent="ghost"
            disabled={busy}
            onClick={(): void => onResolved("keep")}
            title="Keep the receipt as-is and try to install into your currently-active Vortex profile"
          >
            Install into current profile
          </Button>
          <Button
            intent="ghost"
            disabled={busy}
            onClick={(): void => onResolved("cancel")}
            title="Go back and pick a different file"
          >
            Go back
          </Button>
        </div>
      </Card>
    </StepFrame>
  );
}

// ===========================================================================
// 4. PreviewStep
// ===========================================================================

export interface PreviewStepProps {
  bundle: PreviewBundle;
  onContinue: () => void;
  onCancel: () => void;
}

/** Both summary groups lay out the same way; declared once so they cannot drift. */
const SUMMARY_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "var(--eh-sp-3)",
};

export function PreviewStep(props: PreviewStepProps): JSX.Element {
  const { bundle, onContinue, onCancel } = props;
  const { plan } = bundle;
  const target = plan.installTarget;
  const summary = plan.summary;

  // Whether this account can actually download what the plan needs. Read
  // here rather than in the resolver because it is a property of the person
  // installing, not of the collection: the same plan is fine for one account
  // and hundreds of manual clicks for another.
  //
  // Outside a Vortex tree there is no api and therefore no answer, which is
  // the same "unknown" the reader gets from an unfamiliar state shape, and
  // warns about nothing either way.
  const api = useApiOptional();
  const account: NexusAccount = React.useMemo(
    () =>
      api === undefined
        ? { kind: "unknown", why: "not running inside Vortex" }
        : readNexusAccount(api),
    [api],
  );
  const accountLines = React.useMemo(
    () => describeNexusAccount(account, countNexusDownloads(plan)),
    [account, plan],
  );

  const verdict = computeVerdict(plan, accountLines);

  // Enter = continue to decisions/review. Esc = bail. Off when focus
  // is inside an input (there are no inputs on this screen yet, but
  // the hook's guard makes that future-proof).
  useKeyboardShortcut("Enter", onContinue);
  useKeyboardShortcut("Escape", onCancel);

  return (
    <StepFrame
      current="preview"
      title={`${plan.manifest.package.name} v${plan.manifest.package.version}`}
      subtitle={
        plan.manifest.package.description ??
        "Review the plan Event Horizon would execute. Nothing has been changed yet."
      }
    >
      {/* The verdict LEADS.
          It used to sit at the bottom, under six numbers and two cards: a
          reader had to scroll past everything to learn whether this could be
          installed at all. That is the one question this screen exists to
          answer, so it goes first, and the colour carries it before the words
          are read. "Verdict" as a card title said nothing the headline does
          not say better. */}
      <div
        role="status"
        style={{
          display: "flex",
          gap: "var(--eh-sp-3)",
          alignItems: "flex-start",
          padding: "var(--eh-sp-4)",
          marginBottom: "var(--eh-sp-5)",
          borderLeft: `3px solid ${verdict.color}`,
          borderRadius: "var(--eh-radius-sm)",
          background: "var(--eh-bg-raised)",
        }}
      >
        <div className="eh-stack eh-stack--sm eh-fill">
          <strong style={{ color: verdict.color, fontSize: "var(--eh-text-md)" }}>
            {verdict.headline}
          </strong>
          {verdict.lines.length > 0 ? (
            <ul className="eh-list">
              {verdict.lines.map((line, idx) => (
                <li key={idx} className="eh-secondary">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          <span className="eh-note">
            Checked against your active game install. Nothing has been changed yet.
          </span>
        </div>
      </div>

      {/* Two groups, not six equal numbers.
          The first three describe what happens if you do nothing but press
          continue; the last three are the ones that will ask something of you
          or cannot be done at all. Undifferentiated, a reader gets six figures
          and no sense of which need them — and the zeroes are worth keeping,
          because "Missing: 0" says the check ran. */}
      <div className="eh-stack eh-stack--lg" style={{ marginBottom: "var(--eh-sp-5)" }}>
        <section className="eh-stack eh-stack--sm">
          <h3 className="eh-label" style={{ margin: 0 }}>
            What this collection is
          </h3>
          <div style={SUMMARY_GRID}>
            <SummaryTile label="Total mods" value={summary.totalMods} />
            <SummaryTile
              label="Already installed"
              value={summary.alreadyInstalled}
            />
            <SummaryTile
              label="Will install silently"
              value={summary.willInstallSilently}
            />
          </div>
        </section>

        <section className="eh-stack eh-stack--sm">
          <h3 className="eh-label" style={{ margin: 0 }}>
            What needs you
          </h3>
          <div style={SUMMARY_GRID}>
            <SummaryTile
              label="Need confirmation"
              value={summary.needsUserConfirmation}
              accent={summary.needsUserConfirmation > 0 ? "warning" : "default"}
            />
            <SummaryTile
              label="Missing"
              value={summary.missing}
              accent={summary.missing > 0 ? "danger" : "default"}
            />
            <SummaryTile
              label="Orphans"
              value={summary.orphans}
              accent={summary.orphans > 0 ? "warning" : "default"}
            />
          </div>
        </section>
      </div>

      <RulesScopePreview summary={summary} />

      <Card title="Install target" footer={null}>
        {target.kind === "fresh-profile" ? (
          <div>
            <Pill intent="info" withDot>
              Fresh profile
            </Pill>
            <p
              style={{
                margin: "var(--eh-sp-3) 0 0 0",
                color: "var(--eh-text-secondary)",
                fontSize: "var(--eh-text-sm)",
                lineHeight: "var(--eh-leading-relaxed)",
              }}
            >
              A new Vortex profile (suggested name{" "}
              <strong className="eh-strong">
                {target.suggestedProfileName}
              </strong>
              ) will be created. Your current profile is not modified — you
              can switch back at any time from Vortex's profile selector.
            </p>
          </div>
        ) : (
          <div>
            <Pill intent="warning" withDot>
              Current profile
            </Pill>
            <p
              style={{
                margin: "var(--eh-sp-3) 0 0 0",
                color: "var(--eh-text-secondary)",
                fontSize: "var(--eh-text-sm)",
                lineHeight: "var(--eh-leading-relaxed)",
              }}
            >
              The collection will install on top of{" "}
              <strong className="eh-strong">
                {target.profileName}
              </strong>
              . Conflicts and orphans you choose to apply WILL modify your
              setup. You'll see a final summary before any changes are made.
            </p>
          </div>
        )}
      </Card>


      <div
        className="eh-actions"
      >
        <Button intent="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          intent="primary"
          onClick={onContinue}
          disabled={!verdict.canProceed}
        >
          Continue →
        </Button>
      </div>
    </StepFrame>
  );
}

function SummaryTile(props: {
  label: string;
  value: number;
  accent?: "default" | "warning" | "danger";
}): JSX.Element {
  const accentColor =
    props.accent === "warning"
      ? "var(--eh-warning)"
      : props.accent === "danger"
        ? "var(--eh-danger)"
        : "var(--eh-cyan)";
  return (
    <div
      style={{
        padding: "var(--eh-sp-4)",
        background: "var(--eh-bg-raised)",
        border: "1px solid var(--eh-border-subtle)",
        borderRadius: "var(--eh-radius-md)",
      }}
    >
      <div className="eh-label" style={{ marginBottom: "var(--eh-sp-2)" }}>
        {props.label}
      </div>
      <div
        style={{
          color: accentColor,
          fontSize: "var(--eh-text-2xl)",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {props.value}
      </div>
    </div>
  );
}

/**
 * Preview-time scope tiles for slice 6c + 6d curator content. The
 * top SummaryTile row covers mods only; without this section the
 * user has no way to know that a "small" 12-mod collection might
 * actually ship 200 plugin entries and 80 LOOT rules. Hidden
 * entirely when the curator authored none of these — collections
 * built before slice 6d landed (or that genuinely have no rules)
 * shouldn't gain a noisy empty section.
 */
function RulesScopePreview(props: {
  summary: InstallPlan["summary"];
}): JSX.Element | null {
  const { summary } = props;
  const total =
    summary.ruleCount +
    summary.loadOrderCount +
    summary.pluginOrderCount +
    summary.userlistPluginCount +
    summary.userlistGroupCount;
  if (total === 0) return null;

  return (
    <div
      style={{
        marginBottom: "var(--eh-sp-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--eh-sp-3)",
      }}
    >
      <div
        className="eh-label"
      >
        Rules &amp; ordering this collection ships
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--eh-sp-3)",
        }}
      >
        {summary.ruleCount > 0 && (
          <SummaryTile label="Mod rules" value={summary.ruleCount} />
        )}
        {summary.loadOrderCount > 0 && (
          <SummaryTile label="Load order entries" value={summary.loadOrderCount} />
        )}
        {summary.pluginOrderCount > 0 && (
          <SummaryTile label="Plugins" value={summary.pluginOrderCount} />
        )}
        {summary.userlistPluginCount > 0 && (
          <SummaryTile
            label="LOOT plugin rules"
            value={summary.userlistPluginCount}
          />
        )}
        {summary.userlistGroupCount > 0 && (
          <SummaryTile label="LOOT groups" value={summary.userlistGroupCount} />
        )}
      </div>
      <p
        style={{
          margin: 0,
          color: "var(--eh-text-muted)",
          fontSize: "var(--eh-text-xs)",
          lineHeight: "var(--eh-leading-relaxed)",
        }}
      >
        Mod rules and LOOT plugin rules will be applied to your Vortex setup.
        The collection&apos;s rules win over any conflicting rules you may
        already have. Pre-existing rules unrelated to this collection are
        left alone.
      </p>
    </div>
  );
}

/**
 * `accountLines` describes anything about the user's Nexus account that will
 * make this install harder than the plan implies — see checkNexusAccount.
 *
 * It never sets `canProceed: false`, even for a logged-out account that
 * genuinely cannot download. Blocking would rest the whole screen on one
 * inferred state path, and a wrong block leaves the user with no way forward
 * and no explanation; a wrong warning merely wastes a paragraph. The install
 * driver still fails loudly if it turns out to be right.
 */
function computeVerdict(
  plan: InstallPlan,
  accountLines: readonly string[] = [],
): {
  headline: string;
  lines: string[];
  color: string;
  canProceed: boolean;
} {
  const lines: string[] = [];
  const compat = plan.compatibility;
  const blockers: string[] = [];

  for (const r of plan.modResolutions) {
    if (
      r.decision.kind === "nexus-unreachable" ||
      r.decision.kind === "external-missing"
    ) {
      blockers.push(`${r.name} (${r.decision.kind})`);
    }
  }

  if (!plan.summary.canProceed || blockers.length > 0) {
    if (compat.errors.length > 0) {
      for (const e of compat.errors) lines.push(e);
    }
    if (blockers.length > 0) {
      lines.push(
        `${blockers.length} mod${blockers.length === 1 ? " is" : "s are"} structurally unfixable from your side: ` +
          blockers.slice(0, 3).join(", ") +
          (blockers.length > 3 ? ", ..." : ""),
      );
    }
    if (lines.length === 0) {
      lines.push(
        "The plan reports it cannot proceed. See compatibility errors.",
      );
    }
    return {
      headline: "Cannot install",
      lines,
      color: "var(--eh-danger)",
      canProceed: false,
    };
  }

  for (const w of compat.warnings) lines.push(w);
  for (const a of accountLines) lines.push(a);
  if (plan.summary.needsUserConfirmation > 0) {
    lines.push(
      `${plan.summary.needsUserConfirmation} mod${plan.summary.needsUserConfirmation === 1 ? "" : "s"} need your input to resolve`,
    );
  }
  if (plan.summary.orphans > 0) {
    lines.push(
      `${plan.summary.orphans} orphan${plan.summary.orphans === 1 ? "" : "s"} from a previous release will need a decision`,
    );
  }
  if (lines.length === 0) {
    lines.push(
      "All mods resolve cleanly — no conflicts, no orphans, no missing files.",
    );
  }

  // An account that cannot download counts as needing attention. Saying
  // "Plan resolves cleanly" in green above a paragraph explaining that six
  // hundred mods must be fetched by hand would be the headline contradicting
  // the thing it is summarising.
  const needsAttention =
    plan.summary.needsUserConfirmation > 0 ||
    plan.summary.orphans > 0 ||
    accountLines.length > 0;

  return {
    headline: needsAttention
      ? "Plan resolves — needs your input"
      : "Plan resolves cleanly",
    lines,
    color: needsAttention ? "var(--eh-warning)" : "var(--eh-success)",
    canProceed: true,
  };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

// ===========================================================================
// 5. DecisionsStep — conflict + orphan picker grid
// ===========================================================================

export interface DecisionsStepProps {
  state: Extract<WizardState, { kind: "decisions" }>;
  dispatch: React.Dispatch<WizardAction>;
  onContinue: () => void;
}

export function DecisionsStep(props: DecisionsStepProps): JSX.Element {
  const { state, dispatch, onContinue } = props;
  const conflicts = selectConflictResolutions(state.bundle);
  const orphans = state.bundle.plan.orphanedMods;
  const canProceed = canProceedFromDecisions(
    state.bundle,
    state.conflictChoices,
  );
  const undecided = countUndecidedConflicts(
    state.bundle,
    state.conflictChoices,
  );

  return (
    <StepFrame
      current="decisions"
      title="Resolve conflicts and orphans"
      subtitle="For each item below, choose what Event Horizon should do. Defaults are conservative — keep your current setup unless you actively want to replace it."
    >
      {conflicts.length === 0 && orphans.length === 0 && (
        <Card title="Nothing to resolve">
          <p
            className="eh-body"
          >
            The plan resolved cleanly. Click Continue to review the install
            target one last time.
          </p>
        </Card>
      )}

      {conflicts.length > 0 && (
        <section style={{ marginBottom: "var(--eh-sp-5)" }}>
          <SectionHeader
            count={conflicts.length}
            title="Mod conflicts"
            description="The collection's version differs from what's installed on your machine."
          />
          <div
            className="eh-stack"
          >
            {conflicts.map((r) => (
              <ConflictRow
                key={r.compareKey}
                resolution={r}
                value={
                  state.conflictChoices[r.compareKey] ??
                  defaultConflictChoice(r)
                }
                onChange={(choice): void =>
                  dispatch({
                    type: "set-conflict-choice",
                    compareKey: r.compareKey,
                    choice,
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      {orphans.length > 0 && (
        <section>
          <SectionHeader
            count={orphans.length}
            title="Orphaned mods"
            description="These were installed by a previous release of this collection but are no longer referenced."
          />
          <div
            className="eh-stack"
          >
            {orphans.map((o) => (
              <OrphanRow
                key={o.existingModId}
                orphan={o}
                value={
                  state.orphanChoices[o.existingModId] ?? defaultOrphanChoice()
                }
                onChange={(choice): void =>
                  dispatch({
                    type: "set-orphan-choice",
                    modId: o.existingModId,
                    choice,
                  })
                }
              />
            ))}
          </div>
        </section>
      )}

      <div
        className="eh-actions"
      >
        <Button
          intent="ghost"
          onClick={(): void => dispatch({ type: "back-to-preview" })}
        >
          ← Back
        </Button>
        {/* The reason used to live in a `title` on the DISABLED button, which
            browsers frequently do not render at all — so someone stuck here
            had no way to learn why. Said out loud, and counted. */}
        {!canProceed && (
          <span className="eh-note" role="status">
            {undecided} {undecided === 1 ? "mod" : "mods"} above still need a
            choice before you can continue.
          </span>
        )}
        <Button intent="primary" disabled={!canProceed} onClick={onContinue}>
          Continue →
        </Button>
      </div>
    </StepFrame>
  );
}

function SectionHeader(props: {
  count: number;
  title: string;
  description: string;
}): JSX.Element {
  return (
    <header
      style={{
        marginBottom: "var(--eh-sp-3)",
        display: "flex",
        alignItems: "center",
        gap: "var(--eh-sp-3)",
      }}
    >
      <h3
        style={{
          margin: 0,
          color: "var(--eh-text-primary)",
          fontSize: "var(--eh-text-lg)",
        }}
      >
        {props.title}
      </h3>
      <Pill intent="info">{props.count}</Pill>
      <span
        style={{
          color: "var(--eh-text-muted)",
          fontSize: "var(--eh-text-sm)",
        }}
      >
        {props.description}
      </span>
    </header>
  );
}

/**
 * How to fetch a mod Event Horizon cannot fetch: the link, what kind of link
 * it is, and what to do once the file is on disk.
 *
 * Renders even with no URL, because the mod is still installable by hand and
 * the last step — pick the file, we take it from there — is the same either
 * way. A block that vanished when the link was missing would leave the
 * "Pick a local file" radio with no explanation of where the file comes from.
 */
function ExternalDownloadGuide(props: {
  url?: string;
  mode?: "direct" | "browse" | "manual";
  expectedFilename?: string;
}): JSX.Element {
  const guide = describeDownload({
    ...(props.url !== undefined ? { url: props.url } : {}),
    ...(props.mode !== undefined ? { mode: props.mode } : {}),
    ...(props.expectedFilename !== undefined
      ? { expectedFilename: props.expectedFilename }
      : {}),
  });

  return (
    <div
      className="eh-stack eh-stack--sm eh-inset"
      style={{ marginBottom: "var(--eh-sp-3)" }}
    >
      {guide.canOpen && props.url !== undefined && (
        <div className="eh-row">
          <span
            className="eh-mono eh-fill"
            style={{ fontSize: "var(--eh-text-xs)", wordBreak: "break-all" }}
          >
            {props.url}
          </span>
          <Button
            intent="ghost"
            onClick={(): void => {
              void openExternalUrl(props.url as string);
            }}
          >
            {guide.action}
          </Button>
        </div>
      )}
      <ol className="eh-list eh-note" style={{ margin: 0 }}>
        {guide.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

function ConflictRow(props: {
  resolution: ModResolution;
  value: ConflictChoice | undefined;
  onChange: (choice: ConflictChoice) => void;
}): JSX.Element {
  const { resolution, value, onChange } = props;
  const decision = resolution.decision;
  const reportError = useErrorReporter();
  const showToast = useToast();

  const handlePickFile = async (): Promise<void> => {
    if (decision.kind !== "external-prompt-user") return;
    try {
      const file = await pickModArchiveFile({
        title: `Select archive for "${resolution.name}"`,
        expectedFilename: decision.expectedFilename,
      });
      if (file !== undefined) {
        onChange({ kind: "use-local-file", localPath: file });
        showToast({
          intent: "success",
          message: `Linked archive for ${resolution.name}.`,
        });
      }
    } catch (err) {
      reportError(err, {
        title: "Couldn't open file picker",
        context: { step: "decisions", mod: resolution.name },
      });
    }
  };

  return (
    <article
      style={{
        background: "var(--eh-bg-raised)",
        border: "1px solid var(--eh-border-subtle)",
        borderRadius: "var(--eh-radius-md)",
        padding: "var(--eh-sp-4)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--eh-sp-3)",
          marginBottom: "var(--eh-sp-3)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong
            style={{
              color: "var(--eh-text-primary)",
              fontSize: "var(--eh-text-md)",
            }}
          >
            {resolution.name}
          </strong>
          <div
            style={{
              color: "var(--eh-text-muted)",
              fontSize: "var(--eh-text-xs)",
              fontFamily: "var(--eh-font-mono)",
              marginTop: "var(--eh-sp-1)",
            }}
          >
            {resolution.compareKey}
          </div>
        </div>
        <Pill intent="warning">{decisionLabel(decision.kind)}</Pill>
      </header>

      <p
        style={{
          margin: "0 0 var(--eh-sp-3) 0",
          color: "var(--eh-text-secondary)",
          fontSize: "var(--eh-text-sm)",
          lineHeight: "var(--eh-leading-relaxed)",
        }}
      >
        {describeConflict(resolution)}
      </p>

      {/* Get it yourself, in your own browser.
          Vortex answers a browse-website dependency with an embedded browser;
          this deliberately does not. That window is signed out of everything,
          has no password manager, no ad-blocker and no download manager, and
          handles a Cloudflare check badly — the one flow where someone most
          needs their own environment gets the worst version of it.

          The URL is shown in FULL rather than hidden behind the button: it
          came out of a manifest someone else authored, and the person about
          to click should see where they are being sent. openExternalUrl
          refuses anything that is not http(s) regardless. */}
      {decision.kind === "external-prompt-user" && (
        <ExternalDownloadGuide
          url={decision.url}
          mode={decision.downloadMode}
          expectedFilename={decision.expectedFilename}
        />
      )}

      {decision.kind === "external-prompt-user" ? (
        <div
          className="eh-stack eh-stack--sm"
        >
          <RadioOption
            checked={value?.kind === "use-local-file"}
            onChange={(): void => {
              void handlePickFile();
            }}
            label="Pick a local file..."
            sub={
              value?.kind === "use-local-file"
                ? `Picked: ${value.localPath}`
                : `Expected filename: ${decision.expectedFilename}`
            }
          />
          <RadioOption
            checked={value?.kind === "skip"}
            onChange={(): void => onChange({ kind: "skip" })}
            label="Skip this mod"
            sub="The collection will be installed without this mod."
          />
        </div>
      ) : (
        <div
          className="eh-stack eh-stack--sm"
        >
          <RadioOption
            checked={value?.kind === "keep-existing"}
            onChange={(): void => onChange({ kind: "keep-existing" })}
            label="Keep your installed version"
            sub="Safe default — your file stays untouched and is enabled in the install profile."
          />
          <RadioOption
            checked={value?.kind === "replace-existing"}
            onChange={(): void => onChange({ kind: "replace-existing" })}
            label="Replace with the collection's version"
            sub="Your installed version will be uninstalled, then the collection's archive is downloaded/installed."
          />
        </div>
      )}
    </article>
  );
}

function OrphanRow(props: {
  orphan: OrphanedModDecision;
  value: OrphanChoice;
  onChange: (choice: OrphanChoice) => void;
}): JSX.Element {
  const { orphan, value, onChange } = props;
  return (
    <article
      style={{
        background: "var(--eh-bg-raised)",
        border: "1px solid var(--eh-border-subtle)",
        borderRadius: "var(--eh-radius-md)",
        padding: "var(--eh-sp-4)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--eh-sp-3)",
          marginBottom: "var(--eh-sp-3)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong
            style={{
              color: "var(--eh-text-primary)",
              fontSize: "var(--eh-text-md)",
            }}
          >
            {orphan.name}
          </strong>
          <div
            style={{
              color: "var(--eh-text-muted)",
              fontSize: "var(--eh-text-xs)",
              fontFamily: "var(--eh-font-mono)",
              marginTop: "var(--eh-sp-1)",
            }}
          >
            installed by v{orphan.installedFromVersion}
          </div>
        </div>
        <Pill intent="warning">orphaned</Pill>
      </header>
      <div
        className="eh-stack eh-stack--sm"
      >
        <RadioOption
          checked={value.kind === "keep"}
          onChange={(): void => onChange({ kind: "keep" })}
          label="Keep installed"
          sub="Leave the mod alone — useful if you want it independently of the collection."
        />
        <RadioOption
          checked={value.kind === "uninstall"}
          onChange={(): void => onChange({ kind: "uninstall" })}
          label="Uninstall it"
          sub="Removes the mod entirely (file system + Vortex state). Destructive."
        />
      </div>
    </article>
  );
}

function RadioOption(props: {
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
  sub?: React.ReactNode;
}): JSX.Element {
  return (
    <label
      style={{
        display: "flex",
        gap: "var(--eh-sp-3)",
        alignItems: "flex-start",
        padding: "var(--eh-sp-3)",
        background: props.checked
          ? "var(--eh-bg-elevated)"
          : "transparent",
        border: props.checked
          ? "1px solid var(--eh-border-strong)"
          : "1px solid var(--eh-border-subtle)",
        borderRadius: "var(--eh-radius-sm)",
        cursor: "pointer",
        transition:
          "background var(--eh-dur-fast) var(--eh-easing), border var(--eh-dur-fast) var(--eh-easing)",
      }}
    >
      <input
        type="radio"
        checked={props.checked}
        onChange={props.onChange}
        style={{ marginTop: 4, accentColor: "var(--eh-cyan)" }}
      />
      <div>
        <div
          style={{
            color: "var(--eh-text-primary)",
            fontSize: "var(--eh-text-sm)",
            fontWeight: 600,
          }}
        >
          {props.label}
        </div>
        {props.sub !== undefined && (
          <div
            style={{
              color: "var(--eh-text-muted)",
              fontSize: "var(--eh-text-xs)",
              marginTop: "var(--eh-sp-1)",
              wordBreak: "break-word",
            }}
          >
            {props.sub}
          </div>
        )}
      </div>
    </label>
  );
}

function decisionLabel(kind: ModResolution["decision"]["kind"]): string {
  switch (kind) {
    case "nexus-version-diverged":
      return "version diverged";
    case "nexus-bytes-diverged":
      return "bytes diverged";
    case "external-bytes-diverged":
      return "bytes diverged";
    case "external-prompt-user":
      return "needs file";
    default:
      return kind;
  }
}

function describeConflict(resolution: ModResolution): string {
  const d = resolution.decision;
  switch (d.kind) {
    case "nexus-version-diverged":
      return `You have file id ${d.existingFileId} installed; the collection wants file id ${d.requiredFileId}.`;
    case "nexus-bytes-diverged":
      return "Nexus IDs match but the bytes differ. Either Nexus silently re-uploaded the file or your local archive is corrupt.";
    case "external-bytes-diverged":
      return "An external mod with this identity is installed locally but its archive bytes differ from what the collection bundled.";
    case "external-prompt-user":
      return `This mod is not bundled and not in your downloads. Pick a local archive matching "${d.expectedFilename}", or skip the mod.`;
    default:
      return "";
  }
}

// ===========================================================================
// 6. ConfirmStep
// ===========================================================================

export interface ConfirmStepProps {
  state: Extract<WizardState, { kind: "confirm" }>;
  onInstall: () => void;
  onBack: () => void;
}

/** Below this many free bytes on the install drive we surface a
 * pre-flight warning. 5 GB is conservative — most casual collections
 * stage 1–2 GB, but a single high-poly mesh pack can blow past 4. */
const DISK_SPACE_WARN_THRESHOLD = 5 * 1024 * 1024 * 1024;

/**
 * The one warning shape this step uses, defined once.
 *
 * Both banners here had the same eleven inline properties copied out, down to
 * a hardcoded rgba(255, 177, 92, 0.08) that existed nowhere else in the app.
 */
function WarningPanel(props: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  role?: string;
}): JSX.Element {
  return (
    <div
      role={props.role}
      style={{
        display: "flex",
        gap: "var(--eh-sp-2)",
        alignItems: "flex-start",
        padding: "var(--eh-sp-3) var(--eh-sp-4)",
        background: "var(--eh-warning-soft)",
        border: "1px solid var(--eh-warning)",
        borderRadius: "var(--eh-radius-sm)",
        color: "var(--eh-text-primary)",
        fontSize: "var(--eh-text-sm)",
        lineHeight: "var(--eh-leading-relaxed)",
        ...props.style,
      }}
    >
      <span aria-hidden="true">⚠</span>
      <div className="eh-fill">{props.children}</div>
    </div>
  );
}

export function ConfirmStep(props: ConfirmStepProps): JSX.Element {
  const { state, onInstall, onBack } = props;
  const { bundle, decisions } = state;
  const target = bundle.plan.installTarget;

  // Esc = back to decisions. Enter is deliberately NOT bound here.
  //
  // Every other step in this wizard advances on Enter, so binding it to the
  // install would make the last, irreversible action reachable by the same
  // reflex that got the user through the reversible ones. The screen says
  // "Last chance to review"; committing should take a click.
  useKeyboardShortcut("Escape", onBack);

  // Best-effort disk-space probe. We swallow probe errors and just
  // show nothing if the API is unavailable — never block install on
  // a flaky stat. Runs once on mount; recomputing per re-render is
  // pointless because the user can't free disk space without leaving
  // this screen.
  const [diskFreeBytes, setDiskFreeBytes] = React.useState<number | undefined>(
    undefined,
  );
  React.useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getFreeBytes } = await import("../../../utils/diskSpace");
        const probePath = util.getVortexPath("userData");
        const free = await getFreeBytes(probePath);
        if (!cancelled) setDiskFreeBytes(free);
      } catch {
        /* swallow — UI just won't render the banner */
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, []);

  const conflictCount = Object.keys(decisions.conflictChoices ?? {}).length;
  const orphanCount = Object.keys(decisions.orphanChoices ?? {}).length;

  const removalCount =
    Object.values(decisions.conflictChoices ?? {}).filter(
      (c) => c.kind === "replace-existing",
    ).length +
    Object.values(decisions.orphanChoices ?? {}).filter(
      (c) => c.kind === "uninstall",
    ).length;

  const isFresh = target.kind === "fresh-profile";

  const installCount =
    bundle.plan.summary.willInstallSilently +
    Object.values(decisions.conflictChoices ?? {}).filter(
      (c) => c.kind === "replace-existing" || c.kind === "use-local-file",
    ).length;

  return (
    <StepFrame
      current="confirm"
      title="Last chance to review"
      subtitle="Once you click Install, Event Horizon will start downloading, hardlinking, and deploying mods. Closing the page won't roll the changes back."
    >
      <Card
        title={`${bundle.plan.manifest.package.name} v${bundle.plan.manifest.package.version}`}
      >
        <ul
          className="eh-list"
        >
          <li>
            <strong>Target:</strong>{" "}
            {isFresh
              ? `Fresh profile (suggested name: ${target.suggestedProfileName})`
              : `Current profile: ${target.profileName}`}
          </li>
          <li>
            <strong>Mods to install:</strong> {installCount}
          </li>
          <li>
            <strong>Conflict decisions:</strong> {conflictCount}
          </li>
          <li>
            <strong>Orphan decisions:</strong> {orphanCount}
          </li>
        </ul>

        {/* Removals used to be the fifth bullet in that list, sitting at the
            same weight as "Conflict decisions: 3". It is the only line here
            that describes something being destroyed, so it does not belong
            in a list of counts. When there is nothing to remove, saying so
            plainly is the reassurance this screen owes the reader. */}
        {removalCount === 0 ? (
          <p className="eh-note" style={{ margin: "var(--eh-sp-4) 0 0 0" }}>
            Nothing will be uninstalled.
          </p>
        ) : (
          <WarningPanel style={{ margin: "var(--eh-sp-4) 0 0 0" }}>
            <strong>
              {removalCount} mod{removalCount === 1 ? "" : "s"} will be
              uninstalled
              {isFresh ? "" : " from your current profile"}.
            </strong>{" "}
            This is what you asked for on the previous screen, but it is the
            part that cannot be undone by going back.
          </WarningPanel>
        )}
      </Card>

      {diskFreeBytes !== undefined &&
        diskFreeBytes < DISK_SPACE_WARN_THRESHOLD && (
          <WarningPanel role="alert" style={{ marginTop: "var(--eh-sp-4)" }}>
            <strong>Low disk space on Vortex&apos;s data drive.</strong>{" "}
            Only {formatBytes(diskFreeBytes)} free where mods get staged.
            Large collections can easily download tens of gigabytes —
            installs may fail mid-way if the disk fills. Free up space
            before continuing if you&apos;re unsure.
          </WarningPanel>
        )}

      <div
        className="eh-actions"
      >
        <Button intent="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button intent="primary" onClick={onInstall}>
          Install {installCount} mod{installCount === 1 ? "" : "s"}
        </Button>
      </div>
    </StepFrame>
  );
}

// ===========================================================================
// 7. InstallingStep
// ===========================================================================

const PHASE_LABELS: Record<DriverProgress["phase"], string> = {
  preflight: "Pre-flight checks",
  "creating-profile": "Creating fresh profile",
  "switching-profile": "Switching to install profile",
  "removing-mods": "Removing replaced + orphaned mods",
  "installing-mods": "Installing mods",
  "verifying-mods": "Verifying mod integrity",
  "applying-mod-rules": "Applying mod rules",
  "applying-userlist": "Applying LOOT plugin rules",
  deploying: "Deploying",
  "applying-load-order": "Applying load order",
  "writing-receipt": "Writing receipt",
  complete: "Complete",
  aborted: "Aborted",
  failed: "Failed",
};

export function InstallingStep(props: {
  state: Extract<WizardState, { kind: "installing" }>;
  /** Ask the driver to stop at its next checkpoint. */
  onCancel: () => void;
  /** A stop has been asked for and the driver has not reached a checkpoint. */
  cancelPending: boolean;
}): JSX.Element {
  const { progress, bundle } = props.state;

  // Stopping a run that has been going for two hours should not be one
  // stray click away, so the button asks first. It is not a destructive
  // confirm though — nothing is removed, and the copy says so, because a
  // scary dialog here would push people toward killing Vortex instead,
  // which is the genuinely unsafe option.
  const [confirmingStop, setConfirmingStop] = React.useState(false);

  // This screen is up for HOURS on a real collection, and the driver goes
  // quiet for minutes at a time during a large download. A clock that only
  // advanced on driver beats would freeze during exactly the silence the
  // reader needs explaining, so it ticks on its own.
  const [startedAtMs] = React.useState(() => Date.now());
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return (): void => clearInterval(id);
  }, []);

  // Timing is kept per phase because the driver's step counters reset at every
  // transition — see installProgress.
  const [timing, setTiming] = React.useState<PhaseTiming | undefined>(
    undefined,
  );
  React.useEffect(() => {
    if (progress === undefined) return;
    setTiming((prev) => trackPhase(prev, progress, Date.now()));
  }, [progress]);

  const phaseLabel =
    progress !== undefined ? PHASE_LABELS[progress.phase] : "Starting...";
  const ratio =
    progress !== undefined && progress.totalSteps > 0
      ? progress.currentStep / progress.totalSteps
      : undefined;

  const remainingMs =
    timing !== undefined && progress !== undefined
      ? estimateRemainingMs({
          timing,
          totalSteps: progress.totalSteps,
          nowMs,
        })
      : undefined;
  const quiet = timing !== undefined ? describeQuiet(timing, nowMs) : undefined;

  return (
    <StepFrame
      current="installing"
      title="Installing"
      subtitle={`${bundle.plan.manifest.package.name} v${bundle.plan.manifest.package.version} — keep this page open until the run finishes.`}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--eh-sp-5)",
          padding: "var(--eh-sp-6)",
          background: "var(--eh-bg-raised)",
          border: "1px solid var(--eh-border-default)",
          borderRadius: "var(--eh-radius-lg)",
          alignItems: "center",
        }}
      >
        <ProgressRing value={ratio} size={120} />
        <div style={{ flex: 1 }}>
          <strong
            style={{
              color: "var(--eh-text-primary)",
              fontSize: "var(--eh-text-lg)",
            }}
          >
            {phaseLabel}
          </strong>
          <p
            style={{
              margin: "var(--eh-sp-1) 0 0 0",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-sm)",
              lineHeight: "var(--eh-leading-relaxed)",
            }}
          >
            {progress?.message ??
              "Driver is starting up — this usually takes a few seconds."}
          </p>
          {/* Elapsed is always true and always worth knowing; the estimate
              appears only once it is measured rather than guessed. */}
          <p
            style={{
              margin: "var(--eh-sp-2) 0 0 0",
              color: "var(--eh-text-muted)",
              fontSize: "var(--eh-text-xs)",
              fontFamily: "var(--eh-font-mono)",
            }}
          >
            {describeElapsed(startedAtMs, nowMs)}
            {progress !== undefined && progress.totalSteps > 1
              ? ` · step ${progress.currentStep} / ${progress.totalSteps}`
              : ""}
            {remainingMs !== undefined
              ? ` · about ${formatDuration(remainingMs)} left`
              : ""}
          </p>
        </div>
      </div>

      {quiet !== undefined && (
        <p
          className="eh-note"
          role="status"
          style={{ margin: "var(--eh-sp-3) 0 0 0" }}
        >
          {quiet}
        </p>
      )}

      {/* The stop control lives below the progress, away from the eye, and
          never becomes a primary action — the expected thing to do on this
          screen is wait. */}
      <div className="eh-actions" style={{ marginTop: "var(--eh-sp-4)" }}>
        {props.cancelPending ? (
          <span className="eh-note" role="status">
            Stopping after the current mod finishes...
          </span>
        ) : confirmingStop ? (
          <>
            <span className="eh-note eh-fill">
              Stop after the current mod finishes? Mods already installed stay
              where they are — nothing is undone, and running this collection
              again picks up from where it stopped.
            </span>
            <Button intent="ghost" onClick={(): void => setConfirmingStop(false)}>
              Keep going
            </Button>
            <Button intent="danger" onClick={props.onCancel}>
              Stop install
            </Button>
          </>
        ) : (
          <Button intent="ghost" onClick={(): void => setConfirmingStop(true)}>
            Stop install
          </Button>
        )}
      </div>
    </StepFrame>
  );
}

// ===========================================================================
// 8. DoneStep
// ===========================================================================

export interface DoneStepProps {
  result: InstallResult;
  bundle: PreviewBundle;
  onStartOver: () => void;
  onGoCollections: () => void;
  /**
   * Optional. When provided AND the install succeeded, the success
   * card surfaces a "Switch to <profile>" button so the user lands
   * directly inside the profile their collection just installed
   * into. No-op for aborted/failed results.
   */
  onSwitchProfile?: (profileId: string, profileName: string) => void;
}

export function DoneStep(props: DoneStepProps): JSX.Element {
  const { result, bundle, onStartOver, onGoCollections, onSwitchProfile } = props;

  let badge: JSX.Element;
  let headline: string;
  let body: React.ReactNode;
  let accent: string;

  if (result.kind === "success") {
    badge = (
      <Pill intent="success" withDot>
        Success
      </Pill>
    );
    headline = `Installed ${bundle.plan.manifest.package.name} v${bundle.plan.manifest.package.version}`;
    accent = "var(--eh-success)";
    body = (
      <SuccessBody
        result={result}
      />
    );
  } else if (result.kind === "aborted") {
    badge = <Pill intent="warning">Stopped</Pill>;
    headline = "Install stopped";
    accent = "var(--eh-warning)";
    body = (
      <FailureBody
        phase={result.phase}
        partialProfileId={result.partialProfileId}
        message={result.reason}
        installedSoFar={result.installedSoFar.length}
        stopped
      />
    );
  } else {
    badge = (
      <Pill intent="danger" withDot>
        Failed
      </Pill>
    );
    headline = "Install failed";
    accent = "var(--eh-danger)";
    body = (
      <FailureBody
        phase={result.phase}
        partialProfileId={result.partialProfileId}
        message={result.error}
        installedSoFar={result.installedSoFar.length}
      />
    );
  }

  return (
    <StepFrame
      current="done"
      title={
        <span style={{ color: accent }}>
          {headline}
        </span>
      }
      subtitle={
        <span style={{ display: "inline-flex", gap: "var(--eh-sp-2)" }}>
          {badge}
        </span>
      }
    >
      <Card title={null}>{body}</Card>

      <div
        className="eh-actions"
      >
        <Button intent="ghost" onClick={onStartOver}>
          Install another collection
        </Button>
        {result.kind === "success" && onSwitchProfile !== undefined && (
          <Button
            intent="ghost"
            onClick={(): void =>
              onSwitchProfile(result.profileId, result.profileName)
            }
            title={`Activate the "${result.profileName}" profile in Vortex`}
          >
            Switch to {result.profileName}
          </Button>
        )}
        <Button intent="primary" onClick={onGoCollections}>
          View installed collections
        </Button>
      </div>
    </StepFrame>
  );
}

/**
 * What the collection changed in the user's game settings.
 *
 * Shown without being asked for. A configuration edited silently is not
 * acceptable even when it is correct, and this is the one moment the user is
 * actually looking — burying it in a receipt they will never open would be
 * the same as not telling them.
 *
 * The summary is the visible part; the per-key `before → after` list folds
 * away, because twelve of those is a wall and the fact that it happened is
 * what matters first.
 */
/**
 * Mods that installed as the wrong KIND.
 *
 * Above the settings notice and styled as a warning, because this one means
 * something is broken rather than something changed — and it is invisible
 * otherwise: every file is present, every hash matches, and the game just
 * does not load the mod.
 */
/**
 * The shared head of every post-install notice: a labelled pill and the
 * summary line, in an inset card.
 *
 * The BODIES stay separate on purpose. Game settings folds behind a
 * disclosure because it can list hundreds of INI keys; the others are a
 * handful of lines and folding them would hide the whole message behind a
 * click. Same head, different body, because the difference is real.
 */
function NoticeCard(props: {
  label: string;
  intent: "info" | "warning" | "danger" | "success" | "neutral";
  summary: string;
  accentBorder?: string;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className="eh-inset"
      style={
        props.accentBorder !== undefined
          ? { borderColor: props.accentBorder }
          : undefined
      }
    >
      <div className="eh-row eh-row--sm" style={{ alignItems: "flex-start" }}>
        <Pill intent={props.intent}>{props.label}</Pill>
        <span className="eh-fill eh-secondary" style={{ fontSize: "var(--eh-text-sm)" }}>
          {props.summary}
        </span>
      </div>
      {props.children}
    </div>
  );
}

/** Lines under a notice head, shown inline. */
function NoticeLines(props: { lines: readonly string[] }): JSX.Element | null {
  if (props.lines.length === 0) return null;
  return (
    <div className="eh-note" style={{ marginTop: "var(--eh-sp-2)", whiteSpace: "pre-line" }}>
      {props.lines.join("\n")}
    </div>
  );
}

function ModTypeNotice(props: { lines: readonly string[] }): JSX.Element | null {
  if (props.lines.length === 0) return null;
  const [summary, ...rest] = props.lines;
  return (
    <NoticeCard
      label="Wrong folder"
      intent="warning"
      summary={summary ?? ""}
      accentBorder="var(--eh-warning)"
    >
      <NoticeLines lines={rest} />
    </NoticeCard>
  );
}

/**
 * INI tweaks the curator had on that could not be turned on here.
 *
 * Only failures reach this — see IniTweakApplication. A tweak that landed
 * needs no sentence; one that did not changes how the game runs while
 * changing nothing the user can see, which makes it the one thing on this
 * screen they could never work out for themselves.
 */
function IniTweakNotice(props: { lines: readonly string[] }): JSX.Element | null {
  if (props.lines.length === 0) return null;
  const [summary, ...rest] = props.lines;
  return (
    <NoticeCard
      label="INI tweaks"
      intent="warning"
      summary={summary ?? ""}
      accentBorder="var(--eh-warning)"
    >
      <NoticeLines lines={rest} />
    </NoticeCard>
  );
}

function GameIniNotice(props: { lines: readonly string[] }): JSX.Element | null {
  if (props.lines.length === 0) return null;
  const [summary, ...changes] = props.lines;

  return (
    <NoticeCard label="Game settings" intent="info" summary={summary ?? ""}>
      {changes.length > 0 && (
        <details style={{ marginTop: "var(--eh-sp-2)" }}>
          <summary className="eh-note" style={{ cursor: "pointer" }}>
            Show the {changes.length} setting{changes.length === 1 ? "" : "s"} that changed
          </summary>
          <div
            className="eh-mono eh-muted"
            style={{ marginTop: "var(--eh-sp-2)", whiteSpace: "pre-line" }}
          >
            {changes.join("\n")}
          </div>
        </details>
      )}
    </NoticeCard>
  );
}

function SuccessBody(props: {
  result: Extract<InstallResult, { kind: "success" }>;
}): JSX.Element {
  const { result } = props;
  const installedBuckets = countByKey(
    result.installedMods.map((m) => m.fromDecision),
  );
  const removedBuckets = countByKey(
    result.removedMods.map((m) => m.reason),
  );
  return (
    <div className="eh-stack eh-stack--lg">
      <ModTypeNotice lines={result.modTypeNotice ?? []} />
      <IniTweakNotice lines={result.iniTweakNotice ?? []} />
      <GameIniNotice lines={result.gameIniNotice ?? []} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--eh-sp-3)",
        }}
      >
        <Tile
          label="Profile"
          value={result.profileName}
          accent="var(--eh-cyan)"
        />
        <Tile
          label="Mode"
          value={
            result.installTargetMode === "fresh-profile"
              ? "Fresh profile"
              : "Current profile"
          }
        />
        <Tile
          label="Installed"
          value={String(result.installedModIds.length)}
          accent="var(--eh-success)"
        />
        <Tile
          label="Removed"
          value={String(result.removedMods.length)}
          accent={
            result.removedMods.length > 0
              ? "var(--eh-warning)"
              : undefined
          }
        />
        <Tile
          label="Carried"
          value={String(result.carriedMods.length)}
        />
        <Tile
          label="Skipped"
          value={String(result.skippedMods.length)}
        />
      </div>

      {installedBuckets.length > 0 && (
        <BucketList title="Install breakdown" buckets={installedBuckets} />
      )}
      {removedBuckets.length > 0 && (
        <BucketList title="Removal breakdown" buckets={removedBuckets} />
      )}
      {result.skippedMods.length > 0 && (
        <details>
          <summary
            style={{
              color: "var(--eh-text-muted)",
              cursor: "pointer",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            Show skipped mods ({result.skippedMods.length})
          </summary>
          <ul
            style={{
              margin: "var(--eh-sp-2) 0 0 0",
              paddingLeft: "var(--eh-sp-5)",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            {result.skippedMods.map((s) => (
              <li key={s.compareKey}>
                {s.name} <em className="eh-muted">— {s.reason}</em>
              </li>
            ))}
          </ul>
        </details>
      )}

      <RulesAndUserlistSection
        rules={result.rulesApplication}
        userlist={result.userlistApplication}
      />

      <IntegritySection verifications={result.verifications} />

      <p
        style={{
          margin: 0,
          color: "var(--eh-text-muted)",
          fontSize: "var(--eh-text-xs)",
          fontFamily: "var(--eh-font-mono)",
          wordBreak: "break-all",
        }}
      >
        receipt: {result.receiptPath}
      </p>
    </div>
  );
}

/**
 * Surfaces the slice 7 (file integrity verification) summary the
 * driver writes into the receipt. Without this, the user has no
 * way to see when Vortex's "lost files" bug bit during install.
 *
 * Layout mirrors {@link RulesAndUserlistSection}: a row of count
 * tiles + a `<details>` expander for failure detail. Hidden when
 * the manifest didn't carry a verification snapshot at all (the
 * curator built with `verificationLevel = "none"` AND every
 * verification is `kind: "skip"` for that reason — common for old
 * receipts pre-slice-7).
 */
function IntegritySection(props: {
  verifications: Extract<InstallResult, { kind: "success" }>["verifications"];
}): JSX.Element | null {
  const { verifications } = props;
  if (verifications.length === 0) return null;

  let okCount = 0;
  let recoveredCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let levelNoneSkips = 0;
  let totalVerifiedFiles = 0;
  for (const v of verifications) {
    if (v.kind === "ok") {
      okCount++;
      totalVerifiedFiles += v.verifiedFileCount;
      if (v.retryAttempted === true) recoveredCount++;
    } else if (v.kind === "fail") {
      failCount++;
    } else {
      skipCount++;
      if (v.reason === "verification-level-none") levelNoneSkips++;
    }
  }

  // Hide entirely when every entry is a `verification-level-none`
  // skip — there's nothing to surface and no failure to warn about.
  // (Mixed-skip receipts where SOME mods carried snapshots still
  // render so the user sees the partial coverage.)
  if (
    okCount === 0 &&
    recoveredCount === 0 &&
    failCount === 0 &&
    skipCount === levelNoneSkips
  ) {
    return null;
  }

  const fails = verifications.filter(
    (v): v is Extract<typeof v, { kind: "fail" }> => v.kind === "fail",
  );
  const recovered = verifications.filter(
    (v): v is Extract<typeof v, { kind: "ok" }> =>
      v.kind === "ok" && v.retryAttempted === true,
  );

  return (
    <div
      className="eh-stack"
    >
      <div
        className="eh-label"
      >
        Integrity check
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "var(--eh-sp-2)",
        }}
      >
        <Tile
          label="Mods passing"
          value={String(okCount)}
          accent={failCount === 0 ? "var(--eh-success)" : undefined}
        />
        <Tile
          label="Files verified"
          value={String(totalVerifiedFiles)}
        />
        {recoveredCount > 0 && (
          <Tile
            label="Recovered"
            value={String(recoveredCount)}
            accent="var(--eh-warning)"
          />
        )}
        {failCount > 0 && (
          <Tile
            label="Still failing"
            value={String(failCount)}
            accent="var(--eh-danger)"
          />
        )}
        {skipCount > 0 && failCount === 0 && (
          <Tile
            label="Skipped"
            value={String(skipCount)}
          />
        )}
      </div>
      {recovered.length > 0 && fails.length === 0 && (
        <p
          style={{
            margin: 0,
            color: "var(--eh-text-muted)",
            fontSize: "var(--eh-text-xs)",
            lineHeight: "var(--eh-leading-relaxed)",
          }}
        >
          {recovered.length} mod{recovered.length === 1 ? "" : "s"} needed a
          reinstall to land all files. Common cause: an antivirus briefly
          quarantined a file mid-extract; Event Horizon retried automatically.
        </p>
      )}
      {fails.length > 0 && (
        <details>
          <summary
            style={{
              color: "var(--eh-danger)",
              cursor: "pointer",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            Show failing mods ({fails.length})
          </summary>
          <p
            style={{
              margin: "var(--eh-sp-2) 0 var(--eh-sp-2) 0",
              color: "var(--eh-text-muted)",
              fontSize: "var(--eh-text-xs)",
              lineHeight: "var(--eh-leading-relaxed)",
            }}
          >
            These mods extracted with missing or corrupt files even after
            an automatic reinstall. The most common cause is antivirus
            quarantining files; check your AV history, restore the files,
            and click <strong>Reinstall</strong> on the mod in Vortex&apos;s
            Mods tab. The full per-file diff is in the receipt JSON.
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: "var(--eh-sp-5)",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            {fails.map((f) => (
              <li key={f.vortexModId} style={{ marginBottom: "var(--eh-sp-2)" }}>
                <strong>{f.name}</strong>{" "}
                <em className="eh-muted">
                  — {f.missingFileCount} missing,{" "}
                  {f.sizeMismatchCount} truncated,{" "}
                  {f.hashMismatchCount} corrupt of {f.expectedFileCount}
                  {f.retryAttempted ? "; reinstall did not help" : ""}
                </em>
                {f.examples.length > 0 && (
                  <ul
                    style={{
                      margin: "var(--eh-sp-1) 0 0 0",
                      paddingLeft: "var(--eh-sp-4)",
                      color: "var(--eh-text-muted)",
                      fontSize: "var(--eh-text-xs)",
                      fontFamily: "var(--eh-font-mono)",
                    }}
                  >
                    {f.examples.slice(0, 6).map((ex, i) => (
                      <li key={i} style={{ wordBreak: "break-all" }}>
                        [{ex.bucket}] {ex.path}
                      </li>
                    ))}
                    {f.examples.length > 6 && (
                      <li className="eh-muted">
                        ... and {f.examples.length - 6} more
                      </li>
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Surfaces the slice 6c (mod rules + LoadOrder) and slice 6d
 * (LOOT userlist) application summaries the driver writes into
 * the receipt. Without this section, the user has no way to know
 * whether Vortex's reducers actually accepted the curator's rules
 * or whether some were silently rejected — the verification-on-
 * dispatch we wired into `applyUserlist` would record failures
 * into a JSON file the user never opens.
 *
 * Layout is intentionally compact: collapsed by default if there
 * is nothing meaningful to surface (zero applies, zero skips), so
 * collections without rules don't add noise. Skipped entries open
 * in a `<details>` expander so the danger signal is one click
 * away — same UX pattern as "Show skipped mods" above.
 */
function RulesAndUserlistSection(props: {
  rules: Extract<InstallResult, { kind: "success" }>["rulesApplication"];
  userlist: Extract<InstallResult, { kind: "success" }>["userlistApplication"];
}): JSX.Element | null {
  const { rules, userlist } = props;
  const totalApplied =
    rules.appliedRuleCount +
    rules.appliedLoadOrderCount +
    userlist.appliedRuleCount +
    userlist.appliedGroupAssignmentCount +
    userlist.appliedNewGroupCount +
    userlist.appliedGroupRuleCount;
  const totalSkipped =
    rules.skippedRules.length +
    rules.skippedLoadOrderEntries.length +
    userlist.skippedUserlistEntries.length;
  const hasOverwrites =
    rules.overwrittenUserRuleCount > 0 ||
    userlist.overwrittenGroupAssignmentCount > 0;

  if (totalApplied === 0 && totalSkipped === 0) {
    return null;
  }

  return (
    <div
      className="eh-stack"
    >
      <div
        className="eh-label"
      >
        Rules &amp; ordering
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "var(--eh-sp-2)",
        }}
      >
        <Tile
          label="Mod rules applied"
          value={String(rules.appliedRuleCount)}
        />
        <Tile
          label="Load order entries"
          value={String(rules.appliedLoadOrderCount)}
        />
        <Tile
          label="Plugin rules applied"
          value={String(userlist.appliedRuleCount)}
        />
        <Tile
          label="Plugin groups"
          value={`${userlist.appliedGroupAssignmentCount} assigned · ${userlist.appliedNewGroupCount} new`}
        />
        {hasOverwrites && (
          <Tile
            label="User rules overwritten"
            value={String(
              rules.overwrittenUserRuleCount +
                userlist.overwrittenGroupAssignmentCount,
            )}
            accent="var(--eh-warning)"
          />
        )}
        {totalSkipped > 0 && (
          <Tile
            label="Skipped"
            value={String(totalSkipped)}
            accent="var(--eh-danger)"
          />
        )}
      </div>
      {totalSkipped > 0 && (
        <details>
          <summary
            style={{
              color: "var(--eh-danger)",
              cursor: "pointer",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            Show skipped rules ({totalSkipped})
          </summary>
          <p
            style={{
              margin: "var(--eh-sp-2) 0 var(--eh-sp-2) 0",
              color: "var(--eh-text-muted)",
              fontSize: "var(--eh-text-xs)",
              lineHeight: "var(--eh-leading-relaxed)",
            }}
          >
            These came from the collection but did not land. Common causes:
            Vortex&apos;s mod-rule or userlist contract changed, the rule
            referenced a mod/plugin that did not install, or the curator
            ignored the rule before publishing. The full per-rule reason
            lives in the receipt JSON.
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: "var(--eh-sp-5)",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            {rules.skippedRules.map((s, i) => (
              <li key={`mr-${i}`}>
                <code>{s.source}</code> {s.ruleType} <code>{s.reference}</code>{" "}
                <em className="eh-muted">— {s.reason}</em>
              </li>
            ))}
            {rules.skippedLoadOrderEntries.map((s, i) => (
              <li key={`lo-${i}`}>
                load-order <code>{s.compareKey}</code> @ {s.pos}{" "}
                <em className="eh-muted">— {s.reason}</em>
              </li>
            ))}
            {userlist.skippedUserlistEntries.map((s, i) => (
              <li key={`ul-${i}`}>
                {s.kind} <code>{s.subject}</code>
                {s.reference !== undefined && (
                  <>
                    {" "}
                    {s.ruleKind ?? ""} <code>{s.reference}</code>
                  </>
                )}{" "}
                <em className="eh-muted">— {s.reason}</em>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function FailureBody(props: {
  phase: string;
  message: string;
  partialProfileId?: string;
  installedSoFar?: number;
  /**
   * This was a deliberate stop, not a failure. Same facts, different verb —
   * telling someone their install "failed" when they stopped it themselves
   * reads as a bug and sends them looking for one.
   */
  stopped?: boolean;
}): JSX.Element {
  return (
    <div className="eh-stack">
      {/* The reason leads. Someone reading this screen just had an install
          fail; what went wrong is the whole question, and "Phase:" is our
          vocabulary rather than theirs. It used to be the first line. */}
      <p className="eh-body eh-strong" style={{ fontSize: "var(--eh-text-md)" }}>
        {props.message}
      </p>

      {/* Then the facts about the state their machine is now in, as aligned
          fields rather than a stack of bold-prefixed sentences. */}
      <div className="eh-stack eh-stack--xs">
        <div className="eh-field">
          <span className="eh-field__label">
            {props.stopped === true ? "Stopped during" : "Failed during"}
          </span>
          <span className="eh-fill">{props.phase}</span>
        </div>
        {props.installedSoFar !== undefined && (
          <div className="eh-field">
            <span className="eh-field__label">Mods installed first</span>
            <span className="eh-fill">{props.installedSoFar}</span>
          </div>
        )}
        {props.partialProfileId !== undefined && (
          <div className="eh-field">
            <span className="eh-field__label">Partial profile</span>
            <span className="eh-fill eh-mono">{props.partialProfileId}</span>
          </div>
        )}
      </div>

      {/* And last, what to do — which only makes sense once they know what
          happened and what exists. */}
      {props.partialProfileId !== undefined && (
        <p className="eh-note">
          Event Horizon does not roll back. The partial profile is left in
          place: switch to your previous profile in Vortex to carry on as
          before, or stay on this one and inspect what was installed.
        </p>
      )}

      {/* Only for a stop, and only when something landed: after a crash
          "just run it again" is advice we have not earned, but after a
          deliberate stop it is the actual next step, and the reason it works
          is worth stating — the mods are matched by their Nexus ids and
          archive hashes, so they are recognised rather than re-downloaded. */}
      {props.stopped === true &&
        props.installedSoFar !== undefined &&
        props.installedSoFar > 0 && (
          <p className="eh-note">
            Installing this collection again will pick up where it stopped —
            the {props.installedSoFar} mods already installed are recognised by
            their archive hashes and will not be downloaded twice.
          </p>
        )}
    </div>
  );
}

function Tile(props: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}): JSX.Element {
  return (
    <div
      className="eh-inset"
    >
      <div
        style={{
          color: "var(--eh-text-muted)",
          fontSize: "var(--eh-text-xs)",
          textTransform: "uppercase",
          letterSpacing: "var(--eh-tracking-widest)",
          marginBottom: "var(--eh-sp-1)",
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          color: props.accent ?? "var(--eh-text-primary)",
          fontSize: "var(--eh-text-md)",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          wordBreak: "break-word",
        }}
      >
        {props.value}
      </div>
    </div>
  );
}

function BucketList(props: {
  title: string;
  buckets: Array<{ key: string; count: number }>;
}): JSX.Element {
  return (
    <div>
      <h4
        style={{
          margin: "0 0 var(--eh-sp-2) 0",
          color: "var(--eh-text-secondary)",
          fontSize: "var(--eh-text-xs)",
          textTransform: "uppercase",
          letterSpacing: "var(--eh-tracking-widest)",
        }}
      >
        {props.title}
      </h4>
      <ul
        style={{
          margin: 0,
          paddingLeft: "var(--eh-sp-5)",
          color: "var(--eh-text-secondary)",
          fontSize: "var(--eh-text-sm)",
        }}
      >
        {props.buckets.map((b) => (
          <li key={b.key}>
            <span style={{ fontFamily: "var(--eh-font-mono)" }}>{b.key}</span>{" "}
            — {b.count}
          </li>
        ))}
      </ul>
    </div>
  );
}

function countByKey(
  values: string[],
): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, count]) => ({ key, count }));
}

// avoid unused warnings for re-exported helpers
void buildUserConfirmedDecisions;
void fillDefaultConflictChoices;
void fillDefaultOrphanChoices;
