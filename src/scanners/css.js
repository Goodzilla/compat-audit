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

    const addFinding = (featureKey, name, type) => {
      if (findings.has(featureKey)) return;
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

    return Array.from(findings.values());
  }
}
