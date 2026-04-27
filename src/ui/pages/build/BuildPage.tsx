/**
 * BuildPage — Phase 5.3.
 *
 * The curator-side React UI. Drives the full build pipeline:
 *   1. Loading: read state, hash mods, load (or create) collection config.
 *   2. Form: metadata + per-mod overrides + README / CHANGELOG editors.
 *   3. Building: run the manifest + package pipeline with progress.
 *   4. Done: success card with "Open package" / "Open folder" actions.
 *
 * The page never duplicates logic from `engine.ts` — it just renders
 * the result and dispatches user input.
 */

import * as React from "react";

import {
  Button,
  Card,
  Pill,
  ProgressRing,
  StepDots,
  useToast,
} from "../../components";
import { ErrorBoundary, useErrorReporter, useErrorReporterFormatted } from "../../errors";
import type { EventHorizonRoute } from "../../routes";
import { useApi } from "../../state";
import {
  loadBuildContext,
  runBuildPipeline,
  validateCuratorInput,
  type BuildContext,
  type BuildPipelineResult,
  type BuildProgress,
  type CuratorInput,
} from "./engine";
import type { ExternalModConfigEntry } from "../../../core/manifest/collectionConfig";

export interface BuildPageProps {
  onNavigate: (route: EventHorizonRoute) => void;
}

// ===========================================================================
// State machine
// ===========================================================================

type BuildPageState =
  | { kind: "loading"; phase?: BuildProgress }
  | {
      kind: "form";
      ctx: BuildContext;
      curator: CuratorInput;
      overrides: Record<string, ExternalModConfigEntry>;
      readme: string;
      changelog: string;
      validationError?: string;
    }
  | {
      kind: "building";
      ctx: BuildContext;
      curator: CuratorInput;
      progress: BuildProgress;
    }
  | {
      kind: "done";
      result: BuildPipelineResult;
      ctx: BuildContext;
      curator: CuratorInput;
    }
  | {
      kind: "error";
      previous: BuildPageState | undefined;
    };

// ===========================================================================
// Page
// ===========================================================================

export function BuildPage(props: BuildPageProps): JSX.Element {
  const reportFormatted = useErrorReporterFormatted();
  return (
    <ErrorBoundary
      where="BuildPage"
      variant="page"
      onReport={reportFormatted}
    >
      <BuildWizard onNavigate={props.onNavigate} />
    </ErrorBoundary>
  );
}

