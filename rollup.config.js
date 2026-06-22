import copy from 'rollup-plugin-copy';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import { rmSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

const terserPlugin = isProd
  ? terser({
      compress: {
        drop_console: ['log', 'info'],
      },
    })
  : null;

function htmlPlugin() {
  return {
    name: 'html-string',
    transform(code, id) {
      if (id.endsWith('.html')) {
        return `export default ${JSON.stringify(code)}`;
      }
    },
  };
}

function cleanPlugin(dir) {
  let cleaned = false;
  return {
    name: 'clean',
    buildStart() {
      if (!cleaned) {
        rmSync(dir, { recursive: true, force: true });
        console.log(`clean-plugin: cleaned ${dir}`);
        cleaned = true;
      }
    },
  };
}

function watchFilesPlugin(files) {
  return {
    name: 'watch-files',
    buildStart() {
      for (const file of files) {
        this.addWatchFile(file);
        console.log(`watch-files: ${file} added`);
      }
    },
  };
}

export default [
  {
    input: 'src/content/index.js',
    output: {
      file: 'dist/content.js',
      format: 'iife',
      sourcemap: true,
    },
    plugins: [htmlPlugin(), cleanPlugin('dist'), terserPlugin],
  },
  {
    input: 'src/background/index.js',
    output: {
      file: 'dist/background.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      copy({
        targets: [
          {
            src: 'manifest.json',
            dest: 'dist',
          },
          {
            src: 'popup.html',
            dest: 'dist',
          },
          // JSON 数据压缩复制（去掉缩进和空白）
          {
            src: [
              'data/high_freq_words.json',
              'data/reverse_index.json',
              'data/word_roots.json',
            ],
            dest: 'dist/data',
            transform: (contents) => JSON.stringify(JSON.parse(contents)),
          },
        ],
        hook: 'buildStart',
      }),
      replace({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        'process.env.REQUEST_SIGNATURE_SECRET': JSON.stringify(
          process.env.REQUEST_SIGNATURE_SECRET,
        ),
        // 防止变量被替换
        preventAssignment: true,
      }),
      terserPlugin,
      watchFilesPlugin(['popup.html']),
    ],
  },
];
