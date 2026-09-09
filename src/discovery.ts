import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename, extname, join, posix } from "node:path";
import fg from "fast-glob";
import createIgnore, { type Ignore } from "ignore";
import {
  DEFAULT_DISCOVERY_EXCLUDES,
  DEFAULT_HASH_BYTES,
  DEFAULT_SOURCE_FILE_BYTES,
  TOOL_NAME
} from "./constants";
import {
  compareStrings,
  deterministicId,
  normalisePath,
  stableStringify
} from "./json";
import type {
  Component,
  ComponentType,
  Diagnostic,
  DiscoveryConfig,
  EvidenceRecord,
  JsonObject,
  Relationship,
  UnknownRecord
} from "./types";

export interface DiscoveryResult {
  components: Component[];
  relationships: Relationship[];
  evidence: EvidenceRecord[];
  unknowns: UnknownRecord[];
  diagnostics: Diagnostic[];
}

interface ComponentCatalogueEntry {
  type: ComponentType;
  category: string;
}

interface ModelPattern {
  provider: string;
  pattern: RegExp;
}

interface GitignoreFilter {
  directory: string;
  matcher: Ignore;
}

const MODEL_PATTERNS: ModelPattern[] = [
  {
    provider: "openai",
    pattern:
      /\b(?:gpt-[A-Za-z0-9][A-Za-z0-9._-]*|o1-(?:mini|preview)|o3(?:-(?:deep-research|mini|pro))?|o4-mini(?:-deep-research)?|text-embedding-[A-Za-z0-9._-]+)\b/g
  },
  {
    provider: "anthropic",
    pattern: /\bclaude-[A-Za-z0-9][A-Za-z0-9._-]*\b/g
  },
  {
    provider: "google",
    pattern: /\bgemini-[A-Za-z0-9][A-Za-z0-9._-]*\b/g
  },
  {
    provider: "mistral",
    pattern: /\b(?:mistral|codestral|ministral)-[A-Za-z0-9][A-Za-z0-9._-]*\b/g
  }
];

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cs",
  ".go",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".mjs",
  ".py",
  ".rs",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml"
]);

const MODEL_EXTENSIONS = new Set([
  ".gguf",
  ".h5",
  ".keras",
  ".onnx",
  ".pickle",
  ".pkl",
  ".pt",
  ".pth",
  ".safetensors",
  ".tflite"
]);

const DATASET_EXTENSIONS = new Set([".arrow", ".csv", ".jsonl", ".parquet"]);

