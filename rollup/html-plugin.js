import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKENS_MARKER = '/* @tokens */';
const TOKENS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/shared/tokens.css',
);

export const readTokensCss = () => readFileSync(TOKENS_PATH, 'utf8');

/** Replace the `@tokens` marker comment with shared token CSS. */
export const injectTokens = (css) => {
  if (!css.includes(TOKENS_MARKER)) {
    return css;
  }
  return css.replaceAll(TOKENS_MARKER, readTokensCss());
};

const makePrefix = (filePath) => {
  const salt = relative(process.cwd(), filePath).replace(/\\/g, '/');
  const hash = createHash('sha256')
    .update(`puzzledict:${salt}`)
    .digest('hex')
    .slice(0, 4);
  return `pzd_${hash}`;
};

export const prefixCssVars = (css, prefix) => {
  const names = new Set();
  for (const m of css.matchAll(/(?<![\w-])--([\w-]+)\s*:/g)) {
    names.add(m[1]);
  }

  let out = css;
  const sortedNames = [...names].sort((a, b) => b.length - a.length);
  for (const name of sortedNames) {
    const prefixed = `--${prefix}_${name}`;
    out = out.replaceAll(`var(--${name}`, `var(${prefixed}`);
    out = out.replaceAll(`--${name}:`, `${prefixed}:`);
  }
  return out;
};

const processStyleBlock = (css, id) =>
  prefixCssVars(injectTokens(css), makePrefix(id));

export const htmlPlugin = () => {
  return {
    name: 'html-string',
    buildStart() {
      this.addWatchFile(TOKENS_PATH);
    },
    transform(code, id) {
      if (!id.endsWith('.html')) {
        return;
      }

      const html = code.replace(
        /(<style>)([\s\S]*?)(<\/style>)/g,
        (_, open, css, close) => open + processStyleBlock(css, id) + close,
      );

      return {
        code: `export default ${JSON.stringify(html)}`,
        map: null,
      };
    },
  };
};
