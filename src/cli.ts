#!/usr/bin/env node

import { resolve } from "node:path";
import { Command, Option } from "commander";
import { TOOL_VERSION } from "./constants";
import { diffAiboms } from "./diff";
import { AibomError } from "./errors";
import { toCycloneDx } from "./export/cyclonedx";
import { toSpdxJsonLd } from "./export/spdx";
import { generateAibom } from "./generate";
import { queryImpact } from "./impact";
import { stableStringify, writeJson } from "./json";
import {
  isDocument,
  isManifest,
  loadAibomDocument,
  readStructuredFile,
  validateUnknownFile
} from "./load";
import { initialiseManifest } from "./manifest";
import { projectDocument } from "./projection";
import { formatDiffSummary, formatSummary } from "./summary";
import type { AibomContext, Diagnostic, Sensitivity } from "./types";

interface ContextOptions {
  repository?: string;
  commit?: string;
  ref?: string;
  buildId?: string;
  release?: string;
  deploymentId?: string;
  environment?: string;
  region?: string;
}

interface GenerateCommandOptions extends ContextOptions {
  manifest?: string;
  output: string;
  publicOutput?: string;
  cyclonedxOutput?: string;
  spdxOutput?: string;
  generatedAt?: string;
  discovery: boolean;
  environmentContext: boolean;
  failOnUnknowns: boolean;
}

function contextOptions(options: ContextOptions): AibomContext {
  const deployment =
    options.deploymentId !== undefined ||
    options.environment !== undefined ||
    options.region !== undefined
      ? {
          id: options.deploymentId,
          environment: options.environment,
          region: options.region
        }
      : undefined;

  return {
    repository: options.repository,
    commit: options.commit,
    ref: options.ref,
    buildId: options.buildId,
    release: options.release,
    deployment
  };
}

function addContextOptions(command: Command): Command {
  return command
    .option("--repository <owner/name>", "Repository identity")
    .option("--commit <sha>", "Source commit identity")
    .option("--ref <ref>", "Source ref")
    .option("--build-id <id>", "Build identifier")
    .option("--release <id>", "Release identifier")
    .option("--deployment-id <id>", "Deployment identifier")
    .option("--environment <name>", "Deployment environment")
    .option("--region <name>", "Deployment region");
}

function printDiagnostics(diagnostics: Diagnostic[]): void {
  for (const diagnostic of diagnostics) {
    const location =
      diagnostic.path === undefined ? "" : ` (${diagnostic.path})`;
    const message = `${diagnostic.code}: ${diagnostic.message}${location}`;
    if (diagnostic.level === "warning") {
      console.warn(`warning: ${message}`);
    } else {
      console.error(`error: ${message}`);
    }
  }
}

async function writeOptionalExports(
  root: string,
  options: GenerateCommandOptions,
  document: Awaited<ReturnType<typeof generateAibom>>["document"]
): Promise<void> {
  if (options.publicOutput !== undefined) {
    await writeJson(
      resolve(root, options.publicOutput),
      projectDocument(document, "public")
    );
  }
  if (options.cyclonedxOutput !== undefined) {
    await writeJson(
      resolve(root, options.cyclonedxOutput),
      toCycloneDx(document)
    );
  }
  if (options.spdxOutput !== undefined) {
    await writeJson(resolve(root, options.spdxOutput), toSpdxJsonLd(document));
  }
}

const program = new Command()
  .name("aibom")
  .description(
    "Generate and analyse evidence-classified operational AI Bills of Materials."
  )
  .version(TOOL_VERSION);

program
  .command("init")
  .description("Create a starter aibom.yaml manifest.")
  .argument("[directory]", "Project directory", ".")
  .option("-m, --manifest <path>", "Manifest path", "aibom.yaml")
  .action(async (directory: string, options: { manifest: string }) => {
    const root = resolve(directory);
    const path = await initialiseManifest(root, options.manifest);
    console.log(`Created ${resolve(path)}`);
  });

const generateCommand = program
  .command("generate")
  .description("Generate a canonical operational AIBOM document.")
  .argument("[directory]", "Project directory", ".")
  .option("-m, --manifest <path>", "Manifest path")
  .option("-o, --output <path>", "Canonical JSON output", "aibom.json")
  .option("--public-output <path>", "Write a public sensitivity projection")
  .option(
    "--cyclonedx-output <path>",
    "Write a CycloneDX 1.7 compatibility view"
  )
  .option(
    "--spdx-output <path>",
    "Write an SPDX 3.0.1 JSON-LD compatibility view"
  )
  .option("--generated-at <timestamp>", "Override the generation timestamp")
  .option("--no-discovery", "Disable repository discovery")
  .option(
    "--no-environment-context",
    "Ignore GitHub and AIBOM context environment variables"
  )
  .option(
    "--fail-on-unknowns",
    "Return a non-zero status when explicit unknowns exist",
    false
  );

