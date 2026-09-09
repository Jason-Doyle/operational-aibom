import { SCHEMA_VERSION, TOOL_NAME, TOOL_VERSION } from "./constants";
import { sha256, stableStringify } from "./json";
import type { AibomDocument, DocumentSource, HashValue } from "./types";

export type AibomDocumentContent = Omit<AibomDocument, "document">;

export function finaliseDocument(
  content: AibomDocumentContent,
  source: DocumentSource,
  generatedAt: string
): AibomDocument {
  const normalisedContent = JSON.parse(
    stableStringify(content, 0)
  ) as AibomDocumentContent;
  const normalisedSource = JSON.parse(
    stableStringify(source, 0)
  ) as DocumentSource;
  const digest: HashValue = {
    algorithm: "SHA-256",
    value: sha256(stableStringify(normalisedContent, 0))
  };

  return {
    ...normalisedContent,
    schemaVersion: SCHEMA_VERSION,
    document: {
      id: `urn:aibom:document:sha256:${digest.value}`,
      generatedAt,
      generator: {
        name: TOOL_NAME,
        version: TOOL_VERSION
      },
      source: normalisedSource,
      contentDigest: digest
    }
  };
}
