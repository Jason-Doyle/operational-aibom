import { isAbsolute, relative, resolve } from "node:path";
import { SCHEMA_VERSION } from "./constants";
import { contextFromEnvironment, mergeContexts } from "./context";
import { discoverRepository, type DiscoveryResult } from "./discovery";
import { finaliseDocument, type AibomDocumentContent } from "./document";
import { AibomError } from "./errors";
import {
  compareStrings,
  deterministicId,
  normalisePath,
  stableStringify
} from "./json";
import { loadManifest } from "./manifest";
import type {
  AibomContext,
  Component,
  EvidenceRecord,
  GenerationOptions,
  GenerationResult,
  JsonObject,
  Relationship,
  Sensitivity
} from "./types";
import { validateDocument } from "./validate";

function normaliseGeneratedAt(value: string | undefined): string {
  const date = value === undefined ? new Date() : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new AibomError(
      "generation.timestamp",
      `Invalid generated-at timestamp: ${value}`
    );
  }

  return date.toISOString();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function uniqueObjects<T>(values: T[]): T[] {
  const records = new Map<string, T>();
  for (const value of values) {
    records.set(stableStringify(value, 0), value);
  }
  return [...records.values()];
}

function componentIdentity(component: Component): string {
  const provider =
    typeof component.properties?.provider === "string"
      ? component.properties.provider
      : "";
  return [
    component.type,
    provider.toLowerCase(),
    component.name.toLowerCase(),
    component.version?.toLowerCase() ?? ""
  ].join("|");
}

function mergeComponent(declared: Component, discovered: Component): Component {
  const locations = uniqueObjects([
    ...(declared.locations ?? []),
    ...(discovered.locations ?? [])
  ]);
  const properties: JsonObject = {
    ...(discovered.properties ?? {}),
    ...(declared.properties ?? {})
  };
  const artifactPaths = uniqueStrings(
    [
      declared.properties?.artifactPath,
      discovered.properties?.artifactPath,
      ...(Array.isArray(declared.properties?.artifactPaths)
        ? declared.properties.artifactPaths
        : []),
      ...(Array.isArray(discovered.properties?.artifactPaths)
        ? discovered.properties.artifactPaths
        : [])
    ].filter((value): value is string => typeof value === "string")
  );
  if (artifactPaths.length > 1) {
    delete properties.artifactPath;
    delete properties.fileSize;
    properties.artifactPaths = artifactPaths;
    properties.artifactCount = artifactPaths.length;
  }

  return {
    ...discovered,
    ...declared,
    origin: "merged",
    hashes: uniqueObjects([
      ...(declared.hashes ?? []),
      ...(discovered.hashes ?? [])
    ]),
    locations,
    licences: uniqueStrings([
      ...(declared.licences ?? []),
      ...(discovered.licences ?? [])
    ]),
    evidence: uniqueStrings([
      ...(declared.evidence ?? []),
      ...(discovered.evidence ?? [])
    ]),
    properties
  };
}

function withSensitivity<T extends { sensitivity?: Sensitivity }>(
  record: T,
  fallback: Sensitivity
): T {
  return {
    ...record,
    sensitivity: record.sensitivity ?? fallback
  };
}

function normaliseRelationship(
  relationship: Omit<Relationship, "id"> | Relationship,
  fallback: Sensitivity
): Relationship {
  const id =
    "id" in relationship && relationship.id !== undefined
      ? relationship.id
      : deterministicId("relationship", {
          from: relationship.from,
          type: relationship.type,
          to: relationship.to
        });

  return withSensitivity(
    {
      ...relationship,
      id
    },
    fallback
  );
}

function mergeRelationships(relationships: Relationship[]): Relationship[] {
  const merged = new Map<string, Relationship>();

  for (const relationship of relationships) {
    const key = `${relationship.from}|${relationship.type}|${relationship.to}`;
    const current = merged.get(key);
    if (current === undefined) {
      merged.set(key, relationship);
      continue;
    }

    merged.set(key, {
      ...relationship,
      ...current,
      evidence: uniqueStrings([
        ...(current.evidence ?? []),
        ...(relationship.evidence ?? [])
      ]),
      properties: {
        ...(relationship.properties ?? {}),
        ...(current.properties ?? {})
      }
    });
  }

  return [...merged.values()];
}

