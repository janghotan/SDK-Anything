import type { EvidenceInventory } from "../analyzer/types.js";
import type { AiOperationProposal } from "./types.js";

export interface ValidationProposalsResult {
  valid: boolean;
  proposals: AiOperationProposal[];
  errors: string[];
}

export function validateAiProposals(
  evidence: EvidenceInventory,
  rawJson: unknown,
): ValidationProposalsResult {
  const errors: string[] = [];

  if (!rawJson || typeof rawJson !== "object") {
    return {
      valid: false,
      proposals: [],
      errors: ["AI response must be a JSON object"],
    };
  }

  const rawObj = rawJson as Record<string, unknown>;
  if (!Array.isArray(rawObj.proposals)) {
    return {
      valid: false,
      proposals: [],
      errors: ['AI response must contain a "proposals" array'],
    };
  }

  const knownIds = new Set<string>();
  for (const fn of evidence.functions) {
    knownIds.add(fn.id);
    knownIds.add(fn.name);
  }
  for (const cls of evidence.classes) {
    for (const m of cls.methods) {
      knownIds.add(m.id);
      knownIds.add(m.name);
      knownIds.add(`${cls.name}.${m.name}`);
    }
  }
  for (const fact of evidence.factories) {
    knownIds.add(fact.id);
    knownIds.add(fact.name);
  }

  const validatedProposals: AiOperationProposal[] = [];

  for (let i = 0; i < rawObj.proposals.length; i++) {
    const item = rawObj.proposals[i];
    if (!item || typeof item !== "object") {
      errors.push(`Proposal at index ${i} is not an object`);
      continue;
    }

    const opId = String(
      (item as Record<string, unknown>).operationId || "",
    ).trim();
    if (!opId) {
      errors.push(`Proposal at index ${i} missing required operationId`);
      continue;
    }

    if (!knownIds.has(opId)) {
      errors.push(
        `AI proposed operationId '${opId}' which does not exist in discovered SDK evidence`,
      );
      continue;
    }

    const summary =
      typeof (item as any).summary === "string"
        ? (item as any).summary.trim()
        : undefined;
    const description =
      typeof (item as any).description === "string"
        ? (item as any).description.trim()
        : undefined;
    const group =
      typeof (item as any).group === "string"
        ? (item as any).group.trim()
        : undefined;

    validatedProposals.push({
      operationId: opId,
      summary,
      description,
      group,
      examples: Array.isArray((item as any).examples)
        ? (item as any).examples
        : undefined,
    });
  }

  return {
    valid: errors.length === 0,
    proposals: errors.length === 0 ? validatedProposals : [],
    errors,
  };
}
