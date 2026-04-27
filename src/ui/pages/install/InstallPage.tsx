/**
 * InstallPage — root component for the install wizard route.
 *
 * Owns the wizard reducer state, runs the side-effect engine
 * (read package, hash mods, resolve plan, drive installer), and
 * renders the correct step component based on state.kind.
 *
 * Side-effect contract:
 *   - Effects are tied to specific `state.kind` values via `useEffect`.
 *   - Each effect uses an "alive" ref that the cleanup function flips
 *     to false; async results check the flag before dispatching so we
 *     never set state on an unmounted component.
 *   - Errors caught inside effects are routed through `reportError`
 *     (which opens the global modal) AND a `set-error` action so the
 *     wizard renders an inline retry option.
 */

import * as React from "react";

import { runInstall } from "../../../core/installer/runInstall";
import { Button, Card } from "../../components";
import {
  ErrorBoundary,
  useErrorReporter,
  useErrorReporterFormatted,
} from "../../errors";
import { useApi } from "../../state";
import {
  ConfirmStep,
  DecisionsStep,
  DoneStep,
  InstallingStep,
  LoadingStep,
  PickStep,
  PreviewStep,
  StaleReceiptStep,
} from "./steps";
import {
  runLoadingPipeline,
  runLoadingPipelineWithReceipt,
} from "./engine";
import {
  WizardState,
  fillDefaultConflictChoices,
  fillDefaultOrphanChoices,
  initialWizardState,
  wizardReducer,
} from "./state";
import type { EventHorizonRoute } from "../../routes";
import { formatError } from "../../errors";

export interface InstallPageProps {
  onNavigate: (route: EventHorizonRoute) => void;
}

export function InstallPage(props: InstallPageProps): JSX.Element {
  const reportFormatted = useErrorReporterFormatted();
  return (
    <ErrorBoundary
      where="InstallPage"
      variant="page"
      onReport={reportFormatted}
    >
      <InstallWizard onNavigate={props.onNavigate} />
    </ErrorBoundary>
  );
}