function mergeById<T extends { id: string }>(
  discovered: T[],
  declared: T[]
): T[] {
  return [
    ...new Map(
      [...discovered, ...declared].map((entry) => [entry.id, entry])
    ).values()
  ];
}

function sortById<T extends { id: string }>(values: T[]): T[] {
  return values.sort((left, right) => compareStrings(left.id, right.id));
}

function remapDiscovery(
  discovery: DiscoveryResult,
  idMap: Map<string, string>
): DiscoveryResult {
  const remap = (id: string): string => idMap.get(id) ?? id;

  return {
    ...discovery,
    relationships: discovery.relationships.map((relationship) => ({
      ...relationship,
      id: deterministicId("relationship", {
        from: remap(relationship.from),
        type: relationship.type,
        to: remap(relationship.to)
      }),
      from: remap(relationship.from),
      to: remap(relationship.to)
    })),
    evidence: discovery.evidence.map((record) => ({
      ...record,
      subject: remap(record.subject)
    })),
    unknowns: discovery.unknowns.map((record) => ({
      ...record,
      subject: remap(record.subject)
    }))
  };
}

function contextEvidence(
  context: AibomContext,
  systemId: string,
  generatedAt: string
): EvidenceRecord[] {
  if (context.workflow === undefined && context.workflowRunId === undefined) {
    return [];
  }

  const id = deterministicId("evidence", {
    workflow: context.workflow,
    workflowRunId: context.workflowRunId,
    commit: context.commit
  });

  return [
    {
      id,
      class: "component-fact",
      subject: systemId,
      claim: "The generated record includes GitHub Actions build context.",
      method: "workflow-environment-inspection",
      observedAt: generatedAt,
      confidence: 1,
      scope:
        "This establishes the workflow context exposed to the action, not the correctness of repository declarations.",
      source: {
        type: "workflow",
        uri:
          context.repository !== undefined &&
          context.workflowRunId !== undefined
            ? `https://github.com/${context.repository}/actions/runs/${context.workflowRunId}`
            : undefined,
        collector: "operational-aibom"
      },
      sensitivity: "internal",
      properties: {
        diffMode: "run"
      }
    }
  ];
}

function manifestEvidence(
  systemId: string,
  path: string | undefined,
  digest: { algorithm: "SHA-256"; value: string } | undefined,
  generatedAt: string
): EvidenceRecord[] {
  if (path === undefined || digest === undefined) {
    return [];
  }

  const id = deterministicId("evidence", {
    type: "manifest",
    path,
    digest
  });

  return [
    {
      id,
      class: "component-fact",
      subject: systemId,
      claim: `Generation used a manifest matching SHA-256 ${digest.value}.`,
      method: "manifest-digest",
      observedAt: generatedAt,
      confidence: 1,
      scope:
        "The digest establishes manifest identity; it does not independently verify claims in the manifest.",
      source: {
        type: "manifest",
        path,
        digest,
        collector: "operational-aibom"
      },
      sensitivity: "internal",
      properties: {
        diffMode: "content"
      }
    }
  ];
}

function contentProperties(
  values: JsonObject | undefined
): JsonObject | undefined {
  return values === undefined || Object.keys(values).length === 0
    ? undefined
    : values;
}

function normaliseExcludedPaths(root: string, paths: string[]): string[] {
  return paths.flatMap((path) => {
    const relativePath = normalisePath(relative(root, resolve(root, path)));
    return relativePath === "" ||
      relativePath === ".." ||
      relativePath.startsWith("../") ||
      isAbsolute(relativePath)
      ? []
      : [relativePath];
  });
}

