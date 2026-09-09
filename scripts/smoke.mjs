import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = resolve("examples/rag-agent");
const cli = resolve("dist/cli.js");
const action = resolve("dist/action/index.cjs");
const outputRoot = await mkdtemp(join(tmpdir(), "operational-aibom-smoke-"));
const document = join(outputRoot, "aibom.json");
const publicDocument = join(outputRoot, "aibom.public.json");
const cyclonedx = join(outputRoot, "aibom.cdx.json");
const spdx = join(outputRoot, "aibom.spdx.jsonld");

try {
  await execute(process.execPath, [
    cli,
    "generate",
    root,
    "--output",
    document,
    "--public-output",
    publicDocument,
    "--cyclonedx-output",
    cyclonedx,
    "--spdx-output",
    spdx,
    "--no-environment-context",
    "--generated-at",
    "2026-09-08T22:49:31.000Z"
  ]);
  await execute(process.execPath, [cli, "validate", document]);
  await execute(process.execPath, [cli, "impact", document, "gpt-4.1"]);

  const summaryPath = join(outputRoot, "step-summary.md");
  const githubOutputPath = join(outputRoot, "github-output.txt");
  await writeFile(summaryPath, "", "utf8");
  await writeFile(githubOutputPath, "", "utf8");
  await execute(process.execPath, [action], {
    env: {
      ...process.env,
      GITHUB_REPOSITORY: "example/support-assistant",
      GITHUB_SHA: "0123456789abcdef",
      GITHUB_REF: "refs/heads/main",
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_WORKFLOW: "Operational AIBOM smoke test",
      GITHUB_RUN_ID: "12345",
      GITHUB_WORKSPACE: root,
      GITHUB_STEP_SUMMARY: summaryPath,
      GITHUB_OUTPUT: githubOutputPath,
      INPUT_PATH: ".",
      INPUT_MANIFEST: "aibom.yaml",
      INPUT_OUTPUT: join(outputRoot, "action-aibom.json"),
      "INPUT_PUBLIC-OUTPUT": "",
      "INPUT_CYCLONEDX-OUTPUT": "",
      "INPUT_SPDX-OUTPUT": "",
      INPUT_BASELINE: "",
      "INPUT_DIFF-OUTPUT": "aibom.diff.json",
      INPUT_DISCOVERY: "true",
      "INPUT_ENVIRONMENT-CONTEXT": "true",
      "INPUT_GENERATED-AT": "2026-09-08T22:49:31.000Z",
      "INPUT_BUILD-ID": "smoke-build",
      INPUT_RELEASE: "",
      "INPUT_DEPLOYMENT-ID": "",
      INPUT_ENVIRONMENT: "",
      INPUT_REGION: "",
      "INPUT_FAIL-ON-UNKNOWNS": "false",
      "INPUT_FAIL-ON-NEW-UNKNOWNS": "false",
      "INPUT_FAIL-ON-CHANGES": "false"
    }
  });

  for (const path of [document, publicDocument, cyclonedx, spdx]) {
    await access(path);
  }

  const summary = await readFile(summaryPath, "utf8");
  const actionOutputs = await readFile(githubOutputPath, "utf8");
  const actionDocument = JSON.parse(
    await readFile(join(outputRoot, "action-aibom.json"), "utf8")
  );
  if (!summary.includes("Operational AIBOM")) {
    throw new Error("The Action did not write its job summary.");
  }
  if (!actionOutputs.includes("document-id")) {
    throw new Error("The Action did not publish its document-id output.");
  }
  if (
    actionDocument.context.repository !== "example/support-assistant" ||
    actionDocument.context.commit !== "0123456789abcdef" ||
    actionDocument.context.workflowRunId !== "12345"
  ) {
    throw new Error("The Action did not preserve GitHub environment context.");
  }

  console.log("CLI and GitHub Action smoke tests passed.");
} finally {
  await rm(outputRoot, { force: true, recursive: true });
}
