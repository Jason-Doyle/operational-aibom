export const SCHEMA_VERSION = "0.1.0";
export const TOOL_NAME = "operational-aibom";
export const TOOL_VERSION = "0.1.1";

export const COMPONENT_TYPES = [
  "ai-system",
  "hosted-model",
  "local-model",
  "embedding-model",
  "dataset",
  "evaluation-dataset",
  "prompt",
  "retrieval-index",
  "vector-database",
  "agent",
  "tool",
  "policy",
  "framework",
  "software-library",
  "hosted-service",
  "infrastructure",
  "other"
] as const;

export const EVIDENCE_CLASSES = [
  "component-fact",
  "supplier-declaration",
  "organisational-assessment",
  "deployment-observation",
  "runtime-observation",
  "explicit-unknown"
] as const;

export const SENSITIVITIES = ["public", "internal", "restricted"] as const;

export const DEFAULT_DISCOVERY_EXCLUDES = [
  "**/.git/**",
  "**/.next/**",
  "**/.ssh/**",
  "**/.turbo/**",
  "**/.venv/**",
  "**/.wrangler/**",
  "**/.aws/**",
  "**/.azure/**",
  "**/.config/gcloud/**",
  "**/build/**",
  "**/coverage/**",
  "**/dist/**",
  "**/node_modules/**",
  "**/out/**",
  "**/target/**",
  "**/venv/**",
  "**/aibom.json",
  "**/aibom.*.json",
  "**/aibom.yaml",
  "**/aibom.yml",
  "**/.env",
  "**/.env.*",
  "**/*credential*",
  "**/*credentials*",
  "**/*private-key*",
  "**/*service-account*",
  "**/*service_account*",
  "**/*secret*",
  "**/*-key.json",
  "**/*_key.json",
  "**/id_ed25519*",
  "**/id_rsa*",
  "**/*.jks",
  "**/*.key",
  "**/*.p12",
  "**/*.p8",
  "**/*.pem",
  "**/*.pfx",
  "**/*.keystore"
];

export const DEFAULT_SOURCE_FILE_BYTES = 1_000_000;
export const DEFAULT_HASH_BYTES = 50_000_000;
