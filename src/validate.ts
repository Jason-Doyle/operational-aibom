import { sha256, stableStringify } from "./json";
import {
  validateDocumentSchemaValue,
  validateManifestSchemaValue
} from "./schema";
import type {
  AibomDocument,
  AibomManifest,
  Diagnostic,
  EvidenceRecord,
  Relationship,
  ValidationResult
} from "./types";

function duplicateDiagnostics(label: string, ids: string[]): Diagnostic[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }

  return [...duplicates].map((id) => ({
    level: "error",
    code: "semantic.duplicate-id",
    message: `Duplicate ${label} id: ${id}`
  }));
}

function evidenceReferenceDiagnostics(
  recordLabel: string,
  recordId: string,
  evidenceIds: string[] | undefined,
  knownEvidence: Set<string>
): Diagnostic[] {
  return (evidenceIds ?? [])
    .filter((id) => !knownEvidence.has(id))
    .map((id) => ({
      level: "error",
      code: "semantic.missing-evidence",
      message: `${recordLabel} ${recordId} references missing evidence ${id}`
    }));
}

function temporalDiagnostics(evidence: EvidenceRecord): Diagnostic[] {
  if (evidence.observedAt === undefined || evidence.validUntil === undefined) {
    return [];
  }

  if (Date.parse(evidence.validUntil) >= Date.parse(evidence.observedAt)) {
    return [];
  }

  return [
    {
      level: "error",
      code: "semantic.invalid-evidence-window",
      message: `Evidence ${evidence.id} expires before it was observed`
    }
  ];
}

function optionalRelationshipId(
  relationship: Omit<Relationship, "id"> | Relationship
): string | undefined {
  return "id" in relationship && typeof relationship.id === "string"
    ? relationship.id
    : undefined;
}

export function validateManifest(value: unknown): ValidationResult {
  const schemaResult = validateManifestSchemaValue(value);
  if (!schemaResult.valid) {
    return schemaResult;
  }

  const manifest = value as AibomManifest;
  const diagnostics: Diagnostic[] = [];
  const nodeIds = new Set([
    manifest.system.id,
    ...(manifest.components ?? []).map((component) => component.id)
  ]);
  const relationshipIds = new Set(
    (manifest.relationships ?? []).flatMap((relationship) => {
      const id = optionalRelationshipId(relationship);
      return id === undefined ? [] : [id];
    })
  );
  const subjectIds = new Set([...nodeIds, ...relationshipIds]);
  const evidenceIds = new Set(
    (manifest.evidence ?? []).map((record) => record.id)
  );

  diagnostics.push(
    ...duplicateDiagnostics("component", [
      manifest.system.id,
      ...(manifest.components ?? []).map((component) => component.id)
    ]),
    ...duplicateDiagnostics("relationship", [...relationshipIds]),
    ...duplicateDiagnostics("evidence", [...evidenceIds]),
    ...duplicateDiagnostics(
      "assessment",
      (manifest.assessments ?? []).map((record) => record.id)
    ),
    ...duplicateDiagnostics(
      "observation",
      (manifest.observations ?? []).map((record) => record.id)
    ),
    ...duplicateDiagnostics(
      "unknown",
      (manifest.unknowns ?? []).map((record) => record.id)
    )
  );

  for (const relationship of manifest.relationships ?? []) {
    const relationshipId =
      optionalRelationshipId(relationship) ??
      `${relationship.from}|${relationship.type}|${relationship.to}`;
    if (!nodeIds.has(relationship.from)) {
      diagnostics.push({
        level: "error",
        code: "semantic.missing-relationship-source",
        message: `Relationship ${relationship.type} references missing source ${relationship.from}`
      });
    }
    if (!nodeIds.has(relationship.to)) {
      diagnostics.push({
        level: "error",
        code: "semantic.missing-relationship-target",
        message: `Relationship ${relationship.type} references missing target ${relationship.to}`
      });
    }
    diagnostics.push(
      ...evidenceReferenceDiagnostics(
        "Relationship",
        relationshipId,
        relationship.evidence,
        evidenceIds
      )
    );
  }

  for (const component of manifest.components ?? []) {
    diagnostics.push(
      ...evidenceReferenceDiagnostics(
        "Component",
        component.id,
        component.evidence,
        evidenceIds
      )
    );
  }

  for (const evidence of manifest.evidence ?? []) {
    if (!subjectIds.has(evidence.subject)) {
      diagnostics.push({
        level: "error",
        code: "semantic.missing-evidence-subject",
        message: `Evidence ${evidence.id} references missing subject ${evidence.subject}`
      });
    }
    diagnostics.push(...temporalDiagnostics(evidence));
  }

  for (const assessment of manifest.assessments ?? []) {
    if (!subjectIds.has(assessment.subject)) {
      diagnostics.push({
        level: "error",
        code: "semantic.missing-assessment-subject",
        message: `Assessment ${assessment.id} references missing subject ${assessment.subject}`
      });
    }
    diagnostics.push(
      ...evidenceReferenceDiagnostics(
        "Assessment",
        assessment.id,
        assessment.evidence,
        evidenceIds
      )
    );
  }

  for (const observation of manifest.observations ?? []) {
    if (!subjectIds.has(observation.subject)) {
      diagnostics.push({
        level: "error",
        code: "semantic.missing-observation-subject",
        message: `Observation ${observation.id} references missing subject ${observation.subject}`
      });
    }
    diagnostics.push(
      ...evidenceReferenceDiagnostics(
        "Observation",
        observation.id,
        observation.evidence,
        evidenceIds
      )
    );
  }

  for (const unknown of manifest.unknowns ?? []) {
    if (!subjectIds.has(unknown.subject)) {
      diagnostics.push({
        level: "error",
        code: "semantic.missing-unknown-subject",
        message: `Unknown ${unknown.id} references missing subject ${unknown.subject}`
      });
    }
  }

  return {
    valid: !diagnostics.some((diagnostic) => diagnostic.level === "error"),
    diagnostics
  };
}

