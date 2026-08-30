/**
 * The Collection Doctor's face.
 *
 * Purely presentational: it takes verdicts and renders them. All the Vortex
 * reads and the healing live in the caller, which is what lets this be
 * screenshotted by the render harness without a running Vortex — the only way
 * to actually look at a screen while building it rather than imagining it.
 *
 * ─── THE ONE VISUAL RULE ───────────────────────────────────────────────
 * Colour means "act on this", never decoration. A healthy check is quiet —
 * plain text, no badge, no accent — so the eye lands on the two cards that are
 * wrong instead of scanning eight identical green ticks. That is the same
 * correction the dashboard needed: colouring facts that are fine trains people
 * to ignore colour exactly when it matters.
 */

import * as React from "react";

import { Button, Card, Pill, ProgressRing } from "../../components";
import type { PillIntent } from "../../components";
import type {
  HealAction,
  HealthCheck,
  HealthStatus,
} from "../../../core/doctor/health";
import { overallHealth } from "../../../core/doctor/health";

export interface DoctorPanelProps {
  packageName: string;
  packageVersion: string;
  checks: readonly HealthCheck[];
  /** Which check is being re-run or healed right now. */
  busyCheckId?: string;
  /** Deep scan is expensive, so it is a separate, explicit action. */
  onRunDeepScan?: () => void;
  onRecheck?: () => void;
  onHeal?: (action: HealAction, checkId: string) => void;
  /**
   * Set while an install is running. Every heal re-runs a pipeline step that
   * mutates Vortex, so they are disabled rather than hidden — a button that
   * vanishes reads as a missing feature, one that is disabled with a reason
   * reads as a system that knows what it is doing.
   */
  healingBlocked?: string;
}

const STATUS_COLOR: Record<HealthStatus, string> = {
  healthy: "var(--eh-success)",
  drifted: "var(--eh-warning)",
  broken: "var(--eh-danger)",
  unknown: "var(--eh-text-muted)",
  "not-applicable": "var(--eh-text-disabled)",
};

const STATUS_PILL: Record<HealthStatus, PillIntent> = {
  healthy: "success",
  drifted: "warning",
  broken: "danger",
  unknown: "neutral",
  "not-applicable": "neutral",
};

const STATUS_WORD: Record<HealthStatus, string> = {
  healthy: "OK",
  drifted: "Drifted",
  broken: "Broken",
  unknown: "Not checked",
  "not-applicable": "N/A",
};

/** A ring is worth more than a number here: it reads at a glance. */
function VerdictRing(props: { checks: readonly HealthCheck[] }): JSX.Element {
  const graded = props.checks.filter(
    (c) => c.status !== "not-applicable" && c.status !== "unknown",
  );
  const good = graded.filter((c) => c.status === "healthy").length;
  const pct = graded.length === 0 ? 0 : Math.round((good / graded.length) * 100);
  const overall = overallHealth(props.checks);
  // ProgressRing already centres a `label`, so no absolute overlay is needed.
  return (
    <ProgressRing
      size={104}
      value={pct / 100}
      label={
        <span
          style={{
            display: "grid",
            placeItems: "center",
            lineHeight: 1.1,
          }}
        >
          <span
            style={{
              fontSize: "var(--eh-text-xl)",
              fontWeight: 700,
              color: STATUS_COLOR[overall.status],
            }}
          >
            {graded.length === 0 ? "—" : `${good}/${graded.length}`}
          </span>
          {/* "1/7" alone is a fraction of an unnamed thing. Name it. */}
          <span className="eh-label" style={{ fontSize: "var(--eh-text-xs)" }}>
            {graded.length === 0 ? "checks" : "passing"}
          </span>
        </span>
      }
    />
  );
}

