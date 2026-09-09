import { Version } from "@cyclonedx/cyclonedx-library/Spec";
import { JsonStrictValidator } from "@cyclonedx/cyclonedx-library/Validation";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { toCycloneDx } from "../src/export/cyclonedx";
import { toSpdxJsonLd } from "../src/export/spdx";
import { generateAibom } from "../src/generate";
import { stableStringify } from "../src/json";
import { projectDocument } from "../src/projection";
import { validateDocument } from "../src/validate";

const exampleRoot = fileURLToPath(
  new URL("../examples/rag-agent", import.meta.url)
);

async function exampleDocument() {
  return (
    await generateAibom({
      root: exampleRoot,
      generatedAt: "2026-09-08T22:49:31.000Z",
      environmentContext: false,
      context: {
        deployment: {
          id: "support-prod-1",
          environment: "production",
          region: "westeurope"
        }
      }
    })
  ).document;
}

describe("projectDocument", () => {
  it("removes internal components and deployment context from public output", async () => {
    const projected = projectDocument(await exampleDocument(), "public");

    expect(validateDocument(projected).valid).toBe(true);
    expect(
      projected.components.some(
        (component) => component.id === "urn:example:tool:create-case"
      )
    ).toBe(false);
    expect(projected.context.deployment).toBeUndefined();
    expect(
      projected.relationships.some(
        (relationship) => relationship.type === "can-invoke"
      )
    ).toBe(false);
    expect(
      projected.evidence.some((record) => record.method === "manifest-digest")
    ).toBe(false);
    expect(stableStringify(projected)).not.toContain("aibom.yaml");
  });
});

describe("standard exports", () => {
  it("creates CycloneDX 1.7 and SPDX 3.0.1 compatibility views", async () => {
    const document = await exampleDocument();
    const cyclonedx = toCycloneDx(document);
    const spdx = toSpdxJsonLd(document);
    const cyclonedxText = stableStringify(cyclonedx);
    const spdxText = stableStringify(spdx);

    expect(cyclonedx.specVersion).toBe("1.7");
    expect(cyclonedxText).toContain('"type": "machine-learning-model"');
    expect(cyclonedxText).toContain(
      "Evidence classes, temporal separation and relationship semantics"
    );
    expect(spdx["@context"]).toBe(
      "https://spdx.org/rdf/3.0.1/spdx-context.jsonld"
    );
    expect(spdxText).toContain('"type": "ai_AIPackage"');
    expect(spdxText).toContain('"relationshipType": "dependsOn"');
    expect(spdxText).toContain('"dataset_datasetType": [');
    expect(spdxText).toContain('"noAssertion"');
    expect(spdxText).not.toContain('"structured"');
    expect(spdxText).not.toContain(
      "Ask for confirmation before creating a support case"
    );

    const cycloneDxValidation: unknown = await new JsonStrictValidator(
      Version.v1dot7
    ).validate(cyclonedxText);
    expect(cycloneDxValidation).toBeNull();
  });
});
