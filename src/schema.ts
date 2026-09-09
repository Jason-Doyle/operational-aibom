import Ajv2020, {
  type ErrorObject,
  type ValidateFunction
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import aibomSchema from "../schemas/aibom.schema.json";
import manifestSchema from "../schemas/manifest.schema.json";
import type {
  AibomDocument,
  AibomManifest,
  Diagnostic,
  ValidationResult
} from "./types";

const ajv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: true,
  strict: true
});

addFormats(ajv);
ajv.addSchema(manifestSchema);

const validateManifestSchema = ajv.compile<AibomManifest>(manifestSchema);
const validateDocumentSchema = ajv.compile<AibomDocument>(aibomSchema);

function schemaDiagnostics(
  errors: ErrorObject[] | null | undefined
): Diagnostic[] {
  return (errors ?? []).map((error) => ({
    level: "error",
    code: `schema.${error.keyword}`,
    message: error.message ?? "Schema validation failed",
    path: error.instancePath || "/"
  }));
}

function validateWith<T>(
  validator: ValidateFunction<T>,
  value: unknown
): ValidationResult {
  const valid = validator(value);
  const diagnostics = valid ? [] : schemaDiagnostics(validator.errors);

  return {
    valid: diagnostics.length === 0,
    diagnostics
  };
}

export function validateManifestSchemaValue(value: unknown): ValidationResult {
  return validateWith(validateManifestSchema, value);
}

export function validateDocumentSchemaValue(value: unknown): ValidationResult {
  return validateWith(validateDocumentSchema, value);
}

export { aibomSchema, manifestSchema };