const PACKAGE_CATALOGUE = new Map<string, ComponentCatalogueEntry>([
  [
    "@anthropic-ai/sdk",
    { type: "software-library", category: "model-provider-sdk" }
  ],
  [
    "@azure/openai",
    { type: "software-library", category: "model-provider-sdk" }
  ],
  [
    "@google/generative-ai",
    { type: "software-library", category: "model-provider-sdk" }
  ],
  ["@langchain/core", { type: "framework", category: "ai-framework" }],
  [
    "@microsoft/semantic-kernel",
    { type: "framework", category: "ai-framework" }
  ],
  [
    "@pinecone-database/pinecone",
    { type: "vector-database", category: "client-library" }
  ],
  [
    "@qdrant/js-client-rest",
    { type: "vector-database", category: "client-library" }
  ],
  ["ai", { type: "framework", category: "ai-framework" }],
  ["anthropic", { type: "software-library", category: "model-provider-sdk" }],
  ["chromadb", { type: "vector-database", category: "client-library" }],
  ["crewai", { type: "framework", category: "agent-framework" }],
  [
    "google-generativeai",
    { type: "software-library", category: "model-provider-sdk" }
  ],
  ["langchain", { type: "framework", category: "ai-framework" }],
  ["langgraph", { type: "framework", category: "agent-framework" }],
  ["llama-index", { type: "framework", category: "ai-framework" }],
  ["llamaindex", { type: "framework", category: "ai-framework" }],
  ["ollama", { type: "framework", category: "local-inference" }],
  ["openai", { type: "software-library", category: "model-provider-sdk" }],
  ["pgvector", { type: "vector-database", category: "client-library" }],
  ["pinecone", { type: "vector-database", category: "client-library" }],
  ["semantic-kernel", { type: "framework", category: "ai-framework" }],
  ["tensorflow", { type: "framework", category: "machine-learning-framework" }],
  ["torch", { type: "framework", category: "machine-learning-framework" }],
  ["transformers", { type: "framework", category: "model-framework" }],
  ["weaviate-client", { type: "vector-database", category: "client-library" }],
  [
    "weaviate-ts-client",
    { type: "vector-database", category: "client-library" }
  ]
]);

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function mergeComponents(existing: Component, incoming: Component): Component {
  const properties: JsonObject = {
    ...(existing.properties ?? {}),
    ...(incoming.properties ?? {})
  };
  const declaredVersions = unique(
    [
      existing.properties?.declaredVersion,
      incoming.properties?.declaredVersion,
      ...(Array.isArray(existing.properties?.declaredVersions)
        ? existing.properties.declaredVersions
        : []),
      ...(Array.isArray(incoming.properties?.declaredVersions)
        ? incoming.properties.declaredVersions
        : [])
    ].filter((value): value is string => typeof value === "string")
  ).sort(compareStrings);
  if (declaredVersions.length > 1) {
    delete properties.declaredVersion;
    properties.declaredVersions = declaredVersions;
  }
  const dependencySections = unique(
    [
      existing.properties?.dependencySection,
      incoming.properties?.dependencySection,
      ...(Array.isArray(existing.properties?.dependencySections)
        ? existing.properties.dependencySections
        : []),
      ...(Array.isArray(incoming.properties?.dependencySections)
        ? incoming.properties.dependencySections
        : [])
    ].filter((value): value is string => typeof value === "string")
  ).sort(compareStrings);
  if (dependencySections.length > 1) {
    delete properties.dependencySection;
    properties.dependencySections = dependencySections;
  }

  return {
    ...existing,
    ...incoming,
    id: existing.id,
    origin: existing.origin === incoming.origin ? existing.origin : "merged",
    hashes: uniqueObjects([
      ...(existing.hashes ?? []),
      ...(incoming.hashes ?? [])
    ]),
    locations: uniqueObjects([
      ...(existing.locations ?? []),
      ...(incoming.locations ?? [])
    ]),
    evidence: unique([
      ...(existing.evidence ?? []),
      ...(incoming.evidence ?? [])
    ]),
    properties
  };
}

function uniqueObjects<T>(values: T[]): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = stableStringify(value, 0);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isIgnoredByGitignore(
  path: string,
  filters: GitignoreFilter[]
): boolean {
  let ignored = false;

  for (const filter of filters) {
    if (filter.directory !== "" && !path.startsWith(`${filter.directory}/`)) {
      continue;
    }

    const relativePath =
      filter.directory === "" ? path : path.slice(filter.directory.length + 1);
    const result = filter.matcher.test(relativePath);
    if (result.ignored) {
      ignored = true;
    } else if (result.unignored) {
      ignored = false;
    }
  }

  return ignored;
}

async function createGitignoreFilters(
  root: string,
  useGitignore: boolean,
  excludes: string[]
): Promise<GitignoreFilter[]> {
  if (!useGitignore) {
    return [];
  }

  const candidates = (
    await fg([".gitignore", "**/.gitignore"], {
      cwd: root,
      dot: true,
      caseSensitiveMatch: false,
      followSymbolicLinks: false,
      ignore: excludes,
      onlyFiles: true,
      unique: true
    })
  )
    .map(normalisePath)
    .sort((left, right) => {
      const depthDifference = left.split("/").length - right.split("/").length;
      return depthDifference === 0
        ? compareStrings(left, right)
        : depthDifference;
    });
  const filters: GitignoreFilter[] = [];

  for (const path of candidates) {
    if (isIgnoredByGitignore(path, filters)) {
      continue;
    }

    const directory = posix.dirname(path);
    filters.push({
      directory: directory === "." ? "" : directory,
      matcher: createIgnore().add(await readFile(join(root, path), "utf8"))
    });
  }

  return filters;
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk as Buffer);
  }

  return hash.digest("hex");
}

