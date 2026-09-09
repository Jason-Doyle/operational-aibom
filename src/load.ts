import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { parse as parseYaml } from "yaml";
import { AibomError } from "./errors";
import {
  validateDocumentSchemaValue,
  validateManifestSchemaValue
} from "./schema";
import type { AibomDocument, AibomManifest, ValidationResult } from "./types";
import { validateDocument, validateManifest } from "./validate";

export async function readStructuredFile(path: string): Promise<unknown> {
  const content = await readFile(path, "utf8");

  try {
    return [".yaml", ".yml"].includes(extname(path).toLowerCase())
      ? parseYaml(content)
      : (JSON.parse(content) as unknown);
  } catch (error) {
    throw new AibomError(
      "file.parse",
      `Could not parse ${path}: ${(error as Error).message}`,
      { cause: error }
    );
  }
}

function invalidMessage(path: string, validation: ValidationResult): string {
  return validation.diagnostics
    .filter((diagnostic) => diagnostic.level === "error")
    .map(
      (diagnostic) => `${path}${diagnostic.path ?? ""}: ${diagnostic.message}`
    )
    .join("; ");
}

export async function loadAibomDocument(path: string): Promise<AibomDocument> {
  const value = await readStructuredFile(path);
  const validation = validateDocument(value);

  if (!validation.valid) {
    throw new AibomError("document.invalid", invalidMessage(path, validation));
  }

  return value as AibomDocument;
}

export function validateUnknownFile(
  value: unknown,
  type: "document" | "manifest"
): ValidationResult {
  return type === "document"
    ? validateDocument(value)
    : validateManifest(value);
}

export function isManifest(value: unknown): value is AibomManifest {
  return validateManifestSchemaValue(value).valid;
}

export function isDocument(value: unknown): value is AibomDocument {
  return validateDocumentSchemaValue(value).valid;
}
