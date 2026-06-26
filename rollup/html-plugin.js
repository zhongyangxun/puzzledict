import { createHash } from 'node:crypto';
import { relative } from 'node:path';

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

export const htmlPlugin = () => {
  return {
    name: 'html-string',
    transform(code, id) {
      if (!id.endsWith('.html')) {
        return;
      }

      let html = code;
      html = html.replace(
        /(<style>)([\s\S]*?)(<\/style>)/g,
        (_, open, css, close) =>
          open + prefixCssVars(css, makePrefix(id)) + close,
      );

      return {
        code: `export default ${JSON.stringify(html)}`,
        map: null,
      };
    },
  };
};
