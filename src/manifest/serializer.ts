import * as crypto from 'node:crypto';
import type { CapabilityManifest } from './types.js';

export function canonicalizeJson(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(canonicalizeJson);
  }

  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: Record<string, any> = {};

  for (const key of sortedKeys) {
    sortedObj[key] = canonicalizeJson(obj[key]);
  }

  return sortedObj;
}

export function serializeCanonicalManifest(manifest: CapabilityManifest): string {
  // Sort operations by ID
  const clone = JSON.parse(JSON.stringify(manifest)) as CapabilityManifest;
  if (clone.operations) {
    clone.operations.sort((a, b) => a.id.localeCompare(b.id));
  }
  if (clone.unresolved) {
    clone.unresolved.sort((a, b) => a.id.localeCompare(b.id));
  }

  const canonicalObj = canonicalizeJson(clone);
  return JSON.stringify(canonicalObj, null, 2);
}

export function computeManifestDigest(manifest: CapabilityManifest): string {
  const serialized = serializeCanonicalManifest(manifest);
  const hash = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
  return `sha256:${hash}`;
}
