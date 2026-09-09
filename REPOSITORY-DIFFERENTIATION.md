# Proposed AIBOM Repository Differentiation

Status: concept document. Capabilities listed for the proposed repository are intended behaviour, not implemented functionality.

Comparison reviewed: 8 September 2026.

## Core proposition

| Question   | Existing tools generally answer                                           | Proposed repository would answer                                                                                                       |
| ---------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory  | What AI-related components can be detected?                               | What components, relationships, evidence and observations defined a specific AI system release or deployment?                          |
| Evidence   | Where was a component reference found?                                    | What kind of claim is this, who supplied it, how was it established, when was it observed and how much can be concluded from it?       |
| Change     | What changed between two scans?                                           | What changed in composition or assurance, which deployments are affected and what must be reviewed or reevaluated?                     |
| Operations | Does the repository contain a model, prompt, dataset or risky dependency? | Which deployed systems depend on an affected model, dataset, prompt, index, tool, policy or hosted service?                            |
| Trust      | Is the generated file signed or traceable to a workflow?                  | Is each statement traceable to evidence, with signatures protecting provenance without presenting the statement as automatically true? |
| Unknowns   | Which fields could not be detected?                                       | What is unknown, why it is unknown, who owns the gap, what the consequence is and when it should be reviewed?                          |

## Positioning

| Area                      | Proposed position                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Primary purpose           | Create a machine-processable operational record for an assembled and deployed AI system.                                          |
| Relationship to scanners  | Consume and complement scanner output rather than trying to replace mature source, image and workload scanners.                   |
| Relationship to SBOMs     | Link to or ingest an ordinary SBOM because AI-specific inventory supplements rather than replaces software inventory.             |
| Relationship to standards | Maintain a richer internal operational graph and export the supported subset to CycloneDX and SPDX.                               |
| Delivery model            | A local CLI provides reproducible behaviour. A GitHub Action invokes the same CLI in CI.                                          |
| Primary differentiator    | Evidence classification, release and deployment identity, temporal separation, operational impact analysis and explicit unknowns. |
| Intended users            | Developers, platform engineers, security teams, AI governance teams, incident responders and system owners.                       |

## Comparison with existing tools

Legend:

| Value          | Meaning                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Yes            | Public documentation describes the capability directly.                                                        |
| Partial        | Some related capability exists, but it does not cover the proposed operational model.                          |
| Not documented | The capability was not found in the public material reviewed. This does not prove that it cannot be supported. |
| Planned        | Intended capability of the proposed repository.                                                                |

