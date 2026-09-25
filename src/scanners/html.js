import * as htmlparser2 from 'htmlparser2';

/**
 * HTML Scanner targeting modern HTML elements and attributes
 */
export class HtmlScanner {
  constructor(compatDb) {
    this.compatDb = compatDb;
  }

  scan(code, filename = 'index.html') {
    const findings = new Map();

    const addFinding = (featureKey, name, type) => {
      if (findings.has(featureKey)) return;
      const bcdPath = featureKey.startsWith('html.') ? featureKey.replace(/^html\./, '') : featureKey;
      const compat = this.compatDb.lookup('html', bcdPath);
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

    const parser = new htmlparser2.Parser({
      onopentag(name, attribs) {
        const tag = name.toLowerCase();

        if (tag === 'dialog') {
          addFinding('html.elements.dialog', '<dialog> element', 'element');
        } else if (tag === 'search') {
          addFinding('html.elements.search', '<search> element', 'element');
        }

        if (attribs.popover !== undefined) {
          addFinding('html.global_attributes.popover', 'popover attribute', 'attribute');
        }

        if (attribs.loading === 'lazy') {
          addFinding('html.elements.img.loading', 'loading="lazy" native image lazy-loading', 'attribute');
        }
      }
    });

    parser.write(code);
    parser.end();

    return Array.from(findings.values());
  }
}
