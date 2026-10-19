import type { ClientDescriptor } from "../manifest/types.js";
import type { InvocationContext } from "./types.js";

export interface ClientResolutionResult {
  clientInstance: any;
  knownSecrets: string[];
}

export function resolveClient(
  clientDesc: ClientDescriptor | undefined,
  context: InvocationContext,
): ClientResolutionResult {
  const knownSecrets: string[] = [];

  if (!clientDesc || clientDesc.construction === "none") {
    return {
      clientInstance: context.sdkInstance ?? context.sdkModule,
      knownSecrets,
    };
  }

  if (context.sdkInstance) {
    return {
      clientInstance: context.sdkInstance,
      knownSecrets,
    };
  }

  const env = context.env ?? process.env;
  const resolvedOptions: Record<string, any> = {};

  for (const [key, opt] of Object.entries(clientDesc.options)) {
    if (opt.source && opt.source.startsWith("env:")) {
      const envVarName = opt.source.slice(4);
      const val = env[envVarName];
      if (!val && opt.required) {
        throw new Error(
          `Authentication required: environment variable '${envVarName}' for client option '${key}' is not set`,
        );
      }
      if (val) {
        resolvedOptions[key] = val;
        if (opt.type === "secret") {
          knownSecrets.push(val);
        }
      }
    } else {
      if (opt.required && resolvedOptions[key] === undefined) {
        throw new Error(
          `Required client configuration option '${key}' is missing`,
        );
      }
    }
  }

  const sdkModule = context.sdkModule;
  if (!sdkModule) {
    throw new Error(`Target SDK module not provided in invocation context`);
  }

  const exportTarget =
    sdkModule[clientDesc.export] ??
    (sdkModule.default && sdkModule.default[clientDesc.export]);
  if (!exportTarget) {
    throw new Error(`Export '${clientDesc.export}' not found on SDK module`);
  }

  let clientInstance: any;
  if (clientDesc.construction === "class") {
    clientInstance = new exportTarget(resolvedOptions);
  } else if (clientDesc.construction === "factory") {
    clientInstance = exportTarget(resolvedOptions);
  } else {
    clientInstance = exportTarget;
  }

  return {
    clientInstance,
    knownSecrets,
  };
}
