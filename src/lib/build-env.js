// 仅此文件引用 process：Rollup @rollup/plugin-replace 会把 process.env.NODE_ENV 内联为字面量
export const IS_DEV = process.env.NODE_ENV === 'development';
