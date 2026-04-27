/**
 * CollectionsPage — Phase 5.2.
 *
 * Lists every install receipt under
 * `<appData>/Vortex/event-horizon/installs/*.json` so the user has a
 * single place to:
 *
 *   - See "what did Event Horizon install on this machine?"
 *   - Switch to the Vortex profile that holds a given collection.
 *   - Inspect the per-mod records the receipt holds.
 *   - Uninstall (remove all recorded mods + delete the receipt).
 *
 * The page never edits a receipt directly — it only reads, deletes,
 * and acts on profiles. Receipts are written exclusively by the
 * install driver.
 */

import * as React from "react";
import { util } from "vortex-api";

import {
  deleteReceipt,
  listReceipts,
} from "../../core/installLedger";
import { uninstallMod } from "../../core/installer/modInstall";
import { switchToProfile } from "../../core/installer/profile";
import type { InstallReceipt } from "../../types/installLedger";
import {
  Button,
  Card,
  EventHorizonLogo,
  Modal,
  Pill,
  ProgressRing,
  useToast,
} from "../components";
import { ErrorBoundary, useErrorReporter, useErrorReporterFormatted } from "../errors";
import type { EventHorizonRoute } from "../routes";
import { useApi } from "../state";
import { EXTENSION_VERSION } from "../version";

export interface CollectionsPageProps {
  onNavigate: (route: EventHorizonRoute) => void;
}

interface LoadedState {
  kind: "loaded";
  receipts: InstallReceipt[];
  errors: Array<{ filename: string; message: string }>;
}

type PageState =
  | { kind: "loading" }
  | LoadedState
  | { kind: "empty" };

export function CollectionsPage(props: CollectionsPageProps): JSX.Element {
  const reportFormatted = useErrorReporterFormatted();
  return (
    <ErrorBoundary
      where="CollectionsPage"
      variant="page"
      onReport={reportFormatted}
    >
      <CollectionsList onNavigate={props.onNavigate} />
    </ErrorBoundary>
  );
}

type SortKey = "recent" | "name" | "mods";