function BuildWizard(props: BuildPageProps): JSX.Element {
  const api = useApi();
  const reportError = useErrorReporter();
  const showToast = useToast();
  const [state, setState] = React.useState<BuildPageState>({
    kind: "loading",
  });

  // ── Initial load ─────────────────────────────────────────────────────
  React.useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const ctx = await loadBuildContext(api, {
          onProgress: (p) => {
            if (!alive) return;
            setState({ kind: "loading", phase: p });
          },
        });
        if (!alive) return;
        setState({
          kind: "form",
          ctx,
          curator: {
            name: ctx.defaultName,
            version: ctx.defaultVersion,
            author: ctx.defaultAuthor,
            description: "",
          },
          overrides: { ...ctx.collectionConfig.externalMods },
          readme: ctx.collectionConfig.readme ?? "",
          changelog: ctx.collectionConfig.changelog ?? "",
        });
      } catch (err) {
        if (!alive) return;
        reportError(err, {
          title: "Couldn't prepare build context",
          context: { step: "load-build-context" },
        });
        setState({ kind: "error", previous: undefined });
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, reportError]);

  // ── Step indicator (match the wizard order) ──────────────────────────
  const stepIndex =
    state.kind === "loading"
      ? 0
      : state.kind === "form"
      ? 1
      : state.kind === "building"
      ? 2
      : 3;
  const stepLabels = ["Loading", "Form", "Building", "Done"];

  // ── Render ────────────────────────────────────────────────────────────
  if (state.kind === "loading") {
    return (
      <div className="eh-page">
        <Header stepIndex={stepIndex} stepLabel={stepLabels[stepIndex]} />
        <LoadingPanel progress={state.phase} />
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="eh-page">
        <Header stepIndex={stepIndex} stepLabel="Error" />
        <ErrorPanel onRetry={() => setState({ kind: "loading" })} />
      </div>
    );
  }
  if (state.kind === "building") {
    return (
      <div className="eh-page">
        <Header stepIndex={stepIndex} stepLabel={stepLabels[stepIndex]} />
        <BuildingPanel progress={state.progress} curator={state.curator} />
      </div>
    );
  }
  if (state.kind === "done") {
    return (
      <div className="eh-page">
        <Header stepIndex={stepIndex} stepLabel={stepLabels[stepIndex]} />
        <DonePanel
          result={state.result}
          onBuildAnother={() => setState({ kind: "loading" })}
          onGoHome={() => props.onNavigate("home")}
        />
      </div>
    );
  }

  const formState = state;
  const handleChange = (
    next: Partial<BuildPageState & { kind: "form" }>,
  ): void => {
    setState({ ...formState, ...next, validationError: undefined });
  };

  const onBuild = async (): Promise<void> => {
    const validationError = validateCuratorInput(formState.curator);
    if (validationError !== undefined) {
      setState({ ...formState, validationError });
      return;
    }
    setState({
      kind: "building",
      ctx: formState.ctx,
      curator: formState.curator,
      progress: { phase: "writing-config" },
    });
    try {
      const result = await runBuildPipeline(
        api,
        formState.ctx,
        formState.curator,
        {
          externalMods: formState.overrides,
          readme: formState.readme,
          changelog: formState.changelog,
        },
        {
          onProgress: (p) =>
            setState({
              kind: "building",
              ctx: formState.ctx,
              curator: formState.curator,
              progress: p,
            }),
        },
      );
      showToast({
        intent: "success",
        title: `Built ${formState.curator.name} v${formState.curator.version}`,
        message: `${result.modCount} mods, ${formatBytes(result.outputBytes)}.`,
      });
      setState({
        kind: "done",
        result,
        ctx: formState.ctx,
        curator: formState.curator,
      });
    } catch (err) {
      reportError(err, {
        title: "Build failed",
        context: { step: "run-build-pipeline" },
      });
      setState({ kind: "error", previous: formState });
    }
  };

  return (
    <div className="eh-page">
      <Header stepIndex={stepIndex} stepLabel={stepLabels[stepIndex]} />
      <FormPanel
        state={formState}
        onChange={handleChange}
        onBuild={() => {
          void onBuild();
        }}
      />
    </div>
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
        <StepDots total={4} current={props.stepIndex} />
        <span
          style={{
            color: "var(--eh-text-muted)",
            fontSize: "var(--eh-text-xs)",
            textTransform: "uppercase",
            letterSpacing: "var(--eh-tracking-widest)",
          }}
        >
          Step {props.stepIndex + 1} / 4 · {props.stepLabel}
        </span>
      </div>
    </header>
  );
}

// ===========================================================================
// Loading
// ===========================================================================

function LoadingPanel(props: { progress?: BuildProgress }): JSX.Element {
  const phaseLabel = phaseToLabel(props.progress?.phase);
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
        <div>
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
      </div>
    </Card>
  );
}

// ===========================================================================
// Form
// ===========================================================================

interface FormPanelProps {
  state: Extract<BuildPageState, { kind: "form" }>;
  onChange: (next: Partial<Extract<BuildPageState, { kind: "form" }>>) => void;
  onBuild: () => void;
}

function FormPanel(props: FormPanelProps): JSX.Element {
  const { state, onChange, onBuild } = props;
  const { ctx, curator, overrides, readme, changelog, validationError } = state;

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
      <Card title="Collection metadata">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--eh-sp-3)",
          }}
        >
          <Field label="Name" hint="Curator-facing display name.">
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
        <Button intent="primary" size="lg" onClick={onBuild}>
          Build .ehcoll
        </Button>
      </div>
    </div>
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
}): JSX.Element {
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

function phaseToLabel(phase: BuildProgress["phase"] | undefined): string | undefined {
  switch (phase) {
    case "hashing-mods":
      return "Hashing mod archives...";
    case "capturing-deployment":
      return "Capturing deployment manifests...";
    case "capturing-load-order":
      return "Capturing load order...";
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
