import { deterministicUuid } from "../json";
import type {
  AibomDocument,
  Component,
  JsonValue,
  SystemDefinition
} from "../types";

type CycloneDxComponentType =
  | "application"
  | "data"
  | "file"
  | "framework"
  | "library"
  | "machine-learning-model";

interface CycloneDxProperty {
  name: string;
  value: string;
}

function componentType(component: Component): CycloneDxComponentType {
  switch (component.type) {
    case "hosted-model":
    case "local-model":
    case "embedding-model":
      return "machine-learning-model";
    case "dataset":
    case "evaluation-dataset":
      return "data";
    case "prompt":
    case "policy":
    case "retrieval-index":
      return "file";
    case "framework":
      return "framework";
    case "software-library":
      return "library";
    default:
      return "application";
  }
}

function propertyValue(value: JsonValue): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function properties(
  component: Component | SystemDefinition
): CycloneDxProperty[] {
  const base: CycloneDxProperty[] = [
    {
      name: "operational-aibom:sensitivity",
      value: component.sensitivity ?? "internal"
    }
  ];

  if ("type" in component) {
    base.push(
      {
        name: "operational-aibom:component-type",
        value: component.type
      },
      {
        name: "operational-aibom:origin",
        value: component.origin ?? "declared"
      }
    );
    for (const evidenceId of component.evidence ?? []) {
      base.push({
        name: "operational-aibom:evidence",
        value: evidenceId
      });
    }
  }

  return [
    ...base,
    ...Object.entries(component.properties ?? {}).map(([name, value]) => ({
      name: `operational-aibom:property:${name}`,
      value: propertyValue(value)
    }))
  ];
}

function toComponent(component: Component): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: componentType(component),
    "bom-ref": component.id,
    name: component.name,
    properties: properties(component)
  };

  if (component.version !== undefined) {
    result.version = component.version;
  }
  if (component.description !== undefined) {
    result.description = component.description;
  }
  if (component.supplier !== undefined) {
    result.supplier = {
      name: component.supplier
    };
  }
  if ((component.hashes ?? []).length > 0) {
    result.hashes = (component.hashes ?? []).map((hash) => ({
      alg: hash.algorithm,
      content: hash.value
    }));
  }
  if ((component.licences ?? []).length > 0) {
    result.licenses = (component.licences ?? []).map((licence) => ({
      expression: licence
    }));
  }
  if ((component.locations ?? []).length > 0) {
    result.evidence = {
      occurrences: (component.locations ?? []).map((location) => ({
        location: location.path,
        line: location.lineStart
      }))
    };
  }

  return result;
}

function systemComponent(system: SystemDefinition): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: "application",
    "bom-ref": system.id,
    name: system.name,
    properties: properties(system)
  };

  if (system.version !== undefined) {
    result.version = system.version;
  }
  if (system.description !== undefined) {
    result.description = system.description;
  }

  return result;
}

export function toCycloneDx(document: AibomDocument): Record<string, unknown> {
  const dependencyTargets = new Map<string, Set<string>>();
  for (const relationship of document.relationships) {
    const targets =
      dependencyTargets.get(relationship.from) ?? new Set<string>();
    targets.add(relationship.to);
    dependencyTargets.set(relationship.from, targets);
  }
  const nodeIds = [
    document.system.id,
    ...document.components.map((component) => component.id)
  ];

  return {
    $schema: "https://cyclonedx.org/schema/bom-1.7.schema.json",
    bomFormat: "CycloneDX",
    specVersion: "1.7",
    serialNumber: `urn:uuid:${deterministicUuid(document.document.id)}`,
    version: 1,
    metadata: {
      timestamp: document.document.generatedAt,
      tools: {
        components: [
          {
            type: "application",
            name: document.document.generator.name,
            version: document.document.generator.version
          }
        ]
      },
      component: systemComponent(document.system),
      properties: [
        {
          name: "operational-aibom:source-document",
          value: document.document.id
        },
        {
          name: "operational-aibom:export-loss",
          value:
            "Evidence classes, temporal separation and relationship semantics may be represented only partially in this CycloneDX view."
        }
      ]
    },
    components: document.components.map(toComponent),
    dependencies: nodeIds.map((id) => ({
      ref: id,
      dependsOn: [...(dependencyTargets.get(id) ?? [])].sort()
    })),
    properties: [
      ...document.relationships.map((relationship) => ({
        name: `operational-aibom:relationship:${relationship.id}`,
        value: JSON.stringify({
          from: relationship.from,
          type: relationship.type,
          to: relationship.to
        })
      })),
      ...document.evidence.map((record) => ({
        name: `operational-aibom:evidence:${record.id}`,
        value: JSON.stringify({
          class: record.class,
          subject: record.subject,
          claim: record.claim,
          observedAt: record.observedAt,
          validUntil: record.validUntil
        })
      })),
      ...document.unknowns.map((record) => ({
        name: `operational-aibom:unknown:${record.id}`,
        value: JSON.stringify({
          subject: record.subject,
          field: record.field,
          reason: record.reason,
          reviewAfter: record.reviewAfter
        })
      }))
    ]
  };
}
