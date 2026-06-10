import { REQUEST_SIGNATURE_SECRET } from '../lib/build-env.js';
import {
  buildCanonicalV1,
  generateAbuseGuardSignV1,
} from './abuse-guard-sign.js';

export const REQUEST_TIMEOUT_MS = 3000;

/**
 * @param {string} url
 * @param {object} body
 * @param {object} options
 * @param {string} [options.clientId]
 * @param {number} [options.timeoutMs]
 * @param {boolean} [options.disableSignature]
 * @param {(ctx: { method: string, url: string, headers: Record<string, string>, body: string }) => void} [options.onRequest]
 */
export const postJson = async (
  url,
  body,
  {
    clientId,
    timeoutMs = REQUEST_TIMEOUT_MS,
    disableSignature = false,
    onRequest = () => null,
  },
) => {
  const parsedUrl = URL.parse(url);
  if (!parsedUrl) {
    throw new Error('Invalid URL');
  }

  if (!disableSignature && !REQUEST_SIGNATURE_SECRET) {
    return {
      status: 400,
      message: '请求签名密钥未配置',
      data: null,
    };
  }

  const method = 'POST';
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyStr = JSON.stringify(body);

  const signature = disableSignature
    ? null
    : await generateAbuseGuardSignV1(
        REQUEST_SIGNATURE_SECRET,
        buildCanonicalV1({
          method,
          path: parsedUrl.pathname,
          timestamp,
          clientId,
          body: bodyStr,
        }),
      );

  let response = null;
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Client-Id': clientId,
      ...(signature
        ? { 'X-Timestamp': timestamp, 'X-Signature': `v1=${signature}` }
        : {}),
    };

    onRequest?.({
      method,
      url,
      headers,
      body: bodyStr,
    });

    response = await fetch(url, {
      method,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      body: bodyStr,
    });

    return response;
  } catch (error) {
    if (error.name === 'TimeoutError') {
      console.error(`请求超时 (${timeoutMs}ms):`, url);
      return {
        status: 504,
        message: '请求超时，请稍后再试',
        data: null,
      };
    }

    console.error('请求异常:', error);
    return {
      status: 500,
      message: `请求失败: ${error.message}`,
      data: null,
    };
  }
};

/**
 * @description 返回的 `message` 字段不应包含任何代码逻辑报错信息，因为这里的错误信息是展示给用户看的
 * @param {Response} response
 * @param {(status: number) => string} getMessage
 * @returns {Promise<{ status: number, message: string, data: any }>}
 */
export async function parseJsonResponse(response, getMessage) {
  const { status } = response;
  if (status !== 200) {
    return {
      status,
      message: getMessage(status),
      data: null,
    };
  }
  const data = await response.json();
  return {
    status,
    message: getMessage(status),
    data,
  };
}
