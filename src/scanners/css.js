import * as csstree from 'css-tree';

/**
 * CSS AST Scanner targeting modern selectors, at-rules, and CSS properties
 */
export class CssScanner {
  constructor(compatDb) {
    this.compatDb = compatDb;
  }

  scan(code, filename = 'chunk.css') {
    const findings = new Map();

    const addFinding = (featureKey, name, type, customSupport = null) => {
      if (findings.has(featureKey)) return;
      if (customSupport) {
        findings.set(featureKey, {
          featureKey,
          name,
          category: type,
          support: customSupport,
          file: filename,
          description: name
        });
        return;
      }
      const bcdPath = featureKey.startsWith('css.') ? featureKey.replace(/^css\./, '') : featureKey;
      const compat = this.compatDb.lookup('css', bcdPath);
      if (compat) {
        const support = this.compatDb.getSupportMatrix(compat);
        findings.set(featureKey, {
          featureKey,
          name,
          category: type,
          support,
          file: filename,
          description: compat.description || name
        });
      }
    };

    let ast;
    try {
      ast = csstree.parse(code, {
        parseAtrulePrelude: true,
        parseRulePrelude: true,
        parseValue: true,
        parseCustomProperty: false
      });
    } catch {
      return [];
    }

    csstree.walk(ast, {
      visit: 'PseudoClassSelector',
      enter(node) {
        const name = node.name.toLowerCase();
        if (name === 'has') {
          addFinding('css.selectors.has', ':has() relational pseudo-class', 'selector');
        } else if (name === 'is') {
          addFinding('css.selectors.is', ':is() pseudo-class', 'selector');
        } else if (name === 'where') {
          addFinding('css.selectors.where', ':where() pseudo-class', 'selector');
        } else if (name === 'focus-visible') {
          addFinding('css.selectors.focus-visible', ':focus-visible pseudo-class', 'selector');
        }
      }
    });

    csstree.walk(ast, {
      visit: 'Atrule',
      enter(node) {
        const name = node.name.toLowerCase();
        if (name === 'container') {
          addFinding('css.at-rules.container', '@container container queries', 'at-rule');
        } else if (name === 'layer') {
          addFinding('css.at-rules.layer', '@layer cascade layers', 'at-rule');
        } else if (name === 'starting-style') {
          addFinding('css.at-rules.starting-style', '@starting-style entry transitions', 'at-rule');
        } else if (name === 'scope') {
          addFinding('css.at-rules.scope', '@scope scoping rules', 'at-rule');
        }
      }
    });

    csstree.walk(ast, {
      visit: 'Declaration',
      enter(node) {
        const property = node.property.toLowerCase();

        if (property === 'aspect-ratio') {
          addFinding('css.properties.aspect-ratio', 'aspect-ratio property', 'property');
        } else if (property === 'accent-color') {
          addFinding('css.properties.accent-color', 'accent-color property', 'property');
        }

        // Look inside value for modern functions
        if (node.value) {
          csstree.walk(node.value, {
            visit: 'Function',
            enter(funcNode) {
              const func = funcNode.name.toLowerCase();
              if (func === 'color-mix') {
                addFinding('css.types.color.color-mix', 'color-mix() function', 'color');
              } else if (func === 'light-dark') {
                addFinding('css.types.color.light-dark', 'light-dark() color function', 'color');
              } else if (func === 'oklch') {
                addFinding('css.types.color.oklch', 'oklch() color function', 'color');
              } else if (func === 'oklab') {
                addFinding('css.types.color.oklab', 'oklab() color function', 'color');
              }
            }
          });

          csstree.walk(node.value, {
            visit: 'Identifier',
            enter(identNode) {
              if (identNode.name.toLowerCase() === 'subgrid') {
                addFinding('css.properties.grid-template-columns.subgrid', 'CSS Subgrid', 'layout');
              }
            }
          });
        }
      }
    });

    csstree.walk(ast, {
      visit: 'NestingSelector',
      enter() {
        addFinding('css.selectors.nesting', 'Native CSS Nesting (&)', 'selector');
      }
    });

    // Safari & WebKit visual quirks static detection
    csstree.walk(ast, {
      visit: 'Rule',
      enter(ruleNode) {
        const declProps = new Set();
        const declValues = new Map();

        if (ruleNode.block && ruleNode.block.children) {
          ruleNode.block.children.forEach(child => {
            if (child.type === 'Declaration') {
              const prop = child.property.toLowerCase();
              declProps.add(prop);
              if (child.value) {
                const valStr = csstree.generate(child.value).toLowerCase();
                declValues.set(prop, valStr);
              }
            }
          });
        }

        // 1. Missing -webkit-backdrop-filter
        if (declProps.has('backdrop-filter') && !declProps.has('-webkit-backdrop-filter')) {
          addFinding(
            'safari.css.backdrop-filter-prefix',
            'Missing -webkit-backdrop-filter prefix (Safari < 18 breaks backdrop-filter)',
            'safari-quirk',
            { chrome: 76, safari: 18, firefox: 103, edge: 76, ios_saf: 18, chrome_android: 76, samsung: 12.0 }
          );
        }

        // 2. 100vh height without dvh/svh
        for (const [prop, val] of declValues) {
          if ((prop === 'height' || prop === 'min-height') && val.includes('100vh') && !val.includes('100dvh') && !val.includes('100svh')) {
            addFinding(
              'safari.css.100vh-viewport',
              '100vh height without dvh fallback (iOS Safari address bar resize bug)',
              'safari-quirk',
              { chrome: 108, safari: 15.4, firefox: 101, edge: 108, ios_saf: 15.4, chrome_android: 108, samsung: 21.0 }
            );
          }
        }

        // 3. aspect-ratio on flex items without min-width: 0
        if (declProps.has('aspect-ratio') && !declProps.has('min-width') && !declProps.has('min-height')) {
          if (declProps.has('flex') || declProps.has('flex-basis') || declProps.has('flex-grow')) {
            addFinding(
              'safari.css.aspect-ratio-flex',
              'aspect-ratio on flex items without min-width: 0 (WebKit flexbox layout blowout)',
              'safari-quirk',
              { chrome: 88, safari: 15.4, firefox: 89, edge: 88, ios_saf: 15.4, chrome_android: 88, samsung: 15.0 }
            );
          }
        }

        // 4. position: sticky combined with overflow
        if (declValues.get('position') === 'sticky' && (declProps.has('overflow') || declProps.has('overflow-x') || declProps.has('overflow-y'))) {
          addFinding(
            'safari.css.sticky-overflow-trap',
            'position: sticky combined with overflow property (WebKit sticky clip trap)',
            'safari-quirk',
            { chrome: 56, safari: 13, firefox: 59, edge: 16, ios_saf: 13, chrome_android: 56, samsung: 6.0 }
          );
        }

        // 5. line-clamp missing -webkit-line-clamp
        if (declProps.has('line-clamp') && (!declProps.has('-webkit-line-clamp') || !declProps.has('-webkit-box-orient'))) {
          addFinding(
            'safari.css.line-clamp-prefix',
            'line-clamp missing -webkit-line-clamp and -webkit-box-orient (WebKit multi-line truncation)',
            'safari-quirk',
            { chrome: 14, safari: 5, firefox: 68, edge: 79, ios_saf: 5, chrome_android: 18, samsung: 1.0 }
          );
        }

        // 6. Form control styled without -webkit-appearance: none
        const selStr = ruleNode.prelude ? csstree.generate(ruleNode.prelude).toLowerCase() : '';
        if (/\b(input|select|button|textarea)\b/.test(selStr) && (declProps.has('background') || declProps.has('background-color') || declProps.has('border') || declProps.has('border-radius'))) {
          if (!declProps.has('-webkit-appearance') && !declProps.has('appearance')) {
            addFinding(
              'safari.css.appearance-none',
              'Custom form control missing -webkit-appearance: none (iOS Safari native gradient/border)',
              'safari-quirk',
              { chrome: 84, safari: 15.4, firefox: 80, edge: 84, ios_saf: 15.4, chrome_android: 84, samsung: 14.0 }
            );
          }
        }

        // 7. Root text-size-adjust
        if ((selStr === ':root' || selStr === 'html' || selStr === 'body') && declProps.has('text-size-adjust') && !declProps.has('-webkit-text-size-adjust')) {
          addFinding(
            'safari.css.text-size-adjust',
            'Missing -webkit-text-size-adjust: 100% (iOS Safari landscape font scaling)',
            'safari-quirk',
            { chrome: 54, safari: 13, firefox: 1, edge: 79, ios_saf: 13, chrome_android: 54, samsung: 6.0 }
          );
        }
      }
    });

    return Array.from(findings.values());
  }
}
