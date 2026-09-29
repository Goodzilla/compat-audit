import fs from 'node:fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

/**
 * JS AST Scanner targeting modern ES syntax and Web APIs in production bundles
 * Equipped with lexical scope analysis, feature guard recognition, and polyfill detection
 */
export class JsScanner {
  constructor(compatDb) {
    this.compatDb = compatDb;
  }

  scan(code, filename = 'chunk.js', fullFilePath = null) {
    const compatDb = this.compatDb;
    const findings = new Map();

    const normalizedFile = (filename || 'chunk.js').replaceAll('\\', '/');
    const isVendor = /vendor|node_modules|chunks?\/vendor/i.test(normalizedFile);
    const origin = isVendor ? 'vendor' : 'app';

    let sources = [];
    let vendorPackages = [];
    const mapCandidates = [
      fullFilePath ? fullFilePath + '.map' : null,
      filename ? filename + '.map' : null
    ].filter(Boolean);

    for (const mapPath of mapCandidates) {
      try {
        if (fs.existsSync(mapPath)) {
          const mapContent = fs.readFileSync(mapPath, 'utf-8');
          const parsed = JSON.parse(mapContent);
          if (Array.isArray(parsed.sources)) {
            sources = parsed.sources;
            const pkgs = new Set();
            for (const s of sources) {
              const m = s.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
              if (m) pkgs.add(m[1]);
            }
            vendorPackages = Array.from(pkgs);
            break;
          }
        }
      } catch {}
    }

    const addFinding = (featureKey, name, type, compatOverride = null, customSupport = null) => {
      if (findings.has(featureKey)) return;
      let support = customSupport;
      let description = name;

      if (!support) {
        let compat = compatOverride;
        if (!compat) {
          const bcdPath = featureKey.startsWith('javascript.') || featureKey.startsWith('api.')
            ? featureKey.replace(/^(javascript|api)\./, '')
            : featureKey;
          const category = featureKey.startsWith('api.') ? 'api' : 'javascript';
          compat = this.compatDb.lookup(category, bcdPath);
        }
        if (compat) {
          support = this.compatDb.getSupportMatrix(compat);
          description = compat.description || name;
        }
      }

      if (support) {
        findings.set(featureKey, {
          featureKey,
          name,
          category: type,
          origin,
          sources: sources.slice(0, 5),
          vendorPackages,
          support,
          file: filename,
          description
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
      try {
        ast = acorn.parse(code, {
          ...parseOpts,
          sourceType: 'script'
        });
      } catch {
        return [];
      }
    }

    // --- Lexical Scope & Polyfill / Guard Tracking ---
    const polyfilledFeatures = new Set();

    function extractBindings(pattern, set) {
      if (!pattern) return;
      if (pattern.type === 'Identifier') set.add(pattern.name);
      else if (pattern.type === 'AssignmentPattern') extractBindings(pattern.left, set);
      else if (pattern.type === 'RestElement') extractBindings(pattern.argument, set);
      else if (pattern.type === 'ArrayPattern') {
        for (const el of pattern.elements) if (el) extractBindings(el, set);
      } else if (pattern.type === 'ObjectPattern') {
        for (const prop of pattern.properties) {
          if (prop.type === 'Property') extractBindings(prop.value, set);
          else if (prop.type === 'RestElement') extractBindings(prop.argument, set);
        }
      }
    }

    function createScope(parent = null, isFunction = false) {
      return {
        bindings: new Set(),
        guards: new Set(parent ? parent.guards : []),
        inTryBlock: parent ? Boolean(parent.inTryBlock) : false,
        parent,
        isFunction
      };
    }

    function addVar(scope, name) {
      let s = scope;
      while (s.parent && !s.isFunction) s = s.parent;
      s.bindings.add(name);
    }

    function isBound(scope, name) {
      let s = scope;
      while (s) {
        if (s.bindings.has(name)) return true;
        s = s.parent;
      }
      return false;
    }

    function isGuarded(scope, name) {
      let s = scope;
      while (s) {
        if (s.inTryBlock || s.guards?.has(name)) return true;
        s = s.parent;
      }
      return false;
    }

    function addTargetNames(expr, set) {
      if (!expr) return;
      if (expr.type === 'Identifier') {
        set.add(expr.name);
      } else if (expr.type === 'MemberExpression' && expr.property?.name) {
        set.add(expr.property.name);
        if (expr.object?.name) set.add(`${expr.object.name}.${expr.property.name}`);
      } else if (expr.type === 'Literal' && typeof expr.value === 'string') {
        set.add(expr.value);
      }
    }

    function extractGuardedNames(node) {
      const names = new Set();
      if (!node) return names;

      if (node.type === 'LogicalExpression' && node.operator === '&&') {
        for (const n of extractGuardedNames(node.left)) names.add(n);
        for (const n of extractGuardedNames(node.right)) names.add(n);
      } else if (node.type === 'UnaryExpression' && node.operator === 'typeof') {
        addTargetNames(node.argument, names);
      } else if (node.type === 'BinaryExpression') {
        if (node.operator === 'in') {
          addTargetNames(node.left, names);
        } else {
          const unary = (node.left?.type === 'UnaryExpression' && node.left.operator === 'typeof') ? node.left.argument
            : ((node.right?.type === 'UnaryExpression' && node.right.operator === 'typeof') ? node.right.argument : null);
          if (unary) addTargetNames(unary, names);
        }
      } else {
        addTargetNames(node, names);
      }
      return names;
    }

    // Pass 1: Walk to detect polyfill definitions
    walk.simple(ast, {
      AssignmentExpression(node) {
        // window.X = ... or globalThis.X = ...
        if (node.left.type === 'MemberExpression') {
          const obj = node.left.object;
          const prop = node.left.property;
          const propName = prop?.name;
          if (obj.type === 'Identifier' && ['window', 'globalThis', 'self'].includes(obj.name) && propName) {
            polyfilledFeatures.add(propName);
            polyfilledFeatures.add('api.' + propName);
          } else if (obj.type === 'Identifier' && obj.name === 'Object' && propName) {
            polyfilledFeatures.add('javascript.builtins.Object.' + propName);
          } else if (obj.type === 'MemberExpression' && obj.property?.name === 'prototype' && propName) {
            polyfilledFeatures.add('prototype.' + propName);
            polyfilledFeatures.add(propName);
          }
        }
      }
    });

    // Pass 2: Recursive walk with lexical scopes to detect actual unprotected usages
    const visitors = {
      Program(node, scope, c) {
        for (const stmt of node.body) {
          if (stmt.type === 'FunctionDeclaration' && stmt.id) {
            scope.bindings.add(stmt.id.name);
          } else if (stmt.type === 'ImportDeclaration') {
            for (const spec of stmt.specifiers) {
              scope.bindings.add(spec.local.name);
            }
          }
        }
        for (const stmt of node.body) c(stmt, scope);
      },
      FunctionDeclaration(node, scope, c) {
        if (node.id) scope.bindings.add(node.id.name);
        const fnScope = createScope(scope, true);
        for (const param of node.params) extractBindings(param, fnScope.bindings);
        c(node.body, fnScope);
      },
      FunctionExpression(node, scope, c) {
        const fnScope = createScope(scope, true);
        if (node.id) fnScope.bindings.add(node.id.name);
        for (const param of node.params) extractBindings(param, fnScope.bindings);
        c(node.body, fnScope);
      },
      ArrowFunctionExpression(node, scope, c) {
        const fnScope = createScope(scope, true);
        for (const param of node.params) extractBindings(param, fnScope.bindings);
        c(node.body, fnScope);
      },
      BlockStatement(node, scope, c) {
        const blockScope = createScope(scope, false);
        for (const stmt of node.body) {
          if (stmt.type === 'FunctionDeclaration' && stmt.id) {
            blockScope.bindings.add(stmt.id.name);
          }
        }
        for (const stmt of node.body) c(stmt, blockScope);
      },
      IfStatement(node, scope, c) {
        const guarded = extractGuardedNames(node.test);
        const condScope = createScope(scope, false);
        for (const g of guarded) condScope.guards.add(g);
        c(node.test, condScope);
        c(node.consequent, condScope);
        if (node.alternate) {
          const elseScope = createScope(scope, false);
          c(node.alternate, elseScope);
        }
      },
      TryStatement(node, scope, c) {
        const tryScope = createScope(scope, false);
        tryScope.inTryBlock = true;
        c(node.block, tryScope);
        if (node.handler) c(node.handler, scope);
        if (node.finalizer) c(node.finalizer, scope);
      },
      UnaryExpression(node, scope, c) {
        if (node.operator === 'typeof' && node.argument?.type === 'Identifier') {
          // typeof X never throws ReferenceError and should not trigger Identifier visit
          return;
        }
        c(node.argument, scope);
      },
      BinaryExpression(node, scope, c) {
        if (node.operator === 'in' && node.left?.type === 'Literal') {
          c(node.right, scope);
          return;
        }
        c(node.left, scope);
        c(node.right, scope);
      },
      VariableDeclaration(node, scope, c) {
        for (const decl of node.declarations) {
          const names = new Set();
          extractBindings(decl.id, names);
          for (const name of names) {
            if (node.kind === 'var') addVar(scope, name);
            else scope.bindings.add(name);
          }
          if (decl.init) c(decl.init, scope);
        }
      },
      CatchClause(node, scope, c) {
        const catchScope = createScope(scope, false);
        if (node.param) extractBindings(node.param, catchScope.bindings);
        c(node.body, catchScope);
      },
      ClassDeclaration(node, scope, c) {
        if (node.id) scope.bindings.add(node.id.name);
        if (node.superClass) c(node.superClass, scope);
        c(node.body, scope);
      },

      // --- Modern Syntax Features ---
      ChainExpression(node, scope, c) {
        addFinding('javascript.operators.optional_chaining', 'Optional chaining (?.)', 'syntax');
        c(node.expression, scope);
      },
      LogicalExpression(node, scope, c) {
        if (node.operator === '??') {
          addFinding('javascript.operators.nullish_coalescing', 'Nullish coalescing (??)', 'syntax');
        }
        if (node.operator === '&&') {
          const leftGuards = extractGuardedNames(node.left);
          const leftScope = createScope(scope, false);
          for (const g of leftGuards) leftScope.guards.add(g);
          c(node.left, leftScope);

          const rightScope = createScope(scope, false);
          for (const g of leftGuards) rightScope.guards.add(g);
          c(node.right, rightScope);
        } else {
          c(node.left, scope);
          c(node.right, scope);
        }
      },
      AssignmentExpression(node, scope, c) {
        if (node.operator === '??=') {
          addFinding('javascript.operators.nullish_coalescing_assignment', 'Nullish coalescing assignment (??=)', 'syntax');
        } else if (node.operator === '||=') {
          addFinding('javascript.operators.logical_or_assignment', 'Logical OR assignment (||=)', 'syntax');
        } else if (node.operator === '&&=') {
          addFinding('javascript.operators.logical_and_assignment', 'Logical AND assignment (&&=)', 'syntax');
        }
        c(node.left, scope);
        c(node.right, scope);
      },
      PrivateIdentifier() {
        addFinding('javascript.classes.private_class_fields', 'Private class fields (#field)', 'syntax');
      },
      StaticBlock(node, scope, c) {
        addFinding('javascript.classes.static_initialization_blocks', 'Static initialization blocks', 'syntax');
        c(node.body, scope);
      },
      BigIntLiteral() {
        addFinding('javascript.builtins.BigInt', 'BigInt literals (123n)', 'syntax');
      },
      ImportExpression(node, scope, c) {
        addFinding('javascript.operators.import', 'Dynamic import()', 'syntax');
        c(node.source, scope);
      },

      // --- Member Expressions (Static & Prototype & crypto.randomUUID) ---
      MemberExpression(node, scope, c) {
        c(node.object, scope);
        if (node.computed) c(node.property, scope);

        const propName = node.property?.name;
        if (!propName) return;

        // window.X, globalThis.X, self.X
        if (node.object?.type === 'Identifier' && ['window', 'globalThis', 'self'].includes(node.object.name)) {
          const globalEntry = compatDb.lookupGlobal(propName);
          if (globalEntry) {
            if (!isGuarded(scope, propName) && !polyfilledFeatures.has(propName) && !polyfilledFeatures.has('api.' + propName)) {
              addFinding(globalEntry.featureKey, globalEntry.name, 'api', globalEntry.compat, globalEntry.support);
            }
            return;
          }
        }

        // crypto.randomUUID or window.crypto.randomUUID
        const isCrypto = (node.object?.name === 'crypto') ||
          (node.object?.type === 'MemberExpression' && node.object.property?.name === 'crypto');
        if (isCrypto && propName === 'randomUUID') {
          if (!isGuarded(scope, 'randomUUID') && !polyfilledFeatures.has('randomUUID')) {
            addFinding('api.Crypto.randomUUID', 'crypto.randomUUID()', 'api');
          }
          return;
        }

        // Static built-in methods: Object.hasOwn, Promise.withResolvers, etc.
        const objName = node.object?.name;
        if (objName) {
          const staticEntry = compatDb.lookupStatic(objName, propName);
          if (staticEntry) {
            const qualifiedName = `${objName}.${propName}`;
            if (!isGuarded(scope, propName) && !isGuarded(scope, qualifiedName) && !polyfilledFeatures.has(staticEntry.featureKey)) {
              addFinding(staticEntry.featureKey, staticEntry.name, 'builtin', staticEntry.compat, staticEntry.support);
            }
            return;
          }
        }

        // Prototype methods: .at(), .replaceAll(), .findLast(), .toSorted(), .union(), etc.
        const protoEntry = compatDb.lookupPrototype(propName);
        if (protoEntry) {
          if (!isGuarded(scope, propName) &&
              !polyfilledFeatures.has(protoEntry.featureKey) &&
              !polyfilledFeatures.has('prototype.' + propName) &&
              !polyfilledFeatures.has(propName)) {
            addFinding(protoEntry.featureKey, protoEntry.name, 'prototype', protoEntry.compat, protoEntry.support);
          }
        }
      },

      // --- Object Properties (skip keys unless computed) ---
      Property(node, scope, c) {
        if (node.computed) c(node.key, scope);
        c(node.value, scope);
      },

      // --- Unbound Global Identifiers ---
      Identifier(node, scope) {
        const name = node.name;
        if (isBound(scope, name)) return;
        if (isGuarded(scope, name) || polyfilledFeatures.has(name) || polyfilledFeatures.has('api.' + name)) return;

        const globalEntry = compatDb.lookupGlobal(name);
        if (globalEntry) {
          addFinding(globalEntry.featureKey, globalEntry.name, 'api', globalEntry.compat, globalEntry.support);
        }
      }
    };

    walk.recursive(ast, createScope(null, true), visitors);
    return Array.from(findings.values());
  }
}
