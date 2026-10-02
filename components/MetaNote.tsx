"use client";
import { NAV_V2 } from "@/lib/bootstrap";
import type { GuideId } from "@/lib/guide";
import { GuideButton } from "./GuidePanel";
import EvidencePopover from "./EvidencePopover";
import LegacyMetaNote from "./LegacyMetaNote";
const guides: Record<string, GuideId> = {
  "Snapshot freshness": "freshness",
  "How moves qualify": "moves",
  "Your saved markets": "saved",
  "About observed moves": "observed-moves",
  "How events are selected": "outlooks",
  "How to read these contract prices": "outlooks",
  "How this decision outlook works": "policy-balance",
  "Why these markets appear together": "across-venues",
  "How these indices work": "belief-shift",
  "What this evidence establishes": "evidence",
  "Evaluation coverage": "evidence",
};
/** Compatibility for legacy pages while NAV_V2 rolls out. New views use explicit Guide or evidence controls. */
export default function MetaNote({
  kind,
  title,
  children,
}: {
  kind: "freshness" | "method" | "evidence" | "context";
  title: string;
  children: React.ReactNode;
}) {
  if (!NAV_V2)
    return (
      <LegacyMetaNote kind={kind} title={title}>
        {children}
      </LegacyMetaNote>
    );
  return kind === "evidence" && !guides[title] ? (
    <EvidencePopover title={title}>{children}</EvidencePopover>
  ) : (
    <GuideButton id={guides[title] ?? "evidence"} />
  );
}
