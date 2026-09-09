# Operational AIBOM

Generate an evidence-classified, deployment-aware AI Bill of Materials from a version-controlled manifest, conservative repository discovery and CI context.

This repository contains the stable `1.0.0` implementation. The source is licensed under Apache 2.0.

The design follows [The AI Bill of Materials Is an Operational Record](https://jasondoyle.ie/whitepapers/the-ai-bill-of-materials-is-an-operational-record/).

## What is implemented

| Capability           | Current implementation                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canonical record     | Versioned JSON graph containing a system, components, relationships, evidence, assessments, observations, explicit unknowns and build or deployment context. |
| Manifest             | Optional `aibom.yaml` or JSON manifest validated with JSON Schema draft 2020-12.                                                                             |
| Repository discovery | Conservative detection of hosted model identifiers, prompt files, local model files, contextual dataset files and known AI-related package declarations.     |
| Evidence boundaries  | Discovery claims repository presence or a source reference. It does not convert those observations into an unsupported claim of runtime use.                 |
| Determinism          | Stable sorting and canonical content digests. A fixed generation timestamp produces the same document identifier for the same inputs.                        |
| Validation           | JSON Schema validation plus relationship, subject, evidence reference, temporal and canonical digest checks.                                                 |
| Explicit unknowns    | Missing information can record its reason, owner, consequence, compensating control and next review date.                                                    |
| Semantic diff        | Separates added, removed and changed components, relationships, evidence, assessments, observations and unknowns.                                            |
| Impact analysis      | Traverses reverse relationships to identify the system and components that depend on an affected target.                                                     |
| Publication views    | Filters records by `public`, `internal` or `restricted` sensitivity and removes deployment context from public output.                                       |
| CycloneDX            | Produces a schema-valid CycloneDX 1.7 compatibility view.                                                                                                    |
| SPDX                 | Produces a schema-valid SPDX 3.0.1 JSON-LD compatibility view.                                                                                               |
| CLI                  | Provides `init`, `generate`, `validate`, `diff`, `impact`, `project` and `export` commands.                                                                  |
| GitHub Action        | Bundled Node 24 Action using the same generation code as the CLI.                                                                                            |
| npm library          | Exports the generator, validation, projection, diff, impact and standard mapping APIs.                                                                       |
| Evidence             | Includes a synthetic RAG agent fixture and committed expected outputs generated from a fixed timestamp.                                                      |

## What is not implemented

| Area                          | Current boundary                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Complete automatic generation | Repository inspection cannot establish supplier internals, production deployment state or request-level behaviour.            |
| Ordinary SBOM generation      | The current implementation does not replace Syft, cdxgen or another software SBOM generator. An ingestion adapter is planned. |
| AIROM ingestion               | The canonical model is ready for collector adapters, but direct AIROM ingestion is not yet implemented.                       |
| Cloud discovery               | Azure, AWS, Google Cloud, Kubernetes API and model registry collectors are not implemented.                                   |
| Runtime tracing               | The format can hold controlled observations, but the project does not collect prompts, inputs, outputs or traces.             |
| Evaluation framework adapters | Assessments can be declared, but no evaluation framework output is imported automatically.                                    |
| Vulnerability enrichment      | The project does not query OSV, NVD or supplier advisories.                                                                   |
| Attestation service           | The Action writes files and outputs. A separate official GitHub Action should perform signing and attestation.                |
| Compliance certification      | The output does not prove safety, fairness, legality, security, quality or regulatory compliance.                             |
| Estate aggregation            | Cross-repository storage, search and organisation-wide impact analysis are not implemented.                                   |

## Requirements

| Tool                  | Version        |
| --------------------- | -------------- |
| Node.js               | 22.12 or newer |
| npm                   | 10 or newer    |
| GitHub Action runtime | Node 24        |

## Local setup

```powershell
npm install
npm run build
node dist\cli.js --help
```

To make the command available from the current checkout:

```powershell
npm link
aibom --help
```

## Quick start

Create a manifest:

```powershell
node dist\cli.js init C:\path\to\project
```

The generated manifest deliberately records the owner and intended use as explicit unknowns. Replace those unknowns with real declarations when the information is available.

Generate the canonical record and standard compatibility views:

```powershell
node dist\cli.js generate C:\path\to\project `
  --output artifacts\aibom.json `
  --cyclonedx-output artifacts\aibom.cdx.json `
  --spdx-output artifacts\aibom.spdx.jsonld
```

Create a public projection only after the system and intended public records are marked `sensitivity: public`:

```powershell
node dist\cli.js project artifacts\aibom.json `
  --visibility public `
  --output artifacts\aibom.public.json
```

## Manifest

The manifest is the source for information that cannot be inferred safely. Its schema is [schemas/manifest.schema.json](schemas/manifest.schema.json).

```yaml
schemaVersion: 0.1.0

system:
  id: urn:example:system:assistant
  name: Example assistant
  owner: Example platform team
  intendedUse: Answer questions from approved internal documents.
  sensitivity: internal

components:
  - id: urn:example:model:gpt-4.1
    type: hosted-model
    name: gpt-4.1
    supplier: OpenAI
    sensitivity: internal
    properties:
      provider: openai

relationships:
  - from: urn:example:system:assistant
    type: uses-model
    to: urn:example:model:gpt-4.1
    sensitivity: internal

unknowns:
  - id: urn:example:unknown:training-data
    class: explicit-unknown
    subject: urn:example:model:gpt-4.1
    field: trainingDataset
    reason: The hosted supplier does not publish a complete dataset inventory.
    owner: Example platform team
    consequence: Dataset-level upstream impact cannot be determined.
    reviewAfter: 2026-12-01T00:00:00Z
    sensitivity: internal
```

The complete example is [examples/rag-agent/aibom.yaml](examples/rag-agent/aibom.yaml).

## Discovery

Discovery is conservative and produces evidence about what was found. It does not prove deployment or runtime use.

| Detector              | Current behaviour                                                                                                         | Claim boundary                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Hosted models         | Finds recognised OpenAI, Anthropic, Google and Mistral identifier patterns in supported source and configuration files.   | Records a source reference only.                                                |
| Package declarations  | Parses `package.json` and `requirements*.txt` for a focused catalogue of AI SDKs, frameworks and vector database clients. | Records a dependency declaration, not installation or execution.                |
| Prompt artifacts      | Finds files under `prompt` or `prompts` directories and names containing `.prompt`.                                       | Records repository presence and a digest when within the configured size limit. |
| Local model artifacts | Finds selected GGUF, safetensors, ONNX, PyTorch, Keras, TensorFlow Lite and pickle-related extensions.                    | Hashes the file without loading or executing it.                                |
| Datasets              | Finds CSV, JSONL, Parquet and Arrow files only when their path indicates data, training or evaluation context.            | Records a candidate dataset artifact, not provenance or approval.               |
| Retrieval indexes     | Finds `.faiss` files.                                                                                                     | Records repository presence, not index contents or active deployment.           |

The scanner:

- honours `.gitignore` by default;
- excludes dependency, generated output and build directories;
- excludes `.env`, credential, secret, private key and certificate patterns;
- does not copy prompt, dataset or source content into generated records;
- limits source inspection and hashing using manifest settings;
- records a hash as an explicit unknown when an artifact exceeds `maxHashBytes`.

## CLI commands

| Command                               | Purpose                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `aibom init [directory]`              | Create a starter manifest with explicit unknowns instead of placeholder claims. |
| `aibom generate [directory]`          | Assemble, validate and write the canonical operational record.                  |
| `aibom validate <file>`               | Validate a manifest or generated document.                                      |
| `aibom diff <base> <head>`            | Produce a semantic record-level diff.                                           |
| `aibom impact <document> <component>` | Find reverse dependency paths from a component to affected nodes.               |
| `aibom project <document>`            | Produce a sensitivity-filtered view.                                            |
| `aibom export <document>`             | Export CycloneDX 1.7 or SPDX 3.0.1 JSON-LD.                                     |

Run `aibom <command> --help` for complete options.

Impact analysis reports one shortest reverse dependency path per affected node.

## GitHub Action

The Action:

- uses the same generator as the local CLI;
- binds available repository, commit, ref, event, workflow and run identifiers;
- writes requested files but does not upload them automatically;
- writes a GitHub job summary;
- exposes output paths and the canonical document identifier;
- can compare against a baseline;
- can fail on any unknown, new unknowns or any material semantic change.

After the first versioned release, use the stable major tag:

```yaml
name: Generate operational AIBOM

on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  aibom:
    runs-on: ubuntu-latest
    steps:
      - name: Check out source
        uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0

      - name: Generate operational AIBOM
        id: aibom
        uses: Jason-Doyle/operational-aibom@v1
        with:
          path: .
          output: artifacts/aibom.json
          cyclonedx-output: artifacts/aibom.cdx.json
          spdx-output: artifacts/aibom.spdx.jsonld

      - name: Upload generated records
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        with:
          name: operational-aibom
          path: artifacts/
```

Use `uses: ./` only when testing changes from a checkout of this repository.

JavaScript Actions execute the bundled file referenced by [action.yml](action.yml). The release ref must therefore contain `dist/action/index.cjs`.

### Attestation

Generation and attestation are separate operations. A signature protects provenance and integrity, but does not make the claims in a record true.

To bind the CycloneDX view to an actual release artifact:

```yaml
permissions:
  contents: read
  id-token: write
  attestations: write
  artifact-metadata: write

steps:
  - name: Attest release artifact and AIBOM
    uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6 # v4.2.2
    with:
      subject-path: dist/application.tar.gz
      sbom-path: artifacts/aibom.cdx.json
```

Use build provenance mode instead when the generated `aibom.json` file itself is the subject. Do not describe an AIBOM attestation as proof that the system is safe or compliant.

## Action inputs

| Input                                    | Default           | Purpose                                                            |
| ---------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| `path`                                   | `.`               | Project directory relative to `GITHUB_WORKSPACE`.                  |
| `manifest`                               | empty             | Explicit manifest path. Empty uses `aibom.yaml` only when present. |
| `output`                                 | `aibom.json`      | Canonical output path.                                             |
| `public-output`                          | empty             | Optional public projection.                                        |
| `cyclonedx-output`                       | empty             | Optional CycloneDX 1.7 view.                                       |
| `spdx-output`                            | empty             | Optional SPDX 3.0.1 JSON-LD view.                                  |
| `baseline`                               | empty             | Existing canonical record used for semantic comparison.            |
| `diff-output`                            | `aibom.diff.json` | Diff path when a baseline is supplied.                             |
| `discovery`                              | `true`            | Enable repository discovery.                                       |
| `environment-context`                    | `true`            | Include GitHub and `AIBOM_*` environment context.                  |
| `generated-at`                           | empty             | Fixed ISO 8601 generation timestamp.                               |
| `build-id`, `release`                    | empty             | Optional build and release binding.                                |
| `deployment-id`, `environment`, `region` | empty             | Optional deployment binding.                                       |
| `fail-on-unknowns`                       | `false`           | Fail if any explicit unknown exists.                               |
| `fail-on-new-unknowns`                   | `false`           | Fail if the baseline diff introduces unknowns.                     |
| `fail-on-changes`                        | `false`           | Fail if the baseline diff contains a material change.              |

## Evidence classes

| Class                       | Establishes                                                              | Does not establish                                                                   |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `component-fact`            | A directly observable property, digest, identifier or source occurrence. | Safety, suitability or operational use unless the evidence specifically observes it. |
| `supplier-declaration`      | A supplier made a versioned statement.                                   | Independent verification of that statement.                                          |
| `organisational-assessment` | A defined internal method produced a result for a stated scope and time. | Applicability after the assessed composition changes.                                |
| `deployment-observation`    | A platform reported configured state at an observed time.                | That every request used that state.                                                  |
| `runtime-observation`       | A specific execution was associated with recorded state.                 | That all executions behaved the same way.                                            |
| `explicit-unknown`          | Required information is unavailable or unverified.                       | That the gap is harmless.                                                            |

See [docs/FORMAT.md](docs/FORMAT.md) for the canonical model.

## Standard compatibility views

The canonical record is richer than either export. Every standard view includes an explicit loss notice.

| View      | Version       | Current mapping                                                                                                                                           |
| --------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CycloneDX | 1.7           | Models, datasets, files, frameworks, libraries, system identity, component occurrences, dependencies and namespaced evidence and relationship properties. |
| SPDX      | 3.0.1 JSON-LD | AI packages, dataset packages, software files and packages, hashes, root system and mapped graph relationships.                                           |

Both exporters have been validated against their official JSON schemas. See [docs/STANDARDS-MAPPING.md](docs/STANDARDS-MAPPING.md) for known information loss.

## Reproducible example

[examples/rag-agent](examples/rag-agent) is synthetic and contains no private data. Its committed records were generated with:

```powershell
npm run build
node dist\cli.js generate examples\rag-agent `
  --output expected\aibom.json `
  --public-output expected\aibom.public.json `
  --cyclonedx-output expected\aibom.cdx.json `
  --spdx-output expected\aibom.spdx.jsonld `
  --no-environment-context `
  --generated-at 2026-09-08T22:49:31.000Z
```

The expected canonical document identifier is:

```text
urn:aibom:document:sha256:8b7e2d67e4425f133252f1a1f70a6226623ba696a906f2e8b34d9a164ad9cb0b
```

## Development

| Command                   | Purpose                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run format`          | Format source, schemas and documentation.                                                        |
| `npm run lint`            | Run typed ESLint rules.                                                                          |
| `npm run typecheck`       | Run TypeScript without emitting files.                                                           |
| `npm run test`            | Run unit and integration tests.                                                                  |
| `npm run build`           | Build the ESM library, CLI and bundled Node 24 Action.                                           |
| `npm run smoke`           | Execute the built CLI and Action against the synthetic fixture.                                  |
| `npm run standards:check` | Validate populated exports against the live CycloneDX and SPDX schemas. Requires network access. |
| `npm run package:check`   | Show the npm tarball contents without publishing.                                                |
| `npm run check`           | Run the complete local quality gate.                                                             |

## Release status

| Surface            | Status                                                                  |
| ------------------ | ----------------------------------------------------------------------- |
| GitHub source      | Public at `Jason-Doyle/operational-aibom`.                              |
| Licence            | Apache-2.0.                                                             |
| npm                | Package metadata and trusted-publishing workflow are prepared.          |
| GitHub Action      | The bundled Action is ready for a versioned GitHub release.             |
| Security reporting | Use GitHub private vulnerability reporting as described in SECURITY.md. |