| Capability                     | Proposed operational AIBOM repository                                                                                                                                    | AIROM                                                                                                                                                   | OWASP AIBOM Generator                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Primary scope                  | Planned: assemble a release and deployment-specific operational record from declarations, scanner results, assessments and observations.                                 | Scans filesystems, Git repositories, container images and Kubernetes manifests for AI components and risks.                                             | Generates an AIBOM for models hosted on Hugging Face.                                                                             |
| Automatic source discovery     | Planned: focused built-in discovery plus adapters for external scanners. Discovery is evidence, not the complete record.                                                 | Yes: broad detection across languages, frameworks, hosted models, local models, prompts, datasets, vector databases and infrastructure.                 | Partial: automatically obtains metadata for supported Hugging Face models.                                                        |
| Ordinary software inventory    | Planned: ingest or link an existing SBOM instead of reimplementing package discovery.                                                                                    | Yes: reads manifests, lockfiles, installed metadata and packaged binaries.                                                                              | Not documented as a general software SBOM generator.                                                                              |
| File and line evidence         | Planned: preserve evidence supplied by scanners and collectors.                                                                                                          | Yes: records file, line, detection technique and confidence.                                                                                            | Not documented on the reviewed product page.                                                                                      |
| Evidence classification        | Planned: distinguish verifiable component facts, supplier declarations, organisational assessments, deployment observations, runtime observations and explicit unknowns. | Partial: distinguishes detection evidence and confidence, but the reviewed documentation does not describe these claim classes.                         | Not documented.                                                                                                                   |
| Evidence ownership and source  | Planned: every claim can include issuer, owner, source URI, collection method, observed time and applicable scope.                                                       | Partial: detection source and occurrence evidence are recorded. Broader ownership semantics are not the primary documented model.                       | Partial: model metadata is collected and displayed, but broader organisational evidence ownership is not documented.              |
| Evidence freshness             | Planned: record observation time, expiry or review date and superseding evidence.                                                                                        | Partial: lifecycle and vulnerability information can be updated, but a general evidence freshness model is not documented.                              | Not documented.                                                                                                                   |
| Build identity                 | Planned: bind the record to repository, commit, workflow, run and build artifact identifiers.                                                                            | Partial: repository and artifact scanning is supported; a first-class operational binding across all identities is not documented.                      | Not documented.                                                                                                                   |
| Release identity               | Planned: identify the release whose composition was approved.                                                                                                            | Partial: scans and diffs can run in release workflows, but release identity is not presented as the central record.                                     | Not documented.                                                                                                                   |
| Deployment identity            | Planned: bind composition to environment, region, deployment identifier and observation time.                                                                            | Partial: Kubernetes workload scanning is supported, but a general release-to-deployment evidence record is not documented.                              | Not documented.                                                                                                                   |
| Runtime observation references | Planned: link selected request or execution observations without copying sensitive trace content into the BOM.                                                           | Not documented as a request-level feature.                                                                                                              | Not documented.                                                                                                                   |
| Stable and dynamic records     | Planned: separate stable composition from changing assurance, vulnerability, evaluation and runtime evidence while linking them through durable identifiers.             | Partial: composition, CVE, risk and lifecycle data are available, but the reviewed documentation does not describe this explicit temporal separation.   | Not documented.                                                                                                                   |
| Explicit unknowns              | Planned: capture reason, owner, consequence, compensating control and review date.                                                                                       | Partial: unresolved values remain empty rather than being guessed.                                                                                      | Partial: completeness scoring can expose missing fields, but operational ownership of unknowns is not documented.                 |
| Dependency graph               | Planned: represent software, models, datasets, prompts, retrieval indexes, tools, policies, evaluations, deployments and observations as linked nodes.                   | Partial to yes: emits SPDX JSON-LD and identifies connected AI components such as RAG pipelines.                                                        | Partial: produces CycloneDX model-oriented output and dependency information.                                                     |
| Agent authority                | Planned: record tools, argument schemas, identities, permissions, approval boundaries and governing policies.                                                            | Partial: agent frameworks, tool-related code and configurations may be detected, but authority and approval boundaries are not the documented focus.    | Not documented.                                                                                                                   |
| Evaluation linkage             | Planned: connect an evaluation result to the exact model, prompt, dataset, configuration and release to which it applies.                                                | Partial: compliance attestations and risk findings are supported, but general organisational evaluation lineage is not the documented focus.            | Not documented.                                                                                                                   |
| Operational impact queries     | Planned: answer which releases and deployments depend on an affected component and what must be reevaluated.                                                             | Partial: semantic scan diffs, risks and CI gates are supported. Estate-level impact and reevaluation workflows are not the primary documented function. | Not documented.                                                                                                                   |
| Replacement and recovery data  | Planned: record replacement candidates, tested migration paths, isolation options and recovery dependencies.                                                             | Partial: model lifecycle information identifies provider retirement risk. Tested replacement readiness is not documented as a general record.           | Not documented.                                                                                                                   |
| Pull request diff              | Planned: distinguish composition changes, evidence changes, assurance changes and newly introduced unknowns.                                                             | Yes: supports semantic AIBOM diffs and build gates.                                                                                                     | Not documented.                                                                                                                   |
| Sensitive data handling        | Planned: field-level sensitivity labels and separate public, internal and restricted projections. Prompt or dataset content would not be copied by default.              | Not documented as a multi-view publication model on the reviewed page.                                                                                  | Not documented.                                                                                                                   |
| CycloneDX output               | Planned: export the subset that maps cleanly to CycloneDX.                                                                                                               | Yes.                                                                                                                                                    | Yes.                                                                                                                              |
| SPDX output                    | Planned: export the subset that maps cleanly to SPDX 3.                                                                                                                  | Yes: SPDX 3.0.1 JSON-LD is documented.                                                                                                                  | Described as aligned with SPDX, with CycloneDX as the documented output format.                                                   |
| SARIF or security findings     | Optional adapter output rather than the core record.                                                                                                                     | Yes.                                                                                                                                                    | Not documented.                                                                                                                   |
| Attestation                    | Planned: support GitHub artifact attestation for release records while retaining the distinction between authenticated provenance and truth.                             | Can be added around generated output in a workflow; it is not described as the central AIBOM model.                                                     | Not documented.                                                                                                                   |
| GitHub Actions integration     | Planned: first-party action using the same versioned CLI available locally.                                                                                              | Yes.                                                                                                                                                    | Not documented on the reviewed product page.                                                                                      |
| Reproducible examples          | Planned: fixtures, expected generated records, raw diffs and limitations published with every claimed capability.                                                        | Yes: the project documents fixtures and test scope.                                                                                                     | A web interface and completeness checks are documented; reproducible repository fixtures were not described on the reviewed page. |

