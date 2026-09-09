import { describe, expect, it } from "vitest";
import { contextFromEnvironment, mergeContexts } from "../src/context";
import { diffAiboms } from "../src/diff";
import { generateAibom } from "../src/generate";
import type { EvidenceRecord } from "../src/types";
import { fileURLToPath } from "node:url";

const exampleRoot = fileURLToPath(
  new URL("../examples/rag-agent", import.meta.url)
);

describe("context merging", () => {
  it("does not erase environment values with undefined overrides", () => {
    const environment = contextFromEnvironment({
      GITHUB_REPOSITORY: "example/repository",
      GITHUB_SHA: "abc123",
      GITHUB_REF: "refs/tags/v1.0.0",
      GITHUB_REF_TYPE: "tag",
      GITHUB_REF_NAME: "v1.0.0",
      GITHUB_EVENT_NAME: "push",
      GITHUB_WORKFLOW: "release",
      GITHUB_RUN_ID: "12345",
      AIBOM_BUILD_ID: "build-7",
      AIBOM_DEPLOYMENT_ID: "deployment-9",
      AIBOM_ENVIRONMENT: "production",
      AIBOM_REGION: "westeurope"
    });
    const merged = mergeContexts(environment, {
      repository: undefined,
      commit: undefined,
      ref: undefined,
      buildId: undefined,
      release: undefined,
      deployment: {
        id: undefined,
        environment: undefined,
        region: undefined
      }
    });

    expect(merged).toEqual(environment);
  });
});

describe("run-scoped diff", () => {
  it("ignores observation-time-only regeneration in the material summary", async () => {
    const base = (
      await generateAibom({
        root: exampleRoot,
        generatedAt: "2026-09-08T22:49:31.000Z",
        environmentContext: false
      })
    ).document;
    const head = (
      await generateAibom({
        root: exampleRoot,
        generatedAt: "2026-09-08T22:50:31.000Z",
        environmentContext: false
      })
    ).document;

    const diff = diffAiboms(base, head);
    expect(head.document.id).not.toBe(base.document.id);
    expect(diff.summary).toMatchObject({
      added: 0,
      removed: 0,
      changed: 0,
      reviewRequired: false
    });
    expect(diff.summary.nonMaterialChanges).toBeGreaterThan(0);
  });

  it("does not require review when only workflow run identity changes", async () => {
    const base = (
      await generateAibom({
        root: exampleRoot,
        generatedAt: "2026-09-08T22:49:31.000Z",
        environmentContext: false
      })
    ).document;
    const head = structuredClone(base);
    base.context = {
      ...base.context,
      eventName: "push",
      workflow: "aibom",
      workflowRunId: "100"
    };
    head.context = {
      ...head.context,
      eventName: "workflow_dispatch",
      workflow: "aibom",
      workflowRunId: "101"
    };
    const runEvidence = (runId: string): EvidenceRecord => ({
      id: `urn:test:evidence:run:${runId}`,
      class: "component-fact",
      subject: base.system.id,
      claim: "The generated record includes GitHub Actions build context.",
      method: "workflow-environment-inspection",
      observedAt: `2026-09-08T22:49:${runId === "100" ? "31" : "32"}.000Z`,
      source: {
        type: "workflow",
        uri: `https://github.com/example/repository/actions/runs/${runId}`
      },
      sensitivity: "internal",
      properties: {
        diffMode: "run"
      }
    });
    base.evidence.push(runEvidence("100"));
    head.evidence.push(runEvidence("101"));

    const diff = diffAiboms(base, head);
    expect(diff.contextChanged).toBe(false);
    expect(diff.summary).toMatchObject({
      added: 0,
      removed: 0,
      changed: 0,
      reviewRequired: false
    });
    expect(diff.summary.nonMaterialChanges).toBeGreaterThan(0);
  });
});
