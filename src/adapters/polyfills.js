import vm from 'node:vm';

/**
 * Creates a tolerant browser-like sandbox for executing bundle chunks safely in node:vm
 */
export function createTolerantSandbox(overrides = {}) {
  const dummyElement = {
    addEventListener: () => {},
    removeEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: (c) => c,
    removeChild: (c) => c,
    style: {},
    classList: { add: () => {}, remove: () => {}, contains: () => false }
  };

  const domProxy = new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createElement' || prop === 'querySelector' || prop === 'getElementById') {
        return () => dummyElement;
      }
      if (prop === 'querySelectorAll' || prop === 'getElementsByTagName') {
        return () => [];
      }
      return () => {};
    }
  });

  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
    setTimeout: (fn) => typeof fn === 'function' && fn(),
    clearTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {},
    document: domProxy,
    navigator: { userAgent: 'Mozilla/5.0 (compat-audit)' },
    location: { href: 'http://localhost/', pathname: '/', search: '' },
    history: { pushState: () => {}, replaceState: () => {} },
    crypto: {
      getRandomValues: (arr) => arr
    },
    requestAnimationFrame: (fn) => typeof fn === 'function' && fn(0),
    cancelAnimationFrame: () => {},
    ...overrides
  };

  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  return vm.createContext(sandbox);
}

/**
 * Neutralizes ESM import/export statements for safe execution as VM script
 */
export function prepareScriptForVm(code) {
  return code
    .replace(/^\s*import\s+[^;]+;?/gm, '// [compat-audit import stub]')
    .replace(/^\s*export\s+default\s+/gm, '/* export default */ ')
    .replace(/^\s*export\s*\{[^}]*\}\s*;?/gm, '// [compat-audit export stub]')
    .replace(/^\s*export\s+(const|let|var|function|class)\s+/gm, '$1 ');
}

/**
 * Detects runtime polyfills by evaluating bundle chunks in an isolated node:vm sandbox
 * and checking whether methods are restored or references changed from native V8 implementations.
 */
export function detectRuntimePolyfillsInVm(code, filename = 'chunk.js', compatDb = null) {
  const verifiedPolyfills = new Map();
  if (!compatDb) return verifiedPolyfills;

  try {
    const sandbox = createTolerantSandbox();

    // Retrieve constructors that belong exclusively to the isolated VM context
    const vmArray = vm.runInContext('Array', sandbox);
    const vmString = vm.runInContext('String', sandbox);
    const vmObject = vm.runInContext('Object', sandbox);
    const vmPromise = vm.runInContext('Promise', sandbox);
    const vmUint8Array = vm.runInContext('typeof Uint8Array !== "undefined" ? Uint8Array : null', sandbox);

    const trackedPrototypes = [
      { name: 'Array', proto: vmArray?.prototype },
      { name: 'String', proto: vmString?.prototype },
      { name: 'Object', proto: vmObject?.prototype },
      { name: 'Promise', proto: vmPromise?.prototype },
      { name: 'Uint8Array', proto: vmUint8Array?.prototype }
    ].filter(t => Boolean(t.proto));

    const originalRefs = new Map();

    // 1. Snapshot and delete methods in isolated VM context to simulate legacy target browser
    for (const [propName] of compatDb.indexedPrototypeMethods.entries()) {
      for (const t of trackedPrototypes) {
        const key = `${t.name}.prototype.${propName}`;
        const ref = t.proto[propName];
        originalRefs.set(key, ref);
        try {
          delete t.proto[propName];
        } catch {}
      }
    }

    const trackedBuiltins = {
      Object: vmObject,
      Array: vmArray,
      Uint8Array: vmUint8Array,
      Promise: vmPromise
    };

    for (const [fullName] of compatDb.indexedStaticMethods.entries()) {
      const [builtinName, methodName] = fullName.split('.');
      const builtin = trackedBuiltins[builtinName];
      if (builtin) {
        const key = `${builtinName}.${methodName}`;
        const ref = builtin[methodName];
        originalRefs.set(key, ref);
        try {
          delete builtin[methodName];
        } catch {}
      }
    }

    for (const [globalName] of compatDb.indexedGlobals.entries()) {
      const key = `api.${globalName}`;
      const ref = sandbox[globalName];
      originalRefs.set(key, ref);
      try {
        delete sandbox[globalName];
      } catch {}
    }

    if (sandbox.crypto) {
      originalRefs.set('api.Crypto.randomUUID', sandbox.crypto.randomUUID);
      try {
        delete sandbox.crypto.randomUUID;
      } catch {}
    }

    // 2. Execute script in the isolated VM sandbox
    const preparedCode = prepareScriptForVm(code);
    try {
      vm.runInContext(preparedCode, sandbox, {
        filename,
        timeout: 500
      });
    } catch {
      // Tolerate partial execution failures (e.g. app side effects)
    }

    // 3. Inspect references and mutations post-execution in the VM
    const isPolyfilled = (currentRef, origRef) => {
      if (typeof currentRef !== 'function') return false;
      return !origRef || currentRef !== origRef || !String(currentRef).includes('[native code]');
    };

    for (const [propName, entry] of compatDb.indexedPrototypeMethods.entries()) {
      for (const t of trackedPrototypes) {
        const key = `${t.name}.prototype.${propName}`;
        const currentRef = t.proto[propName];
        const origRef = originalRefs.get(key);

        if (isPolyfilled(currentRef, origRef)) {
          verifiedPolyfills.set(entry.featureKey, {
            featureKey: entry.featureKey,
            name: entry.name,
            category: 'prototype',
            originChunk: filename,
            runtimeVerified: true
          });
          break;
        }
      }
    }

    for (const [fullName, entry] of compatDb.indexedStaticMethods.entries()) {
      const [builtinName, methodName] = fullName.split('.');
      const builtin = trackedBuiltins[builtinName];
      if (builtin) {
        const key = `${builtinName}.${methodName}`;
        const currentRef = builtin[methodName];
        const origRef = originalRefs.get(key);

        if (isPolyfilled(currentRef, origRef)) {
          verifiedPolyfills.set(entry.featureKey, {
            featureKey: entry.featureKey,
            name: entry.name,
            category: 'builtin',
            originChunk: filename,
            runtimeVerified: true
          });
        }
      }
    }

    for (const [globalName, entry] of compatDb.indexedGlobals.entries()) {
      const key = `api.${globalName}`;
      const currentRef = sandbox[globalName];
      const origRef = originalRefs.get(key);

      if (isPolyfilled(currentRef, origRef)) {
        verifiedPolyfills.set(entry.featureKey, {
          featureKey: entry.featureKey,
          name: entry.name,
          category: 'api',
          originChunk: filename,
          runtimeVerified: true
        });
      }
    }

    if (sandbox.crypto && isPolyfilled(sandbox.crypto.randomUUID, originalRefs.get('api.Crypto.randomUUID'))) {
      verifiedPolyfills.set('api.Crypto.randomUUID', {
        featureKey: 'api.Crypto.randomUUID',
        name: 'crypto.randomUUID()',
        category: 'api',
        originChunk: filename,
        runtimeVerified: true
      });
    }
  } catch {}

  return verifiedPolyfills;
}
