import { describe, expect, it } from "vitest";
import { generateAibom } from "../src/generate";
import { validateDocument, validateManifest } from "../src/validate";
import { fileURLToPath } from "node:url";

const exampleRoot = fileURLToPath(
  new URL("../examples/rag-agent", import.meta.url)
);

describe("semantic validation", () => {
  it("rejects a manifest with a dangling relationship target", () => {
    const result = validateManifest({
      schemaVersion: "0.1.0",
      system: {
        id: "urn:test:system",
        name: "Test system"
      },
      relationships: [
        {
          from: "urn:test:system",
          type: "depends-on",
          to: "urn:test:missing"
        }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "semantic.missing-relationship-target"
      })
    );
  });

  it("rejects a generated document whose canonical content is changed", async () => {
    const document = (
      await generateAibom({
        root: exampleRoot,
        generatedAt: "2026-09-08T22:49:31.000Z",
        environmentContext: false
      })
    ).document;
    document.system.name = "Tampered system";

    const result = validateDocument(document);
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "semantic.content-digest"
      })
    );
  });
});
