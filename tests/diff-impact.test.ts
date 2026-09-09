import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { diffAiboms } from "../src/diff";
import { generateAibom } from "../src/generate";
import { queryImpact } from "../src/impact";
import type { AibomDocument } from "../src/types";

const exampleRoot = fileURLToPath(
  new URL("../examples/rag-agent", import.meta.url)
);

async function exampleDocument(): Promise<AibomDocument> {
  return (
    await generateAibom({
      root: exampleRoot,
      generatedAt: "2026-09-08T22:49:31.000Z",
      environmentContext: false
    })
  ).document;
}

describe("diffAiboms", () => {
  it("identifies changed evidence and newly introduced unknowns", async () => {
    const base = await exampleDocument();
    const head = structuredClone(base);
    head.evidence[0] = {
      ...head.evidence[0]!,
      validUntil: "2027-01-01T00:00:00Z"
    };
    head.unknowns.push({
      id: "urn:example:unknown:new",
      class: "explicit-unknown",
      subject: head.system.id,
      field: "replacementModel",
      reason: "No replacement has been tested.",
      sensitivity: "internal"
    });

    const diff = diffAiboms(base, head);
    expect(diff.evidence.changed).toHaveLength(1);
    expect(diff.summary.newUnknowns).toBe(1);
    expect(diff.summary.reviewRequired).toBe(true);
  });
});

describe("queryImpact", () => {
  it("traverses reverse dependencies from a model to the system", async () => {
    const document = await exampleDocument();
    const result = queryImpact(document, "gpt-4.1");

    expect(result.matched).toEqual(["urn:example:model:openai:gpt-4.1"]);
    expect(result.affected).toContain("urn:example:agent:support");
    expect(result.affected).toContain("urn:example:system:support-assistant");
  });
});