## Relationship to standards

CycloneDX and SPDX are standards and data models, not competing repository scanners. The proposed repository should use them where possible and document any information that cannot be represented without loss.

| Area                           | CycloneDX AI/ML-BOM                                                                                                             | SPDX 3 AI profiles                                                                                                             | Proposed repository                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Main role                      | Exchange AI and ML component, dataset, model, configuration and risk information within the wider CycloneDX BOM model.          | Represent AI systems as a connected graph containing software, models, datasets, prompts, agents and associated relationships. | Collect, classify, bind, validate, diff and query operational records, then export compatible views.            |
| Graph representation           | Supports component relationships inside a BOM.                                                                                  | Graph-based model with semantic relationships.                                                                                 | Use a graph as the internal operational unit and preserve source identifiers during export.                     |
| Generation                     | Does not prescribe one universal repository scanner.                                                                            | Does not prescribe one universal repository scanner.                                                                           | Provide collectors, adapters and a GitHub Action.                                                               |
| Evidence semantics             | Can hold evidence and supporting properties, but does not itself establish the proposed evidence classes and operating process. | Can represent rich entities and relationships, but does not by itself collect or validate organisational evidence.             | Apply explicit evidence classes, ownership, observation time, freshness and confidence rules.                   |
| Deployment and runtime binding | Can represent relevant metadata, but collection and lifecycle behaviour depend on the implementation.                           | Can model related elements, but collection and operational workflows depend on the implementation.                             | Make build, release, deployment and selected runtime observation binding a core workflow.                       |
| Operational workflow           | Exchange format and capability model.                                                                                           | Exchange format and knowledge graph model.                                                                                     | Add impact analysis, reevaluation triggers, release comparison, unknown tracking and privacy-aware publication. |

## Proposed information model