export function validateDocument(value: unknown): ValidationResult {
  const schemaResult = validateDocumentSchemaValue(value);
  if (!schemaResult.valid) {
    return schemaResult;
  }

  const document = value as AibomDocument;
  const diagnostics: Diagnostic[] = [];
  const nodeIds = new Set([
    document.system.id,
    ...document.components.map((component) => component.id)
  ]);
  const relationshipIds = new Set(
    document.relationships.map((relationship) => relationship.id)
  );
  const subjectIds = new Set([
    document.document.id,
    ...nodeIds,
    ...relationshipIds
  ]);
  const evidenceIds = new Set(document.evidence.map((evidence) => evidence.id));

  diagnostics.push(
    ...duplicateDiagnostics("component", [
      document.system.id,
      ...document.components.map((component) => component.id)
    ]),
    ...duplicateDiagnostics(
      "relationship",
      document.relationships.map((relationship) => relationship.id)
    ),
    ...duplicateDiagnostics(
      "evidence",
      document.evidence.map((evidence) => evidence.id)
    ),
    ...duplicateDiagnostics(
      "assessment",
      document.assessments.map((assessment) => assessment.id)
    ),
    ...duplicateDiagnostics(
      "observation",
      document.observations.map((observation) => observation.id)
    ),
    ...duplicateDiagnostics(
      "unknown",
      document.unknowns.map((unknown) => unknown.id)
    )
  );

  for (const relationship of document.relationships) {
    if (!nodeIds.has(relationship.from)) {
      diagnostics.push({
        level: "error",
        code: "semantic.missing-relationship-source",
        message: `Relationship ${relationship.id} references missing source ${relationship.from}`
      });
    }
    if (!nodeIds.has(relationship.to)) {
      diagnostics.push({
        level: "error",
        code: "semantic.missing-relationship-target",
        message: `Relationship ${relationship.id} references missing target ${relationship.to}`
      });
    }
    diagnostics.push(
      ...evidenceReferenceDiagnostics(
        "Relationship",
        relationship.id,
        relationship.evidence,
        evidenceIds
      )
    );
  }

  for (const component of document.components) {
    diagnostics.push(
      ...evidenceReferenceDiagnostics(
        "Component",
        component.id,
        component.evidence,
        evidenceIds
      )
    );
  }

  for (const evidence of document.evidence) {
    if (!subjectIds.has(evidence.subject)) {
      diagnostics.push({
        level: "error",
        code: "semantic.missing-evidence-subject",
        message: `Evidence ${evidence.id} references missing subject ${evidence.subject}`
      });
    }
    diagnostics.push(...temporalDiagnostics(evidence));
    if (
      evidence.class === "supplier-declaration" &&
      evidence.source?.uri === undefined
    ) {
      diagnostics.push({
        level: "warning",
        code: "semantic.supplier-source",
        message: `Supplier declaration ${evidence.id} has no source URI`
      });
    }
  }

  for (const assessment of document.assessments) {
    if (!subjectIds.has(assessment.subject)) {
      diagnostics.push({
        level: "error",
        code: "semantic.missing-assessment-subject",
        message: `Assessment ${assessment.id} references missing subject ${assessment.subject}`
      });
    }
    diagnostics.push(
      ...evidenceReferenceDiagnostics(
        "Assessment",
        assessment.id,
        assessment.evidence,
        evidenceIds
      )
    );
  }

  for (const observation of document.observations) {
    if (!subjectIds.has(observation.subject)) {
      diagnostics.push({
        level: "error",
        code: "semantic.missing-observation-subject",
        message: `Observation ${observation.id} references missing subject ${observation.subject}`
      });
    }
    diagnostics.push(
      ...evidenceReferenceDiagnostics(
        "Observation",
        observation.id,
        observation.evidence,
        evidenceIds
      )
    );
  }

  for (const unknown of document.unknowns) {
    if (!subjectIds.has(unknown.subject)) {
      diagnostics.push({
        level: "error",
        code: "semantic.missing-unknown-subject",
        message: `Unknown ${unknown.id} references missing subject ${unknown.subject}`
      });
    }
    if (unknown.owner === undefined) {
      diagnostics.push({
        level: "warning",
        code: "semantic.unknown-owner",
        message: `Unknown ${unknown.id} has no accountable owner`
      });
    }
    if (unknown.reviewAfter === undefined) {
      diagnostics.push({
        level: "warning",
        code: "semantic.unknown-review",
        message: `Unknown ${unknown.id} has no next review date`
      });
    }
  }

  if (document.system.owner === undefined) {
    diagnostics.push({
      level: "warning",
      code: "semantic.system-owner",
      message: "The system has no accountable owner"
    });
  }
  if (document.system.intendedUse === undefined) {
    diagnostics.push({
      level: "warning",
      code: "semantic.system-intended-use",
      message: "The system has no intended use"
    });
  }

  const content = {
    schemaVersion: document.schemaVersion,
    system: document.system,
    context: document.context,
    components: document.components,
    relationships: document.relationships,
    evidence: document.evidence,
    assessments: document.assessments,
    observations: document.observations,
    unknowns: document.unknowns
  };
  const contentDigest = sha256(stableStringify(content, 0));

  if (document.document.contentDigest.value !== contentDigest) {
    diagnostics.push({
      level: "error",
      code: "semantic.content-digest",
      message: "Document content does not match document.contentDigest"
    });
  }
  if (document.document.id !== `urn:aibom:document:sha256:${contentDigest}`) {
    diagnostics.push({
      level: "error",
      code: "semantic.document-id",
      message: "Document id does not match the canonical content digest"
    });
  }

  return {
    valid: !diagnostics.some((diagnostic) => diagnostic.level === "error"),
    diagnostics
  };
}