function CollectionsList(props: CollectionsPageProps): JSX.Element {
  const reportError = useErrorReporter();
  const showToast = useToast();
  const api = useApi();

  const [state, setState] = React.useState<PageState>({ kind: "loading" });
  const [selected, setSelected] = React.useState<InstallReceipt | undefined>(
    undefined,
  );
  const [refreshTick, setRefreshTick] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("recent");

  const refresh = React.useCallback((): void => {
    setRefreshTick((t) => t + 1);
  }, []);

  React.useEffect(() => {
    let alive = true;
    void (async (): Promise<void> => {
      setState({ kind: "loading" });
      try {
        const errors: Array<{ filename: string; message: string }> = [];
        const appData = util.getVortexPath("appData");
        const receipts = await listReceipts(appData, (filename, err) => {
          errors.push({ filename, message: err.message });
        });
        if (!alive) return;
        if (receipts.length === 0 && errors.length === 0) {
          setState({ kind: "empty" });
        } else {
          setState({ kind: "loaded", receipts, errors });
        }
      } catch (err) {
        if (!alive) return;
        reportError(err, {
          title: "Couldn't list installed collections",
          context: { step: "collections-list" },
        });
        setState({ kind: "loaded", receipts: [], errors: [] });
      }
    })();
    return (): void => {
      alive = false;
    };
  }, [refreshTick, reportError]);

  const activeProfileId =
    api.getState().settings?.profiles?.activeProfileId;

  // Apply search + sort to the loaded receipts. Memoised because the
  // grid below re-renders on every keystroke into the search box.
  const visibleReceipts = React.useMemo<InstallReceipt[]>(() => {
    if (state.kind !== "loaded") return [];
    const q = query.trim().toLowerCase();
    const filtered =
      q.length === 0
        ? state.receipts
        : state.receipts.filter((r) =>
            // Match name OR game id OR profile name. Searching by
            // profile name lets users find "the collection in <Skyrim
            // playthrough X>" without remembering its title.
            [r.packageName, r.gameId, r.vortexProfileName]
              .some((s) => s.toLowerCase().includes(q)),
          );
    const out = [...filtered];
    switch (sortKey) {
      case "recent":
        out.sort(
          (a, b) =>
            new Date(b.installedAt).getTime() -
            new Date(a.installedAt).getTime(),
        );
        break;
      case "name":
        out.sort((a, b) =>
          a.packageName.localeCompare(b.packageName, undefined, {
            sensitivity: "base",
          }),
        );
        break;
      case "mods":
        out.sort((a, b) => b.mods.length - a.mods.length);
        break;
    }
    return out;
  }, [state, query, sortKey]);

  if (state.kind === "loading") {
    return (
      <div className="eh-page">
        <header style={{ marginBottom: "var(--eh-sp-5)" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--eh-text-2xl)",
              color: "var(--eh-text-primary)",
            }}
          >
            Loading installed collections...
          </h2>
        </header>
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
          <ProgressRing size={56} />
          <span style={{ color: "var(--eh-text-secondary)" }}>
            Scanning %APPDATA%/Vortex/event-horizon/installs/
          </span>
        </div>
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div className="eh-page">
        <EmptyState onInstall={(): void => props.onNavigate("install")} />
      </div>
    );
  }

  return (
    <div className="eh-page">
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
            Installed collections
          </h2>
          <p
            style={{
              margin: "var(--eh-sp-2) 0 0 0",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-md)",
            }}
          >
            {state.receipts.length} collection{state.receipts.length === 1 ? "" : "s"} on this machine
            {query.trim().length > 0 &&
              ` · showing ${visibleReceipts.length}`}
            .
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--eh-sp-2)" }}>
          <Button intent="ghost" onClick={refresh}>
            Refresh
          </Button>
          <Button
            intent="primary"
            onClick={(): void => props.onNavigate("install")}
          >
            Install another
          </Button>
        </div>
      </header>

      {state.receipts.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "var(--eh-sp-2)",
            marginBottom: "var(--eh-sp-4)",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e): void => setQuery(e.target.value)}
            placeholder="Search by name, game, or profile..."
            aria-label="Filter installed collections"
            style={{
              flex: "1 1 240px",
              minWidth: 0,
              padding: "var(--eh-sp-2) var(--eh-sp-3)",
              background: "var(--eh-bg-base)",
              border: "1px solid var(--eh-border-default)",
              borderRadius: "var(--eh-radius-sm)",
              color: "var(--eh-text-primary)",
              fontSize: "var(--eh-text-sm)",
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--eh-sp-2)",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            <span>Sort:</span>
            <select
              value={sortKey}
              onChange={(e): void => setSortKey(e.target.value as SortKey)}
              aria-label="Sort installed collections"
              style={{
                padding: "var(--eh-sp-2) var(--eh-sp-3)",
                background: "var(--eh-bg-base)",
                border: "1px solid var(--eh-border-default)",
                borderRadius: "var(--eh-radius-sm)",
                color: "var(--eh-text-primary)",
                fontSize: "var(--eh-text-sm)",
                fontFamily: "inherit",
              }}
            >
              <option value="recent">Most recent</option>
              <option value="name">Name (A → Z)</option>
              <option value="mods">Mod count (high → low)</option>
            </select>
          </label>
        </div>
      )}

      {state.errors.length > 0 && (
        <div
          style={{
            marginBottom: "var(--eh-sp-4)",
            padding: "var(--eh-sp-3) var(--eh-sp-4)",
            background: "rgba(255, 91, 120, 0.08)",
            border: "1px solid var(--eh-danger)",
            borderRadius: "var(--eh-radius-md)",
            color: "var(--eh-danger)",
          }}
        >
          <strong>{state.errors.length} receipt{state.errors.length === 1 ? "" : "s"} failed to load.</strong>
          <ul
            style={{
              margin: "var(--eh-sp-2) 0 0 0",
              paddingLeft: "var(--eh-sp-5)",
              color: "var(--eh-text-secondary)",
              fontSize: "var(--eh-text-sm)",
            }}
          >
            {state.errors.slice(0, 5).map((e) => (
              <li key={e.filename}>
                {e.filename}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {visibleReceipts.length === 0 && state.receipts.length > 0 ? (
        <div
          style={{
            padding: "var(--eh-sp-6)",
            background: "var(--eh-bg-elevated)",
            border: "1px dashed var(--eh-border-default)",
            borderRadius: "var(--eh-radius-md)",
            textAlign: "center",
            color: "var(--eh-text-secondary)",
          }}
        >
          No collections match{" "}
          <strong style={{ color: "var(--eh-text-primary)" }}>
            &quot;{query}&quot;
          </strong>
          .{" "}
          <Button intent="ghost" onClick={(): void => setQuery("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "var(--eh-sp-4)",
          }}
        >
          {visibleReceipts.map((receipt) => (
            <ReceiptCard
              key={receipt.packageId}
              receipt={receipt}
              isActive={receipt.vortexProfileId === activeProfileId}
              onOpen={(): void => setSelected(receipt)}
            />
          ))}
        </div>
      )}

      <ReceiptDetailModal
        receipt={selected}
        onClose={(): void => setSelected(undefined)}
        onUninstalled={(): void => {
          setSelected(undefined);
          showToast({
            intent: "success",
            message: "Collection uninstalled. Receipt deleted.",
          });
          refresh();
        }}
      />
    </div>
  );
}

// ===========================================================================
// Empty state
// ===========================================================================

function EmptyState(props: { onInstall: () => void }): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--eh-sp-4)",
        padding: "var(--eh-sp-7) var(--eh-sp-5)",
        background: "var(--eh-bg-glass)",
        border: "1px dashed var(--eh-border-default)",
        borderRadius: "var(--eh-radius-lg)",
        textAlign: "center",
        animation:
          "eh-fade-up var(--eh-dur-deliberate) var(--eh-easing) both",
      }}
    >
      <EventHorizonLogo size={88} />
      <h2
        style={{
          margin: 0,
          color: "var(--eh-text-primary)",
          fontSize: "var(--eh-text-xl)",
        }}
      >
        No collections yet
      </h2>
      <p
        style={{
          margin: 0,
          color: "var(--eh-text-secondary)",
          maxWidth: "440px",
          fontSize: "var(--eh-text-sm)",
          lineHeight: "var(--eh-leading-relaxed)",
        }}
      >
        Install your first .ehcoll collection and Event Horizon will keep a
        receipt here so you can switch profiles, inspect the mod list, or
        uninstall in a single click.
      </p>
      <Button intent="primary" onClick={props.onInstall}>
        Install a collection
      </Button>
    </div>
  );
}

