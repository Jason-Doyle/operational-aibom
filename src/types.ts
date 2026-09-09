import type {
  COMPONENT_TYPES,
  EVIDENCE_CLASSES,
  SENSITIVITIES
} from "./constants";

export type ComponentType = (typeof COMPONENT_TYPES)[number];
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];
export type Sensitivity = (typeof SENSITIVITIES)[number];
export type Origin = "declared" | "discovered" | "merged";

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface HashValue {
  algorithm: "SHA-256";
  value: string;
}

export interface Location {
  path: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface SystemDefinition {
  id: string;
  name: string;
  version?: string;
  description?: string;
  owner?: string;
  intendedUse?: string;
  sensitivity?: Sensitivity;
  properties?: JsonObject;
}

export interface Component {
  id: string;
  type: ComponentType;
  name: string;
  version?: string;
  supplier?: string;
  description?: string;
  origin?: Origin;
  sensitivity?: Sensitivity;
  hashes?: HashValue[];
  locations?: Location[];
  licences?: string[];
  properties?: JsonObject;
  evidence?: string[];
}

export interface Relationship {
  id: string;
  from: string;
  type: string;
  to: string;
  sensitivity?: Sensitivity;
  properties?: JsonObject;
  evidence?: string[];
}

export interface EvidenceSource {
  type:
    "api" | "assessment" | "file" | "manifest" | "uri" | "workflow" | "other";
  uri?: string;
  path?: string;
  lineStart?: number;
  lineEnd?: number;
  digest?: HashValue;
  collector?: string;
}

export interface EvidenceRecord {
  id: string;
  class: EvidenceClass;
  subject: string;
  claim: string;
  issuer?: string;
  owner?: string;
  method?: string;
  observedAt?: string;
  validUntil?: string;
  confidence?: number;
  scope?: string;
  source?: EvidenceSource;
  sensitivity?: Sensitivity;
  properties?: JsonObject;
}

export interface AssessmentRecord {
  id: string;
  subject: string;
  name: string;
  method: string;
  result: "pass" | "fail" | "inconclusive" | "informational";
  observedAt: string;
  validUntil?: string;
  sensitivity?: Sensitivity;
  evidence?: string[];
  properties?: JsonObject;
}

export interface ObservationRecord {
  id: string;
  kind: "deployment" | "runtime";
  subject: string;
  observedAt: string;
  environment?: string;
  sensitivity?: Sensitivity;
  evidence?: string[];
  properties?: JsonObject;
}

export interface UnknownRecord {
  id: string;
  class: "explicit-unknown";
  subject: string;
  field: string;
  reason: string;
  owner?: string;
  consequence?: string;
  compensatingControl?: string;
  reviewAfter?: string;
  sensitivity?: Sensitivity;
  properties?: JsonObject;
}

export interface DiscoveryConfig {
  enabled?: boolean;
  include?: string[];
  exclude?: string[];
  useGitignore?: boolean;
  maxSourceFileBytes?: number;
  maxHashBytes?: number;
  defaultSensitivity?: Sensitivity;
}

export interface PublicationConfig {
  defaultSensitivity?: Sensitivity;
}

export interface DeploymentContext {
  id?: string;
  environment?: string;
  region?: string;
}

export interface AibomContext {
  repository?: string;
  commit?: string;
  ref?: string;
  eventName?: string;
  workflow?: string;
  workflowRunId?: string;
  buildId?: string;
  release?: string;
  deployment?: DeploymentContext;
}

export interface AibomManifest {
  schemaVersion: string;
  system: SystemDefinition;
  context?: AibomContext;
  components?: Component[];
  relationships?: Omit<Relationship, "id">[] | Relationship[];
  evidence?: EvidenceRecord[];
  assessments?: AssessmentRecord[];
  observations?: ObservationRecord[];
  unknowns?: UnknownRecord[];
  discovery?: DiscoveryConfig;
  publication?: PublicationConfig;
}

export interface DocumentSource {
  path?: string;
  digest?: HashValue;
  manifestPresent: boolean;
}

export interface DocumentMetadata {
  id: string;
  generatedAt: string;
  generator: {
    name: string;
    version: string;
  };
  source: DocumentSource;
  contentDigest: HashValue;
}

export interface AibomDocument {
  schemaVersion: string;
  document: DocumentMetadata;
  system: SystemDefinition;
  context: AibomContext;
  components: Component[];
  relationships: Relationship[];
  evidence: EvidenceRecord[];
  assessments: AssessmentRecord[];
  observations: ObservationRecord[];
  unknowns: UnknownRecord[];
}

export interface Diagnostic {
  level: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  diagnostics: Diagnostic[];
}

export interface GenerationOptions {
  root: string;
  manifestPath?: string;
  discovery?: boolean;
  environmentContext?: boolean;
  excludePaths?: string[];
  generatedAt?: string;
  context?: AibomContext;
}

export interface GenerationResult {
  document: AibomDocument;
  diagnostics: Diagnostic[];
}

export interface ChangedRecord<T> {
  id: string;
  before: T;
  after: T;
}

export interface RecordDiff<T> {
  added: T[];
  removed: T[];
  changed: ChangedRecord<T>[];
}

export interface AibomDiff {
  schemaVersion: string;
  baseDocument: string;
  headDocument: string;
  summary: {
    added: number;
    removed: number;
    changed: number;
    newUnknowns: number;
    nonMaterialChanges: number;
    reviewRequired: boolean;
  };
  systemChanged: boolean;
  contextChanged: boolean;
  components: RecordDiff<Component>;
  relationships: RecordDiff<Relationship>;
  evidence: RecordDiff<EvidenceRecord>;
  assessments: RecordDiff<AssessmentRecord>;
  observations: RecordDiff<ObservationRecord>;
  unknowns: RecordDiff<UnknownRecord>;
}

export interface ImpactPath {
  target: string;
  dependent: string;
  relationships: string[];
}

export interface ImpactResult {
  query: string;
  matched: string[];
  affected: string[];
  paths: ImpactPath[];
  context: AibomContext;
}
