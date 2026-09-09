import { AibomError } from "./errors";
import { compareStrings } from "./json";
import type {
  AibomDocument,
  Component,
  ImpactPath,
  ImpactResult,
  Relationship,
  SystemDefinition
} from "./types";

type GraphNode = Component | (SystemDefinition & { type: "ai-system" });

function findMatches(document: AibomDocument, query: string): GraphNode[] {
  const nodes: GraphNode[] = [
    {
      ...document.system,
      type: "ai-system"
    },
    ...document.components
  ];
  const normalisedQuery = query.toLowerCase();
  const exactId = nodes.filter((node) => node.id === query);
  if (exactId.length > 0) {
    return exactId;
  }

  const exactName = nodes.filter(
    (node) => node.name.toLowerCase() === normalisedQuery
  );
  if (exactName.length > 0) {
    return exactName;
  }

  return nodes.filter(
    (node) =>
      node.id.toLowerCase().includes(normalisedQuery) ||
      node.name.toLowerCase().includes(normalisedQuery)
  );
}

interface QueueEntry {
  node: string;
  relationships: string[];
}

export function queryImpact(
  document: AibomDocument,
  query: string
): ImpactResult {
  const matches = findMatches(document, query);
  if (matches.length === 0) {
    throw new AibomError(
      "impact.not-found",
      `No component or system matched ${query}`
    );
  }

  const incoming = new Map<string, Relationship[]>();
  for (const relationship of document.relationships) {
    const relationships = incoming.get(relationship.to) ?? [];
    relationships.push(relationship);
    incoming.set(relationship.to, relationships);
  }

  const paths: ImpactPath[] = [];
  const affected = new Set<string>();
  for (const match of matches) {
    const visited = new Set([match.id]);
    const queue: QueueEntry[] = [
      {
        node: match.id,
        relationships: []
      }
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) {
        break;
      }

      for (const relationship of incoming.get(current.node) ?? []) {
        if (visited.has(relationship.from)) {
          continue;
        }

        visited.add(relationship.from);
        affected.add(relationship.from);
        const relationshipPath = [...current.relationships, relationship.id];
        paths.push({
          target: match.id,
          dependent: relationship.from,
          relationships: relationshipPath
        });
        queue.push({
          node: relationship.from,
          relationships: relationshipPath
        });
      }
    }
  }

  return {
    query,
    matched: matches.map((match) => match.id).sort(),
    affected: [...affected].sort(),
    paths: paths.sort((left, right) =>
      compareStrings(
        `${left.target}|${left.dependent}`,
        `${right.target}|${right.dependent}`
      )
    ),
    context: document.context
  };
}