function pathSegments(path: string): string[] {
  return normalisePath(path).toLowerCase().split("/");
}

function hasDataContext(path: string): boolean {
  const segments = pathSegments(path);
  const name = basename(path).toLowerCase();
  return (
    segments.some((segment) =>
      [
        "data",
        "dataset",
        "datasets",
        "eval",
        "evaluation",
        "training"
      ].includes(segment)
    ) ||
    /(?:^|[-_.])(dataset|eval|evaluation|train|training)(?:[-_.]|$)/u.test(name)
  );
}

function artifactType(path: string): ComponentType | undefined {
  const lowerPath = normalisePath(path).toLowerCase();
  const extension = extname(lowerPath);
  const segments = pathSegments(lowerPath);
  const name = basename(lowerPath);

  if (
    segments.some((segment) => segment === "prompt" || segment === "prompts") ||
    name.includes(".prompt.") ||
    name.endsWith(".prompt")
  ) {
    return "prompt";
  }

  if (MODEL_EXTENSIONS.has(extension)) {
    return "local-model";
  }

  if (extension === ".faiss") {
    return "retrieval-index";
  }

  if (DATASET_EXTENSIONS.has(extension) && hasDataContext(lowerPath)) {
    return segments.some((segment) => ["eval", "evaluation"].includes(segment))
      ? "evaluation-dataset"
      : "dataset";
  }

  return undefined;
}

function componentIdentity(
  type: ComponentType,
  name: string,
  provider?: string
): string {
  return [type, provider?.toLowerCase() ?? "", name.toLowerCase()].join("|");
}

function packageLine(content: string, packageName: string): number | undefined {
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const packageKey = new RegExp(`^\\s*"${escapedName}"\\s*:`, "iu");
  const index = content
    .split(/\r?\n/u)
    .findIndex((line) => packageKey.test(line));
  return index === -1 ? undefined : index + 1;
}

const SAFE_MODEL_TOKEN_CHARACTER = /[A-Za-z0-9._/-]/u;
const CONFIGURATION_EXTENSIONS = new Set([".toml", ".yaml", ".yml"]);
const MODEL_CONFIGURATION_KEY =
  /\b(?:deployment|embedding(?:[_-]?model)?|fallback|llm|model(?:s|[_-]?(?:id|name|deployment))?|provider[_-]?model)\b\s*[:=]/iu;
const MODEL_PATH_SEGMENTS = new Set([
  "anthropic",
  "azure",
  "bedrock",
  "deployment",
  "deployments",
  "gemini",
  "google",
  "mistral",
  "model",
  "models",
  "openai",
  "provider",
  "providers"
]);

function modelTokenBounds(
  line: string,
  match: RegExpMatchArray
): { end: number; start: number } | undefined {
  if (match.index === undefined) {
    return undefined;
  }

  let start = match.index;
  let end = match.index + match[0].length;
  while (start > 0 && SAFE_MODEL_TOKEN_CHARACTER.test(line[start - 1] ?? "")) {
    start -= 1;
  }
  while (
    end < line.length &&
    SAFE_MODEL_TOKEN_CHARACTER.test(line[end] ?? "")
  ) {
    end += 1;
  }

  return { start, end };
}

function isQuotedModelToken(
  line: string,
  bounds: { end: number; start: number }
): boolean {
  const before = line[bounds.start - 1];
  const after = line[bounds.end];
  return (
    before !== undefined && before === after && ['"', "'", "`"].includes(before)
  );
}

function isUnquotedConfigurationToken(
  line: string,
  bounds: { end: number; start: number },
  extension: string
): boolean {
  if (!CONFIGURATION_EXTENSIONS.has(extension)) {
    return false;
  }
  if (/^\s*#/u.test(line)) {
    return false;
  }

  const beforeToken = line.slice(0, bounds.start);
  const preceding = line[bounds.start - 1];
  const following = line[bounds.end];
  const precedingIsDelimiter =
    preceding === undefined || /[\s:[,=]/u.test(preceding);
  const followingIsDelimiter =
    following === undefined || /[\s,\]})#]/u.test(following);

  return (
    precedingIsDelimiter &&
    followingIsDelimiter &&
    MODEL_CONFIGURATION_KEY.test(beforeToken)
  );
}