function CheckCard(props: {
  check: HealthCheck;
  busy: boolean;
  blocked: boolean;
  onHeal?: (action: HealAction, checkId: string) => void;
}): JSX.Element {
  const { check, busy, blocked } = props;
  const [open, setOpen] = React.useState(false);
  const isProblem = check.status === "broken" || check.status === "drifted";

  return (
    <Card inert>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--eh-sp-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--eh-sp-3)" }}>
          {/* The status dot carries the whole verdict at a glance. */}
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              flex: "none",
              background: STATUS_COLOR[check.status],
              boxShadow: isProblem
                ? `0 0 10px ${STATUS_COLOR[check.status]}`
                : "none",
            }}
          />
          <span
            style={{
              fontSize: "var(--eh-text-md)",
              fontWeight: 600,
              color: "var(--eh-text-primary)",
              flex: 1,
            }}
          >
            {check.title}
          </span>
          {/* Quiet when fine: no badge on a healthy check. */}
          {isProblem && (
            <Pill intent={STATUS_PILL[check.status]} withDot>
              {check.affectedCount > 0
                ? `${check.affectedCount}`
                : STATUS_WORD[check.status]}
            </Pill>
          )}
          {!isProblem && (
            <span
              className="eh-label"
              style={{ color: STATUS_COLOR[check.status] }}
            >
              {STATUS_WORD[check.status]}
            </span>
          )}
        </div>

        <p
          style={{
            margin: 0,
            fontSize: "var(--eh-text-sm)",
            color: "var(--eh-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {check.summary}
        </p>

        {check.detail.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              style={{
                alignSelf: "flex-start",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "var(--eh-cyan)",
                fontSize: "var(--eh-text-xs)",
                letterSpacing: "var(--eh-tracking-wide)",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {open ? "Hide details" : `Show details (${check.detail.length})`}
            </button>
            {open && (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "var(--eh-sp-4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  fontSize: "var(--eh-text-xs)",
                  fontFamily: "var(--eh-font-mono)",
                  color: "var(--eh-text-muted)",
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {check.detail.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </>
        )}

        {check.heal !== undefined && (
          // Ghost, not primary. Six primary buttons on one screen is a wall of
          // orange in which nothing stands out — the same mistake as colouring
          // facts that are fine. The single primary action belongs in the
          // header; these are all equally available, so none of them shouts.
          <Button
            intent="ghost"
            size="sm"
            disabled={busy || blocked}
            onClick={() => props.onHeal?.(check.heal!.action, check.id)}
          >
            {busy ? "Working…" : blocked ? "Install in progress" : check.heal.label}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function DoctorPanel(props: DoctorPanelProps): JSX.Element {
  const { checks } = props;
  const overall = overallHealth(checks);
  // Problems first. A user opening this wants the bad news at the top, not in
  // reading order behind six healthy cards.
  const ordered = [...checks].sort((a, b) => rank(a.status) - rank(b.status));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--eh-sp-5)" }}>
      <Card inert>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--eh-sp-5)",
            flexWrap: "wrap",
          }}
        >
          <VerdictRing checks={checks} />
          <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="eh-label">Collection health</span>
            <h2
              style={{
                margin: 0,
                fontSize: "var(--eh-text-xl)",
                color: STATUS_COLOR[overall.status],
              }}
            >
              {overall.headline}
            </h2>
            <span
              style={{
                fontSize: "var(--eh-text-sm)",
                color: "var(--eh-text-secondary)",
              }}
            >
              {props.packageName} v{props.packageVersion} — measured against the
              last install of this collection on this machine.
            </span>
          </div>
          <div style={{ display: "flex", gap: "var(--eh-sp-2)", flexWrap: "wrap" }}>
            {props.onRecheck !== undefined && (
              <Button intent="ghost" onClick={props.onRecheck}>
                Re-check
              </Button>
            )}
            {props.onRunDeepScan !== undefined && (
              // Disabled during an install even though a scan only READS. It
              // would be hashing files the driver is still writing, and every
              // half-written mod would come back as drift — a scary, wrong
              // answer is worse than no answer.
              <Button
                intent="primary"
                disabled={props.healingBlocked !== undefined}
                onClick={props.onRunDeepScan}
              >
                Deep scan files
              </Button>
            )}
          </div>
        </div>
      </Card>

      {props.healingBlocked !== undefined && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--eh-sp-3)",
            padding: "var(--eh-sp-4)",
            borderRadius: "var(--eh-radius-lg)",
            background: "var(--eh-bg-elevated)",
            border: "1px solid var(--eh-warning)",
            color: "var(--eh-text-secondary)",
            fontSize: "var(--eh-text-sm)",
            lineHeight: 1.5,
          }}
        >
          <span aria-hidden="true" style={{ color: "var(--eh-warning)", fontWeight: 700 }}>
            ⏸
          </span>
          <span>{props.healingBlocked}</span>
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--eh-sp-4)",
          alignItems: "start",
        }}
      >
        {ordered.map((c) => (
          <CheckCard
            key={c.id}
            check={c}
            busy={props.busyCheckId === c.id}
            blocked={props.healingBlocked !== undefined}
            {...(props.onHeal !== undefined ? { onHeal: props.onHeal } : {})}
          />
        ))}
      </section>
    </div>
  );
}

/** Broken, then drifted, then unknown, then the quiet ones. */
function rank(s: HealthStatus): number {
  return { broken: 0, drifted: 1, unknown: 2, healthy: 3, "not-applicable": 4 }[s];
}