function InstallWizard(props: InstallPageProps): JSX.Element {
  const api = useApi();
  const reportError = useErrorReporter();
  const [state, dispatch] = React.useReducer(
    wizardReducer,
    initialWizardState,
  );

  // Active AbortController for the in-flight loading pipeline.
  // Stored in a ref so the LoadingStep's Cancel button can reach it
  // without prop-drilling through the reducer state.
  const loadAbortRef = React.useRef<AbortController | undefined>(undefined);

  const handleCancelLoading = React.useCallback((): void => {
    loadAbortRef.current?.abort();
  }, []);

  // Always abort any in-flight load when the page unmounts.
  React.useEffect(() => {
    return () => {
      loadAbortRef.current?.abort();
    };
  }, []);

  // ── Effect: loading pipeline ───────────────────────────────────────
  React.useEffect(() => {
    if (state.kind !== "loading") return;
    let alive = true;
    const controller = new AbortController();
    loadAbortRef.current = controller;

    void (async (): Promise<void> => {
      try {
        const outcome = await runLoadingPipeline({
          api,
          zipPath: state.zipPath,
          signal: controller.signal,
          events: {
            onPhase: (phase, hashCount): void => {
              if (!alive) return;
              dispatch({ type: "loading-phase", phase, hashCount });
            },
            onHashProgress: (done, total, currentItem): void => {
              if (!alive) return;
              dispatch({
                type: "hash-progress",
                done,
                total,
                currentItem,
              });
            },
          },
        });
        if (!alive) return;

        if (outcome.kind === "stale-receipt") {
          dispatch({
            type: "needs-stale-resolution",
            zipPath: state.zipPath,
            ehcoll: outcome.ehcoll,
            receipt: outcome.receipt,
            appDataPath: outcome.appDataPath,
          });
          return;
        }

        dispatch({
          type: "plan-ready",
          bundle: {
            zipPath: state.zipPath,
            ehcoll: outcome.ehcoll,
            receipt: outcome.receipt,
            plan: outcome.plan,
            appDataPath: outcome.appDataPath,
          },
        });
      } catch (err) {
        if (!alive) return;
        // User-initiated cancel: bounce back to the picker silently
        // instead of opening the error modal.
        if (isAbortError(err)) {
          dispatch({ type: "reset" });
          return;
        }
        const formatted = formatError(err, {
          title: "Couldn't prepare the install",
          context: { step: "loading", zipPath: state.zipPath },
        });
        reportError(err, {
          title: formatted.title,
          context: { step: "loading", zipPath: state.zipPath },
        });
        dispatch({ type: "set-error", error: formatted });
      }
    })();

    return (): void => {
      alive = false;
      loadAbortRef.current = undefined;
    };
    // We only care about state.kind changing into 'loading' — re-running
    // when zipPath changes is impossible because zipPath only exists
    // inside the 'loading' branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind === "loading" ? state.zipPath : undefined]);

  // ── Effect: installer ──────────────────────────────────────────────
  React.useEffect(() => {
    if (state.kind !== "installing") return;
    let alive = true;

    void (async (): Promise<void> => {
      try {
        const result = await runInstall({
          api,
          plan: state.bundle.plan,
          ehcoll: state.bundle.ehcoll,
          ehcollZipPath: state.bundle.zipPath,
          appDataPath: state.bundle.appDataPath,
          decisions: state.decisions,
          onProgress: (progress): void => {
            if (!alive) return;
            dispatch({ type: "install-progress", progress });
          },
        });
        if (!alive) return;
        dispatch({ type: "install-result", result });
      } catch (err) {
        if (!alive) return;
        const formatted = formatError(err, {
          title: "Install driver crashed",
          context: {
            step: "installing",
            packageId: state.bundle.plan.manifest.package.id,
          },
        });
        reportError(err, {
          title: formatted.title,
          context: {
            step: "installing",
            packageId: state.bundle.plan.manifest.package.id,
          },
        });
        dispatch({ type: "set-error", error: formatted });
      }
    })();

    return (): void => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind === "installing" ? state.bundle.plan.manifest.package.id : undefined]);

  // ── Render ─────────────────────────────────────────────────────────
  switch (state.kind) {
    case "pick":
      return (
        <PickStep
          onPick={(zipPath): void =>
            dispatch({ type: "pick-file", zipPath })
          }
        />
      );

    case "loading":
      return (
        <LoadingStep
          phase={state.phase}
          hashCount={state.hashCount}
          hashDone={state.hashDone}
          hashCurrent={state.hashCurrent}
          onCancel={handleCancelLoading}
        />
      );

    case "stale-receipt":
      return (
        <StaleReceiptStep
          state={state}
          onResolved={(resolution): void => {
            if (resolution === "cancel") {
              dispatch({ type: "reset" });
              return;
            }
            // Both "delete" and "keep" need to re-run the second half
            // of the loading pipeline. We send the wizard back into
            // loading with an explicit receipt choice.
            void runResumeAfterStaleResolution({
              api,
              state,
              keepReceipt: resolution === "keep",
              dispatch,
              reportError,
            });
          }}
        />
      );

    case "preview":
      return (
        <PreviewStep
          bundle={state.bundle}
          onContinue={(): void => {
            dispatch({
              type: "open-decisions",
              bundle: state.bundle,
              conflictChoices: {},
              orphanChoices: {},
            });
          }}
          onCancel={(): void => dispatch({ type: "reset" })}
        />
      );

    case "decisions":
      return (
        <DecisionsStep
          state={state}
          dispatch={dispatch}
          onContinue={(): void => {
            const filledConflicts = fillDefaultConflictChoices(
              state.bundle,
              state.conflictChoices,
            );
            const filledOrphans = fillDefaultOrphanChoices(
              state.bundle,
              state.orphanChoices,
            );
            dispatch({
              type: "open-confirm",
              decisions: {
                conflictChoices: filledConflicts,
                orphanChoices: filledOrphans,
              },
            });
          }}
        />
      );

    case "confirm":
      return (
        <ConfirmStep
          state={state}
          onInstall={(): void => dispatch({ type: "start-install" })}
          onBack={(): void => dispatch({ type: "back-from-confirm" })}
        />
      );

    case "installing":
      return <InstallingStep state={state} />;

    case "done":
      return (
        <DoneStep
          result={state.result}
          bundle={state.bundle}
          onStartOver={(): void => dispatch({ type: "reset" })}
          onGoCollections={(): void => props.onNavigate("collections")}
        />
      );

    case "error":
      return (
        <ErrorRetry
          state={state}
          onRetry={(): void => dispatch({ type: "reset" })}
        />
      );

    default: {
      const exhaustive: never = state;
      void exhaustive;
      return <PickStep onPick={(): void => undefined} />;
    }
  }
}

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * True for AbortController-originated cancellations. Distinguishes
 * user cancel (silent reset) from genuine pipeline failures (error
 * modal). Mirrors the same helper in BuildPage.
 */
function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    const message = err.message ?? "";
    if (message.toLowerCase().includes("cancelled")) return true;
  }
  return false;
}

