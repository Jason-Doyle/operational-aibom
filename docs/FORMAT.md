# Canonical Operational AIBOM Format

Schema version: `0.1.0`

The canonical document is an internal operational graph. CycloneDX and SPDX files are compatibility views generated from it.

## Top-level records

| Field           | Purpose                                                                                     | Stability                                       |
| --------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `schemaVersion` | Version of this project's canonical data model.                                             | Changes only when the canonical schema changes. |
| `document`      | Generator identity, generation time, source manifest identity and canonical content digest. | Recalculated for each distinct content graph.   |
| `system`        | Identity, ownership, intended use and properties of the assembled AI system.                | Normally release scoped.                        |
| `context`       | Repository, commit, workflow, build, release and deployment identity.                       | Build or deployment scoped.                     |
| `components`    | AI-specific and ordinary system nodes.                                                      | Changes with composition.                       |
| `relationships` | Directed graph edges between the system and components.                                     | Changes with composition or authority.          |
| `evidence`      | Time-bound records supporting statements about graph elements.                              | Can change without composition changing.        |
| `assessments`   | Organisational test or review outcomes.                                                     | Time-bound and scope-bound.                     |
| `observations`  | Deployment or runtime state observed at a specific time.                                    | Dynamic.                                        |
| `unknowns`      | Information that is unavailable or cannot be verified.                                      | Remains until resolved or superseded.           |

## Identifiers

| Rule                    | Requirement                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Scope                   | Every component, relationship, evidence, assessment, observation and unknown has an identifier.                             |
| Uniqueness              | Identifiers must be unique within their record category. Component identifiers must also differ from the system identifier. |
| Durability              | Declared identifiers should remain stable across releases when they refer to the same logical thing.                        |
| Generated identifiers   | Discovery identifiers are SHA-256 URNs derived from stable identifying properties.                                          |
| Document identifier     | `document.id` is `urn:aibom:document:sha256:<contentDigest>`.                                                               |
| Relationship identifier | Omitted manifest relationship identifiers are derived from `from`, `type` and `to`.                                         |

The generator does not include `generatedAt` or source manifest metadata in the content digest. The digest covers:

- schema version;
- system;
- build, release and deployment context;
- components and relationships;
- evidence, assessments, observations and unknowns.

Arrays are sorted by identifier before the digest is calculated.

## Components

| Field                         | Meaning                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `id`                          | Durable graph identifier.                                      |
| `type`                        | Canonical component type.                                      |
| `name`, `version`, `supplier` | Human-readable identity.                                       |
| `origin`                      | `declared`, `discovered` or `merged`.                          |
| `hashes`                      | Directly observed artifact digests.                            |
| `locations`                   | Repository occurrences without copied source content.          |
| `licences`                    | Declared licence expressions.                                  |
| `properties`                  | Type-specific values not promoted to canonical fields.         |
| `evidence`                    | Evidence identifiers directly supporting the component record. |
| `sensitivity`                 | Maximum publication level.                                     |

### Component types

| Type                 | Example                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `ai-system`          | The assembled application represented by the top-level `system` field. |
| `hosted-model`       | Provider-hosted generation model.                                      |
| `local-model`        | Model weights or model package controlled by the deployer.             |
| `embedding-model`    | Hosted or local embedding model.                                       |
| `dataset`            | Training, retrieval or other system dataset.                           |
| `evaluation-dataset` | Versioned dataset used to assess behaviour.                            |
| `prompt`             | System, developer or reusable prompt artifact.                         |
| `retrieval-index`    | Vector or search index built from a corpus.                            |
| `vector-database`    | Vector storage product or client dependency.                           |
| `agent`              | Agent definition or orchestrated authority boundary.                   |
| `tool`               | API, function or command an agent can invoke.                          |
| `policy`             | Governing safety, access or approval policy.                           |
| `framework`          | AI, ML, orchestration or inference framework.                          |
| `software-library`   | Ordinary or AI-specific library.                                       |
| `hosted-service`     | Externally operated API or platform service.                           |
| `infrastructure`     | Runtime, hardware or platform component.                               |
| `other`              | Component that does not yet have a stable canonical category.          |

## Relationships

Relationships are directed. `from` is the dependent, containing or acting node. `to` is the dependency, contained or acted-upon node.

| Relationship      | Interpretation                                                          |
| ----------------- | ----------------------------------------------------------------------- |
| `contains`        | The source system or component contains the target.                     |
| `depends-on`      | The source depends on the target.                                       |
| `uses-model`      | The source is configured to use the target model.                       |
| `trained-on`      | The source model was trained on the target dataset.                     |
| `fine-tuned-from` | The source model was derived from the target model.                     |
| `evaluated-with`  | The source was evaluated using the target.                              |
| `embeds-with`     | The source index or pipeline uses the target embedding model.           |
| `retrieves-from`  | The source retrieves information from the target.                       |
| `governed-by`     | The source is governed by the target prompt, policy or control.         |
| `can-invoke`      | The source agent or workflow has authority to invoke the target tool.   |
| `deployed-as`     | The source release or system is deployed as the target.                 |
| `references`      | Discovery found a repository reference without proving operational use. |

