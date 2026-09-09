import { access, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { SCHEMA_VERSION } from "./constants";
import { AibomError } from "./errors";
import { deterministicId, normalisePath, sha256 } from "./json";
import type { AibomManifest, HashValue } from "./types";
import { validateManifest } from "./validate";

export interface LoadedManifest {
  manifest: AibomManifest;
  path?: string;
  digest?: HashValue;
  present: boolean;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function defaultManifest(root: string): AibomManifest {
  const name = basename(resolve(root));

  return {
    schemaVersion: SCHEMA_VERSION,
    system: {
      id: deterministicId("system", name.toLowerCase()),
      name,
      sensitivity: "internal"
    },
    unknowns: [
      {
        id: deterministicId("unknown", {
          subject: name,
          field: "owner"
        }),
        class: "explicit-unknown",
        subject: deterministicId("system", name.toLowerCase()),
        field: "owner",
        reason:
          "No aibom.yaml manifest was present when the record was generated.",
        consequence: "The accountable system owner is not recorded.",
        sensitivity: "internal"
      },
      {
        id: deterministicId("unknown", {
          subject: name,
          field: "intendedUse"
        }),
        class: "explicit-unknown",
        subject: deterministicId("system", name.toLowerCase()),
        field: "intendedUse",
        reason:
          "No aibom.yaml manifest was present when the record was generated.",
        consequence:
          "The intended operating scope cannot be evaluated from this record.",
        sensitivity: "internal"
      }
    ],
    discovery: {
      enabled: true,
      useGitignore: true,
      defaultSensitivity: "internal"
    },
    publication: {
      defaultSensitivity: "internal"
    }
  };
}

function parseManifest(content: string, path: string): unknown {
  try {
    if (path.toLowerCase().endsWith(".json")) {
      return JSON.parse(content) as unknown;
    }

    return parseYaml(content);
  } catch (error) {
    throw new AibomError(
      "manifest.parse",
      `Could not parse manifest ${normalisePath(path)}: ${(error as Error).message}`,
      { cause: error }
    );
  }
}

export async function loadManifest(
  root: string,
  manifestPath?: string
): Promise<LoadedManifest> {
  const explicit = manifestPath !== undefined;
  const resolvedPath = resolve(root, manifestPath ?? "aibom.yaml");

  if (!(await fileExists(resolvedPath))) {
    if (explicit) {
      throw new AibomError(
        "manifest.missing",
        `Manifest not found: ${normalisePath(resolvedPath)}`
      );
    }

    return {
      manifest: defaultManifest(root),
      present: false
    };
  }

  const content = await readFile(resolvedPath, "utf8");
  const value = parseManifest(content, resolvedPath);
  const validation = validateManifest(value);

  if (!validation.valid) {
    const details = validation.diagnostics
      .map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`)
      .join("; ");
    throw new AibomError(
      "manifest.invalid",
      `Manifest validation failed for ${normalisePath(resolvedPath)}: ${details}`
    );
  }

  return {
    manifest: value as AibomManifest,
    path: resolvedPath,
    digest: {
      algorithm: "SHA-256",
      value: sha256(content)
    },
    present: true
  };
}

export async function initialiseManifest(
  root: string,
  path = "aibom.yaml"
): Promise<string> {
  const resolvedPath = resolve(root, path);

  if (await fileExists(resolvedPath)) {
    throw new AibomError(
      "manifest.exists",
      `Manifest already exists: ${normalisePath(resolvedPath)}`
    );
  }

  const name = basename(resolve(root));
  const systemId = deterministicId("system", name.toLowerCase());
  const manifest: AibomManifest = {
    schemaVersion: SCHEMA_VERSION,
    system: {
      id: systemId,
      name,
      sensitivity: "internal"
    },
    components: [],
    relationships: [],
    evidence: [],
    assessments: [],
    observations: [],
    unknowns: [
      {
        id: deterministicId("unknown", {
          subject: systemId,
          field: "owner"
        }),
        class: "explicit-unknown",
        subject: systemId,
        field: "owner",
        reason: "The accountable system owner has not been declared.",
        consequence:
          "Ownership-dependent review and response cannot be routed.",
        sensitivity: "internal"
      },
      {
        id: deterministicId("unknown", {
          subject: systemId,
          field: "intendedUse"
        }),
        class: "explicit-unknown",
        subject: systemId,
        field: "intendedUse",
        reason: "The approved operating scope has not been declared.",
        consequence:
          "Assessments cannot be evaluated against a stated intended use.",
        sensitivity: "internal"
      }
    ],
    discovery: {
      enabled: true,
      useGitignore: true,
      exclude: [],
      maxSourceFileBytes: 1_000_000,
      maxHashBytes: 50_000_000,
      defaultSensitivity: "internal"
    },
    publication: {
      defaultSensitivity: "internal"
    }
  };

  await writeFile(resolvedPath, stringifyYaml(manifest), "utf8");
  return resolvedPath;
}