export async function generateAibom(
  options: GenerationOptions
): Promise<GenerationResult> {
  const root = resolve(options.root);
  const generatedAt = normaliseGeneratedAt(options.generatedAt);
  const loaded = await loadManifest(root, options.manifestPath);
  const manifest = loaded.manifest;
  const sourcePath =
    loaded.path === undefined
      ? undefined
      : normalisePath(relative(root, loaded.path));
  const defaultSensitivity =
    manifest.publication?.defaultSensitivity ??
    manifest.discovery?.defaultSensitivity ??
    "internal";
  const system = withSensitivity(manifest.system, defaultSensitivity);
  const context = mergeContexts(
    manifest.context,
    options.environmentContext === false ? undefined : contextFromEnvironment(),
    options.context
  );
  const declaredComponents: Component[] = (manifest.components ?? []).map(
    (component) =>
      withSensitivity(
        {
          ...component,
          origin: component.origin ?? "declared",
          properties: contentProperties(component.properties)
        },
        defaultSensitivity
      )
  );
  const discovery =
    options.discovery !== false && manifest.discovery?.enabled !== false
      ? await discoverRepository(
          root,
          system.id,
          manifest.discovery ?? {},
          generatedAt,
          normaliseExcludedPaths(
            root,
            [...(options.excludePaths ?? []), sourcePath].filter(
              (path): path is string => path !== undefined
            )
          )
        )
      : {
          components: [],
          relationships: [],
          evidence: [],
          unknowns: [],
          diagnostics: []
        };
  const declaredByIdentity = new Map(
    declaredComponents.map((component) => [
      componentIdentity(component),
      component
    ])
  );
  const idMap = new Map<string, string>();
  const mergedComponents = new Map<string, Component>(
    declaredComponents.map((component) => [component.id, component])
  );

  for (const discovered of discovery.components) {
    const declared = declaredByIdentity.get(componentIdentity(discovered));
    if (declared === undefined) {
      mergedComponents.set(
        discovered.id,
        withSensitivity(discovered, defaultSensitivity)
      );
      continue;
    }

    idMap.set(discovered.id, declared.id);
    const current = mergedComponents.get(declared.id) ?? declared;
    mergedComponents.set(declared.id, mergeComponent(current, discovered));
  }

  const remappedDiscovery = remapDiscovery(discovery, idMap);
  const relationships = mergeRelationships([
    ...(manifest.relationships ?? []).map((relationship) =>
      normaliseRelationship(relationship, defaultSensitivity)
    ),
    ...remappedDiscovery.relationships.map((relationship) =>
      withSensitivity(relationship, defaultSensitivity)
    )
  ]);
  const evidence = mergeById(
    [
      ...remappedDiscovery.evidence,
      ...manifestEvidence(system.id, sourcePath, loaded.digest, generatedAt),
      ...contextEvidence(context, system.id, generatedAt)
    ],
    (manifest.evidence ?? []).map((record) =>
      withSensitivity(record, defaultSensitivity)
    )
  );
  const assessments = (manifest.assessments ?? []).map((record) =>
    withSensitivity(record, defaultSensitivity)
  );
  const observations = (manifest.observations ?? []).map((record) =>
    withSensitivity(record, defaultSensitivity)
  );
  const unknowns = mergeById(
    remappedDiscovery.unknowns,
    (manifest.unknowns ?? []).map((record) =>
      withSensitivity(record, defaultSensitivity)
    )
  );
  const content: AibomDocumentContent = {
    schemaVersion: SCHEMA_VERSION,
    system,
    context,
    components: sortById([...mergedComponents.values()]),
    relationships: sortById(relationships),
    evidence: sortById(evidence),
    assessments: sortById(assessments),
    observations: sortById(observations),
    unknowns: sortById(unknowns)
  };
  const document = finaliseDocument(
    content,
    {
      path: sourcePath,
      digest: loaded.digest,
      manifestPresent: loaded.present
    },
    generatedAt
  );
  const validation = validateDocument(document);

  if (!validation.valid) {
    throw new AibomError(
      "generation.invalid",
      validation.diagnostics
        .filter((diagnostic) => diagnostic.level === "error")
        .map((diagnostic) => diagnostic.message)
        .join("; ")
    );
  }

  return {
    document,
    diagnostics: [...remappedDiscovery.diagnostics, ...validation.diagnostics]
  };
}
