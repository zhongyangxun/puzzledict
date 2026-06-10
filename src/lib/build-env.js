// 仅此文件引用 process：Rollup @rollup/plugin-replace 会把 process.env.xxx 内联为字面量
export const IS_DEV = process.env.NODE_ENV === 'development';

export const REQUEST_SIGNATURE_SECRET = process.env.REQUEST_SIGNATURE_SECRET;

if (!process.env.REQUEST_SIGNATURE_SECRET) {
  console.warn('REQUEST_SIGNATURE_SECRET 未设置，API 请求将失败');
}
