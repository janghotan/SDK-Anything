import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import type {
  EvidenceInventory,
  DiscoveredFunction,
  DiscoveredClass,
  DiscoveredMethod,
  DiscoveredFactory,
  DiscoveredParameter,
  UnresolvedSymbol,
  SourceLocation,
  JSONSchemaObject,
  JSONSchemaProperty,
} from "./types.js";
import { lowerTypeToJsonSchema } from "./type-lowering.js";

export interface ScanOptions {
  sourceKind: string;
  sourceIdentifier: string;
  sourcePackageName?: string;
  sourceVersion: string;
  sourceRevision?: string;
  sourceDigest: string;
  sourcePath: string;
}

export function scanSource(options: ScanOptions): EvidenceInventory {
  const rootDir = options.sourcePath;
  const entryPointFile = findEntryPoint(rootDir);

  if (!fs.existsSync(entryPointFile)) {
    throw new Error(
      `Entry point file not found in ${rootDir}. Could not locate main, types, or default entry files.`,
    );
  }

  // Configure TypeScript program
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    allowJs: true,
    checkJs: true,
    noEmit: true,
    skipLibCheck: true,
  };

  const program = ts.createProgram([entryPointFile], compilerOptions);
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(entryPointFile);

  const discoveredFunctions: DiscoveredFunction[] = [];
  const discoveredClasses: DiscoveredClass[] = [];
  const discoveredFactories: DiscoveredFactory[] = [];
  const unresolvedSymbols: UnresolvedSymbol[] = [];

  if (sourceFile) {
    const fileSymbol = checker.getSymbolAtLocation(sourceFile);
    const exports = fileSymbol ? checker.getExportsOfModule(fileSymbol) : [];

    for (const exp of exports) {
      const name = exp.getName();
      if (name.startsWith("_")) continue;

      let targetSymbol = exp;
      if (exp.flags & ts.SymbolFlags.Alias) {
        targetSymbol = checker.getAliasedSymbol(exp);
      }

      const declarations =
        targetSymbol.getDeclarations() ?? exp.getDeclarations() ?? [];
      const decl = declarations[0];
      const sourceLocation: SourceLocation = decl
        ? {
            filePath: path
              .relative(rootDir, decl.getSourceFile().fileName)
              .replace(/\\/g, "/"),
            line:
              decl
                .getSourceFile()
                .getLineAndCharacterOfPosition(decl.getStart()).line + 1,
            character:
              decl
                .getSourceFile()
                .getLineAndCharacterOfPosition(decl.getStart()).character + 1,
          }
        : {
            filePath: path
              .relative(rootDir, entryPointFile)
              .replace(/\\/g, "/"),
            line: 1,
            character: 1,
          };

      const doc = ts.displayPartsToString(exp.getDocumentationComment(checker));

      // If it's purely an interface or type alias, skip (it's a type definition, not an operation)
      if (
        (targetSymbol.flags &
          (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)) !==
          0 &&
        (targetSymbol.flags &
          (ts.SymbolFlags.Function |
            ts.SymbolFlags.Method |
            ts.SymbolFlags.Value)) ===
          0
      ) {
        continue;
      }

      // 1. Is it a class?
      if (
        targetSymbol.flags & ts.SymbolFlags.Class ||
        (decl && ts.isClassDeclaration(decl))
      ) {
        const classType = checker.getDeclaredTypeOfSymbol(targetSymbol);
        const constructorType = checker.getTypeOfSymbol(targetSymbol);
        const constructSignatures = constructorType.getConstructSignatures();

        const constructorParams: DiscoveredParameter[] = [];
        if (constructSignatures.length > 0) {
          const sig = constructSignatures[0];
          for (const param of sig.parameters) {
            const pType = checker.getTypeOfSymbol(param);
            const pName = param.getName();
            const pRes = lowerTypeToJsonSchema(pType, checker);
            const pIsOpt = isParamOptional(param, checker);
            constructorParams.push({
              name: pName,
              typeText: checker.typeToString(pType),
              required: !pIsOpt,
              schema: pRes.schema,
              description: ts.displayPartsToString(
                param.getDocumentationComment(checker),
              ),
            });
          }
        }

        const methods: DiscoveredMethod[] = [];
        const classProperties = classType.getProperties();

        for (const prop of classProperties) {
          const propName = prop.getName();
          if (propName.startsWith("_") || propName === "constructor") continue;

          const propType = checker.getTypeOfSymbol(prop);
          const callSigs = propType.getCallSignatures();

          if (callSigs.length > 0) {
            const sig = callSigs[0];
            const methodParams: DiscoveredParameter[] = [];
            const inputProps: Record<string, JSONSchemaProperty> = {};
            const requiredProps: string[] = [];
            let methodUnresolved = false;

            for (const param of sig.parameters) {
              const pType = checker.getTypeOfSymbol(param);
              const pName = param.getName();
              const pIsOpt = isParamOptional(param, checker);
              const pRes = lowerTypeToJsonSchema(pType, checker);

              if (pRes.unresolvedReason) {
                methodUnresolved = true;
                unresolvedSymbols.push({
                  symbolName: `${name}.${propName}`,
                  sourceLocation,
                  reason: `Method parameter '${pName}': ${pRes.unresolvedReason}`,
                  suggestedAction:
                    "Provide reviewed schema in sdk-anything.overrides.json",
                  code: pRes.code ?? "UNSUPPORTED_TYPE_CATEGORY",
                  severity: "warning",
                  canContinueGeneration: true,
                });
                break;
              }

              methodParams.push({
                name: pName,
                typeText: checker.typeToString(pType),
                required: !pIsOpt,
                schema: pRes.schema,
                description: ts.displayPartsToString(
                  param.getDocumentationComment(checker),
                ),
              });

              if (pRes.schema) {
                inputProps[pName] = pRes.schema;
              }
              if (!pIsOpt) {
                requiredProps.push(pName);
              }
            }

            if (!methodUnresolved) {
              const returnType = sig.getReturnType();
              const returnTypeText = checker.typeToString(returnType);
              const isAsync = returnTypeText.startsWith("Promise<");

              methods.push({
                id: `${name.toLowerCase()}.${propName}`,
                name: propName,
                receiver: name,
                isAsync,
                description: ts.displayPartsToString(
                  prop.getDocumentationComment(checker),
                ),
                parameters: methodParams,
                returnType: {
                  typeText: returnTypeText,
                  isAsync,
                },
                inputSchema: {
                  type: "object",
                  properties: inputProps,
                  required:
                    requiredProps.length > 0 ? requiredProps.sort() : undefined,
                  additionalProperties: false,
                },
                sourceLocation,
                confidence: "high",
                overloadsCount: callSigs.length,
              });
            }
          }
        }

        discoveredClasses.push({
          id: name,
          name,
          exportName: name,
          modulePath: sourceLocation.filePath,
          description: doc,
          constructorParameters: constructorParams,
          methods: methods.sort((a, b) => a.name.localeCompare(b.name)),
          sourceLocation,
        });

        continue;
      }

      // 2. Is it a function or factory?
      const symbolType = checker.getTypeOfSymbol(exp);
      const callSignatures = symbolType.getCallSignatures();

      if (callSignatures.length > 0) {
        const sig = callSignatures[0];
        const returnType = sig.getReturnType();
        const returnTypeText = checker.typeToString(returnType);

        // Check if it's a factory function creating a client
        const matchedClass = discoveredClasses.find(
          (c) => c.name === returnTypeText || returnTypeText.includes(c.name),
        );
        if (
          matchedClass ||
          (name.startsWith("create") &&
            (name.includes("Client") ||
              name.includes("Sdk") ||
              name.includes("Instance")))
        ) {
          const clientName =
            matchedClass?.name ?? returnTypeText.replace(/Promise<|>/g, "");
          const factoryParams: DiscoveredParameter[] = [];
          for (const param of sig.parameters) {
            const pType = checker.getTypeOfSymbol(param);
            const pName = param.getName();
            const pRes = lowerTypeToJsonSchema(pType, checker);
            const pIsOpt = isParamOptional(param, checker);
            factoryParams.push({
              name: pName,
              typeText: checker.typeToString(pType),
              required: !pIsOpt,
              schema: pRes.schema,
              description: ts.displayPartsToString(
                param.getDocumentationComment(checker),
              ),
            });
          }

          // A factory commonly returns an object/interface rather than a
          // named class. Inspect that returned type so its methods become
          // first-class operations instead of disappearing.
          const awaitedReturn =
            (checker as any).getAwaitedType?.(returnType) ?? returnType;
          const factoryMethods = matchedClass
            ? matchedClass.methods
            : discoverMethodsFromType(
                awaitedReturn,
                name,
                sourceLocation,
                checker,
                unresolvedSymbols,
              );

          discoveredFactories.push({
            id: name,
            name,
            exportName: name,
            modulePath: sourceLocation.filePath,
            description: doc,
            parameters: factoryParams,
            returnsClient: clientName,
            methods: factoryMethods,
            sourceLocation,
          });
          continue;
        }

        // Top-level standalone function
        const fnParams: DiscoveredParameter[] = [];
        const inputProps: Record<string, JSONSchemaProperty> = {};
        const requiredProps: string[] = [];
        let fnUnresolved = false;

        for (const param of sig.parameters) {
          const pType = checker.getTypeOfSymbol(param);
          const pName = param.getName();
          const pIsOpt = isParamOptional(param, checker);
          const pRes = lowerTypeToJsonSchema(pType, checker);

          if (pRes.unresolvedReason) {
            fnUnresolved = true;
            unresolvedSymbols.push({
              symbolName: name,
              sourceLocation,
              reason: `Parameter '${pName}': ${pRes.unresolvedReason}`,
              suggestedAction:
                "Provide reviewed schema in sdk-anything.overrides.json",
              code: pRes.code ?? "UNSUPPORTED_TYPE_CATEGORY",
              severity: "warning",
              canContinueGeneration: true,
            });
            break;
          }

          fnParams.push({
            name: pName,
            typeText: checker.typeToString(pType),
            required: !pIsOpt,
            schema: pRes.schema,
            description: ts.displayPartsToString(
              param.getDocumentationComment(checker),
            ),
          });

          if (pRes.schema) {
            inputProps[pName] = pRes.schema;
          }
          if (!pIsOpt) {
            requiredProps.push(pName);
          }
        }

        if (!fnUnresolved) {
          const isAsync = returnTypeText.startsWith("Promise<");
          const inputSchema: JSONSchemaObject = {
            type: "object",
            properties: inputProps,
            required:
              requiredProps.length > 0 ? requiredProps.sort() : undefined,
            additionalProperties: false,
          };

          discoveredFunctions.push({
            id: name,
            name,
            exportName: name,
            modulePath: sourceLocation.filePath,
            isAsync,
            description: doc,
            parameters: fnParams,
            returnType: {
              typeText: returnTypeText,
              isAsync,
            },
            inputSchema,
            sourceLocation,
            confidence: "high",
            overloadsCount: callSignatures.length,
          });
        }
      } else if (!discoveredClasses.some((c) => c.name === name)) {
        unresolvedSymbols.push({
          symbolName: name,
          sourceLocation,
          reason:
            "Exported symbol could not be resolved to a local callable signature",
          suggestedAction:
            "Provide reviewed schema in sdk-anything.overrides.json",
          code: "UNRESOLVED_CALLABLE_SIGNATURE",
          severity: "warning",
          canContinueGeneration: true,
        });
      }
    }
  }

  // Look for README
  const docSummary = findDocumentationSummary(rootDir);

  return {
    source: {
      kind: options.sourceKind,
      identifier: options.sourceIdentifier,
      packageName: options.sourcePackageName,
      version: options.sourceVersion,
      revision: options.sourceRevision,
      digest: options.sourceDigest,
    },
    entryPoint: path.relative(rootDir, entryPointFile).replace(/\\/g, "/"),
    functions: discoveredFunctions.sort((a, b) => a.id.localeCompare(b.id)),
    classes: discoveredClasses.sort((a, b) => a.id.localeCompare(b.id)),
    factories: discoveredFactories.sort((a, b) => a.id.localeCompare(b.id)),
    unresolved: unresolvedSymbols.sort((a, b) =>
      a.symbolName.localeCompare(b.symbolName),
    ),
    documentation: docSummary,
  };
}

