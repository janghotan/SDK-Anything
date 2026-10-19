import type { SourceSnapshot } from '../source/types.js';
import { resolveSource } from '../source/index.js';
import type { EvidenceInventory } from './types.js';
import { scanSource } from './export-scanner.js';

export * from './types.js';
export * from './type-lowering.js';
export * from './export-scanner.js';

export async function analyzeSourceSnapshot(
  target: SourceSnapshot | string
): Promise<EvidenceInventory> {
  let snapshot: SourceSnapshot;
  if (typeof target === 'string') {
    snapshot = await resolveSource(target);
  } else {
    snapshot = target;
  }

  return scanSource({
    sourceKind: snapshot.kind,
    sourceIdentifier: snapshot.identifier,
    sourcePackageName: snapshot.packageName,
    sourceVersion: snapshot.version,
    sourceRevision: snapshot.revision,
    sourceDigest: snapshot.digest,
    sourcePath: snapshot.snapshotPath,
  });
}