// ===========================================================================
// Resume-after-stale helper
// ===========================================================================

async function runResumeAfterStaleResolution(args: {
  api: ReturnType<typeof useApi>;
  state: Extract<WizardState, { kind: "stale-receipt" }>;
  keepReceipt: boolean;
  dispatch: React.Dispatch<import("./state").WizardAction>;
  reportError: ReturnType<typeof useErrorReporter>;
}): Promise<void> {
  const { api, state, keepReceipt, dispatch, reportError } = args;
  // Move back to 'loading' visually — we'll skip reading-package since
  // we already have it.
  dispatch({
    type: "pick-file",
    zipPath: state.zipPath,
  });
  try {
    const outcome = await runLoadingPipelineWithReceipt({
      api,
      zipPath: state.zipPath,
      ehcoll: state.ehcoll,
      receipt: keepReceipt ? state.receipt : undefined,
      appDataPath: state.appDataPath,
      events: {
        onPhase: (phase, hashCount): void => {
          dispatch({ type: "loading-phase", phase, hashCount });
        },
        onHashProgress: (done, total, currentItem): void => {
          dispatch({
            type: "hash-progress",
            done,
            total,
            currentItem,
          });
        },
      },
    });
    dispatch({
      type: "plan-ready",
      bundle: {
        zipPath: state.zipPath,
        ehcoll: outcome.ehcoll,
        receipt: outcome.receipt,
        plan: outcome.plan,
        appDataPath: outcome.appDataPath,
      },
    });
  } catch (err) {
    if (isAbortError(err)) {
      dispatch({ type: "reset" });
      return;
    }
    const formatted = formatError(err, {
      title: "Couldn't prepare the install",
      context: {
        step: "stale-resume",
        zipPath: state.zipPath,
      },
    });
    reportError(err, {
      title: formatted.title,
      context: {
        step: "stale-resume",
        zipPath: state.zipPath,
      },
    });
    dispatch({ type: "set-error", error: formatted });
  }
}

// ===========================================================================
// Error-recovery view
// ===========================================================================

function ErrorRetry(props: {
  state: Extract<WizardState, { kind: "error" }>;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div className="eh-page" key="error">
      <Card title={props.state.error.title}>
        <p
          style={{
            margin: 0,
            color: "var(--eh-text-secondary)",
            fontSize: "var(--eh-text-sm)",
            lineHeight: "var(--eh-leading-relaxed)",
          }}
        >
          {props.state.error.message}
        </p>
        <p
          style={{
            margin: "var(--eh-sp-3) 0 0 0",
            color: "var(--eh-text-muted)",
            fontSize: "var(--eh-text-xs)",
          }}
        >
          The full report is open in the error panel — copy or save it before retrying.
        </p>
        <div style={{ marginTop: "var(--eh-sp-4)" }}>
          <Button intent="primary" onClick={props.onRetry}>
            Start over
          </Button>
        </div>
      </Card>
    </div>
  );
}