function discoverMethodsFromType(
  type: ts.Type,
  receiverName: string,
  sourceLocation: SourceLocation,
  checker: ts.TypeChecker,
  unresolvedSymbols: UnresolvedSymbol[],
): DiscoveredMethod[] {
  const methods: DiscoveredMethod[] = [];

  for (const prop of type.getProperties()) {
    const propName = prop.getName();
    if (propName.startsWith("_") || propName === "constructor") continue;

    const propType = checker.getTypeOfSymbol(prop);
    const callSigs = propType.getCallSignatures();
    if (callSigs.length === 0) continue;

    const sig = callSigs[0];
    const methodParams: DiscoveredParameter[] = [];
    const inputProps: Record<string, JSONSchemaProperty> = {};
    const requiredProps: string[] = [];
    let methodUnresolved = false;

    for (const param of sig.parameters) {
      const pType = checker.getTypeOfSymbol(param);
      const pName = param.getName();
      const pIsOpt = isParamOptional(param, checker);
      const pRes = lowerTypeToJsonSchema(pType, checker);

      if (pRes.unresolvedReason) {
        methodUnresolved = true;
        unresolvedSymbols.push({
          symbolName: `${receiverName}.${propName}`,
          sourceLocation,
          reason: `Method parameter '${pName}': ${pRes.unresolvedReason}`,
          suggestedAction:
            "Provide reviewed schema in sdk-anything.overrides.json",
          code: pRes.code ?? "UNSUPPORTED_TYPE_CATEGORY",
          severity: "warning",
          canContinueGeneration: true,
        });
        break;
      }

      methodParams.push({
        name: pName,
        typeText: checker.typeToString(pType),
        required: !pIsOpt,
        schema: pRes.schema,
        description: ts.displayPartsToString(
          param.getDocumentationComment(checker),
        ),
      });
      if (pRes.schema) inputProps[pName] = pRes.schema;
      if (!pIsOpt) requiredProps.push(pName);
    }

    if (methodUnresolved) continue;

    const returnType = sig.getReturnType();
    const returnTypeText = checker.typeToString(returnType);
    const isAsync = returnTypeText.startsWith("Promise<");

    methods.push({
      id: `${receiverName.toLowerCase()}.${propName}`,
      name: propName,
      receiver: receiverName,
      isAsync,
      description: ts.displayPartsToString(
        prop.getDocumentationComment(checker),
      ),
      parameters: methodParams,
      returnType: { typeText: returnTypeText, isAsync },
      inputSchema: {
        type: "object",
        properties: inputProps,
        required: requiredProps.length > 0 ? requiredProps.sort() : undefined,
        additionalProperties: false,
      },
      sourceLocation,
      confidence: "high",
      overloadsCount: callSigs.length,
    });
  }

  return methods.sort((a, b) => a.name.localeCompare(b.name));
}

