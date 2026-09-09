import { readFile } from "node:fs/promises";
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import addFormats2019 from "ajv-formats-draft2019";

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

function validationError(name, errors) {
  return new Error(
    `${name} validation failed:\n${JSON.stringify(errors, null, 2)}`
  );
}

async function validateCycloneDx() {
  const base = "https://cyclonedx.org/schema/";
  const [schema, spdx, jsf, cryptography] = await Promise.all([
    fetchJson(`${base}bom-1.7.schema.json`),
    fetchJson(`${base}spdx.schema.json`),
    fetchJson(`${base}jsf-0.82.schema.json`),
    fetchJson(`${base}cryptography-defs.schema.json`)
  ]);
  const document = JSON.parse(
    await readFile("examples/rag-agent/expected/aibom.cdx.json", "utf8")
  );
  const ajv = new Ajv({ allErrors: true, logger: false, strict: false });
  addFormats(ajv);
  addFormats2019(ajv);
  ajv.addSchema(spdx);
  ajv.addSchema(jsf);
  ajv.addSchema(cryptography);
  const validate = ajv.compile(schema);

  if (!validate(document)) {
    throw validationError("CycloneDX 1.7", validate.errors);
  }
}

async function validateSpdx() {
  const schema = await fetchJson(
    "https://spdx.org/schema/3.0.1/spdx-json-schema.json"
  );
  const document = JSON.parse(
    await readFile("examples/rag-agent/expected/aibom.spdx.jsonld", "utf8")
  );
  const ajv = new Ajv2020({
    allErrors: true,
    logger: false,
    strict: false
  });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  if (!validate(document)) {
    throw validationError("SPDX 3.0.1", validate.errors);
  }
}

await Promise.all([validateCycloneDx(), validateSpdx()]);
console.log("CycloneDX 1.7 and SPDX 3.0.1 schema validation passed.");