| Record type      | Purpose                                                                       | Example                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Component        | Identify something that participates in the AI system.                        | Hosted model deployment, model file, prompt bundle, vector index, dataset snapshot, tool API or ordinary SBOM.               |
| Relationship     | Explain how components depend on or govern one another.                       | `uses-model`, `trained-on`, `embeds-with`, `retrieves-from`, `governed-by`, `can-invoke`, `evaluated-with` or `deployed-as`. |
| Evidence         | Support a statement without making all evidence appear equally authoritative. | File digest, supplier model card, internal evaluation, cloud deployment response or request trace reference.                 |
| Composition      | Record the relatively stable graph approved for a build or release.           | Release `v1.4.0` uses prompt bundle `sha256:...` and model deployment `support-prod-3`.                                      |
| Assessment       | Record a time-bound organisational conclusion.                                | Regression evaluation passed against dataset snapshot `eval-2026-09-01`.                                                     |
| Observation      | Record deployment or runtime state at an observed time.                       | Deployment API reported model version `2026-08-15` in region `westeurope`.                                                   |
| Unknown          | Preserve unavailable information and its operational consequence.             | Hosted model training dataset is unavailable from the supplier and requires annual review.                                   |
| Publication view | Control which parts of the record can be shared.                              | Public record omits prompt text, internal endpoint names and restricted dataset details.                                     |

## Evidence classes

| Evidence class            | What it means                                                                                  | What it does not prove                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Verifiable component fact | A directly observed property can be checked, such as a digest, commit or immutable identifier. | That the component is safe, suitable or trustworthy.          |
| Supplier declaration      | A supplier published a statement about a component.                                            | That the organisation independently verified the statement.   |
| Organisational assessment | A defined internal test or review produced a result for a stated scope and time.               | That the result applies after the tested composition changes. |
| Deployment observation    | A platform reported configured deployment state at a stated time.                              | That every request was served by that exact state.            |
| Runtime observation       | A specific execution was associated with recorded components or configuration.                 | That the observation applies to every execution.              |
| Explicit unknown          | Required information is unavailable or cannot be verified.                                     | That the missing information is harmless.                     |

## Repository workflow

| Stage       | CLI or Action behaviour                                                                                                         | Output                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Discover | Run focused built-in collectors and optional external tools such as ordinary SBOM or AI component scanners.                     | Raw collector records with source and collection method.      |
| 2. Declare  | Read a version-controlled manifest for intended use, ownership, policies, relationships and unavailable metadata.               | Declared claims kept separate from detected facts.            |
| 3. Observe  | Collect approved CI, build, release and deployment identifiers. Later adapters could collect selected runtime references.       | Time-stamped observations scoped to a release or deployment.  |
| 4. Classify | Assign an evidence class and preserve issuer, owner, source, scope, confidence and freshness.                                   | Normalised evidence records.                                  |
| 5. Assemble | Join components, relationships, evidence and observations into a versioned graph.                                               | Canonical operational AIBOM JSON.                             |
| 6. Validate | Check schema, dangling relationships, missing identifiers, stale evidence, sensitivity rules and required unknown explanations. | Validation report and deterministic exit code.                |
| 7. Diff     | Compare the proposed graph with the selected baseline.                                                                          | Composition, evidence, assurance and unknown deltas.          |
| 8. Publish  | Generate human-readable and machine-readable views. Optionally create a GitHub artifact attestation.                            | CI job summary, downloadable artifact and standards exports.  |
| 9. Query    | Evaluate dependency and reevaluation questions against one or more records.                                                     | Impact report for incidents, migrations and release approval. |

## GitHub Action behaviour by event

| Event                      | Intended behaviour                                                                                           | Default publication                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Pull request               | Generate the proposed record, validate it and compare it with the base branch.                               | GitHub job summary plus a non-sensitive diff artifact.                       |
| Push to the default branch | Generate a versioned composition record associated with the commit and workflow run.                         | Internal workflow artifact unless explicitly configured otherwise.           |
| Release                    | Bind the approved composition to the release and generated artifacts.                                        | Release artifact with optional GitHub artifact attestation.                  |
| Deployment                 | Add or update a deployment observation linked to an existing release record.                                 | Restricted artifact by default because deployment metadata may be sensitive. |
| Schedule                   | Refresh time-bound supplier, lifecycle or vulnerability evidence without rewriting the original composition. | New evidence snapshot linked to the existing record.                         |

