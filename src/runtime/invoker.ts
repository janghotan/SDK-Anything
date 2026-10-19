import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { CapabilityManifest, OperationDescriptor } from '../manifest/types.js';
import type { InvocationContext, InvocationResult } from './types.js';
import { enforceOperationPolicy } from './policy-enforcer.js';
import { resolveClient } from './client-lifecycle.js';
import { boundResult } from './pagination.js';
import { normalizeError } from './errors.js';

const AjvClass = (Ajv2020 as any).default ?? Ajv2020;
const ajv = new AjvClass({ allErrors: true, strict: false });
const addFormatsFn = (addFormats as any).default ?? addFormats;
addFormatsFn(ajv);

const compiledValidators = new Map<string, any>();

function getInputValidator(op: OperationDescriptor): any {
  if (!compiledValidators.has(op.id)) {
    const validator = ajv.compile(op.inputSchema);
    compiledValidators.set(op.id, validator);
  }
  return compiledValidators.get(op.id);
}

export async function invokeOperation(
  manifest: CapabilityManifest,
  operationId: string,
  input: unknown,
  context: InvocationContext = {}
): Promise<InvocationResult> {
  const startTime = Date.now();
  const knownSecrets: string[] = [];

  try {
    // 1. Locate operation in manifest
    const op = manifest.operations.find(o => o.id === operationId);
    if (!op) {
      return {
        success: false,
        operationId,
        error: {
          code: 'UNSUPPORTED_OPERATION',
          message: `Operation '${operationId}' not found in capability manifest`,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 2. Policy enforcement (pure/read vs write/destructive/unknown)
    await enforceOperationPolicy(op, context);

    // 3. Input validation against manifest schema
    const validator = getInputValidator(op);
    const valid = validator(input ?? {});
    if (!valid && validator.errors) {
      const errorDetails = validator.errors
        .map((e: any) => `${e.instancePath || 'input'}: ${e.message}`)
        .join('; ');
      return {
        success: false,
        operationId,
        error: {
          code: 'INVALID_INPUT',
          message: `Input validation failed for '${operationId}': ${errorDetails}`,
          details: validator.errors,
        },
        executionTimeMs: Date.now() - startTime,
      };
    }

    // 4. Resolve client instance if instance method
    let targetCallable: any;
    let thisArg: any = null;

    if (op.invoke.kind === 'instance-method') {
      const clientRes = resolveClient(manifest.client, context);
      knownSecrets.push(...clientRes.knownSecrets);
      const clientInstance = clientRes.clientInstance;
      if (!clientInstance) {
        throw new Error(`Client instance could not be resolved for '${operationId}'`);
      }
      const methodName = op.invoke.method!;
      if (typeof clientInstance[methodName] !== 'function') {
        throw new Error(`Method '${methodName}' not found on client instance`);
      }
      targetCallable = clientInstance[methodName];
      thisArg = clientInstance;
    } else {
      const sdkModule = context.sdkModule;
      if (!sdkModule) {
        throw new Error(`Target SDK module not provided in invocation context`);
      }
      const fnName = op.invoke.functionName!;
      targetCallable = sdkModule[fnName] ?? (sdkModule.default && sdkModule.default[fnName]);
      if (typeof targetCallable !== 'function') {
        throw new Error(`Function '${fnName}' not found on SDK module`);
      }
    }

    // 5. Invoke with timeout
    const timeoutMs = context.timeoutMs ?? 30000;
    const executionPromise = (async () => {
      if (typeof input === 'object' && input !== null) {
        const propKeys = Object.keys(op.inputSchema.properties || {});
        if (propKeys.length === 1 && propKeys[0] in (input as any)) {
          return targetCallable.call(thisArg, (input as any)[propKeys[0]]);
        }
        if (targetCallable.length > 1 && propKeys.length > 1) {
          const positional = propKeys.map(k => (input as any)[k]);
          return targetCallable.apply(thisArg, positional);
        }
        return targetCallable.call(thisArg, input);
      }
      return targetCallable.call(thisArg);
    })();

    let timeoutHandle: any;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`Operation '${operationId}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const rawResult = await Promise.race([executionPromise, timeoutPromise]).finally(() => {
      clearTimeout(timeoutHandle);
    });

    // 6. Bounding / Pagination
    const bounded = boundResult(rawResult, op.result.pagination, {
      maxItems: context.maxItems,
      maxBytes: context.maxBytes,
    });

    return {
      success: true,
      operationId,
      data: bounded.data,
      truncated: bounded.truncated,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (err: unknown) {
    const norm = normalizeError(err, knownSecrets);
    return {
      success: false,
      operationId,
      error: norm,
      executionTimeMs: Date.now() - startTime,
    };
  }
}