function isSupportedModelReference(
  line: string,
  match: RegExpMatchArray,
  extension: string
): boolean {
  const bounds = modelTokenBounds(line, match);
  if (bounds === undefined) {
    return false;
  }

  const tokenSegments = line.slice(bounds.start, bounds.end).split("/");
  const prefixSegments = tokenSegments.slice(0, -1);
  if (
    tokenSegments.at(-1) !== match[0] ||
    prefixSegments.some(
      (segment) => !MODEL_PATH_SEGMENTS.has(segment.toLowerCase())
    )
  ) {
    return false;
  }

  return (
    isQuotedModelToken(line, bounds) ||
    isUnquotedConfigurationToken(line, bounds, extension)
  );
}

function parsePackageJson(
  content: string
): Array<{ name: string; declaredVersion: string; section: string }> {
  const value = JSON.parse(content) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  const sections = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies"
  ] as const;

  return sections.flatMap((section) =>
    Object.entries(value[section] ?? {}).map(([name, declaredVersion]) => ({
      name,
      declaredVersion,
      section
    }))
  );
}

function parseRequirements(
  content: string
): Array<{ name: string; declaredVersion: string; line: number }> {
  return content
    .split(/\r?\n/u)
    .map((rawLine, index) => ({ rawLine, line: index + 1 }))
    .filter(({ rawLine }) => {
      const line = rawLine.trim();
      return line !== "" && !line.startsWith("#") && !line.startsWith("-");
    })
    .flatMap(({ rawLine, line }) => {
      const match = rawLine
        .split("#", 1)[0]
        ?.trim()
        .match(/^([A-Za-z0-9_.-]+)\s*(.*)$/u);
      if (match?.[1] === undefined) {
        return [];
      }

      return [
        {
          name: match[1].replaceAll("_", "-"),
          declaredVersion: match[2]?.trim() ?? "",
          line
        }
      ];
    });
}