// ===========================================================================
// Card
// ===========================================================================

function ReceiptCard(props: {
  receipt: InstallReceipt;
  isActive: boolean;
  onOpen: () => void;
}): JSX.Element {
  const { receipt, isActive, onOpen } = props;
  return (
    <Card
      onClick={onOpen}
      title={receipt.packageName}
      footer={
        <span style={{ color: "var(--eh-text-muted)" }}>
          installed {new Date(receipt.installedAt).toLocaleDateString()}
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
          <Pill intent="info">v{receipt.packageVersion}</Pill>
          <Pill intent="neutral">{receipt.gameId}</Pill>
          {receipt.installTargetMode === "fresh-profile" ? (
            <Pill intent="info">fresh profile</Pill>
          ) : (
            <Pill intent="warning">current profile</Pill>
          )}
          {isActive && (
            <Pill intent="success" withDot>
              active
            </Pill>
          )}
        </div>
        <div>
          <strong>Profile:</strong> {receipt.vortexProfileName}
        </div>
        <div>
          <strong>Mods:</strong> {receipt.mods.length}
        </div>
      </div>
    </Card>
  );
}

// ===========================================================================
// Detail modal
// ===========================================================================

function ReceiptDetailModal(props: {
  receipt: InstallReceipt | undefined;
  onClose: () => void;
  onUninstalled: () => void;
}): JSX.Element {
  const { receipt, onClose, onUninstalled } = props;
  const api = useApi();
  const reportError = useErrorReporter();
  const showToast = useToast();

  const [busy, setBusy] = React.useState(false);
  const [confirmingUninstall, setConfirmingUninstall] = React.useState(false);
  const [progress, setProgress] = React.useState<{
    current: number;
    total: number;
  } | null>(null);

  const handleExportDiagnostic = async (): Promise<void> => {
    if (receipt === undefined) return;
    setBusy(true);
    try {
      const saved = await saveDiagnosticReport(receipt);
      if (saved) {
        showToast({
          intent: "success",
          message: "Diagnostic saved.",
        });
      }
    } catch (err) {
      reportError(err, {
        title: "Couldn't export diagnostic",
        context: {
          step: "export-diagnostic",
          packageId: receipt.packageId,
        },
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchProfile = async (): Promise<void> => {
    if (receipt === undefined) return;
    setBusy(true);
    try {
      await switchToProfile(api, receipt.vortexProfileId);
      showToast({
        intent: "success",
        message: `Switched to profile "${receipt.vortexProfileName}".`,
      });
      onClose();
    } catch (err) {
      reportError(err, {
        title: "Couldn't switch profile",
        context: {
          step: "switch-profile",
          profileId: receipt.vortexProfileId,
        },
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUninstall = async (): Promise<void> => {
    if (receipt === undefined) return;
    setBusy(true);
    setProgress({ current: 0, total: receipt.mods.length });
    try {
      let i = 0;
      for (const mod of receipt.mods) {
        i += 1;
        setProgress({ current: i, total: receipt.mods.length });
        try {
          await uninstallMod(api, {
            gameId: receipt.gameId,
            modId: mod.vortexModId,
          });
        } catch (err) {
          // Continue removing the rest — log per-mod failures, finalize
          // by reporting once at the end.
          // eslint-disable-next-line no-console
          console.warn(
            `[Event Horizon] Failed to uninstall ${mod.name} (${mod.vortexModId}):`,
            err,
          );
        }
      }
      const appData = util.getVortexPath("appData");
      await deleteReceipt(appData, receipt.packageId);
      onUninstalled();
    } catch (err) {
      reportError(err, {
        title: "Uninstall partially failed",
        context: {
          step: "uninstall",
          packageId: receipt.packageId,
        },
      });
    } finally {
      setBusy(false);
      setProgress(null);
      setConfirmingUninstall(false);
    }
  };

  return (
    <Modal
      open={receipt !== undefined}
      onClose={(): void => {
        if (busy) return;
        onClose();
      }}
      size="lg"
      title={receipt?.packageName ?? ""}
      subtitle={
        receipt !== undefined
          ? `v${receipt.packageVersion} · ${receipt.gameId}`
          : undefined
      }
      footer={
        receipt !== undefined && (
          <>
            <Button
              intent="danger"
              disabled={busy}
              onClick={(): void => setConfirmingUninstall(true)}
            >
              Uninstall
            </Button>
            <Button
              intent="ghost"
              disabled={busy}
              onClick={(): void => {
                void handleSwitchProfile();
              }}
            >
              Switch to profile
            </Button>
            <Button
              intent="ghost"
              disabled={busy}
              onClick={(): void => {
                void handleExportDiagnostic();
              }}
              title="Save a JSON diagnostic with this receipt + version metadata. Useful to attach to bug reports."
            >
              Export diagnostic
            </Button>
            <Button intent="primary" onClick={onClose} disabled={busy}>
              Close
            </Button>
          </>
        )
      }
    >
      {receipt !== undefined && (
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
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "var(--eh-sp-3)",
            }}
          >
            <DetailTile
              label="Profile"
              value={receipt.vortexProfileName}
              sub={`id ${receipt.vortexProfileId}`}
            />
            <DetailTile
              label="Mode"
              value={
                receipt.installTargetMode === "fresh-profile"
                  ? "Fresh profile"
                  : "Current profile"
              }
            />
            <DetailTile
              label="Installed at"
              value={new Date(receipt.installedAt).toLocaleString()}
            />
            <DetailTile
              label="Mod count"
              value={String(receipt.mods.length)}
            />
          </div>

          <section>
            <h4
              style={{
                margin: "0 0 var(--eh-sp-2) 0",
                color: "var(--eh-text-secondary)",
                fontSize: "var(--eh-text-xs)",
                textTransform: "uppercase",
                letterSpacing: "var(--eh-tracking-widest)",
              }}
            >
              Mods recorded
            </h4>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                maxHeight: "320px",
                overflowY: "auto",
                border: "1px solid var(--eh-border-subtle)",
                borderRadius: "var(--eh-radius-sm)",
              }}
            >
              {receipt.mods.map((m) => (
                <li
                  key={m.vortexModId}
                  style={{
                    padding: "var(--eh-sp-2) var(--eh-sp-3)",
                    borderBottom: "1px solid var(--eh-border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "var(--eh-sp-2)",
                  }}
                >
                  <span style={{ color: "var(--eh-text-primary)" }}>
                    {m.name}
                  </span>
                  <span
                    style={{
                      color: "var(--eh-text-muted)",
                      fontSize: "var(--eh-text-xs)",
                      fontFamily: "var(--eh-font-mono)",
                    }}
                  >
                    {m.source} · {m.vortexModId}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {progress !== null && (
            <div
              style={{
                padding: "var(--eh-sp-3)",
                background: "var(--eh-bg-base)",
                borderRadius: "var(--eh-radius-sm)",
                color: "var(--eh-text-secondary)",
                fontSize: "var(--eh-text-sm)",
              }}
            >
              Uninstalling... {progress.current} / {progress.total}
            </div>
          )}
        </div>
      )}

      <UninstallConfirmModal
        open={confirmingUninstall}
        receipt={receipt}
        onCancel={(): void => setConfirmingUninstall(false)}
        onConfirm={(): void => {
          void handleUninstall();
        }}
        busy={busy}
      />
    </Modal>
  );
}

function UninstallConfirmModal(props: {
  open: boolean;
  receipt: InstallReceipt | undefined;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}): JSX.Element {
  return (
    <Modal
      open={props.open && props.receipt !== undefined}
      onClose={props.onCancel}
      size="sm"
      title="Uninstall this collection?"
      footer={
        <>
          <Button intent="ghost" onClick={props.onCancel} disabled={props.busy}>
            Cancel
          </Button>
          <Button
            intent="danger"
            onClick={props.onConfirm}
            disabled={props.busy}
          >
            Yes, uninstall
          </Button>
        </>
      }
    >
      <p
        style={{
          margin: 0,
          color: "var(--eh-text-secondary)",
          fontSize: "var(--eh-text-sm)",
          lineHeight: "var(--eh-leading-relaxed)",
        }}
      >
        Event Horizon will remove every mod recorded in this receipt
        {props.receipt !== undefined &&
          ` (${props.receipt.mods.length} mod${props.receipt.mods.length === 1 ? "" : "s"})`}{" "}
        and delete the receipt file. The Vortex profile itself is NOT
        deleted — switch to it manually if you want to inspect what
        survives.
      </p>
    </Modal>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function DetailTile(props: {
  label: string;
  value: string;
  sub?: string;
}): JSX.Element {
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
          fontSize: "var(--eh-text-sm)",
          fontWeight: 600,
          wordBreak: "break-word",
        }}
      >
        {props.value}
      </div>
      {props.sub !== undefined && (
        <div
          style={{
            marginTop: 2,
            color: "var(--eh-text-muted)",
            fontSize: "var(--eh-text-xs)",
            fontFamily: "var(--eh-font-mono)",
          }}
        >
          {props.sub}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Diagnostic export
// ===========================================================================

interface MinimalElectronDialog {
  showSaveDialog: (
    opts: Record<string, unknown>,
  ) => Promise<{ canceled: boolean; filePath?: string }>;
}
interface MinimalElectronModule {
  remote?: { dialog?: MinimalElectronDialog };
  dialog?: MinimalElectronDialog;
}

/** Build a self-contained diagnostic JSON for a receipt and prompt
 * the user to save it. We bundle the full receipt + a metadata block
 * (Event Horizon version, OS, timestamp) so a bug report attachment
 * is enough on its own — no follow-up "what's your version" pings.
 *
 * Returns true if the user actually picked a path and we wrote to
 * disk; false if they cancelled the dialog.
 *
 * Throws on real I/O errors so the caller's reportError can pick
 * them up. Cancellation is NOT an error. */
async function saveDiagnosticReport(
  receipt: InstallReceipt,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const electron = require("electron") as MinimalElectronModule;
  const dialog = electron.remote?.dialog ?? electron.dialog;
  if (dialog?.showSaveDialog === undefined) {
    throw new Error("Electron save dialog API is not available");
  }

  const sanitized = receipt.packageName
    .replace(/[<>:"\\/|?*\x00-\x1f]/g, "_")
    .slice(0, 60)
    .trim();
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const defaultName = `event-horizon-diagnostic-${sanitized}-${stamp}.json`;

  const result = await dialog.showSaveDialog({
    title: "Export Event Horizon diagnostic",
    defaultPath: defaultName,
    filters: [
      { name: "JSON", extensions: ["json"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (result.canceled || result.filePath === undefined) return false;

  const payload = {
    schema: "event-horizon.diagnostic/1",
    generatedAt: new Date().toISOString(),
    extension: {
      name: "vortex-event-horizon",
      version: EXTENSION_VERSION,
    },
    host: {
      platform:
        typeof process !== "undefined" ? process.platform : "unknown",
      nodeVersion:
        typeof process !== "undefined" ? process.version : "unknown",
      // Trim user-agent to avoid leaking arbitrary auth state, just
      // keep the major Electron + Chrome version string.
      userAgent:
        typeof navigator !== "undefined"
          ? navigator.userAgent.slice(0, 240)
          : "unknown",
    },
    receipt,
  };

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fsp = require("fs/promises") as typeof import("fs/promises");
  await fsp.writeFile(
    result.filePath,
    JSON.stringify(payload, null, 2),
    { encoding: "utf-8" },
  );
  return true;
}