## Proposed repository artifacts

Names are illustrative and should be confirmed during design.

| Artifact            | Purpose                                                                                | Version controlled                             |
| ------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `aibom.yaml`        | Human-maintained declarations, ownership, relationships, policy and explicit unknowns. | Yes                                            |
| `aibom.schema.json` | Validate the source manifest and canonical generated record.                           | Yes                                            |
| `aibom.json`        | Canonical generated operational graph.                                                 | Optional; release artifacts may be preferable. |
| `aibom.public.json` | Redacted projection intended for public distribution.                                  | Optional                                       |
| `aibom.diff.json`   | Machine-readable change between two records.                                           | No                                             |
| `aibom-summary.md`  | Human-readable CI or release summary.                                                  | No                                             |
| `aibom.cdx.json`    | CycloneDX export containing representable information.                                 | No                                             |
| `aibom.spdx.jsonld` | SPDX 3 export containing representable information.                                    | No                                             |
| Attestation bundle  | Cryptographically links a released record to its GitHub workflow provenance.           | Published with the release artifact.           |

## Operational questions the repository should support

| Scenario               | Query                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| Model retirement       | Which releases and deployments reference the retiring model or an alias that may resolve to it?        |
| Dataset withdrawal     | Which models, indexes, evaluations and deployments depend directly or transitively on the dataset?     |
| Prompt change          | Which evaluations and approvals became stale when the prompt bundle changed?                           |
| Embedding migration    | Which indexes must be rebuilt and which compatibility tests are required?                              |
| Agent tool change      | Which agents gained authority, which identities they use and which approval boundary changed?          |
| Vulnerable loader      | Which model artifacts are loaded through the affected library and where are those builds deployed?     |
| Incident investigation | Which composition, policies, retrieved sources and tool definitions applied to the affected execution? |
| Recovery               | Which tested replacement or isolation path exists for the affected component?                          |
| Evidence review        | Which supplier declarations have no independent assessment or have passed their review date?           |
| Unknown management     | Which important unknowns have no owner, compensating control or next review date?                      |

## Recommended implementation boundary

| Build directly                                  | Integrate or ingest                       |
| ----------------------------------------------- | ----------------------------------------- |
| Canonical operational graph and identifiers     | Ordinary SBOM generation                  |
| Evidence classes and validation rules           | Broad source, image and workload scanning |
| Manifest for declarations and explicit unknowns | Vulnerability databases                   |
| Build, release and deployment binding           | Model provider lifecycle catalogues       |
| Temporal evidence and freshness handling        | Model cards and supplier documentation    |
| Composition and evidence diff                   | Evaluation frameworks                     |
| Impact and reevaluation queries                 | Cloud and deployment platform APIs        |
| Public, internal and restricted projections     | GitHub artifact attestation service       |
| CycloneDX and SPDX mappings                     | Runtime tracing systems                   |

## Proposed delivery phases

| Phase                         | Scope                                                                                                                                                 | Evidence of completion                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 0. Design                     | Define identifiers, evidence classes, graph relationships, sensitivity rules and mappings to CycloneDX and SPDX.                                      | Published schema, example records, mapping table and documented unresolved questions.      |
| 1. Minimum viable repository  | CLI, `aibom.yaml`, deterministic generation, validation, Git commit and workflow binding, diff, GitHub Action and one realistic RAG or agent example. | Reproducible fixture produces the committed expected output locally and in GitHub Actions. |
| 2. Interoperability           | Ingest an ordinary SBOM and AIROM output; export CycloneDX and SPDX views; add optional GitHub artifact attestation.                                  | Round-trip and mapping tests publish raw results and documented information loss.          |
| 3. Operational evidence       | Add evaluation records, deployment observations, freshness rules, reevaluation triggers and impact queries.                                           | Demonstrated model retirement, prompt change and dataset withdrawal scenarios.             |
| 4. Controlled runtime linkage | Link selected runtime observations and trace references without copying sensitive request content.                                                    | A privacy-reviewed example connects an execution to a release composition.                 |

