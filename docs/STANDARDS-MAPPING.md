# Standards Mapping

The canonical operational AIBOM is the source record. CycloneDX and SPDX outputs are compatibility views. They are not expected to round-trip without information loss.

## Versions

| Format                      | Version | Schema                                                |
| --------------------------- | ------- | ----------------------------------------------------- |
| Canonical operational AIBOM | 0.1.0   | `schemas/aibom.schema.json`                           |
| CycloneDX JSON              | 1.7     | `https://cyclonedx.org/schema/bom-1.7.schema.json`    |
| SPDX JSON-LD                | 3.0.1   | `https://spdx.org/schema/3.0.1/spdx-json-schema.json` |

## Component mapping

| Canonical type                                                      | CycloneDX type                        | SPDX type                   |
| ------------------------------------------------------------------- | ------------------------------------- | --------------------------- |
| AI system                                                           | `application` in `metadata.component` | `ai_AIPackage` root element |
| `hosted-model`                                                      | `machine-learning-model`              | `ai_AIPackage`              |
| `local-model`                                                       | `machine-learning-model`              | `ai_AIPackage`              |
| `embedding-model`                                                   | `machine-learning-model`              | `ai_AIPackage`              |
| `dataset`                                                           | `data`                                | `dataset_DatasetPackage`    |
| `evaluation-dataset`                                                | `data`                                | `dataset_DatasetPackage`    |
| `prompt`                                                            | `file`                                | `software_File`             |
| `policy`                                                            | `file`                                | `software_File`             |
| `retrieval-index`                                                   | `file`                                | `software_File`             |
| `framework`                                                         | `framework`                           | `software_Package`          |
| `software-library`                                                  | `library`                             | `software_Package`          |
| Agent, tool, vector database, hosted service, infrastructure, other | `application`                         | `software_Package`          |

The original canonical type is retained in a CycloneDX property or SPDX comment.

SPDX requires `dataset_datasetType`. The exporter uses a declared `properties.datasetType` value when it is in the SPDX vocabulary and otherwise emits `noAssertion`.

## Field mapping

| Canonical field        | CycloneDX                     | SPDX                                                                                             |
| ---------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Component identifier   | `bom-ref`                     | `spdxId`                                                                                         |
| Name                   | `name`                        | `name`                                                                                           |
| Version                | `version`                     | `software_packageVersion`                                                                        |
| Supplier               | `supplier.name`               | Not currently exported because a valid SPDX Agent relationship requires more identity modelling. |
| SHA-256                | `hashes[].alg/content`        | `verifiedUsing[].algorithm/hashValue`                                                            |
| Licence                | `licenses[].expression`       | Not currently exported.                                                                          |
| Repository locations   | `evidence.occurrences[]`      | Not currently exported.                                                                          |
| Origin and sensitivity | Namespaced properties         | Element comment                                                                                  |
| Intended use           | Namespaced system property    | `ai_informationAboutApplication`                                                                 |
| Document generator     | `metadata.tools.components[]` | SPDX `Tool` and `CreationInfo.createdUsing`                                                      |

## Relationship mapping

| Canonical relationship | SPDX relationship                                | CycloneDX                                        |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------ |
| `contains`             | `contains`                                       | Dependency edge plus exact relationship property |
| `depends-on`           | `dependsOn`                                      | Dependency edge plus exact relationship property |
| `uses-model`           | `dependsOn`                                      | Dependency edge plus exact relationship property |
| `trained-on`           | `trainedOn`                                      | Dependency edge plus exact relationship property |
| `fine-tuned-from`      | `descendantOf`                                   | Dependency edge plus exact relationship property |
| `evaluated-with`       | `hasTest`                                        | Dependency edge plus exact relationship property |
| `embeds-with`          | `dependsOn`                                      | Dependency edge plus exact relationship property |
| `retrieves-from`       | `hasInput`                                       | Dependency edge plus exact relationship property |
| `governed-by`          | `configures`                                     | Dependency edge plus exact relationship property |
| `can-invoke`           | `usesTool`                                       | Dependency edge plus exact relationship property |
| `deployed-as`          | `generates`                                      | Dependency edge plus exact relationship property |
| `references`           | `hasMetadata`                                    | Dependency edge plus exact relationship property |
| Unrecognised value     | `other` with the original value in `description` | Dependency edge plus exact relationship property |

CycloneDX dependency edges do not carry a relationship type. The exporter therefore also writes one top-level namespaced property per canonical relationship.

## Evidence mapping

| Canonical record                  | CycloneDX 1.7                                | SPDX 3.0.1                                 |
| --------------------------------- | -------------------------------------------- | ------------------------------------------ |
| File occurrences                  | Component `evidence.occurrences`             | Not currently exported.                    |
| Evidence class and claim          | Namespaced top-level property                | Not currently exported.                    |
| Observation and expiry times      | Included in the namespaced evidence property | Not currently exported.                    |
| Explicit unknown                  | Namespaced top-level property                | Not currently exported.                    |
| Assessment                        | No direct mapping in the current exporter.   | No direct mapping in the current exporter. |
| Deployment or runtime observation | No direct mapping in the current exporter.   | No direct mapping in the current exporter. |

CycloneDX 1.7 supports richer declarations, claims and evidence structures. The current mapping uses namespaced properties because they validate consistently across the live schema and the official JavaScript library. This remains deliberately narrow until the canonical evidence classes can be represented without changing their meaning.

SPDX supports extensible graph elements and relationships. The current mapping concentrates on composition and does not invent a false equivalence for organisational evidence.

## Information loss

Both views lose some or all of:

- evidence class semantics;
- ownership and review dates for unknowns;
- assessment method and applicability;
- separation between composition and changing operational evidence;
- deployment and runtime observations;
- field-level sensitivity;
- exact relationship semantics where a standard relationship is unavailable.

Every generated compatibility view includes a loss notice.

## Attestation boundary

CycloneDX or SPDX output can be used as the SBOM predicate for an actual release artifact. The canonical operational record can also be attested as an artifact in its own right.

An attestation establishes:

- the subject digest;
- the workflow and repository provenance exposed by GitHub;
- integrity of the signed statement.

It does not establish:

- truth of supplier declarations;
- correctness of organisational assessments;
- safety or suitability of components;
- complete runtime coverage.
