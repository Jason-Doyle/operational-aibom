import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateAibom } from "../src/generate";
import { writeJson } from "../src/json";
import { validateDocument } from "../src/validate";

const generatedAt = "2026-09-08T22:49:31.000Z";

async function createProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "operational-aibom-discovery-"));
  await writeFile(
    join(root, "aibom.yaml"),
    [
      "schemaVersion: 0.1.0",
      "system:",
      "  id: urn:test:system",
      "  name: Test system",
      "  owner: Test owner",
      "  intendedUse: Test conservative discovery.",
      "  sensitivity: internal",
      "discovery:",
      "  enabled: true",
      "  useGitignore: true",
      "  defaultSensitivity: internal",
      ""
    ].join("\n"),
    "utf8"
  );
  return root;
}

describe("repository discovery", () => {
  it("keeps same-named artifacts at different paths as separate components", async () => {
    const root = await createProject();
    try {
      await mkdir(join(root, "prompts", "agent-a"), { recursive: true });
      await mkdir(join(root, "prompts", "agent-b"), { recursive: true });
      await writeFile(
        join(root, "prompts", "agent-a", "system.prompt.txt"),
        "Agent A prompt",
        "utf8"
      );
      await writeFile(
        join(root, "prompts", "agent-b", "system.prompt.txt"),
        "Agent B prompt",
        "utf8"
      );
      const result = await generateAibom({
        root,
        generatedAt,
        environmentContext: false
      });
      const prompts = result.document.components.filter(
        (component) => component.type === "prompt"
      );

      expect(validateDocument(result.document).valid).toBe(true);
      expect(prompts).toHaveLength(2);
      expect(new Set(prompts.map((component) => component.id)).size).toBe(2);
      expect(
        prompts
          .flatMap(
            (component) =>
              component.locations?.map((location) => location.path) ?? []
          )
          .sort()
      ).toEqual([
        "prompts/agent-a/system.prompt.txt",
        "prompts/agent-b/system.prompt.txt"
      ]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("accumulates all matching artifacts into a declared component", async () => {
    const root = await createProject();
    try {
      await appendFile(
        join(root, "aibom.yaml"),
        [
          "components:",
          "  - id: urn:test:prompt:system",
          "    type: prompt",
          "    name: system.prompt.txt",
          "    sensitivity: internal",
          ""
        ].join("\n"),
        "utf8"
      );
      await mkdir(join(root, "prompts", "agent-a"), { recursive: true });
      await mkdir(join(root, "prompts", "agent-b"), { recursive: true });
      await mkdir(join(root, "prompts", "agent-c"), { recursive: true });
      await writeFile(
        join(root, "prompts", "agent-a", "system.prompt.txt"),
        "Agent A prompt",
        "utf8"
      );
      await writeFile(
        join(root, "prompts", "agent-b", "system.prompt.txt"),
        "Agent B prompt",
        "utf8"
      );
      await writeFile(
        join(root, "prompts", "agent-c", "system.prompt.txt"),
        "Agent C prompt",
        "utf8"
      );

      const result = await generateAibom({
        root,
        generatedAt,
        environmentContext: false
      });
      const prompt = result.document.components.find(
        (component) => component.id === "urn:test:prompt:system"
      );
      const relationship = result.document.relationships.find(
        (record) =>
          record.from === "urn:test:system" &&
          record.type === "references" &&
          record.to === "urn:test:prompt:system"
      );

      expect(prompt?.origin).toBe("merged");
      expect(prompt?.hashes).toHaveLength(3);
      expect(prompt?.evidence).toHaveLength(3);
      expect(prompt?.properties).toMatchObject({
        artifactCount: 3,
        artifactPaths: [
          "prompts/agent-a/system.prompt.txt",
          "prompts/agent-b/system.prompt.txt",
          "prompts/agent-c/system.prompt.txt"
        ]
      });
      expect(prompt?.properties?.artifactPath).toBeUndefined();
      expect(prompt?.properties?.fileSize).toBeUndefined();
      expect(
        prompt?.locations?.map((location) => location.path).sort()
      ).toEqual([
        "prompts/agent-a/system.prompt.txt",
        "prompts/agent-b/system.prompt.txt",
        "prompts/agent-c/system.prompt.txt"
      ]);
      expect(relationship?.evidence).toHaveLength(3);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("requires quoted model identifiers and excludes sensitive key paths", async () => {
    const root = await createProject();
    try {
      await mkdir(join(root, "src"), { recursive: true });
      await mkdir(join(root, "models"), { recursive: true });
      await writeFile(
        join(root, "src", "app.ts"),
        [
          'const model = "gpt-4.1";',
          'const routedModel = "models/gemini-2.5-pro";',
          'const archive = "prod-o3-archive";',
          'const trailing = "AoIBAQCabcd/o3";',
          "const o1 = 1;",
          "const o3 = 3;",
          ""
        ].join("\n"),
        "utf8"
      );
      await writeFile(
        join(root, "models.yaml"),
        [
          "model: gpt-4o",
          "embedding_model: text-embedding-3-large",
          'clientKey: "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC/o3/aWQoNZmXk"',
          ""
        ].join("\n"),
        "utf8"
      );
      await writeFile(
        join(root, "SERVICE-ACCOUNT-KEY.JSON"),
        JSON.stringify({
          private_key: "synthetic+o1/value",
          model: "claude-3-opus"
        }),
        "utf8"
      );
      await writeFile(
        join(root, "REQUIREMENTS.TXT"),
        "openai==2.0.0\n",
        "utf8"
      );
      await writeFile(
        join(root, "models", "MODEL.TFLITE"),
        "synthetic model bytes",
        "utf8"
      );

      const result = await generateAibom({
        root,
        generatedAt,
        environmentContext: false
      });
      const names = result.document.components.map(
        (component) => component.name
      );
      const evidencePaths = result.document.evidence.flatMap((record) =>
        record.source?.path === undefined ? [] : [record.source.path]
      );

      expect(names).toContain("gpt-4.1");
      expect(names).toContain("gpt-4o");
      expect(names).toContain("gemini-2.5-pro");
      expect(names).toContain("text-embedding-3-large");
      expect(names).toContain("openai");
      expect(names).toContain("MODEL.TFLITE");
      expect(names).not.toContain("o1");
      expect(names).not.toContain("o3");
      expect(names).not.toContain("claude-3-opus");
      expect(evidencePaths).not.toContain("SERVICE-ACCOUNT-KEY.JSON");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("does not re-ingest a configured output file", async () => {
    const root = await createProject();
    try {
      await mkdir(join(root, "src"), { recursive: true });
      await writeFile(
        join(root, "src", "app.ts"),
        'export const model = "gpt-4.1";\n',
        "utf8"
      );
      const options = {
        root,
        generatedAt,
        environmentContext: false,
        excludePaths: ["inventory.json"]
      };
      const first = await generateAibom(options);
      await writeJson(join(root, "inventory.json"), first.document);
      const second = await generateAibom(options);

      expect(second.document.document.id).toBe(first.document.document.id);
      expect(
        second.document.evidence.some(
          (record) => record.source?.path === "inventory.json"
        )
      ).toBe(false);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("honours nested gitignore files", async () => {
    const root = await createProject();
    try {
      await mkdir(join(root, "local", "prompts"), { recursive: true });
      await writeFile(join(root, "local", ".gitignore"), "prompts/\n", "utf8");
      await writeFile(
        join(root, "local", "prompts", "system.prompt.txt"),
        "Ignored local prompt",
        "utf8"
      );

      const result = await generateAibom({
        root,
        generatedAt,
        environmentContext: false
      });

      expect(
        result.document.components.some((component) =>
          component.locations?.some(
            (location) => location.path === "local/prompts/system.prompt.txt"
          )
        )
      ).toBe(false);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("preserves conflicting package declarations without choosing one", async () => {
    const root = await createProject();
    try {
      await mkdir(join(root, "packages", "api"), { recursive: true });
      await writeFile(
        join(root, "package.json"),
        JSON.stringify({
          dependencies: {
            openai: "^4.0.0"
          }
        }),
        "utf8"
      );
      await writeFile(
        join(root, "packages", "api", "package.json"),
        JSON.stringify({
          devDependencies: {
            openai: "^5.9.9"
          }
        }),
        "utf8"
      );

      const result = await generateAibom({
        root,
        generatedAt,
        environmentContext: false
      });
      const openai = result.document.components.find(
        (component) => component.name === "openai"
      );

      expect(openai?.properties?.declaredVersion).toBeUndefined();
      expect(openai?.properties?.declaredVersions).toEqual([
        "^4.0.0",
        "^5.9.9"
      ]);
      expect(openai?.properties?.dependencySection).toBeUndefined();
      expect(openai?.properties?.dependencySections).toEqual([
        "dependencies",
        "devDependencies"
      ]);
      expect(openai?.evidence).toHaveLength(2);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
