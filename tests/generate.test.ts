import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateAibom } from "../src/generate";
import { stableStringify } from "../src/json";
import { validateDocument } from "../src/validate";

const exampleRoot = fileURLToPath(
  new URL("../examples/rag-agent", import.meta.url)
);
const generatedAt = "2026-09-08T22:49:31.000Z";

describe("generateAibom", () => {
  it("merges declarations with conservative repository evidence", async () => {
    const first = await generateAibom({
      root: exampleRoot,
      generatedAt,
      environmentContext: false,
      context: {
        deployment: {
          id: "support-prod-1",
          environment: "production",
          region: "westeurope"
        }
      }
    });
    const second = await generateAibom({
      root: exampleRoot,
      generatedAt,
      environmentContext: false,
      context: {
        deployment: {
          id: "support-prod-1",
          environment: "production",
          region: "westeurope"
        }
      }
    });

    expect(first.document.document.id).toBe(second.document.document.id);
    expect(stableStringify(first.document)).toBe(
      stableStringify(second.document)
    );
    expect(validateDocument(first.document).valid).toBe(true);

    const model = first.document.components.find(
      (component) => component.id === "urn:example:model:openai:gpt-4.1"
    );
    expect(model?.origin).toBe("merged");
    expect(model?.locations).toContainEqual({
      path: "src/agent.ts",
      lineStart: 4,
      lineEnd: 4
    });

    expect(
      first.document.components.some(
        (component) =>
          component.name === "system.prompt.txt" &&
          component.origin === "merged" &&
          component.hashes?.[0]?.algorithm === "SHA-256"
      )
    ).toBe(true);
    expect(
      first.document.components.some(
        (component) =>
          component.name === "regression.jsonl" &&
          component.type === "evaluation-dataset"
      )
    ).toBe(true);
    expect(
      first.document.components.some(
        (component) =>
          component.name === "openai" &&
          component.properties?.usageAssertion === "dependency-declaration"
      )
    ).toBe(true);

    const serialised = stableStringify(first.document);
    expect(serialised).not.toContain(
      "Ask for confirmation before creating a support case"
    );
    expect(serialised).toContain(
      "deployment or request-level use is not established"
    );
  });

  it("records explicit unknowns when no manifest exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "operational-aibom-"));
    try {
      const result = await generateAibom({
        root,
        generatedAt,
        environmentContext: false,
        discovery: false
      });

      expect(result.document.document.source.manifestPresent).toBe(false);
      expect(
        result.document.unknowns.map((record) => record.field).sort()
      ).toEqual(["intendedUse", "owner"]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
