import type { EvidenceInventory } from '../analyzer/types.js';
import type { DisclosureNotice } from './types.js';

export function checkAndRecordDisclosure(evidence: EvidenceInventory): DisclosureNotice {
  const symbols = [
    ...evidence.functions.map(f => f.name),
    ...evidence.classes.flatMap(c => c.methods.map(m => `${c.name}.${m.name}`)),
  ];

  const snippets = symbols.slice(0, 50);

  const notice = [
    `=== AI Assistance Privacy Disclosure ===`,
    `Before sending data to the configured AI model endpoint:`,
    `- Target SDK: ${evidence.source.identifier}@${evidence.source.version}`,
    `- Transmitted Data: Minimal source summary including function/method names (${snippets.join(', ')}), signature summaries, and documentation excerpts.`,
    `- Protected Data: Full source files, private repositories, environment variables, credentials, and local file paths are NEVER transmitted.`,
    `========================================`,
  ].join('\n');

  return {
    disclosed: true,
    notice,
    snippets,
  };
}
