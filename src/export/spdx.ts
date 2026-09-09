import type { AibomDocument, Component, Relationship } from "../types";

const SPDX_CONTEXT = "https://spdx.org/rdf/3.0.1/spdx-context.jsonld";
const CREATION_INFO_ID = "_:creationinfo";
const SPDX_DATASET_TYPES = new Set([
  "audio",
  "categorical",
  "graph",
  "image",
  "noAssertion",
  "numeric",
  "other",
  "sensor",
  "structured",
  "syntactic",
  "text",
  "timeseries",
  "timestamp",
  "video"
]);

function spdxTimestamp(value: string): string {
  return new Date(value).toISOString().replace(/\.\d{3}Z$/u, "Z");
}

const RELATIONSHIP_TYPES = new Set([
  "affects",
  "amendedBy",
  "ancestorOf",
  "availableFrom",
  "configures",
  "contains",
  "coordinatedBy",
  "copiedTo",
  "delegatedTo",
  "dependsOn",
  "descendantOf",
  "describes",
  "doesNotAffect",
  "expandsTo",
  "exploitCreatedBy",
  "fixedBy",
  "fixedIn",
  "foundBy",
  "generates",
  "hasAddedFile",
  "hasAssessmentFor",
  "hasAssociatedVulnerability",
  "hasConcludedLicense",
  "hasDataFile",
  "hasDeclaredLicense",
  "hasDeletedFile",
  "hasDependencyManifest",
  "hasDistributionArtifact",
  "hasDocumentation",
  "hasDynamicLink",
  "hasEvidence",
  "hasExample",
  "hasHost",
  "hasInput",
  "hasMetadata",
  "hasOptionalComponent",
  "hasOptionalDependency",
  "hasOutput",
  "hasPrerequisite",
  "hasProvidedDependency",
  "hasRequirement",
  "hasSpecification",
  "hasStaticLink",
  "hasTest",
  "hasTestCase",
  "hasVariant",
  "invokedBy",
  "modifiedBy",
  "other",
  "packagedBy",
  "patchedBy",
  "publishedBy",
  "reportedBy",
  "republishedBy",
  "serializedInArtifact",
  "testedOn",
  "trainedOn",
  "underInvestigationFor",
  "usesTool"
]);

function spdxType(component: Component): string {
  switch (component.type) {
    case "hosted-model":
    case "local-model":
    case "embedding-model":
      return "ai_AIPackage";
    case "dataset":
    case "evaluation-dataset":
      return "dataset_DatasetPackage";
    case "prompt":
    case "policy":
    case "retrieval-index":
      return "software_File";
    default:
      return "software_Package";
  }
}

function hashes(
  component: Component
): Array<Record<string, unknown>> | undefined {
  const values = (component.hashes ?? []).map((hash) => ({
    type: "Hash",
    algorithm: "sha256",
    hashValue: hash.value
  }));
  return values.length === 0 ? undefined : values;
}

function datasetTypes(component: Component): string[] {
  const declared = component.properties?.datasetType;
  const values =
    typeof declared === "string"
      ? [declared]
      : Array.isArray(declared) &&
          declared.every((value) => typeof value === "string")
        ? declared
        : [];
  const valid = values.filter((value) => SPDX_DATASET_TYPES.has(value));
  return valid.length === 0 ? ["noAssertion"] : valid;
}

function componentElement(component: Component): Record<string, unknown> {
  const type = spdxType(component);
  const element: Record<string, unknown> = {
    type,
    spdxId: component.id,
    creationInfo: CREATION_INFO_ID,
    name: component.name,
    comment: `Operational AIBOM type=${component.type}; origin=${component.origin ?? "declared"}; sensitivity=${component.sensitivity ?? "internal"}.`
  };

  if (component.description !== undefined) {
    element.description = component.description;
  }
  if (component.version !== undefined) {
    element.software_packageVersion = component.version;
  }
  if (type === "dataset_DatasetPackage") {
    element.dataset_datasetType = datasetTypes(component);
  }
  const verifiedUsing = hashes(component);
  if (verifiedUsing !== undefined) {
    element.verifiedUsing = verifiedUsing;
  }

  return element;
}

function relationshipType(relationship: Relationship): string {
  const directMappings: Record<string, string> = {
    "depends-on": "dependsOn",
    "trained-on": "trainedOn",
    "evaluated-with": "hasTest",
    "can-invoke": "usesTool",
    "deployed-as": "generates",
    "fine-tuned-from": "descendantOf",
    "governed-by": "configures",
    "retrieves-from": "hasInput",
    "embeds-with": "dependsOn",
    "uses-model": "dependsOn",
    references: "hasMetadata",
    contains: "contains"
  };
  const mapped = directMappings[relationship.type] ?? relationship.type;
  return RELATIONSHIP_TYPES.has(mapped) ? mapped : "other";
}

function relationshipElement(
  relationship: Relationship
): Record<string, unknown> {
  const mappedType = relationshipType(relationship);
  const element: Record<string, unknown> = {
    type: "Relationship",
    spdxId: relationship.id,
    creationInfo: CREATION_INFO_ID,
    relationshipType: mappedType,
    from: relationship.from,
    to: [relationship.to]
  };

  if (mappedType === "other" || mappedType !== relationship.type) {
    element.description = `Operational AIBOM relationship type: ${relationship.type}.`;
  }

  return element;
}

export function toSpdxJsonLd(document: AibomDocument): Record<string, unknown> {
  const toolId = "urn:aibom:tool:operational-aibom";
  const documentElementId = `${document.document.id}:spdx`;

  return {
    "@context": SPDX_CONTEXT,
    "@graph": [
      {
        type: "Tool",
        spdxId: toolId,
        creationInfo: CREATION_INFO_ID,
        name: document.document.generator.name,
        comment: `Version ${document.document.generator.version}`
      },
      {
        type: "CreationInfo",
        "@id": CREATION_INFO_ID,
        specVersion: "3.0.1",
        createdBy: [toolId],
        createdUsing: [toolId],
        created: spdxTimestamp(document.document.generatedAt)
      },
      {
        type: "SpdxDocument",
        spdxId: documentElementId,
        creationInfo: CREATION_INFO_ID,
        profileConformance: ["core", "software", "ai", "dataset"],
        rootElement: [document.system.id],
        comment:
          "This SPDX view is exported from an operational AIBOM. Evidence classes, observations and unknown ownership may not map without loss."
      },
      {
        type: "ai_AIPackage",
        spdxId: document.system.id,
        creationInfo: CREATION_INFO_ID,
        name: document.system.name,
        description: document.system.description,
        software_packageVersion: document.system.version,
        ai_informationAboutApplication: document.system.intendedUse
      },
      ...document.components.map(componentElement),
      ...document.relationships.map(relationshipElement)
    ]
  };
}
