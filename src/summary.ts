import type { AibomDiff, AibomDocument, Diagnostic } from "./types";

export interface DocumentSummary {
  components: number;
  relationships: number;
  evidence: number;
  assessments: number;
  observations: number;
  unknowns: number;
  warnings: number;
}

export function summariseDocument(
  document: AibomDocument,
  diagnostics: Diagnostic[] = []
): DocumentSummary {
  return {
    components: document.components.length,
    relationships: document.relationships.length,
    evidence: document.evidence.length,
    assessments: document.assessments.length,
    observations: document.observations.length,
    unknowns: document.unknowns.length,
    warnings: diagnostics.filter((diagnostic) => diagnostic.level === "warning")
      .length
  };
}

export function formatSummary(
  document: AibomDocument,
  diagnostics: Diagnostic[] = []
): string {
  const summary = summariseDocument(document, diagnostics);
  return [
    `Document: ${document.document.id}`,
    `Components: ${summary.components}`,
    `Relationships: ${summary.relationships}`,
    `Evidence: ${summary.evidence}`,
    `Assessments: ${summary.assessments}`,
    `Observations: ${summary.observations}`,
    `Unknowns: ${summary.unknowns}`,
    `Warnings: ${summary.warnings}`
  ].join("\n");
}

export function formatDiffSummary(diff: AibomDiff): string {
  return [
    `Base: ${diff.baseDocument}`,
    `Head: ${diff.headDocument}`,
    `Added: ${diff.summary.added}`,
    `Removed: ${diff.summary.removed}`,
    `Changed: ${diff.summary.changed}`,
    `New unknowns: ${diff.summary.newUnknowns}`,
    `Non-material changes: ${diff.summary.nonMaterialChanges}`,
    `Review required: ${diff.summary.reviewRequired ? "yes" : "no"}`
  ].join("\n");
}