function isParamOptional(param: ts.Symbol, checker: ts.TypeChecker): boolean {
  if ((param.flags & ts.SymbolFlags.Optional) !== 0) {
    return true;
  }
  const decl = param.valueDeclaration ?? param.getDeclarations()?.[0];
  if (decl && ts.isParameter(decl)) {
    if (decl.questionToken != null || decl.initializer != null) {
      return true;
    }
  }
  const pType = checker.getTypeOfSymbol(param);
  if (
    pType.isUnion() &&
    pType.types.some((t) => (t.flags & ts.TypeFlags.Undefined) !== 0)
  ) {
    return true;
  }
  return false;
}

function findEntryPoint(rootDir: string): string {
  const pkgJsonPath = path.join(rootDir, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));

      // Check types / typings
      if (pkg.types && fs.existsSync(path.join(rootDir, pkg.types))) {
        return path.resolve(rootDir, pkg.types);
      }
      if (pkg.typings && fs.existsSync(path.join(rootDir, pkg.typings))) {
        return path.resolve(rootDir, pkg.typings);
      }

      // Check exports
      if (pkg.exports) {
        if (
          typeof pkg.exports === "string" &&
          fs.existsSync(path.join(rootDir, pkg.exports))
        ) {
          return path.resolve(rootDir, pkg.exports);
        }
        if (pkg.exports["."]) {
          const dot = pkg.exports["."];
          if (
            typeof dot === "string" &&
            fs.existsSync(path.join(rootDir, dot))
          ) {
            return path.resolve(rootDir, dot);
          }
          if (dot.types && fs.existsSync(path.join(rootDir, dot.types))) {
            return path.resolve(rootDir, dot.types);
          }
          if (dot.import && fs.existsSync(path.join(rootDir, dot.import))) {
            return path.resolve(rootDir, dot.import);
          }
        }
      }

      // Check main
      if (pkg.main && fs.existsSync(path.join(rootDir, pkg.main))) {
        return path.resolve(rootDir, pkg.main);
      }
    } catch {
      // Ignore package.json read error and fall through
    }
  }

  // Common fallbacks
  const fallbacks = [
    "index.ts",
    "src/index.ts",
    "index.d.ts",
    "dist/index.d.ts",
    "index.js",
    "src/index.js",
  ];

  for (const candidate of fallbacks) {
    const full = path.join(rootDir, candidate);
    if (fs.existsSync(full)) {
      return path.resolve(full);
    }
  }

  // If no entry found, search for any .ts or .js file in root or src
  const files = fs.readdirSync(rootDir);
  const tsFile = files.find((f) => f.endsWith(".ts") || f.endsWith(".js"));
  if (tsFile) {
    return path.resolve(rootDir, tsFile);
  }

  return path.resolve(rootDir, "index.ts");
}

function findDocumentationSummary(rootDir: string) {
  let readmePath: string | undefined;
  let readmeSnippet: string | undefined;

  for (const name of ["README.md", "readme.md", "README", "readme"]) {
    const p = path.join(rootDir, name);
    if (fs.existsSync(p)) {
      readmePath = path.relative(rootDir, p).replace(/\\/g, "/");
      const content = fs.readFileSync(p, "utf8");
      readmeSnippet = content.slice(0, 1000);
      break;
    }
  }

  return {
    hasReadme: !!readmePath,
    readmePath,
    readmeSnippet,
    discoveredExamples: [],
  };
}
