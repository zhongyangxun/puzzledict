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

  let response = null;
  try {
    // { status, message, data } object so the UI can stop loading and show a helpful message.
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': clientId,
      },
      signal: AbortSignal.timeout(3000), // 3s 超时
      body: JSON.stringify({ lookup_key: text }),
    });
  } catch (error) {
    console.error('请求超时', error);
    return {
      status: 504,
      message: '请求超时，请稍后再试',
      data: null,
    };
  }

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
