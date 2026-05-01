import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  // 通用
  {
    ignores: ['dist/**', 'node_modules/**', 'data/**'],
  },

  // 源码：浏览器/扩展环境
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions, // Chrome extension API
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // 允许使用 console
      // TODO:  打包时删除 console.log
      'no-console': 'off',
    },
  },

  // 构建/脚本: node 环境
  {
    files: ['*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // 关闭与 prettier 冲突的规则
  prettier,
];