export async function discoverRepository(
  root: string,
  systemId: string,
  config: DiscoveryConfig,
  observedAt: string,
  excludedPaths: string[] = []
): Promise<DiscoveryResult> {
  const components = new Map<string, Component>();
  const relationships = new Map<string, Relationship>();
  const evidence = new Map<string, EvidenceRecord>();
  const unknowns = new Map<string, UnknownRecord>();
  const diagnostics: Diagnostic[] = [];
  const sensitivity = config.defaultSensitivity ?? "internal";
  const maxSourceFileBytes =
    config.maxSourceFileBytes ?? DEFAULT_SOURCE_FILE_BYTES;
  const maxHashBytes = config.maxHashBytes ?? DEFAULT_HASH_BYTES;
  const discoveryExcludes = [
    ...DEFAULT_DISCOVERY_EXCLUDES,
    ...(config.exclude ?? [])
  ];
  const gitignoreFilters = await createGitignoreFilters(
    root,
    config.useGitignore ?? true,
    discoveryExcludes
  );
  const exactExcludes = new Set(excludedPaths.map(normalisePath));
  const files = (
    await fg(config.include ?? ["**/*"], {
      cwd: root,
      dot: true,
      caseSensitiveMatch: false,
      followSymbolicLinks: false,
      ignore: discoveryExcludes,
      onlyFiles: true,
      unique: true
    })
  )
    .map(normalisePath)
    .filter((path) => !exactExcludes.has(path))
    .filter((path) => !isIgnoredByGitignore(path, gitignoreFilters))
    .sort(compareStrings);

  const addComponent = (component: Component): void => {
    const key =
      typeof component.properties?.artifactPath === "string"
        ? `artifact|${component.id}`
        : componentIdentity(
            component.type,
            component.name,
            typeof component.properties?.provider === "string"
              ? component.properties.provider
              : undefined
          );
    const current = components.get(key);
    components.set(
      key,
      current ? mergeComponents(current, component) : component
    );
  };

  const addRelationship = (
    from: string,
    type: string,
    to: string,
    evidenceIds: string[]
  ): void => {
    const key = `${from}|${type}|${to}`;
    const current = relationships.get(key);
    const relationship: Relationship = {
      id: deterministicId("relationship", { from, type, to }),
      from,
      type,
      to,
      sensitivity,
      evidence: unique([...(current?.evidence ?? []), ...evidenceIds])
    };
    relationships.set(key, relationship);
  };

  const addPackage = (
    name: string,
    declaredVersion: string,
    path: string,
    line: number | undefined,
    section: string
  ): void => {
    const normalisedName = name.toLowerCase();
    const catalogue = PACKAGE_CATALOGUE.get(normalisedName);
    if (catalogue === undefined) {
      return;
    }

    const componentId = deterministicId("component", {
      type: catalogue.type,
      name: normalisedName
    });
    const evidenceId = deterministicId("evidence", {
      collector: "package-manifest",
      path,
      line,
      name,
      declaredVersion,
      section
    });
    const packageProperties: JsonObject = {
      category: catalogue.category,
      declaredVersion,
      dependencySection: section,
      usageAssertion: "dependency-declaration"
    };

    evidence.set(evidenceId, {
      id: evidenceId,
      class: "component-fact",
      subject: componentId,
      claim: `Dependency declaration references ${name}${declaredVersion === "" ? "" : ` ${declaredVersion}`}.`,
      method: "package-manifest-inspection",
      observedAt,
      confidence: 1,
      scope:
        "The package manifest contains this declaration; installation or runtime use is not established.",
      source: {
        type: "file",
        path,
        lineStart: line,
        lineEnd: line,
        collector: TOOL_NAME
      },
      sensitivity,
      properties: {
        diffMode: "content"
      }
    });
    addComponent({
      id: componentId,
      type: catalogue.type,
      name,
      origin: "discovered",
      sensitivity,
      locations: [
        {
          path,
          lineStart: line,
          lineEnd: line
        }
      ],
      properties: packageProperties,
      evidence: [evidenceId]
    });
    addRelationship(systemId, "depends-on", componentId, [evidenceId]);
  };

  for (const path of files) {
    const absolutePath = join(root, path);
    const fileStat = await stat(absolutePath);
    const detectedArtifactType = artifactType(path);

    if (detectedArtifactType !== undefined) {
      const componentId = deterministicId("component", {
        type: detectedArtifactType,
        path
      });
      const digest =
        fileStat.size <= maxHashBytes
          ? await hashFile(absolutePath)
          : undefined;
      const evidenceId = deterministicId("evidence", {
        collector: "file-artifact",
        type: detectedArtifactType,
        path,
        digest
      });
      const hashes =
        digest === undefined
          ? undefined
          : [
              {
                algorithm: "SHA-256" as const,
                value: digest
              }
            ];

      evidence.set(evidenceId, {
        id: evidenceId,
        class: "component-fact",
        subject: componentId,
        claim: `Repository contains a ${detectedArtifactType} artifact at ${path}.`,
        method: "file-extension-and-path-inspection",
        observedAt,
        confidence: detectedArtifactType === "dataset" ? 0.8 : 0.95,
        scope: "Presence is established; operational use is not established.",
        source: {
          type: "file",
          path,
          digest:
            digest === undefined
              ? undefined
              : {
                  algorithm: "SHA-256",
                  value: digest
                },
          collector: TOOL_NAME
        },
        sensitivity,
        properties: {
          diffMode: "content"
        }
      });
      addComponent({
        id: componentId,
        type: detectedArtifactType,
        name: basename(path),
        origin: "discovered",
        sensitivity,
        hashes,
        locations: [{ path }],
        properties: {
          artifactPath: path,
          fileSize: fileStat.size,
          usageAssertion: "repository-presence"
        },
        evidence: [evidenceId]
      });
      addRelationship(systemId, "references", componentId, [evidenceId]);

      if (digest === undefined) {
        const unknownId = deterministicId("unknown", {
          subject: componentId,
          field: "hashes.SHA-256",
          path
        });
        unknowns.set(unknownId, {
          id: unknownId,
          class: "explicit-unknown",
          subject: componentId,
          field: "hashes.SHA-256",
          reason: `The file is ${fileStat.size} bytes, above the configured maxHashBytes value of ${maxHashBytes}.`,
          consequence:
            "This generated record cannot establish byte-level identity for the artifact.",
          sensitivity
        });
      }
    }

    const lowerName = basename(path).toLowerCase();
    const sourceExtension = extname(lowerName);
    const shouldReadSource =
      fileStat.size <= maxSourceFileBytes &&
      SOURCE_EXTENSIONS.has(sourceExtension);
    let sourceContent: string | undefined;

    if (
      shouldReadSource ||
      lowerName === "package.json" ||
      /^requirements(?:[.-].*)?\.txt$/u.test(lowerName)
    ) {
      sourceContent = await readFile(absolutePath, "utf8");
    }

    if (lowerName === "package.json" && sourceContent !== undefined) {
      try {
        for (const entry of parsePackageJson(sourceContent)) {
          addPackage(
            entry.name,
            entry.declaredVersion,
            path,
            packageLine(sourceContent, entry.name.toLowerCase()),
            entry.section
          );
        }
      } catch (error) {
        diagnostics.push({
          level: "warning",
          code: "discovery.package-json",
          message: `Could not parse ${path}: ${(error as Error).message}`,
          path
        });
      }
    }

    if (
      /^requirements(?:[.-].*)?\.txt$/u.test(lowerName) &&
      sourceContent !== undefined
    ) {
      for (const entry of parseRequirements(sourceContent)) {
        addPackage(
          entry.name,
          entry.declaredVersion,
          path,
          entry.line,
          "requirements"
        );
      }
    }

    if (!shouldReadSource || sourceContent === undefined) {
      continue;
    }

    const fileDigest = await hashFile(absolutePath);
    const lines = sourceContent.split(/\r?\n/u);
    lines.forEach((line, index) => {
      for (const modelPattern of MODEL_PATTERNS) {
        const matches = [...line.matchAll(modelPattern.pattern)].filter(
          (match) => isSupportedModelReference(line, match, sourceExtension)
        );
        for (const match of matches) {
          const modelName = match[0];
          const componentType: ComponentType = modelName.includes("embedding")
            ? "embedding-model"
            : "hosted-model";
          const componentId = deterministicId("component", {
            type: componentType,
            provider: modelPattern.provider,
            name: modelName.toLowerCase()
          });
          const evidenceId = deterministicId("evidence", {
            collector: "model-reference",
            provider: modelPattern.provider,
            modelName,
            path,
            line: index + 1
          });

          evidence.set(evidenceId, {
            id: evidenceId,
            class: "component-fact",
            subject: componentId,
            claim: `Source contains a reference to ${modelPattern.provider} model identifier ${modelName}.`,
            method: "source-pattern-inspection",
            observedAt,
            confidence: 0.85,
            scope:
              "The identifier is referenced in source or configuration; deployment or request-level use is not established.",
            source: {
              type: "file",
              path,
              lineStart: index + 1,
              lineEnd: index + 1,
              digest: {
                algorithm: "SHA-256",
                value: fileDigest
              },
              collector: TOOL_NAME
            },
            sensitivity,
            properties: {
              diffMode: "content"
            }
          });
          addComponent({
            id: componentId,
            type: componentType,
            name: modelName,
            origin: "discovered",
            sensitivity,
            locations: [
              {
                path,
                lineStart: index + 1,
                lineEnd: index + 1
              }
            ],
            properties: {
              provider: modelPattern.provider,
              usageAssertion: "source-reference"
            },
            evidence: [evidenceId]
          });
          addRelationship(systemId, "references", componentId, [evidenceId]);
        }
      }
    });
  }

  return {
    components: [...components.values()],
    relationships: [...relationships.values()],
    evidence: [...evidence.values()],
    unknowns: [...unknowns.values()],
    diagnostics
  };
}
