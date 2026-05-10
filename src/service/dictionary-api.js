import { getCache, setCache } from './cache';

const API_URL = 'http://127.0.0.1:8789/lookup';

export async function queryDictionary(text, clientId) {
  const cache = await getCache(text);
  if (cache) {
    return {
      status: 200,
      message: '查询成功',
      data: cache,
    };
  }

  // TODO(rate-limit): handle network errors (fetch throws) and always return a structured
  // { status, message, data } object so the UI can stop loading and show a helpful message.
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': clientId,
    },
    body: JSON.stringify({ lookup_key: text }),
  });

  const { status } = response;

  if (status !== 200) {
    return {
      status,
      message: getMessage(status),
      data: null,
    };
  }

  const data = await response.json();
  await setCache(text, data);

  return {
    status,
    message: getMessage(status),
    data,
  };
}

function getMessage(status) {
  switch (status) {
    case 200:
      return '查询成功';
    case 429:
      return '请求过于频繁，请稍后再试';
    default:
      // TODO(rate-limit): distinguish 5xx from not-found (avoid misleading "未找到该单词" on server errors).
      return '未找到该单词';
  }
}
