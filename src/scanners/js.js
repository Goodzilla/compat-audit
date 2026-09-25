import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

/**
 * JS AST Scanner targeting modern ES syntax and Web APIs in production bundles
 */
export class JsScanner {
  constructor(compatDb) {
    this.compatDb = compatDb;
  }

  scan(code, filename = 'chunk.js') {
    const findings = new Map();

    const normalizedFile = (filename || 'chunk.js').replaceAll('\\', '/');
    const isVendor = /vendor|node_modules|chunks?\/vendor/i.test(normalizedFile);
    const origin = isVendor ? 'vendor' : 'app';

    const addFinding = (featureKey, name, type) => {
      if (findings.has(featureKey)) return;
      const bcdPath = featureKey.startsWith('javascript.') || featureKey.startsWith('api.')
        ? featureKey.replace(/^(javascript|api)\./, '')
        : featureKey;
      const category = featureKey.startsWith('api.') ? 'api' : 'javascript';
      const compat = this.compatDb.lookup(category, bcdPath);
      if (compat) {
        const support = this.compatDb.getSupportMatrix(compat);
        findings.set(featureKey, {
          featureKey,
          name,
          category: type,
          origin,
          support,
          file: filename,
          description: compat.description || name
        });
      }
    };

    let ast;
    const parseOpts = {
      ecmaVersion: 'latest',
      locations: false,
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true
    };
    try {
      ast = acorn.parse(code, {
        ...parseOpts,
        sourceType: 'module'
      });
    } catch {
      // If parsing as module fails, try as script
      try {
        ast = acorn.parse(code, {
          ...parseOpts,
          sourceType: 'script'
        });
      } catch (err) {
        // Syntax error in minified code (e.g. invalid snippet)
        return [];
      }
    }

    walk.simple(ast, {
      // 1. Syntax features
      ChainExpression() {
        addFinding('javascript.operators.optional_chaining', 'Optional chaining (?.)', 'syntax');
      },
      LogicalExpression(node) {
        if (node.operator === '??') {
          addFinding('javascript.operators.nullish_coalescing', 'Nullish coalescing (??)', 'syntax');
        }
      },
      AssignmentExpression(node) {
        if (node.operator === '??=') {
          addFinding('javascript.operators.nullish_coalescing_assignment', 'Nullish coalescing assignment (??=)', 'syntax');
        } else if (node.operator === '||=') {
          addFinding('javascript.operators.logical_or_assignment', 'Logical OR assignment (||=)', 'syntax');
        } else if (node.operator === '&&=') {
          addFinding('javascript.operators.logical_and_assignment', 'Logical AND assignment (&&=)', 'syntax');
        }
      },
      PrivateIdentifier() {
        addFinding('javascript.classes.private_class_fields', 'Private class fields (#field)', 'syntax');
      },
      StaticBlock() {
        addFinding('javascript.classes.static_initialization_blocks', 'Static initialization blocks', 'syntax');
      },
      BigIntLiteral() {
        addFinding('javascript.builtins.BigInt', 'BigInt literals (123n)', 'syntax');
      },
      ImportExpression() {
        addFinding('javascript.operators.import', 'Dynamic import()', 'syntax');
      },

      // 2. Global Web APIs and Builtins
      Identifier(node) {
        const name = node.name;
        switch (name) {
          case 'structuredClone':
            addFinding('api.structuredClone', 'structuredClone()', 'api');
            break;
          case 'queueMicrotask':
            addFinding('api.queueMicrotask', 'queueMicrotask()', 'api');
            break;
          case 'ResizeObserver':
            addFinding('api.ResizeObserver', 'ResizeObserver', 'api');
            break;
          case 'IntersectionObserver':
            addFinding('api.IntersectionObserver', 'IntersectionObserver', 'api');
            break;
          case 'AbortController':
            addFinding('api.AbortController', 'AbortController', 'api');
            break;
          case 'BroadcastChannel':
            addFinding('api.BroadcastChannel', 'BroadcastChannel', 'api');
            break;
          case 'CompressionStream':
            addFinding('api.CompressionStream', 'CompressionStream', 'api');
            break;
          case 'SubtleCrypto':
            addFinding('api.SubtleCrypto', 'SubtleCrypto (Web Crypto)', 'api');
            break;
        }
      },

      // 3. Member expressions (e.g. Object.hasOwn, crypto.randomUUID, Array.prototype.at)
      MemberExpression(node) {
        const prop = node.property?.name;

        // Object / Map / Promise / Array static methods
        if (node.object?.name === 'Object') {
          if (prop === 'hasOwn') {
            addFinding('javascript.builtins.Object.hasOwn', 'Object.hasOwn()', 'builtin');
          } else if (prop === 'groupBy') {
            addFinding('javascript.builtins.Object.groupBy', 'Object.groupBy()', 'builtin');
          }
        } else if (node.object?.name === 'Map' && prop === 'groupBy') {
          addFinding('javascript.builtins.Map.groupBy', 'Map.groupBy()', 'builtin');
        } else if (node.object?.name === 'Promise') {
          if (prop === 'allSettled') {
            addFinding('javascript.builtins.Promise.allSettled', 'Promise.allSettled()', 'builtin');
          } else if (prop === 'any') {
            addFinding('javascript.builtins.Promise.any', 'Promise.any()', 'builtin');
          } else if (prop === 'withResolvers') {
            addFinding('javascript.builtins.Promise.withResolvers', 'Promise.withResolvers()', 'builtin');
          }
        } else if (node.object?.name === 'Array' && prop === 'fromAsync') {
          addFinding('javascript.builtins.Array.fromAsync', 'Array.fromAsync()', 'builtin');
        }

        // crypto.randomUUID
        if ((node.object?.name === 'crypto' || node.object?.property?.name === 'crypto') && prop === 'randomUUID') {
          addFinding('api.Crypto.randomUUID', 'crypto.randomUUID()', 'api');
        }

        // Method calls on prototypes
        if (prop === 'at') {
          addFinding('javascript.builtins.Array.at', 'Array/String.prototype.at()', 'prototype');
        } else if (prop === 'replaceAll') {
          addFinding('javascript.builtins.String.replaceAll', 'String.prototype.replaceAll()', 'prototype');
        } else if (prop === 'findLast' || prop === 'findLastIndex') {
          addFinding('javascript.builtins.Array.findLast', 'Array.prototype.findLast()', 'prototype');
        } else if (prop === 'toSorted' || prop === 'toReversed' || prop === 'toSpliced') {
          addFinding('javascript.builtins.Array.toSorted', 'Array change-by-copy methods (toSorted, etc.)', 'prototype');
        } else if (['union', 'intersection', 'difference', 'symmetricDifference', 'isSubsetOf', 'isSupersetOf', 'isDisjointFrom'].includes(prop)) {
          addFinding(`javascript.builtins.Set.${prop}`, `Set.prototype.${prop}()`, 'prototype');
        }
      }
    });

    return Array.from(findings.values());
  }
}