Additional kebab-case relationship names are accepted. Exporters map unsupported relationships conservatively and preserve the original value in a loss note.

## Evidence

| Field                      | Meaning                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `class`                    | Evidence class defining what kind of statement is being recorded.                     |
| `subject`                  | System, component, relationship or document identifier to which the evidence applies. |
| `claim`                    | Narrow statement supported by the record.                                             |
| `issuer`, `owner`          | Party making the statement and party accountable for reviewing it.                    |
| `method`                   | Collection, test or review method.                                                    |
| `observedAt`, `validUntil` | Time boundary for the evidence.                                                       |
| `confidence`               | Confidence in detection or association from `0` to `1`, not a safety score.           |
| `scope`                    | Explicit limit on what can be concluded.                                              |
| `source`                   | File, manifest, workflow, API, assessment or URI provenance.                          |
| `sensitivity`              | Maximum publication level.                                                            |

| Evidence class              | Use                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `component-fact`            | Directly observed identifier, digest, source occurrence or configured value.           |
| `supplier-declaration`      | Supplier-authored intended use, limitation, provenance or support statement.           |
| `organisational-assessment` | Internal evaluation, threat model, review or release conclusion.                       |
| `deployment-observation`    | Platform-reported configured deployment state.                                         |
| `runtime-observation`       | Request or execution-specific state.                                                   |
| `explicit-unknown`          | An unavailable or unverified value. Canonical unknown details normally use `unknowns`. |

## Discovery claims

Automatic discovery uses narrow claims:

| Observation                      | Claim made                                                   |
| -------------------------------- | ------------------------------------------------------------ |
| Model identifier in source       | The source contains a reference to the identifier.           |
| Dependency in a package manifest | The manifest declares the dependency.                        |
| Prompt, model or dataset file    | The repository contains the artifact.                        |
| Artifact digest                  | The observed file bytes matched the recorded SHA-256 digest. |

Discovery does not claim that:

- the referenced model served a production request;
- a declared package was installed or executed;
- a file was included in a deployed build;
- a supplier statement is true;
- a component is safe or suitable.

## Assessments

An assessment must identify:

- its subject;
- its name and method;
- a result of `pass`, `fail`, `inconclusive` or `informational`;
- its observation time;
- any expiry time;
- supporting evidence identifiers.

Changing a model, prompt, dataset, retrieval index, tool or relevant configuration should normally trigger review of assessments that applied to the previous composition.

## Observations

| Kind         | Intended use                                                                          |
| ------------ | ------------------------------------------------------------------------------------- |
| `deployment` | Record environment, platform or configured release state observed at a point in time. |
| `runtime`    | Link a specific execution to controlled trace or replay evidence.                     |

Runtime input, output and identity data should remain in an access-controlled tracing system. The AIBOM should carry identifiers or references rather than copy unrestricted trace content.

## Unknowns

| Field                 | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `field`               | Information that is unavailable.                          |
| `reason`              | Why it cannot currently be supplied or verified.          |
| `owner`               | Party accountable for the gap.                            |
| `consequence`         | Operational limitation created by the gap.                |
| `compensatingControl` | Other control used while the information remains unknown. |
| `reviewAfter`         | Next required review time.                                |

Missing `owner` and `reviewAfter` produce warnings rather than silently turning the unknown into a complete-looking record.

## Sensitivity

| Level        | Intended audience                                           |
| ------------ | ----------------------------------------------------------- |
| `public`     | Safe for unrestricted publication.                          |
| `internal`   | Intended for the organisation and trusted delivery systems. |
| `restricted` | Requires explicit access control.                           |

Projection rules:

- a projection includes records at or below the requested level;
- relationships are removed if either endpoint is absent;
- evidence references are removed when the evidence is not visible;
- public context keeps repository, commit, ref and release only;
- public output omits manifest path and digest;
- the system itself must be marked public before a public projection can be generated.

`publication.defaultSensitivity` is a fallback applied to declared records that omit `sensitivity`. It does not publish a record and does not override the projection filter. Automatic manifest and workflow provenance remains internal.

## Diff semantics

The diff contains the complete record-level changes. Its summary separates material changes from run-scoped provenance:

- repository, commit, ref, release and deployment changes are material context changes;
- event name, workflow name, workflow run id and build id are run scoped;
- generated discovery and manifest evidence ignores observation-time-only changes but still detects changed source digests, locations or claims;
- workflow context and observation-time-only evidence changes remain visible in the full diff but increment `nonMaterialChanges` instead of forcing `reviewRequired`;
- `fail-on-changes` uses the material summary.

## Validation

Validation fails on:

- schema violations;
- duplicate identifiers;
- missing relationship endpoints;
- missing evidence or subject references;
- invalid evidence time windows;
- a content digest or document identifier that does not match canonical content.

Validation warns on:

- supplier declarations without a source URI;
- unknowns without an owner or next review date;
- a system without an owner or intended use.
