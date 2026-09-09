import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { toCycloneDx } from "../src/export/cyclonedx";
import { toSpdxJsonLd } from "../src/export/spdx";
import { generateAibom } from "../src/generate";
import { stableStringify } from "../src/json";
import { projectDocument } from "../src/projection";

const exampleRoot = fileURLToPath(
  new URL("../examples/rag-agent", import.meta.url)
);
const expectedRoot = fileURLToPath(
  new URL("../examples/rag-agent/expected", import.meta.url)
);

describe("committed reference outputs", () => {
  it("match a fixed, environment-independent generation", async () => {
    const document = (
      await generateAibom({
        root: exampleRoot,
        generatedAt: "2026-09-08T22:49:31.000Z",
        environmentContext: false,
        excludePaths: [
          "expected/aibom.json",
          "expected/aibom.public.json",
          "expected/aibom.cdx.json",
          "expected/aibom.spdx.jsonld"
        ]
      })
    ).document;
    const expected = await Promise.all([
      readFile(`${expectedRoot}/aibom.json`, "utf8"),
      readFile(`${expectedRoot}/aibom.public.json`, "utf8"),
      readFile(`${expectedRoot}/aibom.cdx.json`, "utf8"),
      readFile(`${expectedRoot}/aibom.spdx.jsonld`, "utf8")
    ]);

    expect(stableStringify(document)).toBe(expected[0]);
    expect(stableStringify(projectDocument(document, "public"))).toBe(
      expected[1]
    );
    expect(stableStringify(toCycloneDx(document))).toBe(expected[2]);
    expect(stableStringify(toSpdxJsonLd(document))).toBe(expected[3]);
  });
});