## Non-goals

| The repository should not claim to                                                       | Reason                                                                                                      |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Prove that an AI system is safe, fair, lawful, secure or suitable.                       | An inventory and its provenance do not establish those conclusions.                                         |
| Replace an ordinary SBOM.                                                                | AI systems still contain conventional software and infrastructure dependencies.                             |
| Infer unavailable supplier information.                                                  | Unknown information should remain explicit rather than being guessed.                                       |
| Copy prompts, datasets, inputs, outputs or credentials into public artifacts by default. | A useful operational record must not create a new confidentiality or privacy exposure.                      |
| Store full runtime traces as part of the BOM.                                            | Traces are high-volume, sensitive operational evidence and should be referenced through controlled systems. |
| Create a new compliance badge or unsupported completeness score.                         | Field presence is not equivalent to effective control or verified assurance.                                |
| Reimplement every scanner, evaluation framework or tracing platform.                     | The repository should provide an integration and evidence model around specialised tools.                   |
| Claim complete automatic generation.                                                     | Repository and CI inspection cannot observe all supplier, deployment or runtime facts.                      |

## Main project risk

| Risk                                                                                     | Mitigation                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| The repository becomes another static scanner with less coverage than established tools. | Treat scanner output as one input and focus implementation on operational assembly, evidence semantics and impact analysis.                |
| A new schema competes with established standards.                                        | Publish explicit CycloneDX and SPDX mappings, contribute useful concepts upstream and document every lossy conversion.                     |
| Automatic collection leaks sensitive information.                                        | Collect identifiers and digests by default, apply sensitivity labels and require explicit configuration before publishing detailed values. |
| Signed output is mistaken for verified truth.                                            | State that attestations authenticate provenance and integrity, while evidence classes describe what each underlying claim establishes.     |
| The scope becomes too broad for a credible first release.                                | Use one realistic example system and prove a narrow end-to-end workflow before adding frameworks or cloud adapters.                        |

## Recommended public description

| Field                | Draft                                                                                                                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One-line description | An evidence-classified, deployment-aware operational AI Bill of Materials generator for local development and GitHub Actions.                                                                                                                                                                  |
| Short positioning    | Existing scanners can identify AI components. This project assembles those findings with declarations, assessments and deployment observations to record what defined a specific AI system release, what evidence supports it, what remains unknown and what must be reviewed when it changes. |
| Accuracy boundary    | The generated record describes observed and declared composition. It does not certify safety, compliance, fairness, legality or model quality.                                                                                                                                                 |

## Sources reviewed

| Source                                                                                                                                    | Relevance                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [The AI Bill of Materials Is an Operational Record](https://jasondoyle.ie/whitepapers/the-ai-bill-of-materials-is-an-operational-record/) | Defines the proposed operational model, evidence classes, temporal separation and practical questions.                           |
| [AIROM](https://github.com/airomhq/airom)                                                                                                 | Existing evidence-first scanner with broad discovery, multiple output formats, risk detection, CI integration and semantic diff. |
| [OWASP AIBOM Generator](https://genai.owasp.org/resource/owasp-aibom-generator/)                                                          | Existing Hugging Face-focused generator with CycloneDX output, visualisation and completeness scoring.                           |
| [CycloneDX AI/ML-BOM](https://cyclonedx.org/capabilities/mlbom/)                                                                          | Existing BOM capability for models, datasets, configurations, provenance and AI/ML risk information.                             |
| [SPDX AI](https://spdx.dev/learn/areas-of-interest/ai/)                                                                                   | Existing graph-based AI profiles covering software, models, data, prompts and agents.                                            |
| [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)                                | Provides signed build provenance and integrity guarantees while explicitly not guaranteeing artifact security.                   |
