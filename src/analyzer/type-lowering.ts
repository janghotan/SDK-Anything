import ts from 'typescript';
import type { JSONSchemaProperty } from './types.js';

export interface TypeLoweringResult {
  schema?: JSONSchemaProperty;
  unresolvedReason?: string;
}

export function lowerTypeToJsonSchema(
  type: ts.Type,
  checker: ts.TypeChecker,
  activeTypeIds: Set<number> = new Set(),
  depth = 0
): TypeLoweringResult {
  if (depth > 10) {
    return { unresolvedReason: 'Type hierarchy exceeded maximum supported depth (possible recursion)' };
  }

  // Type ID for recursion detection (ts.Type has an internal id property)
  const typeId = (type as any).id ?? -1;
  if (typeId !== -1 && activeTypeIds.has(typeId)) {
    return { unresolvedReason: 'Circular type reference detected' };
  }

  const nextActive = new Set(activeTypeIds);
  if (typeId !== -1) {
    nextActive.add(typeId);
  }

  const flags = type.getFlags();

  // Any or Unknown
  if (flags & ts.TypeFlags.Any || flags & ts.TypeFlags.Unknown) {
    return { unresolvedReason: 'Unconstrained any or unknown type is unsupported without explicit override' };
  }

  // Primitive: string
  if (flags & ts.TypeFlags.String) {
    return { schema: { type: 'string' } };
  }

  // Primitive: number
  if (flags & ts.TypeFlags.Number) {
    return { schema: { type: 'number' } };
  }

  // Primitive: boolean
  if (flags & ts.TypeFlags.Boolean || flags & ts.TypeFlags.BooleanLiteral) {
    return { schema: { type: 'boolean' } };
  }

  // Primitive: null
  if (flags & ts.TypeFlags.Null) {
    return { schema: { type: 'null' } };
  }

  // String Literal
  if (flags & ts.TypeFlags.StringLiteral) {
    const val = (type as ts.StringLiteralType).value;
    return { schema: { type: 'string', const: val } };
  }

  // Number Literal
  if (flags & ts.TypeFlags.NumberLiteral) {
    const val = (type as ts.NumberLiteralType).value;
    return { schema: { type: 'number', const: val } };
  }

  // Union Type (e.g. 'a' | 'b' | 'c', or string | number)
  if (type.isUnion()) {
    const types = type.types;
    // Check if it's all string literals
    const allStringLiterals = types.every(t => (t.getFlags() & ts.TypeFlags.StringLiteral) !== 0);
    if (allStringLiterals) {
      const enumVals = types.map(t => (t as ts.StringLiteralType).value);
      return { schema: { type: 'string', enum: enumVals } };
    }

    // Check if it's all number literals
    const allNumberLiterals = types.every(t => (t.getFlags() & ts.TypeFlags.NumberLiteral) !== 0);
    if (allNumberLiterals) {
      const enumVals = types.map(t => (t as ts.NumberLiteralType).value);
      return { schema: { type: 'number', enum: enumVals } };
    }

    // Filter out undefined if optional
    const nonUndefinedTypes = types.filter(t => (t.getFlags() & ts.TypeFlags.Undefined) === 0);
    if (nonUndefinedTypes.length === 1) {
      return lowerTypeToJsonSchema(nonUndefinedTypes[0], checker, nextActive, depth + 1);
    }

    // Generalized union -> anyOf
    const subSchemas: JSONSchemaProperty[] = [];
    for (const subType of nonUndefinedTypes) {
      const subRes = lowerTypeToJsonSchema(subType, checker, nextActive, depth + 1);
      if (subRes.unresolvedReason) {
        return { unresolvedReason: `Union branch unresolved: ${subRes.unresolvedReason}` };
      }
      if (subRes.schema) {
        subSchemas.push(subRes.schema);
      }
    }
    return { schema: { anyOf: subSchemas } };
  }

  // Array / Tuple Type
  if (checker.isArrayType(type)) {
    const typeArgs = (type as ts.TypeReference).typeArguments;
    const itemType = typeArgs && typeArgs.length > 0 ? typeArgs[0] : undefined;
    if (!itemType) {
      return { schema: { type: 'array' } };
    }
    const itemRes = lowerTypeToJsonSchema(itemType, checker, nextActive, depth + 1);
    if (itemRes.unresolvedReason) {
      return { unresolvedReason: `Array item type unresolved: ${itemRes.unresolvedReason}` };
    }
    return { schema: { type: 'array', items: itemRes.schema } };
  }

  // Tuple (e.g. [number, number])
  if (checker.isTupleType(type)) {
    const typeArgs = (type as ts.TypeReference).typeArguments;
    if (typeArgs && typeArgs.length > 0) {
      const firstRes = lowerTypeToJsonSchema(typeArgs[0], checker, nextActive, depth + 1);
      return {
        schema: {
          type: 'array',
          items: firstRes.schema ?? { type: 'number' },
        },
      };
    }
    return { schema: { type: 'array' } };
  }

  // Function / Callback -> unsupported for atomic tools
  const callSignatures = type.getCallSignatures();
  if (callSignatures.length > 0) {
    return { unresolvedReason: 'Function/callback parameters are unsupported in atomic tool operations' };
  }

  // Type parameter (free generic T)
  if (flags & ts.TypeFlags.TypeParameter) {
    return { unresolvedReason: 'Unbound generic type parameter is unsupported' };
  }

  // Object Type / Interface / Struct
  if (flags & ts.TypeFlags.Object) {
    const properties = type.getProperties();
    const propsSchema: Record<string, JSONSchemaProperty> = {};
    const required: string[] = [];

    for (const prop of properties) {
      const propName = prop.getName();
      // Ignore private/protected/internal symbols
      if (propName.startsWith('_')) continue;

      const propType = checker.getTypeOfSymbol(prop);

      // Check if property is optional
      const isOptional = (prop.flags & ts.SymbolFlags.Optional) !== 0 ||
        (propType.isUnion() && propType.types.some(t => (t.getFlags() & ts.TypeFlags.Undefined) !== 0));

      const propRes = lowerTypeToJsonSchema(propType, checker, nextActive, depth + 1);
      if (propRes.unresolvedReason) {
        return { unresolvedReason: `Property '${propName}' unresolved: ${propRes.unresolvedReason}` };
      }

      propsSchema[propName] = propRes.schema ?? { type: 'string' };

      // Add description from JSDoc if present
      const doc = ts.displayPartsToString(prop.getDocumentationComment(checker));
      if (doc) {
        propsSchema[propName].description = doc;
      }

      if (!isOptional) {
        required.push(propName);
      }
    }

    return {
      schema: {
        type: 'object',
        properties: propsSchema,
        required: required.length > 0 ? required.sort() : undefined,
        additionalProperties: false,
      },
    };
  }

  return { unresolvedReason: `Unsupported type category: ${checker.typeToString(type)}` };
}