addContextOptions(generateCommand).action(
  async (directory: string, options: GenerateCommandOptions) => {
    const root = resolve(directory);
    const result = await generateAibom({
      root,
      manifestPath: options.manifest,
      discovery: options.discovery,
      environmentContext: options.environmentContext,
      excludePaths: [
        options.output,
        options.publicOutput,
        options.cyclonedxOutput,
        options.spdxOutput
      ].filter((path): path is string => path !== undefined),
      generatedAt: options.generatedAt,
      context: contextOptions(options)
    });
    const output = resolve(root, options.output);
    await writeJson(output, result.document);
    await writeOptionalExports(root, options, result.document);
    printDiagnostics(result.diagnostics);
    console.log(formatSummary(result.document, result.diagnostics));
    console.log(`Output: ${output}`);

    if (options.failOnUnknowns && result.document.unknowns.length > 0) {
      process.exitCode = 2;
    }
  }
);

program
  .command("validate")
  .description("Validate a manifest or generated document.")
  .argument("<file>", "YAML or JSON file")
  .addOption(
    new Option("--type <type>", "File type")
      .choices(["auto", "document", "manifest"])
      .default("auto")
  )
  .action(
    async (
      file: string,
      options: { type: "auto" | "document" | "manifest" }
    ) => {
      const path = resolve(file);
      const value = await readStructuredFile(path);
      const type =
        options.type === "auto"
          ? isDocument(value)
            ? "document"
            : isManifest(value)
              ? "manifest"
              : "document"
          : options.type;
      const validation = validateUnknownFile(value, type);
      printDiagnostics(validation.diagnostics);

      if (!validation.valid) {
        process.exitCode = 1;
        return;
      }

      console.log(`${path} is a valid ${type}.`);
    }
  );

program
  .command("diff")
  .description("Compare two generated operational AIBOM documents.")
  .argument("<base>", "Base document")
  .argument("<head>", "Head document")
  .option("-o, --output <path>", "Write JSON diff instead of printing it")
  .option(
    "--fail-on-change",
    "Return a non-zero status when material records differ",
    false
  )
  .action(
    async (
      basePath: string,
      headPath: string,
      options: { output?: string; failOnChange: boolean }
    ) => {
      const diff = diffAiboms(
        await loadAibomDocument(resolve(basePath)),
        await loadAibomDocument(resolve(headPath))
      );

      if (options.output === undefined) {
        console.log(stableStringify(diff));
      } else {
        await writeJson(resolve(options.output), diff);
        console.log(formatDiffSummary(diff));
        console.log(`Output: ${resolve(options.output)}`);
      }

      if (
        options.failOnChange &&
        (diff.summary.added > 0 ||
          diff.summary.removed > 0 ||
          diff.summary.changed > 0)
      ) {
        process.exitCode = 2;
      }
    }
  );

program
  .command("impact")
  .description("Find systems and components that depend on a target.")
  .argument("<document>", "Generated document")
  .argument("<component>", "Component id or name")
  .option("-o, --output <path>", "Write the impact report to JSON")
  .action(
    async (
      documentPath: string,
      component: string,
      options: { output?: string }
    ) => {
      const result = queryImpact(
        await loadAibomDocument(resolve(documentPath)),
        component
      );
      if (options.output === undefined) {
        console.log(stableStringify(result));
      } else {
        await writeJson(resolve(options.output), result);
        console.log(`Output: ${resolve(options.output)}`);
      }
    }
  );

program
  .command("project")
  .description("Create a sensitivity-filtered projection.")
  .argument("<document>", "Generated document")
  .addOption(
    new Option("--visibility <level>", "Maximum sensitivity")
      .choices(["public", "internal", "restricted"])
      .makeOptionMandatory()
  )
  .option("-o, --output <path>", "Output path", "aibom.projected.json")
  .action(
    async (
      documentPath: string,
      options: { visibility: Sensitivity; output: string }
    ) => {
      const document = await loadAibomDocument(resolve(documentPath));
      await writeJson(
        resolve(options.output),
        projectDocument(document, options.visibility)
      );
      console.log(`Output: ${resolve(options.output)}`);
    }
  );

program
  .command("export")
  .description("Export a generated document to a standard compatibility view.")
  .argument("<document>", "Generated document")
  .addOption(
    new Option("--format <format>", "Export format")
      .choices(["cyclonedx", "spdx"])
      .makeOptionMandatory()
  )
  .option("-o, --output <path>", "Output path")
  .action(
    async (
      documentPath: string,
      options: { format: "cyclonedx" | "spdx"; output?: string }
    ) => {
      const document = await loadAibomDocument(resolve(documentPath));
      const output =
        options.output ??
        (options.format === "cyclonedx"
          ? "aibom.cdx.json"
          : "aibom.spdx.jsonld");
      await writeJson(
        resolve(output),
        options.format === "cyclonedx"
          ? toCycloneDx(document)
          : toSpdxJsonLd(document)
      );
      console.log(`Output: ${resolve(output)}`);
    }
  );

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof AibomError) {
    console.error(`${error.code}: ${error.message}`);
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Unknown error");
  }
  process.exitCode = 1;
}
