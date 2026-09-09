import { finaliseDocument } from "./document";
import { AibomError } from "./errors";
import type { AibomContext, AibomDocument, Sensitivity } from "./types";

const sensitivityRank: Record<Sensitivity, number> = {
  public: 0,
  internal: 1,
  restricted: 2
};

function visible(
  sensitivity: Sensitivity | undefined,
  projection: Sensitivity
): boolean {
  return (
    sensitivityRank[sensitivity ?? "internal"] <= sensitivityRank[projection]
  );
}

function projectContext(
  context: AibomContext,
  projection: Sensitivity
): AibomContext {
  if (projection !== "public") {
    return context;
  }

  return {
    repository: context.repository,
    commit: context.commit,
    ref: context.ref,
    release: context.release
  };
}

export function projectDocument(
  document: AibomDocument,
  projection: Sensitivity
): AibomDocument {
  if (!visible(document.system.sensitivity, projection)) {
    throw new AibomError(
      "projection.system-sensitive",
      `System ${document.system.id} is marked ${document.system.sensitivity ?? "internal"} and cannot be included in a ${projection} projection`
    );
  }

  const nodeIds = new Set([
    document.system.id,
    ...document.components
      .filter((component) => visible(component.sensitivity, projection))
      .map((component) => component.id)
  ]);
  const components = document.components.filter((component) =>
    nodeIds.has(component.id)
  );
  const relationships = document.relationships.filter(
    (relationship) =>
      visible(relationship.sensitivity, projection) &&
      nodeIds.has(relationship.from) &&
      nodeIds.has(relationship.to)
  );
  const subjectIds = new Set([
    document.system.id,
    ...components.map((component) => component.id),
    ...relationships.map((relationship) => relationship.id)
  ]);
  const evidence = document.evidence.filter(
    (record) =>
      visible(record.sensitivity, projection) && subjectIds.has(record.subject)
  );
  const evidenceIds = new Set(evidence.map((record) => record.id));
  const cleanEvidence = (ids: string[] | undefined): string[] =>
    (ids ?? []).filter((id) => evidenceIds.has(id));
  const projectedComponents = components.map((component) => ({
    ...component,
    evidence: cleanEvidence(component.evidence)
  }));
  const projectedRelationships = relationships.map((relationship) => ({
    ...relationship,
    evidence: cleanEvidence(relationship.evidence)
  }));
  const assessments = document.assessments
    .filter(
      (record) =>
        visible(record.sensitivity, projection) &&
        subjectIds.has(record.subject)
    )
    .map((record) => ({
      ...record,
      evidence: cleanEvidence(record.evidence)
    }));
  const observations = document.observations
    .filter(
      (record) =>
        visible(record.sensitivity, projection) &&
        subjectIds.has(record.subject)
    )
    .map((record) => ({
      ...record,
      evidence: cleanEvidence(record.evidence)
    }));
  const unknowns = document.unknowns.filter(
    (record) =>
      visible(record.sensitivity, projection) && subjectIds.has(record.subject)
  );

  return finaliseDocument(
    {
      schemaVersion: document.schemaVersion,
      system: document.system,
      context: projectContext(document.context, projection),
      components: projectedComponents,
      relationships: projectedRelationships,
      evidence,
      assessments,
      observations,
      unknowns
    },
    {
      manifestPresent: document.document.source.manifestPresent,
      digest:
        projection === "public" ? undefined : document.document.source.digest,
      path: projection === "public" ? undefined : document.document.source.path
    },
    document.document.generatedAt
  );
}
