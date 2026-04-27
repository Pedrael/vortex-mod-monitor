/**
 * Placeholder page used by every route whose real implementation
 * lives in a later Phase 5 slice (Install wizard / Collections /
 * Build). Keeps the navigation discoverable and the UX honest about
 * what is and isn't shipped.
 *
 * Visually shows: a small floating logo, the phase pill, the page
 * title, a one-paragraph description, and an explicit "still cooking"
 * call-out so QA testers don't file bugs against unbuilt screens.
 */

import * as React from "react";

import { EventHorizonLogo, Page, Pill } from "../components";

export interface ComingSoonPageProps {
  phase: string;
  title: string;
  description: string;
}

export function ComingSoonPage(props: ComingSoonPageProps): JSX.Element {
  const { phase, title, description } = props;

  return (
    <Page>
      <div className="eh-coming-soon">
        <EventHorizonLogo size={96} />
        <span className="eh-coming-soon__phase">{phase}</span>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p style={{ maxWidth: 520, lineHeight: "var(--eh-leading-relaxed)" }}>
          {description}
        </p>
        <div
          style={{
            display: "flex",
            gap: "var(--eh-sp-2)",
            marginTop: "var(--eh-sp-3)",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Pill intent="warning" withDot>
            Still cooking
          </Pill>
          <Pill intent="info">UI lands in {phase}</Pill>
        </div>
      </div>
    </Page>
  );
}
