import type { AibomContext, DeploymentContext } from "./types";

function defined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

function deploymentFromEnvironment(
  environment: NodeJS.ProcessEnv
): DeploymentContext | undefined {
  const deployment = {
    id: defined(environment.AIBOM_DEPLOYMENT_ID),
    environment: defined(environment.AIBOM_ENVIRONMENT),
    region: defined(environment.AIBOM_REGION)
  };

  return Object.values(deployment).some((value) => value !== undefined)
    ? deployment
    : undefined;
}

export function contextFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env
): AibomContext {
  const release =
    environment.GITHUB_REF_TYPE === "tag"
      ? defined(environment.GITHUB_REF_NAME)
      : defined(environment.AIBOM_RELEASE);

  return compactContext({
    repository: defined(environment.GITHUB_REPOSITORY),
    commit: defined(environment.GITHUB_SHA),
    ref: defined(environment.GITHUB_REF),
    eventName: defined(environment.GITHUB_EVENT_NAME),
    workflow: defined(environment.GITHUB_WORKFLOW),
    workflowRunId: defined(environment.GITHUB_RUN_ID),
    buildId: defined(environment.AIBOM_BUILD_ID),
    release,
    deployment: deploymentFromEnvironment(environment)
  });
}

export function mergeContexts(
  ...contexts: Array<AibomContext | undefined>
): AibomContext {
  const merged: AibomContext = {};

  for (const context of contexts) {
    if (context === undefined) {
      continue;
    }

    if (context.repository !== undefined)
      merged.repository = context.repository;
    if (context.commit !== undefined) merged.commit = context.commit;
    if (context.ref !== undefined) merged.ref = context.ref;
    if (context.eventName !== undefined) merged.eventName = context.eventName;
    if (context.workflow !== undefined) merged.workflow = context.workflow;
    if (context.workflowRunId !== undefined) {
      merged.workflowRunId = context.workflowRunId;
    }
    if (context.buildId !== undefined) merged.buildId = context.buildId;
    if (context.release !== undefined) merged.release = context.release;
    if (context.deployment !== undefined) {
      merged.deployment = {
        ...merged.deployment,
        ...(context.deployment.id === undefined
          ? {}
          : { id: context.deployment.id }),
        ...(context.deployment.environment === undefined
          ? {}
          : { environment: context.deployment.environment }),
        ...(context.deployment.region === undefined
          ? {}
          : { region: context.deployment.region })
      };
    }
  }

  return compactContext(merged);
}

function compactContext(context: AibomContext): AibomContext {
  const compact: AibomContext = {};
  if (context.repository !== undefined) compact.repository = context.repository;
  if (context.commit !== undefined) compact.commit = context.commit;
  if (context.ref !== undefined) compact.ref = context.ref;
  if (context.eventName !== undefined) compact.eventName = context.eventName;
  if (context.workflow !== undefined) compact.workflow = context.workflow;
  if (context.workflowRunId !== undefined) {
    compact.workflowRunId = context.workflowRunId;
  }
  if (context.buildId !== undefined) compact.buildId = context.buildId;
  if (context.release !== undefined) compact.release = context.release;
  if (
    context.deployment !== undefined &&
    (context.deployment.id !== undefined ||
      context.deployment.environment !== undefined ||
      context.deployment.region !== undefined)
  ) {
    compact.deployment = context.deployment;
  }

  return compact;
}
