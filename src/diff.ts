import { SCHEMA_VERSION } from "./constants";
import { deepEqual } from "./json";
import type {
  AibomDiff,
  AibomContext,
  AibomDocument,
  ChangedRecord,
  EvidenceRecord,
  RecordDiff
} from "./types";

function diffRecords<T extends { id: string }>(
  base: T[],
  head: T[],
  normalise: (record: T) => unknown = (record) => record
): RecordDiff<T> {
  const baseById = new Map(base.map((record) => [record.id, record]));
  const headById = new Map(head.map((record) => [record.id, record]));
  const added = head.filter((record) => !baseById.has(record.id));
  const removed = base.filter((record) => !headById.has(record.id));
  const changed: ChangedRecord<T>[] = [];

  for (const [id, before] of baseById) {
    const after = headById.get(id);
    if (
      after !== undefined &&
      !deepEqual(normalise(before), normalise(after))
    ) {
      changed.push({ id, before, after });
    }
  }

  return {
    added,
    removed,
    changed
  };
}

function changedCount<T>(diff: RecordDiff<T>): number {
  return diff.added.length + diff.removed.length + diff.changed.length;
}

function evidenceDiffMode(
  evidence: EvidenceRecord
): "content" | "run" | undefined {
  const value = evidence.properties?.diffMode;
  return value === "content" || value === "run" ? value : undefined;
}

function materialEvidence(evidence: EvidenceRecord[]): EvidenceRecord[] {
  return evidence.filter((record) => evidenceDiffMode(record) !== "run");
}

function normaliseEvidence(evidence: EvidenceRecord): EvidenceRecord {
  if (evidenceDiffMode(evidence) !== "content") {
    return evidence;
  }

  const material = { ...evidence };
  delete material.observedAt;
  return material;
}

function materialContext(context: AibomContext): AibomContext {
  return {
    repository: context.repository,
    commit: context.commit,
    ref: context.ref,
    release: context.release,
    deployment: context.deployment
  };
}

export function diffAiboms(
  base: AibomDocument,
  head: AibomDocument
): AibomDiff {
  const components = diffRecords(base.components, head.components);
  const relationships = diffRecords(base.relationships, head.relationships);
  const evidence = diffRecords(base.evidence, head.evidence);
  const assessments = diffRecords(base.assessments, head.assessments);
  const observations = diffRecords(base.observations, head.observations);
  const unknowns = diffRecords(base.unknowns, head.unknowns);
  const systemChanged = !deepEqual(base.system, head.system);
  const rawContextChanged = !deepEqual(base.context, head.context);
  const contextChanged = !deepEqual(
    materialContext(base.context),
    materialContext(head.context)
  );
  const materialEvidenceDiff = diffRecords(
    materialEvidence(base.evidence),
    materialEvidence(head.evidence),
    normaliseEvidence
  );
  const diffs = [
    components,
    relationships,
    materialEvidenceDiff,
    assessments,
    observations,
    unknowns
  ];
  const added = diffs.reduce((total, diff) => total + diff.added.length, 0);
  const removed = diffs.reduce((total, diff) => total + diff.removed.length, 0);
  const changed =
    diffs.reduce((total, diff) => total + diff.changed.length, 0) +
    Number(systemChanged) +
    Number(contextChanged);
  const nonMaterialChanges =
    Math.max(0, changedCount(evidence) - changedCount(materialEvidenceDiff)) +
    Number(rawContextChanged && !contextChanged);

  return {
    schemaVersion: SCHEMA_VERSION,
    baseDocument: base.document.id,
    headDocument: head.document.id,
    summary: {
      added,
      removed,
      changed,
      newUnknowns: unknowns.added.length,
      nonMaterialChanges,
      reviewRequired:
        systemChanged ||
        contextChanged ||
        changedCount(components) > 0 ||
        changedCount(relationships) > 0 ||
        changedCount(materialEvidenceDiff) > 0 ||
        changedCount(assessments) > 0 ||
        unknowns.added.length > 0
    },
    systemChanged,
    contextChanged,
    components,
    relationships,
    evidence,
    assessments,
    observations,
    unknowns
  };
}
