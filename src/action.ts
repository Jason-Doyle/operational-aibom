import * as core from "@actions/core";
import { isAbsolute, resolve } from "node:path";
import { diffAiboms } from "./diff";
import { AibomError } from "./errors";
import { toCycloneDx } from "./export/cyclonedx";
import { toSpdxJsonLd } from "./export/spdx";
import { generateAibom } from "./generate";
import { writeJson } from "./json";
import { loadAibomDocument } from "./load";
import { projectDocument } from "./projection";
import { summariseDocument } from "./summary";
import type { AibomContext, AibomDiff } from "./types";

function optionalInput(name: string): string | undefined {
  const value = core.getInput(name, { trimWhitespace: true });
  return value === "" ? undefined : value;
}

function inputPath(root: string, value: string): string {
  return isAbsolute(value) ? value : resolve(root, value);
}

function inputContext(): AibomContext {
  const deploymentId = optionalInput("deployment-id");
  const environment = optionalInput("environment");
  const region = optionalInput("region");
  const deployment =
    deploymentId !== undefined ||
    environment !== undefined ||
    region !== undefined
      ? {
          id: deploymentId,
          environment,
          region
        }
      : undefined;

  return {
    buildId: optionalInput("build-id"),
    release: optionalInput("release"),
    deployment
  };
}

function addSummary(
  documentId: string,
  summary: ReturnType<typeof summariseDocument>,
  diff: AibomDiff | undefined
): void {
  core.summary
    .addHeading("Operational AIBOM")
    .addRaw(`Document: \`${documentId}\``)
    .addEOL()
    .addTable([
      [
        { data: "Record", header: true },
        { data: "Count", header: true }
      ],
      ["Components", String(summary.components)],
      ["Relationships", String(summary.relationships)],
      ["Evidence", String(summary.evidence)],
      ["Assessments", String(summary.assessments)],
      ["Observations", String(summary.observations)],
      ["Unknowns", String(summary.unknowns)],
      ["Warnings", String(summary.warnings)]
    ]);

  if (diff !== undefined) {
    core.summary.addHeading("Change from baseline", 2).addTable([
      [
        { data: "Change", header: true },
        { data: "Count", header: true }
      ],
      ["Added", String(diff.summary.added)],
      ["Removed", String(diff.summary.removed)],
      ["Changed", String(diff.summary.changed)],
      ["New unknowns", String(diff.summary.newUnknowns)],
      ["Non-material changes", String(diff.summary.nonMaterialChanges)],
      ["Review required", diff.summary.reviewRequired ? "yes" : "no"]
    ]);
  }
}

async function run(): Promise<void> {
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const root = inputPath(workspace, core.getInput("path") || ".");
  const output = inputPath(root, core.getInput("output") || "aibom.json");
  const publicOutput = optionalInput("public-output");
  const cyclonedxOutput = optionalInput("cyclonedx-output");
  const spdxOutput = optionalInput("spdx-output");
  const baseline = optionalInput("baseline");
  const diffOutput = core.getInput("diff-output") || "aibom.diff.json";
  const result = await generateAibom({
    root,
    manifestPath: optionalInput("manifest"),
    discovery: core.getBooleanInput("discovery"),
    environmentContext: core.getBooleanInput("environment-context"),
    excludePaths: [
      output,
      publicOutput === undefined ? undefined : inputPath(root, publicOutput),
      cyclonedxOutput === undefined
        ? undefined
        : inputPath(root, cyclonedxOutput),
      spdxOutput === undefined ? undefined : inputPath(root, spdxOutput),
      baseline === undefined ? undefined : inputPath(root, baseline),
      inputPath(root, diffOutput)
    ].filter((path): path is string => path !== undefined),
    generatedAt: optionalInput("generated-at"),
    context: inputContext()
  });

  await writeJson(output, result.document);
  core.setOutput("document-id", result.document.document.id);
  core.setOutput("output", output);
  core.setOutput("unknown-count", result.document.unknowns.length);

  if (publicOutput !== undefined) {
    const path = inputPath(root, publicOutput);
    await writeJson(path, projectDocument(result.document, "public"));
    core.setOutput("public-output", path);
  }
  if (cyclonedxOutput !== undefined) {
    const path = inputPath(root, cyclonedxOutput);
    await writeJson(path, toCycloneDx(result.document));
    core.setOutput("cyclonedx-output", path);
  }
  if (spdxOutput !== undefined) {
    const path = inputPath(root, spdxOutput);
    await writeJson(path, toSpdxJsonLd(result.document));
    core.setOutput("spdx-output", path);
  }

  let diff: AibomDiff | undefined;
  if (baseline !== undefined) {
    diff = diffAiboms(
      await loadAibomDocument(inputPath(root, baseline)),
      result.document
    );
    const path = inputPath(root, diffOutput);
    await writeJson(path, diff);
    core.setOutput("diff-output", path);
    core.setOutput("review-required", diff.summary.reviewRequired);
  } else {
    core.setOutput("review-required", false);
  }

  for (const diagnostic of result.diagnostics) {
    if (diagnostic.level === "warning") {
      core.warning(diagnostic.message, {
        title: diagnostic.code,
        file: diagnostic.path
      });
    }
  }

  addSummary(
    result.document.document.id,
    summariseDocument(result.document, result.diagnostics),
    diff
  );
  await core.summary.write();

  const failures: string[] = [];
  if (
    core.getBooleanInput("fail-on-unknowns") &&
    result.document.unknowns.length > 0
  ) {
    failures.push(
      `The generated record contains ${result.document.unknowns.length} explicit unknowns.`
    );
  }
  if (
    core.getBooleanInput("fail-on-new-unknowns") &&
    (diff?.summary.newUnknowns ?? 0) > 0
  ) {
    failures.push(
      `The generated record introduces ${diff?.summary.newUnknowns ?? 0} explicit unknowns.`
    );
  }
  if (
    core.getBooleanInput("fail-on-changes") &&
    diff !== undefined &&
    (diff.summary.added > 0 ||
      diff.summary.removed > 0 ||
      diff.summary.changed > 0)
  ) {
    failures.push("The generated record differs from the configured baseline.");
  }

  if (failures.length > 0) {
    throw new AibomError("action.policy", failures.join(" "));
  }
}

void run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : "Unknown error");
});
