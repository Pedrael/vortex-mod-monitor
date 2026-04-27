/**
 * ErrorReportModal — the visible face of any error that reaches the
 * UI (whether by `reportError(...)`, by an ErrorBoundary catch, or by
 * an action wrap-and-rethrow).
 *
 * Layout:
 *   - Title (from FormattedError.title)
 *   - Severity pill + class name
 *   - Message paragraph
 *   - Details list (bulleted, only if there are any)
 *   - Hints list ("What to try", green-tinted)
 *   - Collapsible "Technical details" (raw message, context bag,
 *     structured payload, stack trace) — closed by default; testers
 *     and devs open it as needed.
 *   - Footer:
 *       [ Copy report ]  [ Save report... ]    [ Dismiss ]
 *
 * The "Copy report" and "Save report" buttons emit the same plain
 * text bundle (built by `buildErrorReport`) so testers can paste
 * what they captured into Discord / GitHub issues / our triage doc
 * without any formatting drift.
 */

import * as React from "react";

import { Button, Pill } from "../components";
import { Modal } from "../components/Modal";
import { FormattedError, buildErrorReport } from "./formatError";

export interface ErrorReportModalProps {
  open: boolean;
  error: FormattedError | undefined;
  onClose: () => void;
}

export function ErrorReportModal(props: ErrorReportModalProps): JSX.Element {
  const { open, error, onClose } = props;

  const [copyState, setCopyState] = React.useState<"idle" | "ok" | "fail">(
    "idle",
  );
  const [saveState, setSaveState] = React.useState<"idle" | "ok" | "fail">(
    "idle",
  );
  const [techExpanded, setTechExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setCopyState("idle");
      setSaveState("idle");
      setTechExpanded(false);
    }
  }, [open]);

  if (error === undefined) {
    return <Modal open={false} onClose={onClose} />;
  }

  const reportText = buildErrorReport(error);

  const handleCopy = async (): Promise<void> => {
    try {
      await copyToClipboard(reportText);
      setCopyState("ok");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("fail");
      window.setTimeout(() => setCopyState("idle"), 3000);
    }
  };

  const handleSave = async (): Promise<void> => {
    try {
      const saved = await saveReportToFile(error.title, reportText);
      setSaveState(saved ? "ok" : "idle");
      if (saved) {
        window.setTimeout(() => setSaveState("idle"), 2500);
      }
    } catch {
      setSaveState("fail");
      window.setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const copyLabel =
    copyState === "ok"
      ? "Copied!"
      : copyState === "fail"
        ? "Copy failed"
        : "Copy report";
  const saveLabel =
    saveState === "ok"
      ? "Saved!"
      : saveState === "fail"
        ? "Save failed"
        : "Save report...";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={error.title}
      subtitle={`${error.className} · ${error.severity}`}
      footer={
        <>
          <Button
            intent="ghost"
            onClick={(): void => {
              void handleCopy();
            }}
          >
            {copyLabel}
          </Button>
          <Button
            intent="ghost"
            onClick={(): void => {
              void handleSave();
            }}
          >
            {saveLabel}
          </Button>
          <Button intent="primary" onClick={onClose}>
            Dismiss
          </Button>
        </>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--eh-sp-4)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--eh-sp-2)",
            flexWrap: "wrap",
          }}
        >
          <Pill
            intent={error.severity === "warning" ? "warning" : "danger"}
            withDot
          >
            {error.severity}
          </Pill>
          <Pill intent="info">{error.className}</Pill>
        </div>

        <p
          style={{
            color: "var(--eh-text-primary)",
            fontSize: "var(--eh-text-md)",
            lineHeight: "var(--eh-leading-relaxed)",
            margin: 0,
          }}
        >
          {error.message}
        </p>

        {error.details.length > 0 && (
          <Section title="Details">
            <BulletList items={error.details} />
          </Section>
        )}

        {error.hints.length > 0 && (
          <Section title="What to try" intent="success">
            <BulletList items={error.hints} />
          </Section>
        )}

        <Section title="Technical details" collapsible>
          {techExpanded ? (
            <TechnicalPanel error={error} reportText={reportText} />
          ) : (
            <button
              type="button"
              className="eh-button eh-button--ghost eh-button--sm"
              onClick={(): void => setTechExpanded(true)}
              style={{ marginTop: "var(--eh-sp-2)" }}
            >
              Show stack trace + context
            </button>
          )}
        </Section>
      </div>
    </Modal>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function Section(props: {
  title: string;
  intent?: "default" | "success";
  collapsible?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  const titleColor =
    props.intent === "success"
      ? "var(--eh-success)"
      : "var(--eh-text-secondary)";
  return (
    <section>
      <h4
        style={{
          fontSize: "var(--eh-text-xs)",
          fontWeight: 700,
          color: titleColor,
          letterSpacing: "var(--eh-tracking-widest)",
          textTransform: "uppercase",
          margin: "0 0 var(--eh-sp-2) 0",
        }}
      >
        {props.title}
      </h4>
      {props.children}
    </section>
  );
}

function BulletList(props: { items: string[] }): JSX.Element {
  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: "var(--eh-sp-5)",
        color: "var(--eh-text-secondary)",
        fontSize: "var(--eh-text-sm)",
        lineHeight: "var(--eh-leading-relaxed)",
      }}
    >
      {props.items.map((item, idx) => (
        <li key={idx} style={{ marginBottom: "var(--eh-sp-1)" }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function TechnicalPanel(props: {
  error: FormattedError;
  reportText: string;
}): JSX.Element {
  const { error, reportText } = props;
  return (
    <pre
      style={{
        margin: 0,
        padding: "var(--eh-sp-3)",
        background: "var(--eh-bg-deep)",
        border: "1px solid var(--eh-border-subtle)",
        borderRadius: "var(--eh-radius-sm)",
        color: "var(--eh-text-secondary)",
        fontSize: "var(--eh-text-xs)",
        fontFamily: "var(--eh-font-mono)",
        lineHeight: "var(--eh-leading-snug)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        maxHeight: "320px",
        overflow: "auto",
      }}
      title={`${error.className}: ${error.rawMessage}`}
    >
      {reportText}
    </pre>
  );
}

// ===========================================================================
// Clipboard + file IO
// ===========================================================================

interface MinimalElectronClipboard {
  writeText: (s: string) => void;
}
interface MinimalElectronDialog {
  showSaveDialog: (
    opts: Record<string, unknown>,
  ) => Promise<{ canceled: boolean; filePath?: string }>;
}
interface MinimalElectronModule {
  clipboard?: MinimalElectronClipboard;
  remote?: { dialog?: MinimalElectronDialog };
  dialog?: MinimalElectronDialog;
}

function tryRequireElectron(): MinimalElectronModule | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("electron") as MinimalElectronModule;
  } catch {
    return undefined;
  }
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const electron = tryRequireElectron();
  const clipboard = electron?.clipboard;
  if (clipboard?.writeText) {
    clipboard.writeText(text);
    return;
  }
  throw new Error("No clipboard API available");
}

async function saveReportToFile(
  title: string,
  text: string,
): Promise<boolean> {
  const electron = tryRequireElectron();
  if (!electron) {
    throw new Error("Electron module not available");
  }
  const dialog = electron.remote?.dialog ?? electron.dialog;
  if (!dialog?.showSaveDialog) {
    throw new Error("Electron dialog API not available");
  }

  const sanitized = title
    .replace(/[<>:"\\/|?*\x00-\x1f]/g, "_")
    .slice(0, 80)
    .trim();
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const defaultPath = `event-horizon-error-${stamp}-${sanitized}.txt`;

  const result = await dialog.showSaveDialog({
    title: "Save Event Horizon error report",
    defaultPath,
    filters: [
      { name: "Text file", extensions: ["txt"] },
      { name: "All files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePath) return false;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fsp = require("fs/promises") as typeof import("fs/promises");
  await fsp.writeFile(result.filePath, text, { encoding: "utf-8" });
  return true;
}
